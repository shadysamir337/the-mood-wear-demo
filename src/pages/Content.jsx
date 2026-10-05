import { Link } from 'react-router-dom'
import { Lines, Reveal } from '../components/Motion'
import { LineMark } from '../components/Brand'
import Seo from '../components/Seo'
import { useProducts } from '../lib/store'
import { formatPrice } from '../lib/pricing'

/** Shipping copy built from the store settings, so it always matches checkout. */
function shippingCopy(settings) {
  const s = settings?.shipping
  const parts = ['We deliver across Egypt in 2–5 working days.']
  if (!s) return parts[0]
  const cairo = s.zones?.find((z) => z.governorate === 'Cairo')?.fee
  const others = Math.min(Number(s.defaultFee) || 0, ...(s.zones || []).filter((z) => z.governorate !== 'Cairo').map((z) => z.fee))
  parts.push(cairo != null ? `Cairo from ${formatPrice(cairo)}, other governorates from ${formatPrice(others)}.` : `Delivery from ${formatPrice(others)}.`)
  if (s.freeThreshold) parts.push(`Free shipping on orders over ${formatPrice(s.freeThreshold)}.`)
  return parts.join(' ')
}

export function Story() {
  return (
    <div className="page story">
      <Seo title="Our story — THE MOOD" description="THE MOOD was created around the idea that clothing can express emotions, phases and moments without saying too much." path="/story" />
      <div className="container">
        <header className="page-head">
          <p className="eyebrow">Our story</p>
          <Lines as="h1" className="display page-head__title" lines={['Say it without', 'saying it.']} delay={0.1} />
        </header>
        <div className="story__grid">
          <Reveal className="story__mark"><LineMark size={280} draw width={1.3} /></Reveal>
          <div className="story__copy">
            <Reveal><p className="story__lead serif">You don't always wear clothes just because you like the design. Sometimes you wear something because it <em>feels like you.</em></p></Reveal>
            <Reveal delay={0.05}><p>THE MOOD is built around the different moods, phases and moments that make up an ordinary day. Some days you're happy. Some days you're heartbroken. Some days you want to party, and some days you want to disappear.</p></Reveal>
            <Reveal delay={0.05}><p>We turn those feelings into something you can wear. No loud graphics. No complicated ideas. A hoodie with one honest sentence, the kind you could have said yourself.</p></Reveal>
            <Reveal delay={0.05}><p>Every drop is a small emotional story. Every piece is a different mood. Put it on and let it say what you don't have to.</p></Reveal>
            <Reveal><Link to="/shop" className="btn">Wear the feeling</Link></Reveal>
          </div>
        </div>
      </div>
    </div>
  )
}

const FAQ = [
  ['How long does delivery take?', 'Between 2 and 5 working days across Egypt. Cairo and Giza are usually faster. Shipping fees are shown at checkout.'],
  ['How do I pay?', 'Cash on delivery. Card and wallet payments are coming soon.'],
  ['Can I exchange my hoodie?', 'Yes. Within 14 days of delivery, unworn with tags on. Message us and we will arrange it.'],
  ['How do the hoodies fit?', 'Relaxed and slightly cropped. If you are between sizes, size up for a looser feel.'],
  ['Will you restock sold-out pieces?', 'Some drops are limited. Follow us on Instagram to know first.'],
]

const PAGES = {
  faq: { title: 'FAQ', description: 'Delivery, payment, exchanges and fit. Short answers.', head: 'Questions.', body: () => FAQ.map(([q, a]) => (<Reveal key={q} className="qa"><h2 className="h3">{q}</h2><p>{a}</p></Reveal>)) },
  'shipping-returns': {
    title: 'Shipping & returns', description: 'Delivery across Egypt in 2–5 working days. 14-day exchanges.', head: 'Shipping & returns.',
    body: (settings) => (<>
      <Reveal className="qa"><h2 className="h3">Shipping</h2><p>{shippingCopy(settings)}</p></Reveal>
      <Reveal className="qa"><h2 className="h3">Exchanges</h2><p>Changed your mind, or the size is off? Exchange within 14 days of delivery. Items must be unworn, unwashed and with tags.</p></Reveal>
      <Reveal className="qa"><h2 className="h3">Faulty items</h2><p>If something arrives damaged, tell us within 48 hours and we will replace it.</p></Reveal>
    </>),
  },
  'size-guide': {
    title: 'Size guide', description: 'Chest, length and sleeve for every size. Relaxed fit.', head: 'Size guide.',
    body: () => (
      <Reveal>
        <table className="sizetable">
          <thead><tr><th>Size</th><th>Chest (cm)</th><th>Length (cm)</th><th>Sleeve (cm)</th></tr></thead>
          <tbody>{[['S', 56, 64, 60], ['M', 58, 66, 61], ['L', 60, 68, 62], ['XL', 62, 70, 63]].map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
        </table>
        <p className="muted">Measured flat. Relaxed fit. Size up if you like it oversized.</p>
      </Reveal>
    ),
  },
  contact: {
    title: 'Contact', description: 'Questions, orders, collabs. Message THE MOOD.', head: 'Say hi.',
    body: () => (<>
      <Reveal className="qa"><p>Questions, orders, collabs. Message us and we will get back to you.</p></Reveal>
      <Reveal className="qa"><h2 className="h3">Instagram</h2><p><a className="link" href="https://www.instagram.com/the.mood_co" target="_blank" rel="noreferrer">@the.mood_co</a></p></Reveal>
      <Reveal className="qa"><h2 className="h3">Facebook</h2><p><a className="link" href="https://www.facebook.com/The.moodclothing" target="_blank" rel="noreferrer">The.moodclothing</a></p></Reveal>
    </>),
  },
  privacy: {
    title: 'Privacy', description: 'What we collect to deliver your order, and nothing more.', head: 'Privacy.',
    body: () => (<>
      <Reveal className="qa"><h2 className="h3">Orders</h2><p>We collect only what we need to deliver your order: your name, phone, address and, if you give it, your email. We use them to confirm and deliver your order and to send updates about it by email or WhatsApp.</p></Reveal>
      <Reveal className="qa"><h2 className="h3">Accounts</h2><p>An account is optional. It keeps your orders, saved addresses and wishlist in one place. You can delete it anytime by messaging us.</p></Reveal>
      <Reveal className="qa"><h2 className="h3">Cookies</h2><p>If you say yes, we use analytics and social cookies (Google, Meta, TikTok) to understand what people like. Say no and nothing loads. Your cart and wishlist are kept in your own browser.</p></Reveal>
      <Reveal className="qa"><p>We never sell your data. Ask us anytime to see or delete it.</p></Reveal>
    </>),
  },
}

export function InfoPage({ page }) {
  const p = PAGES[page]
  const { settings } = useProducts()
  return (
    <div className="page container narrow">
      <Seo title={`${p.title} — THE MOOD`} description={p.description} path={`/${page}`} />
      <header className="page-head"><p className="eyebrow">{p.title}</p><Lines as="h1" className="display page-head__title" lines={[p.head]} delay={0.1} /></header>
      <div className="info">{p.body(settings)}</div>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="page container empty">
      <LineMark size={110} draw />
      <h1 className="display" style={{ fontSize: 'clamp(2.4rem,6vw,5rem)' }}>This page isn't<br /><em>in the mood.</em></h1>
      <Link to="/" className="btn">Back home</Link>
    </div>
  )
}
