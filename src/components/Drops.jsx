import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useCatalog } from '../lib/store'
import { isScheduleActive } from '../lib/pricing'
import { imgProps } from '../lib/images'
import { api } from '../lib/api'
import { Reveal } from './Motion'

/** Admin-managed banner for a placement ('home' | 'shop'). Shows the newest live one. */
export function BannerStrip({ placement }) {
  const { data } = useCatalog()
  const b = (data?.banners || []).filter((x) => (x.placement || 'home') === placement && isScheduleActive(x)).sort((a, z) => (z.updatedAt || 0) - (a.updatedAt || 0))[0]
  if (!b) return null
  const internal = b.ctaLink?.startsWith('/')
  return (
    <Reveal className={`banner banner--${placement}`}>
      <div className="container banner__inner">
        {b.image && <img {...imgProps(b.image, '(max-width: 760px) 100vw, 40vw')} alt="" className="banner__img" loading="lazy" />}
        <div className="banner__copy">
          <p className="h3 serif">{b.title}</p>
          {b.text && <p className="muted">{b.text}</p>}
        </div>
        {b.ctaLabel && b.ctaLink && (internal
          ? <Link to={b.ctaLink} className="btn">{b.ctaLabel}</Link>
          : <a href={b.ctaLink} className="btn" target="_blank" rel="noreferrer">{b.ctaLabel}</a>)}
      </div>
    </Reveal>
  )
}

const parts = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
}

/** Live countdown to a mood's drop date. */
export function Countdown({ to }) {
  const target = new Date(`${to}T20:00:00`).getTime()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!target || target <= now) return null
  const p = parts(target - now)
  return (
    <div className="countdown" role="timer" aria-label={`Drops in ${p.d} days ${p.h} hours`}>
      {[['d', 'days'], ['h', 'hours'], ['m', 'min'], ['s', 'sec']].map(([k, label]) => (
        <span key={k}><b className="serif">{String(p[k]).padStart(2, '0')}</b><small className="eyebrow">{label}</small></span>
      ))}
    </div>
  )
}

/** "Tell me when it drops" for moods without products yet. */
export function DropAlert({ mood }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('')
  const submit = async (e) => {
    e.preventDefault()
    setState('busy')
    try { await api.requestRestockAlert({ email, moodId: mood.id }); setState('done') } catch (err) { setState(err.message) }
  }
  if (state === 'done') return <p className="serif" role="status">You'll be the first to know.</p>
  return (
    <form className="notify notify--drop" onSubmit={submit}>
      <input className="input" type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email for drop alert" />
      <button className="btn" disabled={state === 'busy'}>Tell me when it drops</button>
      {state && state !== 'busy' && <p className="field-error">{state}</p>}
    </form>
  )
}

/** "What's your mood today?" — one tap to the feeling. */
export function MoodPicker({ moods }) {
  const navigate = useNavigate()
  if (!moods.length) return null
  return (
    <section className="section moodpick">
      <div className="container">
        <Reveal><p className="eyebrow">Check in</p><h2 className="h2">What's your mood <em>today?</em></h2></Reveal>
        <div className="moodpick__list">
          {moods.map((m, i) => (
            <motion.button
              key={m.id}
              className="moodpick__item serif"
              style={{ '--accent': m.accentColor }}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04, duration: 0.6 }}
              onClick={() => navigate(`/moods/${m.slug}`)}
            >
              {m.name.replace(/^The /, '').replace(/ Mood$/, '').toLowerCase()}
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  )
}
