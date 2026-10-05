import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/firestore'
import { onSchedule } from 'firebase-functions/scheduler'
import { defineSecret, defineString } from 'firebase-functions/params'
import { logger } from 'firebase-functions'
import { db } from './lib.js'
import { newToken } from './customers.js'
import { adminEmail, customerEmail, layout, restockEmail, WHATSAPP_TEMPLATES } from './templates.js'
import { escapeHtml } from './escape.js'

/*
 * Secrets: set with `firebase functions:secrets:set NAME`. Use the value "none" to switch a channel off.
 * RESEND_API_KEY  – https://resend.com (email)
 * WHATSAPP_TOKEN  – WhatsApp Cloud API permanent token
 */
const RESEND_API_KEY = defineSecret('RESEND_API_KEY')
const WHATSAPP_TOKEN = defineSecret('WHATSAPP_TOKEN')
const WHATSAPP_PHONE_ID = defineString('WHATSAPP_PHONE_ID', { default: '' })
const MAIL_FROM = defineString('MAIL_FROM', { default: 'THE MOOD <orders@themood.co>' })
const SITE_URL = defineString('SITE_URL', { default: 'https://themood.co' })

const secrets = [RESEND_API_KEY, WHATSAPP_TOKEN]
const usable = (v) => v && v !== 'none'

async function channels() {
  const s = (await db.doc('settings/store').get()).data() || {}
  return { email: true, whatsapp: false, adminEmail: s.contact?.email || '', adminWhatsapp: '', ...(s.notifications || {}) }
}

export async function sendEmail(to, { subject, html }) {
  const key = RESEND_API_KEY.value()
  if (!to || !usable(key)) return logger.info('email skipped', { to: Boolean(to), subject })
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM.value(), to: [to], subject, html }),
  })
  if (!res.ok) logger.error('email failed', { status: res.status, body: await res.text() })
}

/** Egyptian mobile numbers to WhatsApp's international format (2010…). */
const toWa = (phone) => {
  const d = String(phone || '').replace(/\D/g, '')
  if (d.startsWith('20')) return d
  if (d.startsWith('0')) return `2${d}`
  return d
}

export async function sendWhatsApp(phone, template) {
  const token = WHATSAPP_TOKEN.value()
  const phoneId = WHATSAPP_PHONE_ID.value()
  if (!phone || !template || !usable(token) || !phoneId) return logger.info('whatsapp skipped', { template: template?.name })
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: toWa(phone), type: 'template',
      template: { name: template.name, language: { code: 'en' }, components: [{ type: 'body', parameters: template.params.map((text) => ({ type: 'text', text: String(text) })) }] },
    }),
  })
  if (!res.ok) logger.error('whatsapp failed', { status: res.status, body: await res.text() })
}

async function notifyCustomer(order, status) {
  const ch = await channels()
  const site = SITE_URL.value()
  const mail = customerEmail(order, status, site)
  const jobs = []
  if (ch.email && mail && order.customer.email) jobs.push(sendEmail(order.customer.email, mail))
  if (ch.whatsapp && WHATSAPP_TEMPLATES[status]) jobs.push(sendWhatsApp(order.customer.phone, WHATSAPP_TEMPLATES[status](order, site)))
  await Promise.allSettled(jobs)
}

export const onOrderCreated = onDocumentCreated({ document: 'orders/{id}', secrets }, async (event) => {
  const order = event.data.data()
  const ch = await channels()
  const site = SITE_URL.value()
  await Promise.allSettled([
    notifyCustomer(order, 'pending'),
    ch.adminEmail && sendEmail(ch.adminEmail, adminEmail(order, site)),
    ch.adminWhatsapp && sendWhatsApp(ch.adminWhatsapp, { name: 'admin_new_order', params: [order.number, order.customer.name, `${order.total} EGP`] }),
  ])
})

export const onOrderUpdated = onDocumentUpdated({ document: 'orders/{id}', secrets }, async (event) => {
  const before = event.data.before.data()
  const after = event.data.after.data()
  if (before.status === after.status) return
  if (after.status === 'delivered' && !after.reviewToken) {
    after.reviewToken = newToken()
    await event.data.after.ref.update({ reviewToken: after.reviewToken })
  }
  await notifyCustomer(after, after.status)
})

/** When a sold-out variant comes back, email everyone who asked, then forget them. */
export const onProductRestock = onDocumentUpdated({ document: 'products/{id}', secrets }, async (event) => {
  const before = event.data.before.data()
  const after = event.data.after.data()
  if (after.status !== 'active') return
  const back = after.variants.filter((v) => v.stock > 0 && !(before.variants.find((b) => b.color === v.color && b.size === v.size)?.stock > 0))
  if (!back.length) return
  const alerts = await db.collection('restockAlerts').where('productId', '==', event.params.id).get()
  const site = SITE_URL.value()
  const product = { ...after, id: event.params.id }
  await Promise.allSettled(alerts.docs.map(async (d) => {
    const a = d.data()
    const match = back.some((v) => (!a.size || v.size === a.size) && (!a.color || v.color === a.color))
    if (!match) return
    await sendEmail(a.email, restockEmail(product, a.size, site))
    await d.ref.delete()
  }))
})

/** When a mood's first product goes live, tell people who wanted to know about the drop. */
export const onProductLive = onDocumentUpdated({ document: 'products/{id}', secrets }, async (event) => {
  const before = event.data.before.data()
  const after = event.data.after.data()
  if (before.status === 'active' || after.status !== 'active' || !after.moodId) return
  const alerts = await db.collection('restockAlerts').where('moodId', '==', after.moodId).get()
  const site = SITE_URL.value()
  await Promise.allSettled(alerts.docs.map(async (d) => {
    await sendEmail(d.data().email, restockEmail({ ...after, id: event.params.id }, '', site))
    await d.ref.delete()
  }))
})

/** Every morning (Cairo time): low-stock list to the store email. */
export const lowStockDigest = onSchedule({ schedule: '0 9 * * *', timeZone: 'Africa/Cairo', secrets }, async () => {
  const settings = (await db.doc('settings/store').get()).data() || {}
  const to = settings.notifications?.adminEmail || settings.contact?.email
  if (!to || settings.notifications?.lowStockDigest === false) return
  const at = settings.lowStock ?? 3
  const products = (await db.collection('products').where('status', '==', 'active').get()).docs.map((d) => d.data())
  const low = products.flatMap((p) => p.variants.filter((v) => v.stock <= at).map((v) => `<li>${escapeHtml(p.name)} · ${escapeHtml(v.color)} ${escapeHtml(v.size)}: <b>${v.stock}</b></li>`))
  if (!low.length) return
  const site = SITE_URL.value()
  await sendEmail(to, { subject: `${low.length} sizes running low`, html: layout({ site, title: 'Running low.', intro: `These sizes are at ${at} or fewer:`, body: `<ul>${low.join('')}</ul>`, cta: { href: `${site}/admin/inventory`, label: 'Open inventory' } }) })
})

/** Publishes products whose scheduled drop time has passed (checked every 15 minutes). */
export const publishScheduledDrops = onSchedule({ schedule: 'every 15 minutes', timeZone: 'Africa/Cairo' }, async () => {
  const now = Date.now()
  const due = await db.collection('products').where('status', '==', 'scheduled').where('publishAt', '<=', now).get()
  const batch = db.batch()
  due.docs.forEach((d) => batch.update(d.ref, { status: 'active', updatedAt: now }))
  if (!due.empty) await batch.commit()
})
