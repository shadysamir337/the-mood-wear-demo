import { useMemo, useState } from 'react'
import { PageHead, Pill, useList, useRemove, useSave, toast } from './ui'
import { Stars } from '../components/Stars'
import { fmtDateTime } from '../lib/format'

/* ================================ REVIEWS =============================== */

function ReviewRow({ r, product }) {
  const save = useSave('reviews')
  const remove = useRemove('reviews')
  const [reply, setReply] = useState(r.reply || '')
  // mutateAsync: the row may unmount (it leaves the filtered list) before a per-call onSuccess would run
  const set = (patch, msg) => save.mutateAsync({ ...r, ...patch }).then(() => toast(msg), () => {})
  return (
    <li className="a-review">
      <div className="a-review__head">
        <Stars value={r.rating} />
        <b>{r.name}</b>
        <span className="muted small">on {product?.name || r.productId} · {r.orderNumber} · {fmtDateTime(r.createdAt)}</span>
        <Pill tone={r.status === 'approved' ? 'active' : r.status === 'rejected' ? 'archived' : 'draft'}>{r.status}</Pill>
      </div>
      {r.text ? <p className="a-review__text">“{r.text}”</p> : <p className="muted small">No text, just stars.</p>}
      <div className="a-review__actions">
        <input className="input input--sm" placeholder="Public reply (optional)" value={reply} onChange={(e) => setReply(e.target.value)} aria-label={`Reply to ${r.name}`} />
        {r.status !== 'approved' && <button className="btn btn--sm" onClick={() => set({ status: 'approved', reply }, 'Review published.')}>Approve</button>}
        {r.status === 'approved' && reply !== (r.reply || '') && <button className="btn btn--sm" onClick={() => set({ reply }, 'Reply saved.')}>Save reply</button>}
        {r.status !== 'rejected' && <button className="link" onClick={() => set({ status: 'rejected' }, 'Review hidden.')}>Reject</button>}
        <button className="link danger" onClick={() => confirm('Delete this review for good?') && remove.mutate(r.id)}>Delete</button>
      </div>
    </li>
  )
}

export function Reviews() {
  const { data: reviews = [], isLoading } = useList('reviews')
  const { data: products = [] } = useList('products')
  const [status, setStatus] = useState('pending')
  const list = useMemo(() => reviews.filter((r) => !status || r.status === status).sort((a, b) => b.createdAt - a.createdAt), [reviews, status])
  const count = (s) => reviews.filter((r) => r.status === s).length
  return (
    <>
      <PageHead title="Reviews" sub="Only customers with a delivered order can review. Nothing shows until you approve it." />
      <div className="a-toolbar">
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <button key={s || 'all'} className={`chip ${status === s ? 'is-on' : ''}`} aria-pressed={status === s} onClick={() => setStatus(s)}>{s || 'All'}{s && ` (${count(s)})`}</button>
        ))}
      </div>
      <div className="a-card">
        {isLoading ? <p className="muted">Loading…</p> : list.length ? (
          <ul className="a-reviews">{list.map((r) => <ReviewRow key={r.id + r.status} r={r} product={products.find((p) => p.id === r.productId)} />)}</ul>
        ) : <p className="muted">{status === 'pending' ? 'Nothing waiting. ' : ''}Reviews arrive after an order is marked delivered.</p>}
      </div>
    </>
  )
}

/* ================================ ACTIVITY ============================== */

export function Activity() {
  const { data: log = [], isLoading } = useList('auditLog')
  const [q, setQ] = useState('')
  const list = log
    .filter((l) => !q || [l.actor, l.action, l.target].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.at - a.at)
  return (
    <>
      <PageHead title="Activity" sub="Who changed what: products, prices, promos, sales, settings and order statuses." />
      <div className="a-toolbar"><input className="input input--sm" placeholder="Search activity" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="a-card a-card--flush">
        <table className="a-table">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Item</th><th>Changed</th></tr></thead>
          <tbody>
            {list.slice(0, 300).map((l) => (
              <tr key={l.id}><td className="muted">{fmtDateTime(l.at)}</td><td>{l.actor}</td><td><code>{l.action}</code></td><td>{l.target}</td><td className="muted small">{(l.details?.changed || []).join(', ') || l.details?.status || l.details?.role || ''}</td></tr>
            ))}
            {!isLoading && !list.length && <tr><td colSpan={5} className="muted">No activity yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  )
}
