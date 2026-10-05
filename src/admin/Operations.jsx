import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { api } from '../lib/api'
import { ORDER_STATUSES, GOVERNORATES, canTransition, formatPrice, stockDelta } from '../lib/pricing'
import { Field, Modal, PageHead, Pill, Toggle, toast, useList, useSave } from './ui'
import { csvCell, escapeHtml, fmtDateTime, fromDateInput, trackingUrl } from '../lib/format'
import { imgSrc } from '../lib/images'
import { useAuth } from '../lib/auth'

/* ================================ ORDERS ================================ */

/** Invoice (with prices) or packing slip (without) in a print window. Every value is escaped. */
function printDoc(o, { slip = false } = {}) {
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) return toast('Allow pop-ups to print.', 'err')
  const e = escapeHtml
  const price = (v) => (slip ? '' : formatPrice(v))
  w.document.write(`<html><head><title>${e(o.number)}</title><style>
    body{font:14px Georgia,serif;padding:48px;color:#111}h1{font-weight:500;letter-spacing:.06em;margin:0}
    table{width:100%;border-collapse:collapse;margin:24px 0}td,th{padding:10px 0;border-bottom:1px solid #ddd;text-align:left}
    .r{text-align:right}small{color:#777;font-family:sans-serif;letter-spacing:.14em;text-transform:uppercase;font-size:10px}
    .box{border:1px solid #111;padding:16px;margin-top:24px;font-size:18px}</style></head><body>
    <h1>THE MOOD</h1><small>${slip ? 'Packing slip' : 'Invoice'} · Wear what you feel</small><hr style="margin:24px 0">
    <p><b>Order ${e(o.number)}</b><br>${e(new Date(o.createdAt).toLocaleString())}</p>
    <p><small>Ship to</small><br>${e(o.customer.name)}<br>${e(o.customer.phone)}<br>${e(o.address.street)}, ${e(o.address.city)}<br>${e(o.address.governorate)}${o.address.notes ? `<br><i>${e(o.address.notes)}</i>` : ''}</p>
    <table><tr><th>Item</th><th>Size</th><th class="r">Qty</th>${slip ? '<th class="r">✓</th>' : '<th class="r">Price</th>'}</tr>
    ${o.items.map((i) => `<tr><td>${e(i.name)}</td><td>${e(i.color)} / ${e(i.size)}</td><td class="r">${e(i.qty)}</td><td class="r">${slip ? '☐' : price(i.unitPrice * i.qty)}</td></tr>`).join('')}</table>
    ${slip
      ? `<div class="box">Collect on delivery: <b>${o.paymentMethod === 'cod' && o.paymentStatus !== 'paid' ? formatPrice(o.total) : 'Nothing, paid'}</b></div>`
      : `<p class="r">Subtotal ${formatPrice(o.subtotal)}<br>${o.discount ? `Discount −${formatPrice(o.discount)} (${e(o.promoCode)})<br>` : ''}Shipping ${formatPrice(o.shipping)}<br><b style="font-size:18px">Total ${formatPrice(o.total)}</b></p>
      <p><small>Payment: ${o.paymentMethod === 'cod' ? 'Cash on delivery' : e(o.paymentMethod)} · ${e(o.paymentStatus)}</small></p>`}
    <script>window.onload=()=>window.print()</script></body></html>`)
  w.document.close()
}

function OrderDetail({ order, onClose, couriers }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState(order.status)
  const [courier, setCourier] = useState(order.tracking?.courier || '')
  const [tnum, setTnum] = useState(order.tracking?.number || '')
  const [notes, setNotes] = useState(order.notes || '')
  const update = useMutation({
    mutationFn: () => api.updateOrderStatus(order.id, status, { tracking: { courier, number: tnum }, notes, note: status !== order.status ? `Status → ${status}` : '' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['catalog'] }); toast('Order updated.'); onClose() },
    onError: (e) => toast(e.message, 'err'),
  })
  const link = trackingUrl(couriers, { courier, number: tnum })
  return (
    <Modal wide title={`Order ${order.number}`} onClose={onClose}
      footer={<><button className="btn btn--ghost" onClick={() => printDoc(order, { slip: true })}>Packing slip</button><button className="btn btn--ghost" onClick={() => printDoc(order)}>Print invoice</button><button className="btn" onClick={() => update.mutate()} disabled={update.isPending} id="update-order">Save changes</button></>}>
      <div className="a-form">
        <div className="a-form__col">
          <h3 className="eyebrow">Items</h3>
          <ul className="a-items">{order.items.map((it, i) => (
            <li key={i}><img src={imgSrc(it.image)} alt="" /><div><b>{it.name}</b><small className="muted">{it.color} · {it.size} · × {it.qty}</small></div><span>{formatPrice(it.unitPrice * it.qty)}</span></li>
          ))}</ul>
          <dl className="totals a-totals">
            <div><dt>Subtotal</dt><dd>{formatPrice(order.subtotal)}</dd></div>
            {order.discount > 0 && <div><dt>Discount ({order.promoCode})</dt><dd>−{formatPrice(order.discount)}</dd></div>}
            <div><dt>Shipping</dt><dd>{formatPrice(order.shipping)}</dd></div>
            <div className="totals__total"><dt>Total</dt><dd>{formatPrice(order.total)}</dd></div>
          </dl>
          <h3 className="eyebrow">Timeline</h3>
          <ol className="a-timeline">{[...order.timeline].reverse().map((t, i) => <li key={i}><Pill>{t.status}</Pill><span className="muted">{fmtDateTime(t.at)}{t.note ? ` · ${t.note}` : ''}{t.by ? ` · ${t.by}` : ''}</span></li>)}</ol>
        </div>
        <div className="a-form__col">
          <Field label="Status"><select className="select" value={status} onChange={(e) => setStatus(e.target.value)} id="order-status">{ORDER_STATUSES.map((s) => <option key={s} value={s} disabled={!canTransition(order.status, s)}>{s}</option>)}</select></Field>
          {stockDelta(order.status, status) > 0 && <p className="small danger">Stock for this order will be returned to inventory.</p>}
          {stockDelta(order.status, status) < 0 && <p className="small danger">Reopening takes the items out of stock again.</p>}
          <div className="two">
            <Field label="Courier">
              <input className="input" list="couriers" value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="Bosta, Aramex…" />
              <datalist id="couriers">{(couriers || []).map((c) => <option key={c.name} value={c.name} />)}</datalist>
            </Field>
            <Field label="Tracking number" hint={link ? <a className="link" href={link} target="_blank" rel="noreferrer">Open tracking ↗</a> : null}><input className="input" value={tnum} onChange={(e) => setTnum(e.target.value)} /></Field>
          </div>
          <Field label="Internal notes"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          <h3 className="eyebrow">Customer</h3>
          <p><b>{order.customer.name}</b><br /><a className="link" href={`tel:${order.customer.phone}`}>{order.customer.phone}</a> · <a className="link" href={`https://wa.me/${waNumber(order.customer.phone)}`} target="_blank" rel="noreferrer">WhatsApp</a>{order.customer.email && <><br />{order.customer.email}</>}</p>
          <h3 className="eyebrow">Deliver to</h3>
          <p>{order.address.street}<br />{order.address.city}, {order.address.governorate}{order.address.notes && <><br /><i className="muted">{order.address.notes}</i></>}</p>
          <h3 className="eyebrow">Payment</h3>
          <p>{order.paymentMethod === 'cod' ? 'Cash on delivery' : order.paymentMethod} · <Pill tone={order.paymentStatus === 'paid' ? 'active' : 'draft'}>{order.paymentStatus}</Pill>{order.source === 'manual' && <> · <Pill tone="draft">manual</Pill></>}</p>
        </div>
      </div>
    </Modal>
  )
}

const waNumber = (p) => {
  const d = String(p || '').replace(/\D/g, '')
  return d.startsWith('20') ? d : d.startsWith('0') ? `2${d}` : d
}

function exportCsv(rows) {
  const head = ['Order', 'Date', 'Customer', 'Phone', 'Governorate', 'Items', 'Subtotal', 'Discount', 'Shipping', 'Total', 'Status', 'Payment', 'Source']
  const body = rows.map((o) => [o.number, new Date(o.createdAt).toISOString(), o.customer.name, o.customer.phone, o.address.governorate, o.items.map((i) => `${i.qty}x ${i.name} (${i.size})`).join(' | '), o.subtotal, o.discount, o.shipping, o.total, o.status, o.paymentStatus, o.source || 'web'])
  const csv = [head, ...body].map((r) => r.map(csvCell).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `the-mood-orders-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

/** Orders taken over Instagram DMs or the phone: same checks, prices and stock rules as the website. */
function ManualOrder({ onClose }) {
  const { data: products = [] } = useList('products')
  const qc = useQueryClient()
  const active = products.filter((p) => p.status === 'active')
  const [lines, setLines] = useState([{ productId: '', color: '', size: '', qty: 1 }])
  const [c, setC] = useState({ name: '', phone: '', email: '', governorate: '', city: '', street: '', notes: '', promoCode: '' })
  const [busy, setBusy] = useState(false)
  const setLine = (i, patch) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)))
  const variantsOf = (id) => active.find((p) => p.id === id)?.variants || []
  const submit = async () => {
    const items = lines.filter((l) => l.productId && l.color && l.size)
    if (!items.length) return toast('Add at least one piece.', 'err')
    setBusy(true)
    try {
      const res = await api.createOrder({
        customer: { name: c.name, phone: c.phone, email: c.email },
        address: { governorate: c.governorate, city: c.city, street: c.street, notes: c.notes },
        items: items.map((l) => ({ ...l, qty: +l.qty })), promoCode: c.promoCode, paymentMethod: 'cod', source: 'manual',
      })
      qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['catalog'] })
      toast(`${res.number} created · ${formatPrice(res.total)}`)
      onClose()
    } catch (e) { toast(e.message, 'err') }
    setBusy(false)
  }
  const field = (k, label, props = {}) => <Field label={label}><input className="input" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} {...props} /></Field>
  return (
    <Modal wide title="New manual order" onClose={onClose} footer={<><button className="btn btn--ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={submit} disabled={busy} id="save-manual">{busy ? 'Creating…' : 'Create order'}</button></>}>
      <div className="a-form">
        <div className="a-form__col">
          <h3 className="eyebrow">Pieces</h3>
          {lines.map((l, i) => {
            const vs = variantsOf(l.productId)
            const colors = [...new Set(vs.map((v) => v.color))]
            return (
              <div key={i} className="a-line">
                <select className="select" aria-label="Product" value={l.productId} onChange={(e) => { const v = variantsOf(e.target.value); setLine(i, { productId: e.target.value, color: v[0]?.color || '', size: '' }) }}><option value="">Product…</option>{active.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                {colors.length > 1 && <select className="select" aria-label="Colour" value={l.color} onChange={(e) => setLine(i, { color: e.target.value, size: '' })}>{colors.map((x) => <option key={x}>{x}</option>)}</select>}
                <select className="select" aria-label="Size" value={l.size} onChange={(e) => setLine(i, { size: e.target.value })}><option value="">Size…</option>{vs.filter((v) => v.color === l.color).map((v) => <option key={v.size} value={v.size} disabled={v.stock <= 0}>{v.size} ({v.stock})</option>)}</select>
                <input className="input input--stock" type="number" min="1" max="10" aria-label="Quantity" value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} />
                {lines.length > 1 && <button className="link danger" onClick={() => setLines(lines.filter((_, k) => k !== i))}>Remove</button>}
              </div>
            )
          })}
          <button className="link" onClick={() => setLines([...lines, { productId: '', color: '', size: '', qty: 1 }])}>+ Add piece</button>
          {field('promoCode', 'Promo code (optional)')}
        </div>
        <div className="a-form__col">
          <div className="two">{field('name', 'Name', { id: 'mo-name' })}{field('phone', 'Phone', { id: 'mo-phone', inputMode: 'tel' })}</div>
          {field('email', 'Email (optional)')}
          <Field label="Governorate"><select className="select" id="mo-gov" value={c.governorate} onChange={(e) => setC({ ...c, governorate: e.target.value })}><option value="">Choose…</option>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}</select></Field>
          <div className="two">{field('city', 'City / area')}{field('street', 'Street & building', { id: 'mo-street' })}</div>
          {field('notes', 'Courier notes (optional)')}
        </div>
      </div>
    </Modal>
  )
}

const PAGE = 25

export function Orders() {
  const qc = useQueryClient()
  const { data: settingsRows = [] } = useList('settings')
  const couriers = settingsRows[0]?.couriers
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [gov, setGov] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [cursors, setCursors] = useState([0])
  const [open, setOpen] = useState(null)
  const [manual, setManual] = useState(false)
  const [sel, setSel] = useState([])
  const cursor = cursors[cursors.length - 1]
  const filters = { status, q: search, from: fromDateInput(from) || 0, to: fromDateInput(to, true) || 0, pageSize: PAGE, cursor }
  const { data, isLoading, isFetching } = useQuery({ queryKey: ['admin', 'orders-page', filters], queryFn: () => api.listOrders(filters), placeholderData: (prev) => prev })
  const list = (data?.rows || []).filter((o) => !gov || o.address.governorate === gov)
  const resetPages = () => { setCursors([0]); setSel([]) }

  useEffect(() => {
    const t = setTimeout(() => { setSearch(q); setCursors([0]) }, 300)
    return () => clearTimeout(t)
  }, [q])

  const bulkStatus = async (s) => {
    let done = 0
    const failed = []
    for (const id of sel) {
      try { await api.updateOrderStatus(id, s, { note: 'Bulk update' }); done++ } catch (e) { failed.push(`${list.find((o) => o.id === id)?.number}: ${e.message}`) }
    }
    qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['catalog'] })
    setSel([])
    if (done) toast(`${done} orders → ${s}`)
    if (failed.length) toast(failed.join(' · '), 'err')
  }

  return (
    <>
      <PageHead title="Orders" sub={data?.total != null ? `${data.total} matching` : 'Newest first'}>
        <button className="btn btn--ghost" onClick={() => exportCsv(list)}>Export CSV</button>
        <button className="btn" onClick={() => setManual(true)} id="new-manual-order">New order</button>
      </PageHead>
      <div className="a-toolbar">
        <input className="input input--sm" placeholder="Order number, phone or name" value={q} onChange={(e) => setQ(e.target.value)} id="order-search" />
        <select className="select select--sm" value={status} onChange={(e) => { setStatus(e.target.value); resetPages() }} aria-label="Status"><option value="">All statuses</option>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="select select--sm" value={gov} onChange={(e) => setGov(e.target.value)} aria-label="Governorate"><option value="">All governorates</option>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}</select>
        <label className="a-date">From <input className="input input--sm" type="date" value={from} onChange={(e) => { setFrom(e.target.value); resetPages() }} aria-label="From date" /></label>
        <label className="a-date">To <input className="input input--sm" type="date" value={to} onChange={(e) => { setTo(e.target.value); resetPages() }} aria-label="To date" /></label>
        {sel.length > 0 && <div className="a-bulk"><span>{sel.length} selected</span><select className="select select--sm" value="" onChange={(e) => e.target.value && bulkStatus(e.target.value)} aria-label="Set status for selected"><option value="">Set status…</option>{ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>}
      </div>
      <div className="a-card a-card--flush">
        <table className="a-table a-table--click">
          <thead><tr><th style={{ width: 36 }}><input type="checkbox" checked={sel.length === list.length && list.length > 0} onChange={(e) => setSel(e.target.checked ? list.map((o) => o.id) : [])} aria-label="Select all" /></th><th>Order</th><th>Customer</th><th>Governorate</th><th>Items</th><th>Total</th><th>Status</th><th>Placed</th></tr></thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id} onClick={() => setOpen(o)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(o)}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.includes(o.id)} onChange={() => setSel((s) => (s.includes(o.id) ? s.filter((x) => x !== o.id) : [...s, o.id]))} aria-label={`Select ${o.number}`} /></td>
                <td><b>{o.number}</b>{o.source === 'manual' && <small className="muted">manual</small>}</td><td>{o.customer.name}<small className="muted">{o.customer.phone}</small></td><td>{o.address.governorate}</td>
                <td>{o.items.reduce((n, i) => n + i.qty, 0)}</td><td>{formatPrice(o.total)}</td><td><Pill>{o.status}</Pill></td><td className="muted">{fmtDateTime(o.createdAt)}</td>
              </tr>
            ))}
            {!isLoading && !list.length && <tr><td colSpan={8} className="muted">No orders found.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="a-pager">
        {isFetching && <span className="muted small">Loading…</span>}
        <button className="link" disabled={cursors.length === 1} onClick={() => { setCursors(cursors.slice(0, -1)); setSel([]) }}>← Newer</button>
        <span className="muted small">Page {cursors.length}</span>
        <button className="link" disabled={data?.next == null} onClick={() => { setCursors([...cursors, data.next]); setSel([]) }}>Older →</button>
      </div>
      <AnimatePresence>
        {open && <OrderDetail key={open.id} order={open} couriers={couriers} onClose={() => setOpen(null)} />}
        {manual && <ManualOrder key="manual" onClose={() => setManual(false)} />}
      </AnimatePresence>
    </>
  )
}

/* =============================== INVENTORY ============================== */

/** Re-mounts (via key) whenever the saved stock changes, so it never shows a stale number. */
function StockInput({ value, threshold, onCommit, label }) {
  const [v, setV] = useState(String(value))
  const n = Math.max(0, parseInt(v, 10) || 0)
  return (
    <input className={`input input--stock ${n === 0 ? 'is-zero' : n <= threshold ? 'is-low' : ''}`} type="number" min="0" value={v}
      onChange={(e) => setV(e.target.value)} onBlur={() => (n !== value ? onCommit(n) : setV(String(value)))}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} aria-label={label} />
  )
}

export function Inventory() {
  const { data: products = [] } = useList('products')
  const { data: settings = [] } = useList('settings')
  const save = useSave('products')
  const threshold = (Array.isArray(settings) ? settings[0] : settings)?.lowStock ?? 3
  const [onlyLow, setOnlyLow] = useState(false)
  const rows = products.flatMap((p) => p.variants.map((v) => ({ p, v }))).filter(({ v }) => !onlyLow || v.stock <= threshold)

  const setStock = (p, v, stock) => {
    const variants = p.variants.map((x) => (x.sku === v.sku && x.color === v.color && x.size === v.size ? { ...x, stock: Math.max(0, +stock || 0) } : x))
    save.mutate({ ...p, variants }, { onSuccess: () => toast('Stock updated.') })
  }
  return (
    <>
      <PageHead title="Inventory" sub={`Low-stock alert at ${threshold} or fewer`}><Toggle checked={onlyLow} onChange={setOnlyLow} label="Only low stock" /></PageHead>
      <div className="a-card a-card--flush">
        <table className="a-table">
          <thead><tr><th>Product</th><th>Colour</th><th>Size</th><th>SKU</th><th style={{ width: 130 }}>Stock</th></tr></thead>
          <tbody>
            {rows.map(({ p, v }) => (
              <tr key={p.id + v.color + v.size}>
                <td><div className="a-prod"><img src={imgSrc(p.images[0])} alt="" /><b>{p.name}</b></div></td>
                <td>{v.color}</td><td>{v.size}</td><td className="muted">{v.sku}</td>
                <td><StockInput key={v.stock} value={v.stock} threshold={threshold} onCommit={(n) => setStock(p, v, n)} label={`${p.name} ${v.color} ${v.size} stock`} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5} className="muted">Nothing low. Nice.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* =============================== CUSTOMERS ============================== */

function CustomerDetail({ c, onClose }) {
  const save = useSave('customers')
  const { data: orders = [] } = useQuery({ queryKey: ['admin', 'orders-page', { q: c.phone }], queryFn: () => api.listOrders({ q: c.phone, pageSize: 50 }).then((r) => r.rows) })
  const [notes, setNotes] = useState(c.notes || '')
  const [tags, setTags] = useState((c.tags || []).join(', '))
  const submit = async () => {
    try { await save.mutateAsync({ ...c, notes, tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10) }) } catch { return }
    toast('Customer saved.'); onClose()
  }
  return (
    <Modal wide title={c.name} onClose={onClose} footer={<><button className="btn btn--ghost" onClick={onClose}>Close</button><button className="btn" onClick={submit} id="save-customer">Save</button></>}>
      <div className="a-form">
        <div className="a-form__col">
          <p><a className="link" href={`tel:${c.phone}`}>{c.phone}</a>{c.email && <><br />{c.email}</>}<br /><span className="muted">{c.governorate}{c.userId ? ' · has an account' : ''}</span></p>
          <div className="a-stats a-stats--sm">
            <div className="stat"><span className="eyebrow muted">Orders</span><b className="serif">{c.orders}</b></div>
            <div className="stat"><span className="eyebrow muted">Spent</span><b className="serif">{formatPrice(c.spent)}</b></div>
          </div>
          <Field label="Tags" hint="Comma separated: vip, influencer, wholesale"><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} id="cust-tags" /></Field>
          <Field label="Notes (only staff see these)"><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} id="cust-notes" /></Field>
        </div>
        <div className="a-form__col">
          <h3 className="eyebrow">Orders</h3>
          <ul className="a-list">{orders.map((o) => <li key={o.id}><span>{o.number} <small className="muted">{fmtDateTime(o.createdAt)}</small></span><span><Pill>{o.status}</Pill> {formatPrice(o.total)}</span></li>)}</ul>
        </div>
      </div>
    </Modal>
  )
}

export function Customers() {
  const { data: rows = [], isLoading } = useList('customers')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')
  const [open, setOpen] = useState(null)
  const allTags = [...new Set(rows.flatMap((c) => c.tags || []))].sort()
  const customers = useMemo(() => rows
    .filter((c) => (!tag || (c.tags || []).includes(tag)) && [c.name, c.phone, c.email].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.spent || 0) - (a.spent || 0)), [rows, q, tag])
  const exportList = () => {
    const csv = [['Name', 'Phone', 'Email', 'Governorate', 'Orders', 'Spent', 'Tags'], ...customers.map((c) => [c.name, c.phone, c.email, c.governorate, c.orders, c.spent, (c.tags || []).join(' ')])].map((r) => r.map(csvCell).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'the-mood-customers.csv'
    a.click()
  }
  return (
    <>
      <PageHead title="Customers" sub={`${customers.length} people`}><button className="btn btn--ghost" onClick={exportList}>Export CSV</button></PageHead>
      <div className="a-toolbar">
        <input className="input input--sm" placeholder="Search customers" value={q} onChange={(e) => setQ(e.target.value)} />
        {allTags.length > 0 && <select className="select select--sm" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag"><option value="">All tags</option>{allTags.map((t) => <option key={t}>{t}</option>)}</select>}
      </div>
      <div className="a-card a-card--flush">
        <table className="a-table a-table--click">
          <thead><tr><th>Customer</th><th>Phone</th><th>Governorate</th><th>Orders</th><th>Spent</th><th>Last order</th></tr></thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} onClick={() => setOpen(c)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setOpen(c)}>
                <td><b>{c.name}</b>{(c.tags || []).length > 0 && <span className="a-tags">{c.tags.map((t) => <Pill key={t} tone="draft">{t}</Pill>)}</span>}<small className="muted">{c.email}</small></td>
                <td>{c.phone}</td><td>{c.governorate}</td><td>{c.orders}</td><td>{formatPrice(c.spent)}</td><td className="muted">{fmtDateTime(c.lastOrderAt)}</td>
              </tr>
            ))}
            {!isLoading && !customers.length && <tr><td colSpan={6} className="muted">Customers appear after their first order.</td></tr>}
          </tbody>
        </table>
      </div>
      <AnimatePresence>{open && <CustomerDetail key={open.id} c={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </>
  )
}

/* ================================ SETTINGS ============================== */

export function Settings() {
  const role = useAuth((x) => x.role)
  const { data: rows = [] } = useList('settings')
  const save = useSave('settings')
  const [s, setS] = useState(null)
  const current = s || (Array.isArray(rows) ? rows[0] : null)
  if (!current) return <p className="muted">Loading…</p>
  const set = (path, value) => setS((prev) => {
    const next = structuredClone(prev || current)
    const keys = path.split('.')
    let o = next
    keys.slice(0, -1).forEach((k) => { o[k] = o[k] ?? {}; o = o[k] })
    o[keys.at(-1)] = value
    return next
  })
  const zones = current.shipping?.zones || []
  const setZone = (gov, fee) => {
    const rest = zones.filter((z) => z.governorate !== gov)
    set('shipping.zones', fee === '' ? rest : [...rest, { governorate: gov, fee: +fee }])
  }
  const submit = async () => {
    try { await save.mutateAsync({ ...current, id: 'store' }); setS(null); toast('Settings saved.') } catch { /* toast shown by useSave */ }
  }

  return (
    <>
      <PageHead title="Settings"><button className="btn" onClick={submit} disabled={!s || save.isPending} id="save-settings">Save settings</button></PageHead>
      <div className="a-grid2">
        <section className="a-card a-form a-form--one">
          <h2 className="eyebrow">Store</h2>
          <Field label="Tagline"><input className="input" value={current.tagline || ''} onChange={(e) => set('tagline', e.target.value)} /></Field>
          <Field label="Announcement bar phrases" hint="One per line"><textarea className="textarea" value={(current.announcements || []).join('\n')} onChange={(e) => set('announcements', e.target.value.split('\n').filter(Boolean))} /></Field>
          <Field label="Instagram"><input className="input" value={current.social?.instagram || ''} onChange={(e) => set('social.instagram', e.target.value)} /></Field>
          <Field label="Facebook"><input className="input" value={current.social?.facebook || ''} onChange={(e) => set('social.facebook', e.target.value)} /></Field>
          <div className="two"><Field label="Contact email"><input className="input" value={current.contact?.email || ''} onChange={(e) => set('contact.email', e.target.value)} /></Field><Field label="Contact phone"><input className="input" value={current.contact?.phone || ''} onChange={(e) => set('contact.phone', e.target.value)} /></Field></div>
          <Field label="Low-stock alert at"><input className="input" type="number" min="0" value={current.lowStock ?? 3} onChange={(e) => set('lowStock', +e.target.value)} /></Field>
        </section>
        <section className="a-card a-form a-form--one">
          <h2 className="eyebrow">Shipping & payments</h2>
          <div className="two">
            <Field label="Default shipping fee (EGP)"><input className="input" type="number" min="0" value={current.shipping?.defaultFee ?? 0} onChange={(e) => set('shipping.defaultFee', +e.target.value)} /></Field>
            <Field label="Free shipping over (EGP)" hint="0 = never"><input className="input" type="number" min="0" value={current.shipping?.freeThreshold ?? 0} onChange={(e) => set('shipping.freeThreshold', +e.target.value)} /></Field>
          </div>
          <div className="a-toggles"><Toggle checked={current.payments?.cod !== false} onChange={(v) => set('payments.cod', v)} label="Cash on delivery (turn off to pause all orders)" /></div>
          <Field label="Fee per governorate" hint="Leave blank to use the default fee">
            <div className="zones">{GOVERNORATES.map((g) => (
              <label key={g}><span>{g}</span><input className="input input--stock" type="number" min="0" placeholder={String(current.shipping?.defaultFee ?? '')} value={zones.find((z) => z.governorate === g)?.fee ?? ''} onChange={(e) => setZone(g, e.target.value)} /></label>
            ))}</div>
          </Field>
        </section>
      </div>
      <div className="a-grid2">
        <section className="a-card a-form a-form--one">
          <h2 className="eyebrow">Notifications</h2>
          <p className="muted small">Order emails go through Resend, WhatsApp through the WhatsApp Cloud API. Keys are set on the server (see README).</p>
          <div className="a-toggles">
            <Toggle checked={current.notifications?.email !== false} onChange={(v) => set('notifications.email', v)} label="Email customers about their order" />
            <Toggle checked={!!current.notifications?.whatsapp} onChange={(v) => set('notifications.whatsapp', v)} label="WhatsApp customers about their order" />
            <Toggle checked={current.notifications?.lowStockDigest !== false} onChange={(v) => set('notifications.lowStockDigest', v)} label="Morning low-stock email" />
          </div>
          <div className="two">
            <Field label="New-order alerts to (email)"><input className="input" type="email" value={current.notifications?.adminEmail || ''} onChange={(e) => set('notifications.adminEmail', e.target.value)} placeholder={current.contact?.email || ''} /></Field>
            <Field label="New-order alerts to (WhatsApp)"><input className="input" inputMode="tel" value={current.notifications?.adminWhatsapp || ''} onChange={(e) => set('notifications.adminWhatsapp', e.target.value)} placeholder="010…" /></Field>
          </div>
        </section>
        <section className="a-card a-form a-form--one">
          <h2 className="eyebrow">Couriers</h2>
          <p className="muted small">Tracking links for customers. Put <code>{'{number}'}</code> where the tracking number goes.</p>
          {(current.couriers || []).map((c, i) => (
            <div className="two" key={i}>
              <input className="input" aria-label="Courier name" value={c.name} onChange={(e) => set('couriers', current.couriers.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
              <div className="row"><input className="input" aria-label="Tracking URL" value={c.url} onChange={(e) => set('couriers', current.couriers.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} /><button className="link danger" onClick={() => set('couriers', current.couriers.filter((_, k) => k !== i))}>Remove</button></div>
            </div>
          ))}
          <button className="link" onClick={() => set('couriers', [...(current.couriers || []), { name: '', url: 'https://' }])}>+ Add courier</button>
        </section>
      </div>
      {role === 'owner' && <Team />}
    </>
  )
}

const ROLE_HELP = { owner: 'Everything, including the team', admin: 'Everything except the team', staff: 'Orders, inventory, customers and reviews' }

/** Owners add people by email (they sign up at /login first) and pick a role. */
function Team() {
  const { data: staff = [], refetch } = useList('staff')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('staff')
  const [busy, setBusy] = useState(false)
  const apply = async (em, r) => {
    setBusy(true)
    try { await api.setStaffRole({ email: em, role: r }); toast(r ? `${em} is now ${r}.` : `${em} removed.`); setEmail(''); refetch() } catch (e) { toast(e.message, 'err') }
    setBusy(false)
  }
  return (
    <section className="a-card a-form a-form--one">
      <h2 className="eyebrow">Team</h2>
      <ul className="a-list">{staff.map((m) => <li key={m.id}><span>{m.email} <small className="muted">{m.role}</small></span><button className="link danger" disabled={busy} onClick={() => confirm(`Remove ${m.email}?`) && apply(m.email, null)}>Remove</button></li>)}</ul>
      <div className="row">
        <input className="input" type="email" placeholder="their@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Team member email" />
        <select className="select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">{Object.keys(ROLE_HELP).map((r) => <option key={r}>{r}</option>)}</select>
        <button className="btn" disabled={busy || !email} onClick={() => apply(email.trim().toLowerCase(), role)}>Add</button>
      </div>
      <p className="muted small">{ROLE_HELP[role]}. They need to sign out and back in to see the change.</p>
    </section>
  )
}
