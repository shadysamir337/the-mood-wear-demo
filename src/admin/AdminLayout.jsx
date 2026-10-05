import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth, DEMO_ADMIN, can, isStaffRole } from '../lib/auth'
import { isFirebaseConfigured } from '../lib/config'
import { LineMark, Wordmark } from '../components/Brand'
import { Toaster, useList } from './ui'

const LINKS = [
  { to: '/admin', label: 'Dashboard', end: true, perm: 'dashboard' },
  { to: '/admin/orders', label: 'Orders', badge: 'orders', perm: 'orders' },
  { to: '/admin/products', label: 'Products', perm: 'products' },
  { to: '/admin/moods', label: 'Moods', perm: 'moods' },
  { to: '/admin/inventory', label: 'Inventory', perm: 'inventory' },
  { to: '/admin/promos', label: 'Promo codes', perm: 'promos' },
  { to: '/admin/sales', label: 'Sales', perm: 'sales' },
  { to: '/admin/banners', label: 'Banners', perm: 'banners' },
  { to: '/admin/customers', label: 'Customers', perm: 'customers' },
  { to: '/admin/reviews', label: 'Reviews', badge: 'reviews', perm: 'reviews' },
  { to: '/admin/activity', label: 'Activity', perm: 'activity' },
  { to: '/admin/settings', label: 'Settings', perm: 'settings' },
]

export function AdminLogin() {
  const { user, role, adminLogin, error, ready } = useAuth()
  const [email, setEmail] = useState(isFirebaseConfigured ? '' : DEMO_ADMIN.email)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  if (ready && user && isStaffRole(role)) return <Navigate to="/admin" replace />
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); await adminLogin(email, password); setBusy(false)
  }
  return (
    <div className="a-login">
      <title>Admin — THE MOOD</title>
      <meta name="robots" content="noindex" />
      <form className="a-login__card" onSubmit={submit}>
        <LineMark size={80} draw />
        <Wordmark />
        <p className="eyebrow muted">Admin</p>
        <div className="field"><label htmlFor="a-email">Email</label><input id="a-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="field"><label htmlFor="a-pass">Password</label><input id="a-pass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        {error && <p className="field-error">{error}</p>}
        <button className="btn btn--block" disabled={busy} id="a-login-btn">{busy ? 'Signing in…' : 'Sign in'}</button>
        {!isFirebaseConfigured && (
          <p className="a-demo small">Demo mode: Firebase isn't connected yet, so everything is saved in this browser. Use <b>{DEMO_ADMIN.email}</b> / <b>{DEMO_ADMIN.password}</b>.</p>
        )}
        <Link to="/" className="link">Back to store</Link>
      </form>
    </div>
  )
}

export default function AdminLayout() {
  const { user, ready, logout, role } = useAuth()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const staff = ready && user && isStaffRole(role)
  const { data: orders = [] } = useList('orders', { enabled: !!staff })
  const { data: reviews = [] } = useList('reviews', { enabled: !!staff && can(role, 'reviews') })
  const badges = { orders: orders.filter((o) => o.status === 'pending').length, reviews: reviews.filter((r) => r.status === 'pending').length }
  const [openPath, setOpenPath] = useState(pathname)
  if (openPath !== pathname) { setOpenPath(pathname); setOpen(false) }

  if (!ready) return <div className="a-loading">Loading…</div>
  if (!staff) return <Navigate to="/admin/login" replace />
  const section = pathname.split('/')[2] || 'dashboard'
  const allowed = can(role, section)

  return (
    <div className="admin">
      <title>Admin — THE MOOD</title>
      <meta name="robots" content="noindex" />
      <aside className={`a-side ${open ? 'is-open' : ''}`}>
        <Link to="/admin" className="a-side__brand"><Wordmark /><span className="eyebrow">Admin</span></Link>
        <nav>
          {LINKS.filter((l) => can(role, l.perm)).map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className="a-link">
              {l.label}
              {l.badge && badges[l.badge] > 0 && <b className="a-badge">{badges[l.badge]}</b>}
            </NavLink>
          ))}
        </nav>
        <div className="a-side__foot">
          <Link to="/" target="_blank" className="a-link">View store ↗</Link>
          <button className="a-link" onClick={logout} id="a-logout">Sign out</button>
          <p className="small muted">{user.email} · {role}</p>
          {!isFirebaseConfigured && <p className="a-demo-tag">Demo mode</p>}
        </div>
      </aside>
      <div className="a-main">
        <div className="a-topbar"><button onClick={() => setOpen(!open)} className="eyebrow" id="a-menu">Menu</button><Wordmark /></div>
        <div className="a-content">{allowed ? <Outlet /> : <p className="muted">Your role ({role}) can't open this page. Ask the store owner.</p>}</div>
      </div>
      <Toaster />
    </div>
  )
}
