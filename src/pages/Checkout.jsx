import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Reveal } from '../components/Motion'
import { LineMark } from '../components/Brand'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { track } from '../lib/analytics'
import { trackingUrl } from '../lib/format'
import { api } from '../lib/api'
import { useCart, useCartLines, useProducts } from '../lib/store'
import { computeTotals, formatPrice, GOVERNORATES } from '../lib/pricing'
import { imgProps } from '../lib/images'

const schema = z.object({
  name: z.string().trim().min(2, 'Tell us your name.'),
  phone: z.string().trim().regex(/^[0-9+\s-]{8,16}$/, 'That phone number looks off.'),
  email: z.union([z.literal(''), z.string().trim().email('That email looks off.')]),
  governorate: z.string().min(1, 'Choose your governorate.'),
  city: z.string().trim().min(2, 'Which city or area?'),
  street: z.string().trim().min(5, 'We need the street and building.'),
  notes: z.string().optional(),
})

function Err({ e }) {
  return e ? <p className="field-error">{e.message}</p> : null
}

export function Checkout() {
  const { lines, isLoading } = useCartLines()
  const { settings } = useProducts()
  const { clear, promoCode, setPromo } = useCart()
  const navigate = useNavigate()
  const [code, setCode] = useState(promoCode || '')
  const [promoResult, setPromoResult] = useState(null)
  const [promoMsg, setPromoMsg] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [busy, setBusy] = useState(false)

  const user = useAuth((s) => s.user)
  const qc = useQueryClient()
  const { data: profile } = useQuery({ queryKey: ['profile', user?.uid], queryFn: () => api.getProfile(user.uid), enabled: !!user })
  const [saveAddress, setSaveAddress] = useState(true)

  const { register, handleSubmit, watch, reset, getValues, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', email: '', governorate: '', city: '', street: '', notes: '' },
  })
  // Prefill once from the account (never overwrite what the customer already typed).
  const [prefilled, setPrefilled] = useState(false)
  useEffect(() => {
    if (prefilled || !user || profile === undefined) return
    const v = getValues()
    const a = profile?.addresses?.[0] || {}
    reset({
      ...v,
      name: v.name || profile?.name || user.name || '',
      phone: v.phone || profile?.phone || '',
      email: v.email || user.email || '',
      governorate: v.governorate || a.governorate || '',
      city: v.city || a.city || '',
      street: v.street || a.street || '',
    })
    setPrefilled(true)
  }, [user, profile, prefilled, getValues, reset])
  const pickAddress = (a) => reset({ ...getValues(), governorate: a.governorate, city: a.city, street: a.street })

  useEffect(() => { track('begin_checkout') }, [])

  const governorate = watch('governorate')
  const phone = watch('phone')

  const items = useMemo(() => lines.map((l) => ({ productId: l.productId, color: l.color, size: l.size, qty: l.qty })), [lines])
  const signature = JSON.stringify(items)

  const applyPromo = async (value = code) => {
    if (!value.trim()) return
    setPromoMsg('')
    try {
      const res = await api.validatePromo({ code: value, items, phone })
      if (!res.ok) { setPromoResult(null); setPromo(''); setPromoMsg(res.error); return }
      setPromoResult(res); setPromo(res.code || value.toUpperCase())
      setPromoMsg('')
    } catch (e) {
      setPromoResult(null); setPromoMsg(e.message || "Couldn't check that code.")
    }
  }

  // re-validate the saved code when the cart changes
  useEffect(() => {
    if (promoCode && items.length) applyPromo(promoCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const totals = computeTotals({ lines, promoResult, settings, governorate })
  const outOfStock = lines.some((l) => l.qty > l.stock)
  const codOn = settings?.payments?.cod !== false

  const onSubmit = async (data) => {
    setSubmitError('')
    setBusy(true)
    try {
      const res = await api.createOrder({
        customer: { name: data.name, phone: data.phone, email: data.email },
        address: { governorate: data.governorate, city: data.city, street: data.street, notes: data.notes },
        items,
        promoCode: promoResult?.ok ? promoResult.code : '',
        paymentMethod: 'cod',
        userId: user?.uid || null,
      })
      track('purchase', { transaction_id: res.number, value: res.total, items: items.map((i) => ({ item_id: i.productId, item_variant: `${i.color} ${i.size}`, quantity: i.qty })) })
      if (user && saveAddress) {
        const a = { governorate: data.governorate, city: data.city.trim(), street: data.street.trim() }
        const list = profile?.addresses || []
        const same = (x) => x.street === a.street && x.governorate === a.governorate
        // awaited so the account page never shows a stale address book; a failure here never blocks the order
        await api.saveProfile(user.uid, {
          name: profile?.name || data.name, phone: profile?.phone || data.phone, email: user.email,
          addresses: list.some(same) ? list : [a, ...list].slice(0, 5),
        }).catch(() => {})
        qc.invalidateQueries({ queryKey: ['profile', user.uid] })
      }
      qc.invalidateQueries({ queryKey: ['my-orders'] })
      clear()
      navigate(`/order/${res.number}`, { state: { total: res.total, name: data.name } })
    } catch (e) {
      setSubmitError(e.message || 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!isLoading && !lines.length) {
    return (
      <div className="page container empty">
        <LineMark size={100} />
        <p className="h3 serif">Your cart is empty.</p>
        <Link to="/shop" className="btn">Find your mood</Link>
      </div>
    )
  }

  return (
    <div className="page checkout">
      <title>Checkout — THE MOOD</title>
      <meta name="robots" content="noindex" />
      <div className="container checkout__grid">
        <form className="checkout__form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <h1 className="h2">Almost <em>yours.</em></h1>

          <fieldset>
            <legend className="eyebrow">Contact</legend>
            <div className="field"><label htmlFor="name">Full name</label><input id="name" className="input" autoComplete="name" {...register('name')} /><Err e={errors.name} /></div>
            <div className="two">
              <div className="field"><label htmlFor="phone">Phone</label><input id="phone" className="input" inputMode="tel" autoComplete="tel" {...register('phone')} /><Err e={errors.phone} /></div>
              <div className="field"><label htmlFor="email">Email (optional)</label><input id="email" className="input" type="email" autoComplete="email" {...register('email')} /><Err e={errors.email} /></div>
            </div>
          </fieldset>

          {!user && <p className="muted small checkout__signin">Have an account? <Link to="/login" state={{ from: '/checkout' }} className="link">Sign in</Link> to use your saved details. Or just keep going.</p>}

          <fieldset>
            <legend className="eyebrow">Delivery</legend>
            {profile?.addresses?.length > 1 && (
              <div className="chips saved-addr" role="group" aria-label="Saved addresses">
                {profile.addresses.map((a, i) => <button type="button" key={i} className="chip" onClick={() => pickAddress(a)}>{a.city || a.governorate}: {a.street.slice(0, 24)}</button>)}
              </div>
            )}
            <div className="two">
              <div className="field">
                <label htmlFor="governorate">Governorate</label>
                <select id="governorate" className="select" {...register('governorate')}>
                  <option value="">Choose…</option>
                  {GOVERNORATES.map((g) => <option key={g}>{g}</option>)}
                </select>
                <Err e={errors.governorate} />
              </div>
              <div className="field"><label htmlFor="city">City / area</label><input id="city" className="input" {...register('city')} /><Err e={errors.city} /></div>
            </div>
            <div className="field"><label htmlFor="street">Street & building</label><input id="street" className="input" autoComplete="street-address" {...register('street')} /><Err e={errors.street} /></div>
            <div className="field"><label htmlFor="notes">Notes for the courier (optional)</label><textarea id="notes" className="textarea" {...register('notes')} /></div>
            {user && <label className="check"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} /> Save this address to my account</label>}
          </fieldset>

          <fieldset>
            <legend className="eyebrow">Payment</legend>
            {codOn
              ? <label className="pay is-on"><input type="radio" name="pay" checked readOnly /> <span><b>Cash on delivery</b><small className="muted"> Pay when it arrives.</small></span></label>
              : <p className="field-error">We're not taking orders right now. Message us on Instagram and we'll sort it out.</p>}
            <label className="pay is-off"><input type="radio" name="pay" disabled /> <span><b>Card & wallets</b><small className="muted"> Coming soon.</small></span></label>
          </fieldset>

          {submitError && <p className="field-error submit-error" role="alert">{submitError}</p>}
          <button className="btn btn--block" type="submit" disabled={busy || outOfStock || !codOn} id="place-order">
            {busy ? 'Placing…' : `Place order · ${formatPrice(totals.total)}${totals.shippingPending ? ' + shipping' : ''}`}
          </button>
        </form>

        <aside className="summary">
          <div className="summary__inner">
            <h2 className="eyebrow">Your order</h2>
            <ul className="summary__lines">
              {lines.map((l) => (
                <li key={l.key}>
                  <div className="summary__img"><img {...imgProps(l.product.images[0], '80px')} alt="" /><span>{l.qty}</span></div>
                  <div><p className="serif">{l.product.name}</p><p className="eyebrow muted">{l.color} · {l.size}</p>{l.qty > l.stock && <p className="field-error">Only {l.stock} in stock.</p>}</div>
                  <p>{formatPrice(l.unitPrice * l.qty)}</p>
                </li>
              ))}
            </ul>
            <div className="promo">
              <input className="input" placeholder="Promo code" value={code} onChange={(e) => setCode(e.target.value)} aria-label="Promo code" id="promo-input" />
              <button type="button" className="btn btn--ghost" onClick={() => applyPromo()} id="promo-apply">Apply</button>
            </div>
            {promoMsg && <p className="field-error">{promoMsg}</p>}
            {promoResult?.ok && <p className="promo__ok"><b>{promoResult.code}</b> applied. <button type="button" onClick={() => { setPromoResult(null); setPromo(''); setCode('') }}>Remove</button></p>}
            <dl className="totals">
              <div><dt>Subtotal</dt><dd>{formatPrice(totals.subtotal)}</dd></div>
              {totals.discount > 0 && <div className="totals__disc"><dt>Discount</dt><dd>−{formatPrice(totals.discount)}</dd></div>}
              <div><dt>Shipping</dt><dd>{totals.shippingPending ? 'Pick a governorate' : totals.shipping === 0 ? 'Free' : formatPrice(totals.shipping)}</dd></div>
              <div className="totals__total"><dt>Total</dt><dd>{formatPrice(totals.total)}</dd></div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function OrderDone() {
  const { number } = useParams()
  const { state } = useLocation()
  return (
    <div className="page container done">
      <title>Order placed — THE MOOD</title>
      <meta name="robots" content="noindex" />
      <LineMark size={160} draw />
      <Reveal><p className="eyebrow">Order {number}</p></Reveal>
      <Reveal delay={0.1}><h1 className="display done__title">Done.<br /><em>Now go be you.</em></h1></Reveal>
      <Reveal delay={0.2}>
        <p className="done__p">{state?.name ? `Thank you, ${state.name.split(' ')[0]}. ` : ''}We'll call to confirm your order, then it's on its way. {state?.total ? <>Have <b>{formatPrice(state.total)}</b> ready on delivery.</> : null}</p>
      </Reveal>
      <Reveal delay={0.3} className="done__cta"><Link to="/track" className="btn btn--ghost">Track order</Link><Link to="/shop" className="btn">Keep browsing</Link></Reveal>
    </div>
  )
}

export function Track() {
  const { settings } = useProducts()
  const [number, setNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState(null)
  const [err, setErr] = useState('')
  const submit = async (e) => {
    e.preventDefault(); setErr(''); setOrder(null)
    try { setOrder(await api.trackOrder(number, phone)) } catch (e2) { setErr(e2.message) }
  }
  const steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']
  const idx = order ? steps.indexOf(order.status) : -1
  return (
    <div className="page container narrow">
      <title>Track order — THE MOOD</title>
      <meta name="robots" content="noindex" />
      <header className="page-head"><p className="eyebrow">Track</p><h1 className="display page-head__title">Where is it?</h1></header>
      <form onSubmit={submit} className="trackform">
        <div className="field"><label htmlFor="t-number">Order number</label><input id="t-number" className="input" placeholder="MOOD-1001" value={number} onChange={(e) => setNumber(e.target.value)} required /></div>
        <div className="field"><label htmlFor="t-phone">Phone used on the order</label><input id="t-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
        <button className="btn" type="submit">Track</button>
      </form>
      {err && <p className="field-error">{err}</p>}
      {order && (
        <Reveal className="tracked">
          <h2 className="h3">{order.number} — <em>{order.status}</em></h2>
          {['cancelled', 'returned', 'refunded'].includes(order.status) ? <p className="muted">This order was {order.status}.</p> : (
            <ol className="steps">{steps.map((s, i) => <li key={s} className={i <= idx ? 'is-done' : ''}><i />{s}</li>)}</ol>
          )}
          {order.tracking?.number && <p className="muted">{order.tracking.courier} · {trackingUrl(settings?.couriers, order.tracking) ? <a className="link" href={trackingUrl(settings.couriers, order.tracking)} target="_blank" rel="noreferrer">{order.tracking.number} ↗</a> : order.tracking.number}</p>}
          <ul className="tracked__items">{order.items.map((it, i) => <li key={i}>{it.qty} × {it.name} ({it.size})</li>)}</ul>
          <p><b>Total {formatPrice(order.total)}</b></p>
        </Reveal>
      )}
    </div>
  )
}
