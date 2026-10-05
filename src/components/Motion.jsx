import { motion } from 'framer-motion'

const ease = [0.22, 1, 0.36, 1]

/** Fade + rise when scrolled into view. */
export function Reveal({ children, delay = 0, y = 28, as = 'div', className = '', ...rest }) {
  const Comp = motion[as] || motion.div
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.9, delay, ease }}
      {...rest}
    >
      {children}
    </Comp>
  )
}

/** Headline that reveals line by line (each line is masked). */
export function Lines({ lines, className = '', delay = 0, as = 'h1' }) {
  const Tag = as
  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <span key={i} className="line-mask">
          <motion.span
            className="line-mask__inner"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 1.1, delay: delay + i * 0.12, ease }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </Tag>
  )
}

/** Endless horizontal ticker. */
export function Marquee({ items, speed = 38, className = '' }) {
  const row = [...items, ...items]
  return (
    <div className={`marquee ${className}`} aria-hidden="true">
      <div className="marquee__track" style={{ animationDuration: `${speed}s` }}>
        {[0, 1].map((k) => (
          <div className="marquee__row" key={k}>
            {row.map((t, i) => (
              <span key={i} className="marquee__item">
                {t}
                <i className="marquee__dot" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
