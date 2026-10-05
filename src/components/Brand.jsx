import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/** Text wordmark: matches the logo's high-contrast serif. */
export function Wordmark({ className = '', as: Tag = 'span' }) {
  return <Tag className={`wordmark ${className}`}>THE MOOD</Tag>
}

const STROKES = [
  'M70 190 C 62 150 70 110 98 88 L 150 66',
  'M108 118 C 120 108 140 108 150 116 C 140 126 118 128 108 118 Z',
  'M142 128 C 150 140 152 150 140 154',
  'M120 168 C 132 163 148 163 160 168 C 150 178 130 178 120 168 Z',
  'M82 200 C 85 230 110 245 150 240 L 168 215',
  'M175 55 C 168 85 160 105 158 118 L 172 128 C 168 134 166 140 172 146 C 168 152 170 158 176 162',
  'M175 55 C 200 60 225 80 225 115 C 225 150 205 175 180 182',
  'M190 100 C 198 95 210 96 215 102',
  'M225 100 C 238 95 244 108 236 118 C 232 122 228 122 226 120',
  'M190 195 C 210 205 225 225 232 250',
  'M95 215 C 80 235 70 255 62 270',
]

/** The one-line-art faces. `draw` animates the strokes in one by one. */
export function LineMark({ size = 120, draw = false, delay = 0, stroke = 'currentColor', width = 2 }) {
  return (
    <svg width={size} height={size} viewBox="40 30 220 260" fill="none" aria-hidden="true">
      {STROKES.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          stroke={stroke}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={draw ? { pathLength: 0, opacity: 0 } : false}
          animate={draw ? { pathLength: 1, opacity: 1 } : undefined}
          transition={{ duration: 1.1, delay: delay + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </svg>
  )
}

const INTRO_KEY = 'mood:intro'
const INTRO_VERSION = '2'
const seenIntro = () => {
  try {
    return localStorage.getItem(INTRO_KEY) === INTRO_VERSION || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return true
  }
}

/** First-visit intro: logo draws itself, then lifts away. Click, tap or any key skips it. */
export function Intro() {
  const [show, setShow] = useState(() => !seenIntro())

  useEffect(() => {
    if (!show) return
    try { localStorage.setItem(INTRO_KEY, INTRO_VERSION) } catch { /* private mode */ }
    const skip = () => setShow(false)
    const t = setTimeout(skip, 2200)
    window.addEventListener('keydown', skip)
    return () => { clearTimeout(t); window.removeEventListener('keydown', skip) }
  }, [show])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="intro"
          onClick={() => setShow(false)}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
        >
          <LineMark size={150} draw />
          <motion.div
            className="intro__word"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.8 }}
          >
            <Wordmark />
            <span className="eyebrow">Wear what you feel</span>
          </motion.div>
          <span className="intro__skip eyebrow">Tap to skip</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
