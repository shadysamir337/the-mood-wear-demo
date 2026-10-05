import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHead, Pill, useList } from './ui'
import { formatPrice } from '../lib/pricing'
import { fmtDateTime } from '../lib/format'

const DAY = 86400000
const COUNTED = (o) => !['cancelled', 'returned', 'refunded'].includes(o.status)

/** Change vs. the previous period of the same length. */
function Delta({ now, before }) {
  if (!before) return <small className="muted">no earlier data</small>
  const pct = Math.round(((now - before) / before) * 100)
  return <small className={pct >= 0 ? 'delta delta--up' : 'delta delta--down'}>{pct >= 0 ? '↑' : '↓'} {Math.abs(pct)}% vs previous</small>
}

export default function Dashboard() {
  const { data: orders = [] } = useList('orders')
  const { data: products = [] } = useList('products')
  const { data: moods = [] } = useList('moods')
  const { data: promos = [] } = useList('promos')
  const { data: settings = [] } = useList('settings')
  const [range, setRange] = useState(30)

  const s = useMemo(() => {
    const now = Date.now()
    const since = now - range * DAY
    const inRange = orders.filter((o) => o.createdAt >= since)
    const valid = inRange.filter(COUNTED)
    const revenue = valid.reduce((n, o) => n + o.total, 0)
    const prevOrders = orders.filter((o) => o.createdAt >= since - range * DAY && o.createdAt < since)
    const prevValid = prevOrders.filter(COUNTED)
    const prevRevenue = prevValid.reduce((n, o) => n + o.total, 0)
    const byGov = {}
    valid.forEach((o) => { byGov[o.address.governorate] = (byGov[o.address.governorate] || 0) + 1 })
    const topGov = Object.entries(byGov).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const manual = valid.filter((o) => o.source === 'manual').length
    const cancelled = inRange.filter((o) => o.status === 'cancelled').length
    const customers = new Set(inRange.map((o) => o.customer.phone)).size

    const days = Array.from({ length: Math.min(range, 30) }, (_, i) => {
      const start = new Date(); start.setHours(0, 0, 0, 0)
      const t = start.getTime() - (Math.min(range, 30) - 1 - i) * DAY
      const total = orders.filter((o) => COUNTED(o) && o.createdAt >= t && o.createdAt < t + DAY).reduce((n, o) => n + o.total, 0)
      return { t, total }
    })

    const byProduct = {}
    valid.forEach((o) => o.items.forEach((it) => { byProduct[it.name] = (byProduct[it.name] || 0) + it.qty }))
    const top = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5)

    const byMood = {}
    valid.forEach((o) => o.items.forEach((it) => {
      const p = products.find((x) => x.id === it.productId)
      const name = moods.find((m) => m.id === p?.moodId)?.name || 'Other'
      byMood[name] = (byMood[name] || 0) + it.qty * it.unitPrice
    }))
    const topMoods = Object.entries(byMood).sort((a, b) => b[1] - a[1]).slice(0, 4)

    return { prevRevenue, prevOrders: prevOrders.length, prevAov: prevValid.length ? prevRevenue / prevValid.length : 0, topGov, manual, cancelled, revenue, orders: inRange.length, aov: valid.length ? revenue / valid.length : 0, customers, days, top, topMoods, pending: orders.filter((o) => o.status === 'pending').length }
  }, [orders, products, moods, range])

  const lowAt = settings[0]?.lowStock ?? 3
  const lowAll = products.filter((p) => p.status === 'active').flatMap((p) => p.variants.filter((v) => v.stock <= lowAt).map((v) => ({ p, v }))).sort((a, b) => a.v.stock - b.v.stock)
  const low = lowAll.slice(0, 8)
  const max = Math.max(1, ...s.days.map((d) => d.total))

  return (
    <>
      <PageHead title="Dashboard" sub="How THE MOOD is feeling.">
        <select className="select select--sm" value={range} onChange={(e) => setRange(+e.target.value)} aria-label="Range">
          <option value={1}>Today</option><option value={7}>7 days</option><option value={30}>30 days</option><option value={365}>12 months</option>
        </select>
      </PageHead>

      <div className="a-stats">
        <div className="stat"><span className="eyebrow muted">Revenue</span><b className="serif">{formatPrice(s.revenue)}</b><Delta now={s.revenue} before={s.prevRevenue} /></div>
        <div className="stat"><span className="eyebrow muted">Orders</span><b className="serif">{s.orders}</b><Delta now={s.orders} before={s.prevOrders} /></div>
        <div className="stat"><span className="eyebrow muted">Avg. order</span><b className="serif">{formatPrice(s.aov)}</b><Delta now={s.aov} before={s.prevAov} /></div>
        <div className="stat"><span className="eyebrow muted">Customers</span><b className="serif">{s.customers}</b></div>
      </div>

      <div className="a-grid2">
        <section className="a-card">
          <h2 className="eyebrow">Sales, last {Math.min(range, 30)} days</h2>
          <div className="chart">
            {s.days.map((d) => (
              <div key={d.t} className="chart__col" title={`${new Date(d.t).toLocaleDateString('en-GB')}: ${formatPrice(d.total)}`}>
                <i style={{ height: `${(d.total / max) * 100}%` }} />
              </div>
            ))}
          </div>
        </section>
        <section className="a-card">
          <h2 className="eyebrow">Needs attention</h2>
          <ul className="a-list">
            <li><span>Pending orders</span><Link to="/admin/orders" className="link">{s.pending}</Link></li>
            <li><span>Low-stock sizes</span><Link to="/admin/inventory" className="link">{lowAll.length}</Link></li>
            <li><span>Active promo codes</span><Link to="/admin/promos" className="link">{promos.filter((p) => p.active).length}</Link></li>
          </ul>
        </section>
      </div>

      <div className="a-grid3">
        <section className="a-card">
          <h2 className="eyebrow">Top pieces</h2>
          <ul className="a-list">{s.top.length ? s.top.map(([n, q]) => <li key={n}><span>{n}</span><b>{q}</b></li>) : <li className="muted">No sales yet.</li>}</ul>
        </section>
        <section className="a-card">
          <h2 className="eyebrow">Top moods</h2>
          <ul className="a-list">{s.topMoods.length ? s.topMoods.map(([n, v]) => <li key={n}><span>{n}</span><b>{formatPrice(v)}</b></li>) : <li className="muted">No sales yet.</li>}</ul>
        </section>
        <section className="a-card">
          <h2 className="eyebrow">Where orders go</h2>
          <ul className="a-list">{s.topGov.length ? s.topGov.map(([g, n]) => <li key={g}><span>{g}</span><b>{n}</b></li>) : <li className="muted">No orders yet.</li>}</ul>
          <p className="muted small">{s.manual} manual · {s.cancelled} cancelled in this period</p>
        </section>
        <section className="a-card">
          <h2 className="eyebrow">Low stock</h2>
          <ul className="a-list">{low.length ? low.map(({ p, v }) => <li key={p.id + v.color + v.size}><span>{p.name} · {v.color} {v.size}</span><b className={v.stock === 0 ? 'danger' : ''}>{v.stock}</b></li>) : <li className="muted">All stocked.</li>}</ul>
        </section>
      </div>

      <section className="a-card">
        <div className="a-card__head"><h2 className="eyebrow">Recent orders</h2><Link to="/admin/orders" className="link">All orders</Link></div>
        <table className="a-table">
          <thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Placed</th></tr></thead>
          <tbody>
            {orders.slice(0, 6).map((o) => (
              <tr key={o.id}><td><b>{o.number}</b></td><td>{o.customer.name}</td><td>{formatPrice(o.total)}</td><td><Pill>{o.status}</Pill></td><td className="muted">{fmtDateTime(o.createdAt)}</td></tr>
            ))}
            {!orders.length && <tr><td colSpan={5} className="muted">No orders yet. They'll show up here the moment someone checks out.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  )
}
