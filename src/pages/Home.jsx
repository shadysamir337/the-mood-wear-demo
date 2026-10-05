import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from 'framer-motion'
import { Lines, Marquee, Reveal } from '../components/Motion'
import { LineMark } from '../components/Brand'
import { Icon } from '../components/Icons'
import ProductCard, { CardSkeleton } from '../components/ProductCard'
import { useProducts } from '../lib/store'
import Seo, { organizationJsonLd } from '../components/Seo'
import { BannerStrip, MoodPicker } from '../components/Drops'
import { imgProps, imgSrc } from '../lib/images'

function Hero() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const scale = useTransform(scrollYProgress, [0, 1], [1.02, 1.18])
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '12%'])
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '-18%'])

  return (
    <section className="hero" ref={ref}>
      <motion.div className="hero__text" style={{ y: textY }}>
        <motion.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 1 }}>
          The Party Mood — New drop
        </motion.p>
        <Lines className="display hero__title" lines={['Wear what', 'you feel.']} delay={0.35} />
        <motion.p className="hero__sub serif" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 1 }}>
          Some days deserve their own hoodie.
        </motion.p>
        <motion.div className="hero__cta" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 1 }}>
          <Link to="/shop" className="btn" id="hero-shop">Shop the drop</Link>
          <Link to="/moods" className="link">Find your mood</Link>
        </motion.div>
      </motion.div>
      <div className="hero__media">
        <motion.img src="/images/hero-full.webp" srcSet="/images/hero-480.webp 480w, /images/hero-full.webp 896w" sizes="(max-width: 860px) 100vw, 50vw" width="896" height="1200" alt="A quiet moment in a black hoodie" style={{ scale, y }} fetchPriority="high" />
        <div className="hero__tag eyebrow">Maybe tonight.</div>
      </div>
    </section>
  )
}

function MoodList({ moods, products }) {
  const [active, setActive] = useState(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 220, damping: 26 })
  const sy = useSpring(y, { stiffness: 220, damping: 26 })

  const imageFor = (m) => imgSrc(products.find((p) => p.moodId === m.id)?.images[0])
  const onMove = (e) => { x.set(e.clientX + 28); y.set(e.clientY - 150) }

  return (
    <section className="section moodlist" onMouseMove={onMove}>
      <div className="container">
        <Reveal className="moodlist__head">
          <p className="eyebrow">The moods</p>
          <h2 className="h2">Whatever you're feeling,<br /><em>there's a mood for it.</em></h2>
        </Reveal>
        <ul className="moodlist__list" onMouseLeave={() => setActive(null)}>
          {moods.map((m, i) => {
            const count = products.filter((p) => p.moodId === m.id).length
            return (
              <Reveal as="li" key={m.id} delay={i * 0.03} y={18}>
                <Link
                  to={`/moods/${m.slug}`}
                  className="moodrow"
                  style={{ '--accent': m.accentColor }}
                  onMouseEnter={() => setActive(m)}
                >
                  <span className="moodrow__n eyebrow">{String(i + 1).padStart(2, '0')}</span>
                  <span className="moodrow__name serif">{m.name}</span>
                  <span className="moodrow__tag serif"><em>{m.tagline}</em></span>
                  <span className="moodrow__meta eyebrow">{count ? `${count} ${count > 1 ? 'pieces' : 'piece'}` : 'Soon'}</span>
                  <Icon.Arrow className="moodrow__arrow" />
                </Link>
              </Reveal>
            )
          })}
        </ul>
      </div>
      <AnimatePresence>
        {active && imageFor(active) && (
          <motion.div key={active.id} className="moodpreview" style={{ x: sx, y: sy }} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3 }}>
            <img src={imageFor(active)} alt="" />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

export default function Home() {
  const { products, moods, settings, isLoading } = useProducts()
  const featured = products.filter((p) => p.featured).slice(0, 4)
  const statements = ['Wear the feeling', 'Your mood. Your statement.', 'Not just what you wear. How you feel.', "Made for the mood you're in", 'Some days deserve their own hoodie']

  return (
    <>
      <Seo title="THE MOOD — Wear What You Feel" description="Minimal, emotional hoodies built around the moods you live in. Wear what you feel." path="/" jsonLd={organizationJsonLd(settings)} />
      <Hero />

      <div className="statement-band">
        <Marquee items={statements} speed={60} />
      </div>

      <BannerStrip placement="home" />

      <section className="section">
        <div className="container">
          <Reveal className="sec-head">
            <div>
              <p className="eyebrow">Latest</p>
              <h2 className="h2">The first <em>feelings.</em></h2>
            </div>
            <Link to="/shop" className="link">View all</Link>
          </Reveal>
          <div className="grid">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
              : featured.map((p, i) => (
                  <Reveal key={p.id} delay={i * 0.08}>
                    <ProductCard product={p} />
                  </Reveal>
                ))}
          </div>
        </div>
      </section>

      <MoodPicker moods={moods} />

      <MoodList moods={moods} products={products} />

      <section className="section story-tease dark">
        <div className="container story-tease__grid">
          <Reveal className="story-tease__mark"><LineMark size={260} draw stroke="currentColor" width={1.4} /></Reveal>
          <Reveal delay={0.1}>
            <p className="eyebrow">The idea</p>
            <h2 className="h2">You don't always wear clothes because you like the design.<br /><em>Sometimes it just feels like you.</em></h2>
            <p className="story-tease__p">THE MOOD turns feelings into something you can wear. One sentence, one hoodie, no explanation needed.</p>
            <Link to="/story" className="btn btn--light">Our story</Link>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal className="sec-head">
            <div>
              <p className="eyebrow">@the.mood_co</p>
              <h2 className="h2">Your mood. <em>Your statement.</em></h2>
            </div>
            <a className="link" href="https://www.instagram.com/the.mood_co" target="_blank" rel="noreferrer">Follow us</a>
          </Reveal>
          <div className="insta">
            {[...products.map((p) => p.images[0]), { src: '/images/hero-full.webp', srcset: '/images/hero-480.webp 480w, /images/hero-full.webp 896w' }].slice(0, 6).map((img, i) => (
              <Reveal key={i} delay={i * 0.05} className="insta__item">
                <a href="https://www.instagram.com/the.mood_co" target="_blank" rel="noreferrer" aria-label="See it on Instagram">
                  <img {...imgProps(img, '(max-width: 760px) 50vw, 16vw')} alt="" loading="lazy" />
                  <span className="insta__hover"><Icon.Instagram /></span>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
