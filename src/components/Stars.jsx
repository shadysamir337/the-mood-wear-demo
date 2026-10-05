import { Icon } from './Icons'

/** Read-only star row. */
export function Stars({ value = 0, size = 14, label }) {
  const v = Math.round(value)
  return (
    <span className="stars" role="img" aria-label={label || `${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Icon.Star key={n} width={size} height={size} filled={n <= v} />)}
    </span>
  )
}

/** Star picker for reviews (a radio group under the hood). */
export function StarInput({ value, onChange, name }) {
  return (
    <div className="stars stars--input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={n <= value ? 'is-on' : ''}>
          <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only" />
          <Icon.Star width={26} height={26} filled={n <= value} />
          <span className="sr-only">{n} star{n > 1 ? 's' : ''}</span>
        </label>
      ))}
    </div>
  )
}
