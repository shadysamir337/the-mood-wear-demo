import { escapeHtml as e } from './escape.js'

const money = (n) => `${Math.round(Number(n) || 0).toLocaleString('en-US')} EGP`

/** One quiet layout for every email: cream paper, serif wordmark, one message. */
export function layout({ title, intro, body = '', cta, site }) {
  return `<!doctype html><html><body style="margin:0;background:#ede8df;color:#111;font:15px/1.6 Georgia,serif">
  <div style="max-width:560px;margin:0 auto;padding:40px 28px">
    <p style="letter-spacing:.3em;font-size:13px;margin:0 0 36px">THE MOOD</p>
    <h1 style="font-weight:400;font-size:30px;line-height:1.15;margin:0 0 16px">${title}</h1>
    <p style="margin:0 0 24px">${intro}</p>
    ${body}
    ${cta ? `<p style="margin:32px 0"><a href="${e(cta.href)}" style="background:#111;color:#ede8df;padding:14px 26px;text-decoration:none;font:12px sans-serif;letter-spacing:.2em;text-transform:uppercase">${e(cta.label)}</a></p>` : ''}
    <p style="margin-top:48px;font:11px sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#8c8981">Wear what you feel · <a href="${e(site)}" style="color:#8c8981">${e(site.replace(/^https?:\/\//, ''))}</a></p>
  </div></body></html>`
}

export function itemsTable(o) {
  const rows = o.items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #d9d2c5">${e(i.qty)} × ${e(i.name)} <span style="color:#8c8981">${e(i.color)} · ${e(i.size)}</span></td><td style="text-align:right;border-bottom:1px solid #d9d2c5">${money(i.unitPrice * i.qty)}</td></tr>`).join('')
  return `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}
    ${o.discount ? `<tr><td style="padding:8px 0">Discount</td><td style="text-align:right">−${money(o.discount)}</td></tr>` : ''}
    <tr><td style="padding:8px 0">Shipping</td><td style="text-align:right">${o.shipping ? money(o.shipping) : 'Free'}</td></tr>
    <tr><td style="padding:8px 0"><b>Total</b></td><td style="text-align:right"><b>${money(o.total)}</b></td></tr></table>`
}

const first = (o) => e(o.customer.name.split(' ')[0])

/** Customer-facing messages per status. Returns null when a status sends nothing. */
export function customerEmail(o, status, site) {
  const track = { href: `${site}/track`, label: 'Track order' }
  switch (status) {
    case 'pending': return { subject: `Order ${o.number} — got it.`, html: layout({ site, title: 'Got it.', intro: `Thank you, ${first(o)}. We'll call to confirm order <b>${e(o.number)}</b>, then it's on its way. Have ${money(o.total)} ready on delivery.`, body: itemsTable(o), cta: track }) }
    case 'confirmed': return { subject: `Order ${o.number} is confirmed`, html: layout({ site, title: 'Confirmed.', intro: `Your order <b>${e(o.number)}</b> is confirmed and being packed.`, cta: track }) }
    case 'shipped': return { subject: `Order ${o.number} is on its way`, html: layout({ site, title: 'On its way.', intro: `Your order <b>${e(o.number)}</b> left us.${o.tracking?.number ? ` ${e(o.tracking.courier)} tracking: <b>${e(o.tracking.number)}</b>.` : ''} Keep your phone close.`, cta: track }) }
    case 'delivered': return { subject: 'How does it feel?', html: layout({ site, title: 'How does it feel?', intro: `Your order <b>${e(o.number)}</b> arrived. If you have a minute, tell us what you think. It helps someone else find their mood.`, cta: o.reviewToken ? { href: `${site}/review/${o.reviewToken}`, label: 'Leave a review' } : null }) }
    case 'cancelled': return { subject: `Order ${o.number} was cancelled`, html: layout({ site, title: 'Cancelled.', intro: `Order <b>${e(o.number)}</b> was cancelled. If that's a surprise, reply to this email and we'll sort it out.` }) }
    default: return null
  }
}

export function adminEmail(o, site) {
  return {
    subject: `New order ${o.number} · ${money(o.total)}`,
    html: layout({ site, title: `New order ${e(o.number)}`, intro: `${e(o.customer.name)} · ${e(o.customer.phone)} · ${e(o.address.governorate)}`, body: itemsTable(o), cta: { href: `${site}/admin/orders`, label: 'Open orders' } }),
  }
}

export function restockEmail(product, size, site) {
  return {
    subject: `${product.name} is back`,
    html: layout({ site, title: "It's back.", intro: `<b>${e(product.name)}</b>${size ? ` in ${e(size)}` : ''} is back in stock. It went fast last time.`, cta: { href: `${site}/product/${product.slug}`, label: 'Wear the feeling' } }),
  }
}

/** WhatsApp template per status: names must match templates approved in Meta Business Manager. */
export const WHATSAPP_TEMPLATES = {
  pending: (o) => ({ name: 'order_received', params: [o.customer.name.split(' ')[0], o.number, money(o.total)] }),
  shipped: (o) => ({ name: 'order_shipped', params: [o.customer.name.split(' ')[0], o.number, o.tracking?.number || '—'] }),
  delivered: (o, site) => ({ name: 'order_delivered', params: [o.customer.name.split(' ')[0], o.reviewToken ? `${site}/review/${o.reviewToken}` : site] }),
}
