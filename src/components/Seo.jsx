import { imgSrc } from '../lib/images'
import { isScheduleActive, totalStock } from '../lib/pricing'

export const SITE_URL = (import.meta.env.VITE_SITE_URL || 'https://themood.co').replace(/\/$/, '')
const abs = (u) => (!u ? `${SITE_URL}/images/hero.jpg` : /^https?:/.test(u) ? u : `${SITE_URL}${u.startsWith('/') ? '' : '/'}${u}`)

/**
 * Title, description, canonical, Open Graph / Twitter tags and optional JSON-LD.
 * React 19 hoists these into <head>; the prerender step bakes them into static HTML.
 */
export default function Seo({ title, description, path = '/', image, type = 'website', jsonLd }) {
  const url = `${SITE_URL}${path}`
  return (
    <>
      <title>{title}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={url} />
      <meta property="og:site_name" content="THE MOOD" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={url} />
      <meta property="og:image" content={abs(image)} />
      <meta name="twitter:card" content="summary_large_image" />
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </>
  )
}

export function productJsonLd(p) {
  const offerEnd = p.pricing?.sale?.endsAt
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: `“${p.statement}” ${p.description || ''}`.trim(),
    image: (p.images || []).map((i) => abs(imgSrc(i))),
    sku: p.id,
    brand: { '@type': 'Brand', name: 'THE MOOD' },
    category: p.mood?.name,
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/product/${p.slug}`,
      priceCurrency: 'EGP',
      price: p.pricing?.price ?? p.price,
      availability: totalStock(p) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      ...(offerEnd && isScheduleActive(p.pricing.sale) ? { priceValidUntil: new Date(offerEnd).toISOString().slice(0, 10) } : {}),
    },
    ...(p.rating?.count ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating.avg, reviewCount: p.rating.count } } : {}),
  }
}

export const organizationJsonLd = (settings) => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'THE MOOD',
  slogan: 'Wear what you feel.',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  sameAs: [settings?.social?.instagram, settings?.social?.facebook].filter(Boolean),
})
