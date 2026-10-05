/**
 * One place for marketing events. Sends to GA4, Meta Pixel and TikTok Pixel when their IDs are set
 * AND the visitor accepted cookies. Nothing loads before consent.
 */
const env = import.meta.env
const IDS = { ga: env.VITE_GA_ID, meta: env.VITE_META_PIXEL_ID, tiktok: env.VITE_TIKTOK_PIXEL_ID }
export const analyticsEnabled = Boolean(IDS.ga || IDS.meta || IDS.tiktok)
const CONSENT = 'mood:consent'

export const getConsent = () => {
  try { return localStorage.getItem(CONSENT) } catch { return null }
}

let loaded = false
const queue = []
const addScript = (src) => {
  const s = document.createElement('script')
  s.async = true
  s.src = src
  document.head.appendChild(s)
}

function load() {
  if (loaded || !analyticsEnabled) return
  loaded = true
  if (IDS.ga) {
    window.dataLayer = window.dataLayer || []
    window.gtag = function gtag() { window.dataLayer.push(arguments) }
    window.gtag('js', new Date())
    window.gtag('config', IDS.ga)
    addScript(`https://www.googletagmanager.com/gtag/js?id=${IDS.ga}`)
  }
  if (IDS.meta) {
    const f = (window.fbq = function fbq() { f.callMethod ? f.callMethod(...arguments) : f.queue.push(arguments) })
    f.push = f; f.loaded = true; f.version = '2.0'; f.queue = []
    addScript('https://connect.facebook.net/en_US/fbevents.js')
    window.fbq('init', IDS.meta)
    window.fbq('track', 'PageView')
  }
  if (IDS.tiktok) {
    const t = (window.ttq = window.ttq || [])
    ;['page', 'track', 'identify'].forEach((m) => { t[m] = (...a) => t.push([m, ...a]) })
    addScript(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${IDS.tiktok}&lib=ttq`)
    t.page()
  }
  queue.splice(0).forEach(([e, d]) => send(e, d))
}

export function setConsent(value) {
  try { localStorage.setItem(CONSENT, value) } catch { /* private mode */ }
  if (value === 'yes') load()
}

if (typeof window !== 'undefined' && getConsent() === 'yes') load()

// Our event name → each platform's standard event.
const META = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'Purchase', add_to_wishlist: 'AddToWishlist', sign_up: 'CompleteRegistration', search: 'Search' }
const TIKTOK = { view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout', purchase: 'CompletePayment', add_to_wishlist: 'AddToWishlist', sign_up: 'CompleteRegistration', search: 'Search' }

function send(event, data) {
  if (window.gtag) window.gtag('event', event, { currency: 'EGP', ...data })
  if (window.fbq && META[event]) window.fbq('track', META[event], { currency: 'EGP', value: data.value, content_ids: data.item_id ? [data.item_id] : data.items?.map((i) => i.item_id), content_type: 'product' })
  if (window.ttq?.track && TIKTOK[event]) window.ttq.track(TIKTOK[event], { currency: 'EGP', value: data.value, content_id: data.item_id })
}

/** Fire-and-forget event. Queued until consent; dropped if analytics isn't configured. */
export function track(event, data = {}) {
  if (typeof window !== 'undefined') (window.__moodEvents ||= []).push({ event, ...data })
  if (!analyticsEnabled || getConsent() !== 'yes') return
  if (!loaded) queue.push([event, data])
  else send(event, data)
}
