import { Link } from 'react-router-dom'
import { Icon } from './Icons'
import { Stars } from './Stars'
import { useWishlist } from '../lib/wishlist'
import { track } from '../lib/analytics'
import { sizeAvailability, totalStock, formatPrice } from '../lib/pricing'
import { imgProps } from '../lib/images'

export default function ProductCard({ product, priority = false }) {
  const { pricing, mood } = product
  const soldOut = totalStock(product) === 0
  const sizes = sizeAvailability(product)
  const [main, hover] = product.images

  return (
    <div className="card-wrap">
    <Link to={`/product/${product.slug}`} className="card" aria-label={`${product.name}, ${formatPrice(pricing.price)}`}>
      <div className="card__media">
        <img {...imgProps(main)} alt={product.name} loading={priority ? 'eager' : 'lazy'} className="card__img" />
        {hover && <img {...imgProps(hover)} alt="" loading="lazy" className="card__img card__img--hover" />}
        <div className="card__badges">
          {soldOut ? <span className="badge badge--light">Sold out</span> : pricing.onSale && <span className="badge badge--sale">−{pricing.percent}%</span>}
          {!soldOut && !pricing.onSale && product.isNew && <span className="badge">New</span>}
        </div>
        <span className="card__quick eyebrow">View</span>
      </div>
      <div className="card__body">
        <div className="card__row">
          <h3 className="card__name">{product.name}</h3>
          <p className="card__price">
            {pricing.compareAt && <s>{formatPrice(pricing.compareAt)}</s>}
            <span>{formatPrice(pricing.price)}</span>
          </p>
        </div>
        <p className="card__mood eyebrow muted">{mood?.name}</p>
        <p className="card__sizes">
          {sizes.map((s) => (
            <span key={s.size} className={s.inStock ? '' : 'is-out'}>{s.size}</span>
          ))}
        </p>
        {product.rating?.count > 0 && <p className="card__rating"><Stars value={product.rating.avg} size={11} /> <span className="muted">({product.rating.count})</span></p>}
      </div>
    </Link>
    <WishButton productId={product.id} name={product.name} className="card__wish" />
    </div>
  )
}

/** Heart toggle. Lives outside the card link so it's its own button. */
export function WishButton({ productId, name, className = '' }) {
  const on = useWishlist((s) => s.ids.includes(productId))
  const toggle = useWishlist((s) => s.toggle)
  return (
    <button type="button" className={`wish ${on ? 'is-on' : ''} ${className}`} aria-pressed={on} aria-label={on ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`} onClick={() => { toggle(productId); if (!on) track('add_to_wishlist', { item_id: productId }) }}>
      <Icon.Heart filled={on} width={18} height={18} />
    </button>
  )
}

export function CardSkeleton() {
  return (
    <div className="card">
      <div className="card__media skeleton" />
      <div className="card__body"><div className="skeleton" style={{ height: 18, width: '70%' }} /></div>
    </div>
  )
}
