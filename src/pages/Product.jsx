import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Reveal } from '../components/Motion'
import { Stars } from '../components/Stars'
import Seo, { productJsonLd } from '../components/Seo'
import { track } from '../lib/analytics'
import { api } from '../lib/api'
import { fmtDate } from '../lib/format'
import { useQuery } from '@tanstack/react-query'
import ProductCard, { WishButton } from '../components/ProductCard'
import { Icon } from '../components/Icons'
import { useCart, useProducts } from '../lib/store'
import { formatPrice, sizeAvailability, variantStock } from '../lib/pricing'
import { imgProps, imgSrc } from '../lib/images'

function Accordion({ title, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="acc">
      <button className="acc__head eyebrow" onClick={() => setOpen(!open)} aria-expanded={open}>
        {title}
        <motion.span animate={{ rotate: open ? 45 : 0 }}><Icon.Plus width={16} /></motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} style={{ overflow: 'hidden' }}>
            <div className="acc__body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Product() {
  const { slug } = useParams()
  const { products, settings, isLoading } = useProducts()
  const product = products.find((p) => p.slug === slug)

  if (isLoading || !product) {
    return (
      <div className="page container">
        {!isLoading && <div className="empty"><p className="h3 serif">This one isn't in the mood.</p><Link to="/shop" className="link">Back to shop</Link></div>}
      </div>
    )
  }
  return <ProductView key={product.id} product={product} products={products} settings={settings} />
}

function ProductView({ product, products, settings }) {
  const add = useCart((s) => s.add)
  const inCart = useCart((s) => s.items)
  const firstInStock = product.colors?.find((c) => product.variants.some((v) => v.color === c.name && v.stock > 0))
  const [color, setColor] = useState((firstInStock || product.colors?.[0])?.name || '')
  const [size, setSize] = useState('')
  const [shake, setShake] = useState(0)
  const [added, setAdded] = useState(false)
  const [maxed, setMaxed] = useState(false)
  const addedTimer = useRef(null)
  useEffect(() => () => clearTimeout(addedTimer.current), [])

  const { pricing, mood } = product
  const sizes = sizeAvailability(product, color)
  const stock = size ? variantStock(product, color, size) : null
  const lowAt = settings?.lowStock ?? 3
  const related = products.filter((p) => p.id !== product.id).sort((a, b) => (b.moodId === product.moodId) - (a.moodId === product.moodId)).slice(0, 4)

  useEffect(() => { track('view_item', { item_id: product.id, item_name: product.name, value: product.pricing.price }) }, [product.id, product.name, product.pricing.price])

  const pickColor = (name) => {
    setColor(name)
    setMaxed(false)
    if (size && variantStock(product, name, size) <= 0) setSize('')
  }

  const onAdd = () => {
    if (!size) return setShake((n) => n + 1)
    const have = inCart.find((i) => i.key === `${product.id}|${color}|${size}`)?.qty || 0
    if (have >= stock) return setMaxed(true)
    add({ productId: product.id, color, size, max: stock })
    track('add_to_cart', { item_id: product.id, item_name: product.name, value: pricing.price, items: [{ item_id: product.id, item_variant: `${color} ${size}`, price: pricing.price, quantity: 1 }] })
    setAdded(true)
    clearTimeout(addedTimer.current)
    addedTimer.current = setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div className="page pdp">
      <Seo
        title={product.metaTitle || `${product.name} — THE MOOD`}
        description={product.metaDescription || `“${product.statement}” ${product.description}`}
        path={`/product/${product.slug}`}
        image={imgSrc(product.images[0])}
        type="product"
        jsonLd={productJsonLd(product)}
      />
      <div className="container pdp__grid">
        <div className="pdp__gallery">
          {product.images.map((img, i) => (
            <Reveal key={imgSrc(img).slice(-60) + i} className="pdp__img" y={20}><img {...imgProps(img, '(max-width: 900px) 100vw, 55vw')} alt={`${product.name}, photo ${i + 1}`} loading={i ? 'lazy' : 'eager'} fetchPriority={i ? undefined : 'high'} /></Reveal>
          ))}
        </div>

        <div className="pdp__info">
          <div className="pdp__sticky">
            <nav className="eyebrow muted crumbs"><Link to="/shop">Shop</Link> / <Link to={`/moods/${mood?.slug}`}>{mood?.name}</Link></nav>
            <div className="pdp__titlerow">
              <h1 className="h2 pdp__name">{product.name}</h1>
              <WishButton productId={product.id} name={product.name} />
            </div>
            {product.rating?.count > 0 && <a href="#reviews" className="pdp__rating"><Stars value={product.rating.avg} /> <span className="muted small">{product.rating.avg} · {product.rating.count} review{product.rating.count > 1 ? 's' : ''}</span></a>}
            <p className="serif pdp__quote"><em>“{product.statement}”</em></p>
            <p className="pdp__price">
              {pricing.compareAt && <s>{formatPrice(pricing.compareAt)}</s>}
              <span>{formatPrice(pricing.price)}</span>
              {pricing.onSale && <span className="badge badge--sale">−{pricing.percent}%</span>}
            </p>

            {product.colors?.length > 0 && (
              <div className="pdp__block">
                <p className="label">Colour — {color}</p>
                <div className="swatches">
                  {product.colors.map((c) => (
                    <button key={c.name} className={`swatch ${color === c.name ? 'is-on' : ''}`} style={{ '--c': c.hex }} onClick={() => pickColor(c.name)} aria-label={c.name} aria-pressed={color === c.name} />
                  ))}
                </div>
              </div>
            )}

            <div className="pdp__block">
              <p className="label">Size {stock !== null && stock > 0 && stock <= lowAt && <b className="low">— only {stock} left</b>}</p>
              <motion.div className="sizes" key={shake} animate={shake ? { x: [0, -8, 8, -5, 5, 0] } : {}} transition={{ duration: 0.4 }}>
                {sizes.map((s) => (
                  <button key={s.size} disabled={!s.inStock} className={`size ${size === s.size ? 'is-on' : ''}`} onClick={() => { setSize(s.size); setMaxed(false) }} aria-pressed={size === s.size}>{s.size}</button>
                ))}
              </motion.div>
              {shake > 0 && !size && <p className="field-error" role="alert">Pick a size first.</p>}
              {maxed && <p className="field-error" role="alert">That's all we have in {size} right now.</p>}
              <Link to="/size-guide" className="link small-link">Size guide</Link>
              {sizes.some((x) => !x.inStock) && <NotifyMe product={product} color={color} sizes={sizes.filter((x) => !x.inStock).map((x) => x.size)} />}
            </div>

            <button className="btn btn--block pdp__add" id="add-to-cart" onClick={onAdd}>
              {added ? <><Icon.Check width={16} /> In your cart</> : 'Wear the feeling'}
            </button>
            <p className="muted small">Cash on delivery across Egypt. 14-day exchange.</p>

            <div className="pdp__acc">
              <Accordion title="The feeling"><p>{product.description}</p></Accordion>
              <Accordion title="Details"><ul className="dots">{product.details?.map((d) => <li key={d}>{d}</li>)}</ul></Accordion>
              <Accordion title="Shipping & exchange"><p>Delivered in 2–5 working days.{settings?.shipping?.freeThreshold ? ` Free shipping over ${formatPrice(settings.shipping.freeThreshold)}.` : ''} Exchange within 14 days, tags on.</p></Accordion>
            </div>
          </div>
        </div>
      </div>

      <Reviews product={product} />

      <section className="section">
        <div className="container">
          <Reveal className="sec-head"><h2 className="h2">Other <em>moods.</em></h2><Link to="/shop" className="link">View all</Link></Reveal>
          <div className="grid">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </div>
      </section>

      {/* mobile sticky bar */}
      <div className="pdp__bar">
        <div><b className="serif">{product.name}</b><span className="muted"> {formatPrice(pricing.price)}</span></div>
        <button className="btn" onClick={onAdd}>{size ? 'Add' : 'Pick size'}</button>
      </div>
    </div>
  )
}

/** "Tell me when it's back" for sold-out sizes. */
function NotifyMe({ product, color, sizes }) {
  const [open, setOpen] = useState(false)
  const [size, setSize] = useState(sizes[0])
  const [email, setEmail] = useState('')
  const [state, setState] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setState('busy')
    try {
      await api.requestRestockAlert({ email, productId: product.id, color, size: sizes.includes(size) ? size : sizes[0] })
      setState('done')
    } catch (err) { setState(err.message) }
  }
  if (!open) return <button type="button" className="link small-link notify__open" onClick={() => setOpen(true)}>Sold out in your size? Get a heads-up</button>
  if (state === 'done') return <p className="muted small" role="status">Got it. We'll email you when it's back.</p>
  return (
    <form className="notify" onSubmit={submit}>
      <select className="select select--sm" value={size} onChange={(e) => setSize(e.target.value)} aria-label="Size to watch">{sizes.map((x) => <option key={x}>{x}</option>)}</select>
      <input className="input input--sm" type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email for restock alert" />
      <button className="btn btn--sm" disabled={state === 'busy'}>Notify me</button>
      {state && state !== 'busy' && <p className="field-error">{state}</p>}
    </form>
  )
}

function Reviews({ product }) {
  const { data: reviews = [] } = useQuery({ queryKey: ['reviews', product.id], queryFn: () => api.productReviews(product.id), staleTime: 60_000 })
  if (!reviews.length) return null
  return (
    <section className="section reviews" id="reviews">
      <div className="container">
        <Reveal className="sec-head">
          <div><p className="eyebrow">Reviews</p><h2 className="h2">How it <em>feels.</em></h2></div>
          {product.rating?.count > 0 && <p className="reviews__avg"><Stars value={product.rating.avg} size={16} /> <span>{product.rating.avg} / 5</span></p>}
        </Reveal>
        <ul className="reviews__list">
          {reviews.map((r) => (
            <Reveal as="li" key={r.id} className="review">
              <Stars value={r.rating} />
              {r.text && <p className="serif review__text">“{r.text}”</p>}
              <p className="eyebrow muted">{r.name} · {fmtDate(r.createdAt)}</p>
              {r.reply && <p className="review__reply"><b>THE MOOD:</b> {r.reply}</p>}
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
