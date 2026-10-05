import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Lenis from 'lenis'
import { Icon } from './Icons'
import { Intro, LineMark, Wordmark } from './Brand'
import { Marquee } from './Motion'
import { useCart, useCartLines, useCatalog, useProducts } from '../lib/store'
import { formatPrice } from '../lib/pricing'
import { api } from '../lib/api'
import { useFocusTrap, useScrollLock } from '../lib/hooks'
import { useAuth } from '../lib/auth'
import { analyticsEnabled, getConsent, setConsent } from '../lib/analytics'
import { useWishlist } from '../lib/wishlist'
import { imgProps } from '../lib/images'

/* ------------------------------ announcement ------------------------------ */

function AnnouncementBar({ items }) {
  if (!items?.length) return null
  return (
    <div className="announce">
      <Marquee items={items} speed={46} />
      <ul className="sr-only">{items.map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  )
}

/* -------------------------------- search --------------------------------- */

function SearchOverlay({ open, onClose }) {
  const { products } = useProducts()
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const trap = useFocusTrap(open, onClose)
  useScrollLock(open)
  const close = () => { setQ(''); onClose() }

  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return products.filter((p) => [p.name, p.statement, p.mood?.name].join(' ').toLowerCase().includes(s)).slice(0, 6)
  }, [q, products])

  return (
    <AnimatePresence>
      {open && (
        <motion.div ref={trap} className="search" role="dialog" aria-modal="true" aria-label="Search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          <div className="container search__inner">
            <div className="search__bar">
              <Icon.Search />
              <input data-autofocus className="search__input" placeholder="What's the mood?" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
              <button onClick={close} aria-label="Close search" id="search-close"><Icon.Close /></button>
            </div>
            <ul className="search__results">
              {results.map((p) => (
                <li key={p.id}>
                  <button onClick={() => { close(); navigate(`/product/${p.slug}`) }}>
                    <img {...imgProps(p.images[0], '64px')} alt="" />
                    <span>
                      <b className="serif">{p.name}</b>
                      <small className="eyebrow muted">{p.mood?.name}</small>
                    </span>
                    <span className="muted">{formatPrice(p.pricing.price)}</span>
                  </button>
                </li>
              ))}
              {q && !results.length && <li className="muted search__empty" role="status">Nothing matches that mood yet.</li>}
            </ul>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* -------------------------------- header --------------------------------- */

const NAV = [
  { to: '/shop', label: 'Shop' },
  { to: '/moods', label: 'Moods' },
  { to: '/story', label: 'Story' },
]

function Header({ onSearch }) {
  const count = useCart((s) => s.items.reduce((n, i) => n + i.qty, 0))
  const wishCount = useWishlist((s) => s.ids.length)
  const user = useAuth((s) => s.user)
  const openDrawer = useCart((s) => s.openDrawer)
  const [scrolled, setScrolled] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [menu, setMenu] = useState(false)
  const last = useRef(0)
  const { pathname } = useLocation()

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 30)
      setHidden(y > last.current && y > 240)
      last.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const [menuPath, setMenuPath] = useState(pathname)
  if (menuPath !== pathname) { setMenuPath(pathname); setMenu(false) }
  const menuRef = useFocusTrap(menu, () => setMenu(false))
  useScrollLock(menu)

  return (
    <>
      <header className={`header ${scrolled ? 'is-scrolled' : ''} ${hidden && !menu ? 'is-hidden' : ''}`}>
        <div className="container header__inner">
          <nav className="header__nav" aria-label="Primary">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className="header__link">{n.label}</NavLink>
            ))}
          </nav>
          <button className="header__burger" onClick={() => setMenu(true)} aria-label="Open menu" aria-expanded={menu} id="open-menu"><Icon.Menu /></button>
          <Link to="/" className="header__brand" aria-label="THE MOOD — home">
            <Wordmark />
          </Link>
          <div className="header__actions">
            <button onClick={onSearch} className="header__icon" aria-label="Search" id="open-search"><Icon.Search /></button>
            <Link to="/track" className="header__link header__track">Track</Link>
            <Link to="/wishlist" className="header__icon header__wish" aria-label={`Wishlist, ${wishCount} saved`}><Icon.Heart filled={wishCount > 0} /></Link>
            <Link to={user ? '/account' : '/login'} className="header__icon header__acc" aria-label={user ? 'Your account' : 'Sign in'} id="open-account"><Icon.User /></Link>
            <button onClick={openDrawer} className="header__icon header__bag" aria-label={`Cart, ${count} items`} id="open-cart">
              <Icon.Bag />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span key={count} className="header__count" initial={{ scale: 0.4 }} animate={{ scale: 1 }}>{count}</motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div ref={menuRef} className="menu" role="dialog" aria-modal="true" aria-label="Menu" initial={{ clipPath: 'inset(0 0 100% 0)' }} animate={{ clipPath: 'inset(0 0 0% 0)' }} exit={{ clipPath: 'inset(0 0 100% 0)' }} transition={{ duration: 0.7, ease: [0.76, 0, 0.24, 1] }}>
            <div className="container menu__top">
              <Wordmark />
              <button onClick={() => setMenu(false)} aria-label="Close menu"><Icon.Close /></button>
            </div>
            <nav className="container menu__links">
              {[{ to: '/', label: 'Home' }, ...NAV, { to: '/wishlist', label: 'Wishlist' }, { to: user ? '/account' : '/login', label: user ? 'Account' : 'Sign in' }, { to: '/track', label: 'Track order' }, { to: '/contact', label: 'Contact' }].map((n, i) => (
                <motion.div key={n.to} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 + i * 0.07, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                  <Link to={n.to} className="menu__link serif">{n.label}</Link>
                </motion.div>
              ))}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ------------------------------ cart drawer ------------------------------ */

function CartDrawer() {
  const { open, closeDrawer, setQty, remove } = useCart()
  const { lines } = useCartLines()
  const { settings } = useProducts()
  const navigate = useNavigate()
  const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.qty, 0)
  const threshold = settings?.shipping?.freeThreshold || 0
  const progress = threshold ? Math.min(100, (subtotal / threshold) * 100) : 0

  const trap = useFocusTrap(open, closeDrawer)
  useScrollLock(open)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeDrawer} />
          <motion.aside ref={trap} className="drawer" role="dialog" aria-modal="true" aria-label="Cart" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}>
            <div className="drawer__head">
              <h2 className="eyebrow">Your cart ({lines.reduce((n, l) => n + l.qty, 0)})</h2>
              <button onClick={closeDrawer} aria-label="Close cart" id="close-cart"><Icon.Close /></button>
            </div>

            {threshold > 0 && lines.length > 0 && (
              <div className="drawer__ship">
                <p>{subtotal >= threshold ? 'Free shipping unlocked.' : <>You're <b>{formatPrice(threshold - subtotal)}</b> away from free shipping.</>}</p>
                <div className="bar"><motion.i animate={{ width: `${progress}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} /></div>
              </div>
            )}

            <div className="drawer__body">
              {!lines.length && (
                <div className="drawer__empty">
                  <LineMark size={90} />
                  <p className="serif">Nothing here.<br /><em>Not in the mood yet?</em></p>
                  <Link to="/shop" className="btn btn--ghost" onClick={closeDrawer}>Find your mood</Link>
                </div>
              )}
              {lines.map((l) => (
                <motion.div layout key={l.key} className="line" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Link to={`/product/${l.product.slug}`} onClick={closeDrawer} className="line__img"><img {...imgProps(l.product.images[0], '96px')} alt="" /></Link>
                  <div className="line__info">
                    <p className="serif line__name">{l.product.name}</p>
                    <p className="eyebrow muted">{l.color} · {l.size}</p>
                    <div className="qty">
                      <button onClick={() => setQty(l.key, l.qty - 1)} aria-label={`One less ${l.product.name}`}><Icon.Minus width={14} /></button>
                      <span aria-live="polite">{l.qty}</span>
                      <button onClick={() => setQty(l.key, l.qty + 1)} disabled={l.qty >= l.stock} aria-label={`One more ${l.product.name}`}><Icon.Plus width={14} /></button>
                    </div>
                  </div>
                  <div className="line__right">
                    <p>{formatPrice(l.unitPrice * l.qty)}</p>
                    <button className="line__remove eyebrow muted" onClick={() => remove(l.key)}>Remove</button>
                  </div>
                </motion.div>
              ))}
            </div>

            {lines.length > 0 && (
              <div className="drawer__foot">
                <div className="drawer__sub"><span className="eyebrow">Subtotal</span><b>{formatPrice(subtotal)}</b></div>
                <p className="muted small">Shipping and promo codes at checkout.</p>
                <button className="btn btn--block" id="go-checkout" onClick={() => { closeDrawer(); navigate('/checkout') }}>Checkout</button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

/* -------------------------------- footer --------------------------------- */

function Newsletter() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email)) return setErr('That email looks off.')
    try { await api.subscribe(email); setDone(true) } catch { setErr("Couldn't sign you up. Try again.") }
  }
  return done ? (
    <p className="serif footer__thanks">You're in. We'll only write when it matters.</p>
  ) : (
    <form onSubmit={submit} className="newsletter">
      <input type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" id="newsletter-email" />
      <button type="submit" aria-label="Subscribe"><Icon.Arrow /></button>
      {err && <p className="field-error" role="alert">{err}</p>}
    </form>
  )
}

function Footer({ settings }) {
  return (
    <footer className="footer dark">
      <div className="container footer__top">
        <div className="footer__lead">
          <LineMark size={96} stroke="currentColor" width={1.8} />
          <p className="h3 serif">Whatever you're feeling,<br /><em>there's a mood for it.</em></p>
          <Newsletter />
        </div>
        <div className="footer__cols">
          <div>
            <h2 className="eyebrow">Shop</h2>
            <Link to="/shop">All hoodies</Link>
            <Link to="/moods">Moods</Link>
            <Link to="/shop?sale=1">Sale</Link>
            <Link to="/track">Track order</Link>
            <Link to="/account">Account</Link>
          </div>
          <div>
            <h2 className="eyebrow">Help</h2>
            <Link to="/shipping-returns">Shipping & returns</Link>
            <Link to="/size-guide">Size guide</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/contact">Contact</Link>
          </div>
          <div>
            <h2 className="eyebrow">Follow</h2>
            <a href={settings?.social?.instagram} target="_blank" rel="noreferrer"><Icon.Instagram width={16} /> Instagram</a>
            <a href={settings?.social?.facebook} target="_blank" rel="noreferrer"><Icon.Facebook width={16} /> Facebook</a>
          </div>
        </div>
      </div>
      <div className="footer__giant" aria-hidden="true" data-text="THE MOOD" />
      <div className="container footer__bottom">
        <span className="eyebrow">© {new Date().getFullYear()} THE MOOD</span>
        <span className="eyebrow">Wear what you feel</span>
        <Link to="/privacy" className="eyebrow">Privacy</Link>
      </div>
    </footer>
  )
}

/* -------------------------------- layout --------------------------------- */

/** Signs-in side effects: sync the wishlist and attach past guest orders (verified email). */
function AccountSync() {
  const user = useAuth((s) => s.user)
  const attach = useWishlist((s) => s.attach)
  const uid = user?.uid
  useEffect(() => {
    attach(uid || null)
    if (uid) api.linkMyOrders(user).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])
  return null
}

/** Shown only when a pixel/analytics ID is configured and the visitor hasn't chosen yet. */
function Consent() {
  const [choice, setChoice] = useState(() => getConsent())
  if (!analyticsEnabled || choice) return null
  const pick = (v) => { setConsent(v); setChoice(v) }
  return (
    <div className="consent" role="region" aria-label="Cookies">
      <p>We use a few cookies to see what people like and to show our moods on Instagram and TikTok. <Link to="/privacy" className="link">Privacy</Link></p>
      <div><button className="btn btn--sm" onClick={() => pick('yes')}>Fine by me</button><button className="link" onClick={() => pick('no')}>No thanks</button></div>
    </div>
  )
}

function CatalogError() {
  const { isError, refetch, isFetching } = useCatalog()
  if (!isError) return null
  return (
    <div className="catalog-error" role="alert">
      <p className="serif">We couldn't load the store just now.</p>
      <button className="btn btn--ghost" onClick={() => refetch()} disabled={isFetching}>{isFetching ? 'Trying…' : 'Try again'}</button>
    </div>
  )
}

export default function StoreLayout() {
  const { settings } = useProducts()
  const { pathname } = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)

  // smooth scrolling
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 0.95 })
    let raf
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop) }
    raf = requestAnimationFrame(loop)
    window.__lenis = lenis
    return () => { cancelAnimationFrame(raf); lenis.destroy(); window.__lenis = null }
  }, [])

  useEffect(() => {
    if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true })
    else window.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <Intro />
      <AnnouncementBar items={settings?.announcements} />
      <Header onSearch={() => setSearchOpen(true)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer />
      <AccountSync />
      <CatalogError />
      <motion.main id="main" key={pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
        <Suspense fallback={<div className="page" aria-busy="true" />}>
          <Outlet />
        </Suspense>
      </motion.main>
      <Footer settings={settings} />
      <Consent />
    </>
  )
}
