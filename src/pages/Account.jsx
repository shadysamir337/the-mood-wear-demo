import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Lines, Reveal } from '../components/Motion'
import { LineMark } from '../components/Brand'
import ProductCard from '../components/ProductCard'
import { StarInput } from '../components/Stars'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { useProducts } from '../lib/store'
import { useWishlist } from '../lib/wishlist'
import { isFirebaseConfigured } from '../lib/config'
import { formatPrice, GOVERNORATES } from '../lib/pricing'
import { fmtDate } from '../lib/format'
import { imgProps } from '../lib/images'

/* -------------------------------- login -------------------------------- */

export function Login() {
  const { user, ready, login, signup, google, reset, error, clearError } = useAuth()
  const [mode, setMode] = useState('in')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const { state } = useLocation()
  const navigate = useNavigate()
  const next = state?.from || '/account'
  if (ready && user) return <Navigate to={next} replace />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const switchTo = (m) => { clearError(); setSent(false); setMode(m) }
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    if (mode === 'in' && (await login(form.email, form.password))) navigate(next, { replace: true })
    if (mode === 'up' && (await signup(form))) navigate(next, { replace: true })
    if (mode === 'reset' && (await reset(form.email))) setSent(true)
    setBusy(false)
  }

  return (
    <div className="page container narrow account">
      <title>Sign in — THE MOOD</title>
      <meta name="robots" content="noindex" />
      <header className="page-head">
        <p className="eyebrow">Account</p>
        <Lines as="h1" className="display page-head__title" lines={[mode === 'up' ? 'Join the mood.' : mode === 'reset' ? 'Reset it.' : 'Welcome back.']} delay={0.05} key={mode} />
      </header>
      <div className="tabs" role="tablist" aria-label="Sign in or create account">
        <button role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'is-on' : ''} onClick={() => switchTo('in')}>Sign in</button>
        <button role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'is-on' : ''} onClick={() => switchTo('up')}>Create account</button>
      </div>
      <form className="authform" onSubmit={submit}>
        {mode === 'up' && <div className="field"><label htmlFor="acc-name">Name</label><input id="acc-name" className="input" autoComplete="name" value={form.name} onChange={set('name')} required /></div>}
        <div className="field"><label htmlFor="acc-email">Email</label><input id="acc-email" className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} required /></div>
        {mode !== 'reset' && <div className="field"><label htmlFor="acc-pass">Password</label><input id="acc-pass" className="input" type="password" autoComplete={mode === 'up' ? 'new-password' : 'current-password'} minLength={mode === 'up' ? 8 : undefined} value={form.password} onChange={set('password')} required /></div>}
        {error && <p className="field-error" role="alert">{error}</p>}
        {sent && <p className="muted" role="status">If that email has an account, a reset link is on its way.</p>}
        <button className="btn btn--block" disabled={busy} id="acc-submit">{busy ? 'One second…' : mode === 'up' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'}</button>
        {isFirebaseConfigured && mode !== 'reset' && <button type="button" className="btn btn--ghost btn--block" onClick={async () => (await google()) && navigate(next, { replace: true })}>Continue with Google</button>}
        {mode === 'in' && <button type="button" className="link" onClick={() => switchTo('reset')}>Forgot password?</button>}
        {mode === 'reset' && <button type="button" className="link" onClick={() => switchTo('in')}>Back to sign in</button>}
      </form>
      <p className="muted small">No account needed to order. One just keeps your orders, addresses and wishlist in one place.</p>
    </div>
  )
}

/* ------------------------------- account ------------------------------- */

function useProfile(uid) {
  return useQuery({ queryKey: ['profile', uid], queryFn: () => api.getProfile(uid), enabled: !!uid })
}

function AddressBook({ uid, profile }) {
  const qc = useQueryClient()
  const [draft, setDraft] = useState(null)
  const [msg, setMsg] = useState('')
  const addresses = profile?.addresses || []
  const save = async (list) => {
    await api.saveProfile(uid, { addresses: list })
    qc.invalidateQueries({ queryKey: ['profile', uid] })
  }
  const add = async (e) => {
    e.preventDefault()
    if (!draft.governorate || draft.street.trim().length < 5) return setMsg('Add the governorate and street.')
    await save([...addresses, draft].slice(0, 5))
    setDraft(null); setMsg('')
  }
  return (
    <section className="acc-card">
      <h2 className="eyebrow">Addresses</h2>
      {!addresses.length && !draft && <p className="muted">No saved addresses yet. We'll offer to save one at checkout.</p>}
      <ul className="addr">
        {addresses.map((a, i) => (
          <li key={i}><span>{a.street}, {a.city}<br /><span className="muted">{a.governorate}</span></span><button className="link danger" onClick={() => save(addresses.filter((_, k) => k !== i))}>Remove</button></li>
        ))}
      </ul>
      {draft ? (
        <form onSubmit={add} className="addr__form">
          <select className="select" aria-label="Governorate" value={draft.governorate} onChange={(e) => setDraft({ ...draft, governorate: e.target.value })}><option value="">Governorate…</option>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}</select>
          <input className="input" aria-label="City or area" placeholder="City / area" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
          <input className="input" aria-label="Street and building" placeholder="Street & building" value={draft.street} onChange={(e) => setDraft({ ...draft, street: e.target.value })} />
          {msg && <p className="field-error">{msg}</p>}
          <div className="row"><button className="btn">Save address</button><button type="button" className="link" onClick={() => setDraft(null)}>Cancel</button></div>
        </form>
      ) : addresses.length < 5 && <button className="link" onClick={() => setDraft({ governorate: '', city: '', street: '' })}>+ Add address</button>}
    </section>
  )
}

function Profile({ user, profile }) {
  const qc = useQueryClient()
  const [name, setName] = useState(profile?.name ?? user.name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [saved, setSaved] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    await api.saveProfile(user.uid, { name: name.trim(), phone: phone.trim(), email: user.email })
    qc.invalidateQueries({ queryKey: ['profile', user.uid] })
    setSaved(true)
  }
  return (
    <section className="acc-card">
      <h2 className="eyebrow">Details</h2>
      <form onSubmit={submit} className="authform">
        <div className="field"><label htmlFor="pf-name">Name</label><input id="pf-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} /></div>
        <div className="field"><label htmlFor="pf-phone">Phone</label><input id="pf-phone" className="input" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false) }} /></div>
        <p className="muted small">{user.email}{isFirebaseConfigured && !user.emailVerified ? ' · check your inbox to verify this email' : ''}</p>
        <button className="btn btn--ghost">{saved ? 'Saved' : 'Save details'}</button>
      </form>
    </section>
  )
}

export function Account() {
  const { user, ready, logout } = useAuth()
  const { data: profile, isLoading: loadingProfile } = useProfile(user?.uid)
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['my-orders', user?.uid], queryFn: () => api.myOrders(user.uid), enabled: !!user })
  if (ready && !user) return <Navigate to="/login" state={{ from: '/account' }} replace />
  if (!user) return <div className="page" />

  return (
    <div className="page container account">
      <title>Your account — THE MOOD</title>
      <meta name="robots" content="noindex" />
      <header className="page-head">
        <p className="eyebrow">Account</p>
        <Lines as="h1" className="display page-head__title" lines={[`Hi, ${(profile?.name || user.name || 'you').split(' ')[0]}.`]} delay={0.05} />
      </header>
      <div className="acc-grid">
        <section className="acc-card acc-orders">
          <h2 className="eyebrow">Orders</h2>
          {isLoading ? <p className="muted">Loading…</p> : !orders.length ? (
            <div><p className="muted">No orders on this account yet.</p><Link to="/shop" className="link">Find your mood</Link></div>
          ) : (
            <ul className="myorders">
              {orders.map((o) => (
                <li key={o.id}>
                  <div className="myorders__imgs">{o.items.slice(0, 3).map((i, k) => <img key={k} {...imgProps(i.image, '56px')} alt="" />)}</div>
                  <div><b>{o.number}</b><p className="muted small">{fmtDate(o.createdAt)} · {o.items.reduce((n, i) => n + i.qty, 0)} pieces · {formatPrice(o.total)}</p></div>
                  <span className={`pill pill--${o.status}`}>{o.status}</span>
                  {o.status === 'delivered' && <Link className="link" to={o.reviewToken ? `/review/${o.reviewToken}` : `/review/order/${o.id}`}>Review</Link>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="acc-side">
          {!loadingProfile && <Profile key={profile?.updatedAt || 'new'} user={user} profile={profile} />}
          <AddressBook uid={user.uid} profile={profile} />
          <section className="acc-card"><Link to="/wishlist" className="link">Your wishlist</Link></section>
          <button className="link" onClick={logout} id="acc-logout">Sign out</button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------- wishlist ------------------------------ */

export function Wishlist() {
  const ids = useWishlist((s) => s.ids)
  const { products, isLoading } = useProducts()
  const list = ids.map((id) => products.find((p) => p.id === id)).filter(Boolean)
  return (
    <div className="page container">
      <title>Wishlist — THE MOOD</title>
      <meta name="robots" content="noindex" />
      <header className="page-head">
        <p className="eyebrow">Wishlist</p>
        <Lines as="h1" className="display page-head__title" lines={['Saved for', 'the right day.']} delay={0.05} />
      </header>
      {!isLoading && !list.length ? (
        <div className="empty"><LineMark size={90} /><p className="h3 serif">Nothing saved yet.</p><Link to="/shop" className="btn">Find your mood</Link></div>
      ) : (
        <div className="grid">{list.map((p, i) => <Reveal key={p.id} delay={(i % 4) * 0.06}><ProductCard product={p} /></Reveal>)}</div>
      )}
    </div>
  )
}

/* -------------------------------- review ------------------------------- */

function ReviewItem({ item, auth }) {
  const [rating, setRating] = useState(0)
  const [text, setText] = useState('')
  const [state, setState] = useState(item.reviewed ? 'done' : 'idle')
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    if (!rating) return setErr('Pick 1 to 5 stars.')
    setState('busy'); setErr('')
    try {
      await api.submitReview({ ...auth, productId: item.productId, rating, text })
      setState('done')
    } catch (e2) { setErr(e2.message); setState('idle') }
  }
  return (
    <li className="revitem">
      <img {...imgProps(item.image, '96px')} alt="" />
      <div>
        <p className="serif h3">{item.name}</p>
        {state === 'done' ? <p className="muted">Thank you. It'll show once we've had a look.</p> : (
          <form onSubmit={submit} className="authform">
            <StarInput value={rating} onChange={setRating} name={`r-${item.productId}`} />
            <div className="field"><label htmlFor={`t-${item.productId}`}>How does it feel? (optional)</label><textarea id={`t-${item.productId}`} className="textarea" maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} /></div>
            {err && <p className="field-error" role="alert">{err}</p>}
            <button className="btn" disabled={state === 'busy'}>Send review</button>
          </form>
        )}
      </div>
    </li>
  )
}

export function Review() {
  const { token, orderId } = useParams()
  const { user } = useAuth()
  const auth = token ? { token } : { orderId, uid: user?.uid }
  const { data, error, isLoading } = useQuery({
    queryKey: ['reviewable', token, orderId, user?.uid],
    queryFn: () => api.reviewableItems(auth),
    enabled: Boolean(token || (orderId && user)),
    retry: false,
  })
  return (
    <div className="page container narrow">
      <title>Leave a review — THE MOOD</title>
      <meta name="robots" content="noindex" />
      <header className="page-head">
        <p className="eyebrow">{data ? `Order ${data.number}` : 'Review'}</p>
        <Lines as="h1" className="display page-head__title" lines={[data ? `How does it feel, ${data.name}?` : 'How does it feel?']} delay={0.05} />
      </header>
      {isLoading && <p className="muted">Loading…</p>}
      {error && <div className="empty"><p className="h3 serif">{error.message}</p><Link to="/" className="link">Back home</Link></div>}
      {data && <ul className="revlist">{data.items.map((i) => <ReviewItem key={i.productId} item={i} auth={auth} />)}</ul>}
    </div>
  )
}
