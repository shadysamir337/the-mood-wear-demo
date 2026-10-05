import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Lines, Reveal } from '../components/Motion'
import ProductCard, { CardSkeleton } from '../components/ProductCard'
import { Icon } from '../components/Icons'
import { useProducts } from '../lib/store'
import { totalStock } from '../lib/pricing'
import Seo from '../components/Seo'
import { BannerStrip, Countdown, DropAlert } from '../components/Drops'
import { imgProps, imgSrc } from '../lib/images'

const SORTS = {
  featured: ['Featured', (a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || b.createdAt - a.createdAt],
  new: ['Newest', (a, b) => b.createdAt - a.createdAt],
  low: ['Price: low to high', (a, b) => a.pricing.price - b.pricing.price],
  high: ['Price: high to low', (a, b) => b.pricing.price - a.pricing.price],
}

function Grid({ products, isLoading }) {
  if (isLoading) return <div className="grid">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
  if (!products.length) {
    return (
      <div className="empty">
        <p className="h3 serif">Nothing in this mood yet.</p>
        <Link to="/shop" className="link">See everything</Link>
      </div>
    )
  }
  return (
    <div className="grid">
      {products.map((p, i) => (
        <Reveal key={p.id} delay={(i % 4) * 0.06}><ProductCard product={p} priority={i < 4} /></Reveal>
      ))}
    </div>
  )
}

export function Shop() {
  const { products, moods, isLoading } = useProducts()
  const [params, setParams] = useSearchParams()
  const mood = params.get('mood') || ''
  const sort = SORTS[params.get('sort')] ? params.get('sort') : 'featured'
  const size = params.get('size') || ''
  const sale = params.get('sale') === '1'
  const stock = params.get('stock') === '1'

  // functional update: two quick clicks must not overwrite each other's filter
  const set = (k, v) => setParams((prev) => {
    const next = new URLSearchParams(prev)
    if (v) next.set(k, v); else next.delete(k)
    return next
  }, { replace: true })

  const list = useMemo(() => {
    return products
      .filter((p) => !mood || p.moodId === mood)
      .filter((p) => !sale || p.pricing.onSale)
      .filter((p) => !stock || totalStock(p) > 0)
      .filter((p) => !size || p.variants.some((v) => v.size === size && v.stock > 0))
      .sort(SORTS[sort][1])
  }, [products, mood, sale, stock, size, sort])

  const moodsWithProducts = moods.filter((m) => products.some((p) => p.moodId === m.id))

  return (
    <div className="page">
      <Seo title="Shop — THE MOOD" description="Every hoodie, every mood. Minimal pieces with one honest sentence." path="/shop" />
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Shop</p>
          <Lines as="h1" className="display page-head__title" lines={['Every mood,', 'every hoodie.']} delay={0.1} />
        </header>

        <BannerStrip placement="shop" />
        <div className="filters">
          <div className="chips" role="group" aria-label="Filter by mood">
            <button className={`chip ${!mood ? 'is-on' : ''}`} aria-pressed={!mood} onClick={() => set('mood', '')}>All</button>
            {moodsWithProducts.map((m) => (
              <button key={m.id} className={`chip ${mood === m.id ? 'is-on' : ''}`} aria-pressed={mood === m.id} style={{ '--accent': m.accentColor }} onClick={() => set('mood', m.id)}>{m.name.replace('The ', '').replace(' Mood', '')}</button>
            ))}
          </div>
          <div className="filters__right">
            <select className="select select--sm" value={size} onChange={(e) => set('size', e.target.value)} aria-label="Size">
              <option value="">All sizes</option>
              {['S', 'M', 'L', 'XL'].map((s) => <option key={s}>{s}</option>)}
            </select>
            <label className="check"><input type="checkbox" checked={sale} onChange={(e) => set('sale', e.target.checked ? '1' : '')} /> On sale</label>
            <label className="check"><input type="checkbox" checked={stock} onChange={(e) => set('stock', e.target.checked ? '1' : '')} /> In stock</label>
            <select className="select select--sm" value={sort} onChange={(e) => set('sort', e.target.value)} aria-label="Sort">
              {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </div>
        </div>
        <p className="muted small count">{list.length} {list.length === 1 ? 'piece' : 'pieces'}</p>
        <Grid products={list} isLoading={isLoading} />
      </div>
    </div>
  )
}

export function Moods() {
  const { moods, products } = useProducts()
  return (
    <div className="page">
      <Seo title="Moods — THE MOOD" description="Happy, sad, in love, chaotic, calm. Pick a feeling and find the hoodie that says it." path="/moods" />
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Moods</p>
          <Lines as="h1" className="display page-head__title" lines={['Pick a feeling.']} delay={0.1} />
        </header>
        <div className="moodgrid">
          {moods.map((m, i) => {
            const items = products.filter((p) => p.moodId === m.id)
            return (
              <Reveal key={m.id} delay={(i % 2) * 0.08}>
                <Link to={`/moods/${m.slug}`} className="moodtile" style={{ '--accent': m.accentColor }}>
                  <div className="moodtile__img">
                    {items[0] ? <img {...imgProps(items[0].images[0], '(max-width: 760px) 100vw, 50vw')} alt="" loading="lazy" /> : <span className="serif moodtile__soon">Soon</span>}
                  </div>
                  <div className="moodtile__body">
                    <span className="eyebrow muted">{String(i + 1).padStart(2, '0')}</span>
                    <h2 className="h3">{m.name}</h2>
                    <p className="serif"><em>{m.tagline}</em></p>
                  </div>
                </Link>
              </Reveal>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function MoodPage() {
  const { slug } = useParams()
  const { moods, products, isLoading } = useProducts()
  const mood = moods.find((m) => m.slug === slug)
  const list = products.filter((p) => p.moodId === mood?.id)

  if (!isLoading && !mood) return <div className="page container empty"><p className="h3 serif">That mood doesn't exist.</p><Link to="/moods" className="link">All moods</Link></div>
  if (!mood) return <div className="page" />

  return (
    <div className="page moodpage" style={{ '--accent': mood.accentColor }}>
      <Seo title={`${mood.name} — THE MOOD`} description={`${mood.tagline} ${mood.story}`} path={`/moods/${mood.slug}`} image={mood.coverImage ? imgSrc(mood.coverImage) : list[0] && imgSrc(list[0].images[0])} />
      <section className="moodhero">
        <div className="container">
          <Link to="/moods" className="link moodhero__back"><Icon.Arrow style={{ transform: 'scaleX(-1)' }} width={14} /> All moods</Link>
          <Lines as="h1" className="display" lines={[mood.name]} delay={0.1} />
          <p className="serif moodhero__tag"><em>{mood.tagline}</em></p>
          <p className="moodhero__story">{mood.story}</p>
          {mood.dropDate && !list.length && (
            <div className="moodhero__drop">
              <p className="eyebrow">Drops {new Date(mood.dropDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}</p>
              <Countdown to={mood.dropDate} />
              <DropAlert mood={mood} />
            </div>
          )}
          {!mood.dropDate && !list.length && !isLoading && <DropAlert mood={mood} />}
        </div>
      </section>
      <div className="container">
        <Grid products={list} isLoading={isLoading} />
      </div>
    </div>
  )
}
