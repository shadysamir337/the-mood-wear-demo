import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { slugify } from '../lib/api'
import { isScheduleActive, formatPrice } from '../lib/pricing'
import { Field, ImageUploader, Modal, PageHead, Pill, ScopeEditor, Toggle, toast, useList, useRemove, useSave } from './ui'
import { fmtDate, fromDateInput, toDateInput } from '../lib/format'

/* ================================ MOODS ================================= */

function MoodEditor({ initial, count, onClose }) {
  const [m, setM] = useState({ name: '', slug: '', tagline: '', story: '', accentColor: '#D9C48A', order: count + 1, visible: true, dropDate: '', coverImage: '', ...initial })
  const save = useSave('moods')
  const set = (k, v) => setM((x) => ({ ...x, [k]: v }))
  const submit = async () => {
    if (!m.name.trim()) return toast('Give the mood a name.', 'err')
    try { await save.mutateAsync({ ...m, slug: m.slug || slugify(m.name.replace(/^the /i, '').replace(/ mood$/i, '')), order: +m.order }) } catch { return }
    toast('Mood saved.'); onClose()
  }
  return (
    <Modal title={initial?.id ? 'Edit mood' : 'New mood'} onClose={onClose} footer={<><button className="btn btn--ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={submit} id="save-mood">Save mood</button></>}>
      <div className="a-form a-form--one">
        <Field label="Name"><input className="input" value={m.name} onChange={(e) => set('name', e.target.value)} placeholder="The Happy Mood" id="m-name" /></Field>
        <Field label="Tagline"><input className="input" value={m.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
        <Field label="Story" hint="A short emotional story for the mood page"><textarea className="textarea" value={m.story} onChange={(e) => set('story', e.target.value)} /></Field>
        <div className="two">
          <Field label="Accent colour" hint="Used only on this mood's pages"><input type="color" className="color-lg" value={m.accentColor} onChange={(e) => set('accentColor', e.target.value)} /></Field>
          <Field label="Sort order"><input className="input" type="number" value={m.order} onChange={(e) => set('order', e.target.value)} /></Field>
        </div>
        <Field label="Drop date" hint="Shown while the mood has no products"><input className="input" type="date" value={m.dropDate || ''} onChange={(e) => set('dropDate', e.target.value)} /></Field>
        <Field label="Cover image (optional)"><ImageUploader images={m.coverImage ? [m.coverImage] : []} onChange={(v) => set('coverImage', v[v.length - 1] || '')} /></Field>
        <Toggle checked={m.visible} onChange={(v) => set('visible', v)} label="Visible on the store" />
      </div>
    </Modal>
  )
}

export function Moods() {
  const { data: moods = [] } = useList('moods')
  const { data: products = [] } = useList('products')
  const remove = useRemove('moods')
  const save = useSave('moods')
  const [edit, setEdit] = useState(null)
  const sorted = [...moods].sort((a, b) => a.order - b.order)
  return (
    <>
      <PageHead title="Moods" sub="Your categories. Each drop is a small emotional story."><button className="btn" onClick={() => setEdit({})} id="new-mood">New mood</button></PageHead>
      <div className="a-card a-card--flush">
        <table className="a-table">
          <thead><tr><th>#</th><th>Mood</th><th>Tagline</th><th>Products</th><th>Visible</th><th /></tr></thead>
          <tbody>{sorted.map((m) => {
            const n = products.filter((p) => p.moodId === m.id).length
            return (
              <tr key={m.id}>
                <td className="muted">{m.order}</td>
                <td><div className="a-mood"><i style={{ background: m.accentColor }} /><b>{m.name}</b></div></td>
                <td className="muted">{m.tagline}</td>
                <td>{n || <span className="muted">Soon</span>}</td>
                <td><Toggle checked={m.visible} onChange={(v) => save.mutate({ ...m, visible: v })} /></td>
                <td className="a-actions"><button className="link" onClick={() => setEdit(m)}>Edit</button><button className="link danger" onClick={() => (n ? toast('Move its products first.', 'err') : confirm(`Delete ${m.name}?`) && remove.mutate(m.id))}>Delete</button></td>
              </tr>
            )
          })}</tbody>
        </table>
      </div>
      <AnimatePresence>{edit && <MoodEditor key={edit.id || 'new'} initial={edit.id ? edit : null} count={moods.length} onClose={() => setEdit(null)} />}</AnimatePresence>
    </>
  )
}

/* ================================ PROMOS ================================ */

const PROMO_TYPES = { percent: 'Percentage off', fixed: 'Fixed amount off', shipping: 'Free shipping', bogo: 'Buy X get Y free' }

function PromoEditor({ initial, moods, products, onClose }) {
  const [p, setP] = useState({ code: '', type: 'percent', value: 10, minOrder: 0, maxDiscount: 0, usageLimit: 0, perCustomerLimit: 0, firstOrderOnly: false, buyQty: 1, getQty: 1, scope: { type: 'all' }, active: true, startsAt: null, endsAt: null, usedCount: 0, ...initial })
  const save = useSave('promos')
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }))
  const submit = async () => {
    if (!/^[A-Za-z0-9_-]{3,24}$/.test(p.code)) return toast('Code: 3–24 letters or numbers.', 'err')
    if (p.type === 'percent' && (p.value <= 0 || p.value > 100)) return toast('Percentage must be 1–100.', 'err')
    try { await save.mutateAsync({ ...p, code: p.code.toUpperCase(), value: +p.value, minOrder: +p.minOrder, maxDiscount: +p.maxDiscount, usageLimit: +p.usageLimit, perCustomerLimit: +p.perCustomerLimit, buyQty: +p.buyQty, getQty: +p.getQty }) } catch { return }
    toast('Promo saved.'); onClose()
  }
  return (
    <Modal wide title={initial?.id ? `Edit ${initial.code}` : 'New promo code'} onClose={onClose} footer={<><button className="btn btn--ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={submit} id="save-promo">Save promo</button></>}>
      <div className="a-form">
        <div className="a-form__col">
          <Field label="Code"><input className="input" value={p.code} onChange={(e) => set('code', e.target.value.toUpperCase())} disabled={!!initial?.id} placeholder="MOOD10" id="promo-code" /></Field>
          <Field label="Type"><select className="select" value={p.type} onChange={(e) => set('type', e.target.value)}>{Object.entries(PROMO_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          {(p.type === 'percent' || p.type === 'fixed') && <Field label={p.type === 'percent' ? 'Percentage (%)' : 'Amount (EGP)'}><input className="input" type="number" min="0" value={p.value} onChange={(e) => set('value', e.target.value)} id="promo-value" /></Field>}
          {p.type === 'bogo' && <div className="two"><Field label="Buy"><input className="input" type="number" min="1" value={p.buyQty} onChange={(e) => set('buyQty', e.target.value)} /></Field><Field label="Get free"><input className="input" type="number" min="1" value={p.getQty} onChange={(e) => set('getQty', e.target.value)} /></Field></div>}
          <div className="two">
            <Field label="Minimum order (EGP)"><input className="input" type="number" min="0" value={p.minOrder} onChange={(e) => set('minOrder', e.target.value)} /></Field>
            <Field label="Max discount (EGP)" hint="0 = no cap"><input className="input" type="number" min="0" value={p.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} /></Field>
          </div>
          <div className="two">
            <Field label="Total uses" hint="0 = unlimited"><input className="input" type="number" min="0" value={p.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} /></Field>
            <Field label="Uses per customer" hint="0 = unlimited"><input className="input" type="number" min="0" value={p.perCustomerLimit} onChange={(e) => set('perCustomerLimit', e.target.value)} /></Field>
          </div>
        </div>
        <div className="a-form__col">
          <div className="two">
            <Field label="Starts"><input className="input" type="date" value={toDateInput(p.startsAt)} onChange={(e) => set('startsAt', fromDateInput(e.target.value))} /></Field>
            <Field label="Ends"><input className="input" type="date" value={toDateInput(p.endsAt)} onChange={(e) => set('endsAt', fromDateInput(e.target.value, true))} /></Field>
          </div>
          <Field label="Applies to"><ScopeEditor value={p.scope} onChange={(v) => set('scope', v)} moods={moods} products={products} /></Field>
          <div className="a-toggles"><Toggle checked={p.firstOrderOnly} onChange={(v) => set('firstOrderOnly', v)} label="First order only" /><Toggle checked={p.active} onChange={(v) => set('active', v)} label="Active" /></div>
        </div>
      </div>
    </Modal>
  )
}

const describePromo = (p) => ({ percent: `${p.value}% off`, fixed: `${formatPrice(p.value)} off`, shipping: 'Free shipping', bogo: `Buy ${p.buyQty}, get ${p.getQty} free` }[p.type])

export function Promos() {
  const { data: promos = [] } = useList('promos')
  const { data: moods = [] } = useList('moods')
  const { data: products = [] } = useList('products')
  const save = useSave('promos')
  const remove = useRemove('promos')
  const [edit, setEdit] = useState(null)
  return (
    <>
      <PageHead title="Promo codes" sub="Codes are checked on the server at checkout."><button className="btn" onClick={() => setEdit({})} id="new-promo">New promo</button></PageHead>
      <div className="a-card a-card--flush">
        <table className="a-table">
          <thead><tr><th>Code</th><th>Discount</th><th>Applies to</th><th>Used</th><th>Dates</th><th>Active</th><th /></tr></thead>
          <tbody>
            {promos.map((p) => (
              <tr key={p.id}>
                <td><b className="code">{p.code}</b></td>
                <td>{describePromo(p)}{p.minOrder > 0 && <small className="muted"> · min {formatPrice(p.minOrder)}</small>}</td>
                <td className="muted">{{ all: 'Whole store', moods: 'Moods', products: 'Products' }[p.scope?.type || 'all']}</td>
                <td>{p.usedCount || 0}{p.usageLimit ? ` / ${p.usageLimit}` : ''}</td>
                <td className="muted">{p.startsAt ? fmtDate(p.startsAt) : 'Now'} → {p.endsAt ? fmtDate(p.endsAt) : 'No end'}{!isScheduleActive(p) && p.active && <> <Pill tone="archived">Expired</Pill></>}</td>
                <td><Toggle checked={p.active} onChange={(v) => save.mutate({ ...p, active: v })} /></td>
                <td className="a-actions"><button className="link" onClick={() => setEdit(p)}>Edit</button><button className="link danger" onClick={() => confirm(`Delete ${p.code}?`) && remove.mutate(p.id)}>Delete</button></td>
              </tr>
            ))}
            {!promos.length && <tr><td colSpan={7} className="muted">No promo codes yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <AnimatePresence>{edit && <PromoEditor key={edit.id || 'new'} initial={edit.id ? edit : null} moods={moods} products={products} onClose={() => setEdit(null)} />}</AnimatePresence>
    </>
  )
}

/* ================================= SALES ================================ */

function SaleEditor({ initial, moods, products, onClose }) {
  const [s, setS] = useState({ title: '', type: 'percent', value: 20, scope: { type: 'all' }, startsAt: null, endsAt: null, active: true, ...initial })
  const save = useSave('sales')
  const set = (k, v) => setS((x) => ({ ...x, [k]: v }))
  const submit = async () => {
    if (!s.title.trim()) return toast('Name the sale.', 'err')
    if (+s.value <= 0 || (s.type === 'percent' && +s.value >= 100)) return toast('Check the discount value.', 'err')
    try { await save.mutateAsync({ ...s, value: +s.value }) } catch { return }
    toast('Sale saved.'); onClose()
  }
  return (
    <Modal title={initial?.id ? 'Edit sale' : 'New sale'} onClose={onClose} footer={<><button className="btn btn--ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={submit} id="save-sale">Save sale</button></>}>
      <div className="a-form a-form--one">
        <Field label="Sale name"><input className="input" value={s.title} onChange={(e) => set('title', e.target.value)} placeholder="Summer mood sale" id="sale-title" /></Field>
        <div className="two">
          <Field label="Discount type"><select className="select" value={s.type} onChange={(e) => set('type', e.target.value)}><option value="percent">Percentage</option><option value="fixed">Fixed amount (EGP)</option></select></Field>
          <Field label="Value"><input className="input" type="number" min="0" value={s.value} onChange={(e) => set('value', e.target.value)} id="sale-value" /></Field>
        </div>
        <div className="two">
          <Field label="Starts"><input className="input" type="date" value={toDateInput(s.startsAt)} onChange={(e) => set('startsAt', fromDateInput(e.target.value))} /></Field>
          <Field label="Ends"><input className="input" type="date" value={toDateInput(s.endsAt)} onChange={(e) => set('endsAt', fromDateInput(e.target.value, true))} /></Field>
        </div>
        <Field label="Applies to"><ScopeEditor value={s.scope} onChange={(v) => set('scope', v)} moods={moods} products={products} /></Field>
        <Toggle checked={s.active} onChange={(v) => set('active', v)} label="Active" />
      </div>
    </Modal>
  )
}

export function Sales() {
  const { data: sales = [] } = useList('sales')
  const { data: moods = [] } = useList('moods')
  const { data: products = [] } = useList('products')
  const save = useSave('sales')
  const remove = useRemove('sales')
  const [edit, setEdit] = useState(null)
  return (
    <>
      <PageHead title="Sales" sub="Prices drop automatically on the store with a sale badge."><button className="btn" onClick={() => setEdit({})} id="new-sale">New sale</button></PageHead>
      <div className="a-card a-card--flush">
        <table className="a-table">
          <thead><tr><th>Sale</th><th>Discount</th><th>Applies to</th><th>Dates</th><th>Status</th><th>Active</th><th /></tr></thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td><b>{s.title}</b></td>
                <td>{s.type === 'percent' ? `${s.value}% off` : `${formatPrice(s.value)} off`}</td>
                <td className="muted">{s.scope?.type === 'moods' ? `${s.scope.moodIds?.length || 0} moods` : s.scope?.type === 'products' ? `${s.scope.productIds?.length || 0} products` : 'Whole store'}</td>
                <td className="muted">{s.startsAt ? fmtDate(s.startsAt) : 'Now'} → {s.endsAt ? fmtDate(s.endsAt) : 'No end'}</td>
                <td><Pill tone={isScheduleActive(s) ? 'active' : 'draft'}>{isScheduleActive(s) ? 'Live' : s.active ? 'Scheduled' : 'Off'}</Pill></td>
                <td><Toggle checked={s.active} onChange={(v) => save.mutate({ ...s, active: v })} /></td>
                <td className="a-actions"><button className="link" onClick={() => setEdit(s)}>Edit</button><button className="link danger" onClick={() => confirm(`Delete “${s.title}”?`) && remove.mutate(s.id)}>Delete</button></td>
              </tr>
            ))}
            {!sales.length && <tr><td colSpan={7} className="muted">No sales yet. Create one and it appears on the store instantly.</td></tr>}
          </tbody>
        </table>
      </div>
      <AnimatePresence>{edit && <SaleEditor key={edit.id || 'new'} initial={edit.id ? edit : null} moods={moods} products={products} onClose={() => setEdit(null)} />}</AnimatePresence>
    </>
  )
}

/* ================================ BANNERS =============================== */

function BannerEditor({ initial, onClose }) {
  const [b, setB] = useState({ title: '', text: '', ctaLabel: 'Shop the drop', ctaLink: '/shop', image: '', placement: 'home', active: true, startsAt: null, endsAt: null, ...initial })
  const save = useSave('banners')
  const set = (k, v) => setB((x) => ({ ...x, [k]: v }))
  const submit = async () => {
    if (!b.title.trim()) return toast('Give the banner a headline.', 'err')
    if (b.ctaLink && !/^\/|^https:\/\//.test(b.ctaLink)) return toast('Links start with / or https://', 'err')
    try { await save.mutateAsync(b) } catch { return }
    toast('Banner saved.'); onClose()
  }
  return (
    <Modal title={initial?.id ? 'Edit banner' : 'New banner'} onClose={onClose} footer={<><button className="btn btn--ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={submit} id="save-banner">Save banner</button></>}>
      <div className="a-form a-form--one">
        <Field label="Headline"><input className="input" value={b.title} onChange={(e) => set('title', e.target.value)} placeholder="The Love Mood drops Friday." id="banner-title" /></Field>
        <Field label="Line under it (optional)"><input className="input" value={b.text} onChange={(e) => set('text', e.target.value)} /></Field>
        <div className="two">
          <Field label="Button label"><input className="input" value={b.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} /></Field>
          <Field label="Button link" hint="/moods/love or https://…"><input className="input" value={b.ctaLink} onChange={(e) => set('ctaLink', e.target.value)} /></Field>
        </div>
        <Field label="Where"><select className="select" value={b.placement} onChange={(e) => set('placement', e.target.value)}><option value="home">Home, under the hero</option><option value="shop">Top of the shop</option></select></Field>
        <div className="two">
          <Field label="Starts"><input className="input" type="date" value={toDateInput(b.startsAt)} onChange={(e) => set('startsAt', fromDateInput(e.target.value))} /></Field>
          <Field label="Ends"><input className="input" type="date" value={toDateInput(b.endsAt)} onChange={(e) => set('endsAt', fromDateInput(e.target.value, true))} /></Field>
        </div>
        <Field label="Image (optional)"><ImageUploader images={b.image ? [b.image] : []} onChange={(v) => set('image', v[v.length - 1] || '')} /></Field>
        <Toggle checked={b.active} onChange={(v) => set('active', v)} label="Active" />
      </div>
    </Modal>
  )
}

export function Banners() {
  const { data: banners = [] } = useList('banners')
  const save = useSave('banners')
  const remove = useRemove('banners')
  const [edit, setEdit] = useState(null)
  return (
    <>
      <PageHead title="Banners" sub="Announce a drop on the home page or the shop. Schedule it and it shows up on its own."><button className="btn" onClick={() => setEdit({})} id="new-banner">New banner</button></PageHead>
      <div className="a-card a-card--flush">
        <table className="a-table">
          <thead><tr><th>Headline</th><th>Where</th><th>Dates</th><th>Status</th><th>Active</th><th /></tr></thead>
          <tbody>
            {banners.map((b) => (
              <tr key={b.id}>
                <td><b>{b.title}</b>{b.text && <small className="muted">{b.text}</small>}</td>
                <td className="muted">{b.placement === 'shop' ? 'Shop' : 'Home'}</td>
                <td className="muted">{b.startsAt ? fmtDate(b.startsAt) : 'Now'} → {b.endsAt ? fmtDate(b.endsAt) : 'No end'}</td>
                <td><Pill tone={isScheduleActive(b) ? 'active' : 'draft'}>{isScheduleActive(b) ? 'Live' : b.active ? 'Scheduled' : 'Off'}</Pill></td>
                <td><Toggle checked={b.active} onChange={(v) => save.mutate({ ...b, active: v })} /></td>
                <td className="a-actions"><button className="link" onClick={() => setEdit(b)}>Edit</button><button className="link danger" onClick={() => confirm(`Delete “${b.title}”?`) && remove.mutate(b.id)}>Delete</button></td>
              </tr>
            ))}
            {!banners.length && <tr><td colSpan={6} className="muted">No banners yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <AnimatePresence>{edit && <BannerEditor key={edit.id || 'new'} initial={edit.id ? edit : null} onClose={() => setEdit(null)} />}</AnimatePresence>
    </>
  )
}
