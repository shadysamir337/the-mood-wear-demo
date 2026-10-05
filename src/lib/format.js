/** Date helpers for <input type="date">. Both directions use local time so dates never shift. */
const pad = (n) => String(n).padStart(2, '0')
export const toDateInput = (ms) => {
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export const fromDateInput = (s, end = false) => (s ? new Date(`${s}T${end ? '23:59:59' : '00:00:00'}`).getTime() : null)
export const fmtDate = (ms) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export const fmtDateTime = (ms) => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** Escape text for HTML strings built by hand (invoices, emails). */
export const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/** Quote a CSV cell and neutralise spreadsheet formulas (=, +, -, @). */
export const csvCell = (v) => {
  let s = String(v ?? '')
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

/** Courier tracking link from Settings → couriers ({ name, url containing {number} }). */
export const trackingUrl = (couriers, tracking) => {
  const c = (couriers || []).find((x) => x.name.toLowerCase() === String(tracking?.courier || '').toLowerCase())
  return c && tracking?.number && /^https:\/\//.test(c.url) ? c.url.replace('{number}', encodeURIComponent(tracking.number)) : ''
}

/** For <input type="datetime-local"> in local time. */
export const toDateTimeInput = (ms) => {
  if (!ms) return ''
  const d = new Date(ms)
  return `${toDateInput(ms)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
