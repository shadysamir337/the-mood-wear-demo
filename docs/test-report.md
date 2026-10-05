# THE MOOD — test report

Date: 5 October 2026 · Branch `claude/serene-mendel-wsfc9l`

## How it was tested

1. **Code review** of the whole project (storefront, admin, data layer, pricing engine).
2. **Baseline tests** written before any fix, run against the original code to confirm each finding.
3. Fixes and new features, each with tests. Every suite was run again at the end.

| Suite | Baseline (original code) | Final |
| --- | --- | --- |
| Unit tests (Vitest) | 18 / 22 pass | **24 / 24** |
| Browser tests, demo mode (Playwright, desktop 1440 px + mobile Pixel 7) | 30 / 60 pass | **74 / 74** |
| Security rules on the Firestore emulator | no rules existed | **11 / 11** |
| Cloud Functions on the emulators | no functions existed | **10 / 10** |
| Browser tests against the Firebase emulators | Firebase mode could not take an order | **33 / 33** (+1 skipped: covered by the functions tests) |
| Accessibility (axe, WCAG 2 A/AA, 9 pages) | serious violations on every page | **0 serious or critical** |

## Lighthouse (mobile, production build)

| Page | Original: performance / accessibility / SEO | Now | Largest paint | Page weight |
| --- | --- | --- | --- | --- |
| Home | 61 / 89 / 92 | **90 / 96 / 100** | 13.3 s → **2.5 s** | 3.6 MB → **253 kB** |
| Shop | 63 / 85 / 92 | **92 / 95 / 100** | 6.8 s → **2.4 s** | 6.0 MB → **316 kB** |
| Product | 61 / 90 / 92 | **89 / 96 / 100** | 8.3 s → **2.6 s** | 4.4 MB → **280 kB** |

Google Fonts are blocked in the test sandbox, so these runs used fallback fonts. Expect slightly lower numbers with the real fonts.

## Findings and what happened

| # | Finding | Confirmed by a test? | Status |
| --- | --- | --- | --- |
| 1 | Firebase mode called Cloud Functions that didn't exist, so checkout, promos, tracking and order management failed | Yes, by reading the code (no `functions/`) | **Fixed**: `functions/`, tested on the emulators |
| 2 | No Firestore or Storage security rules | Yes | **Fixed**: rules plus 11 rules tests |
| 3 | Stored XSS: customer name and address went unescaped into the admin's invoice window | **Yes**: the injected `<img>` rendered as HTML | **Fixed**: everything is escaped |
| 4 | Order numbers collided after an order was deleted | **Yes**: two orders got the same number | **Fixed**: counter (transactional on the server) |
| 5 | Stock was not reserved atomically | Yes, by design review | **Fixed**: 5 parallel buyers for the last 2 units give exactly 2 orders |
| 6 | Demo admin with public credentials would run in production | Yes | **Fixed**: production builds refuse demo mode |
| 7 | Promo and sale dates moved back one day on every save (Cairo time) | **Yes**: 10 Dec showed as 9 Dec | **Fixed** |
| 8 | Sizes ignored the selected colour | **Yes** | **Fixed** |
| 9 | Cart quantity could go past stock | **Yes**: 6 in the cart with 4 in stock | **Fixed** |
| 10 | Checkout total included shipping before a governorate was picked | **Yes**: 1,535 instead of 1,450 EGP | **Fixed** |
| 11 | Reopening a cancelled order didn't take stock again; any status could follow any other | **Yes** | **Fixed**: transition map, stock moves both ways |
| 12 | Free-shipping threshold and fees were hardcoded on the product, FAQ and shipping pages; Dashboard ignored the low-stock setting | **Yes** | **Fixed** |
| 13 | Inventory inputs showed stale numbers | Yes, by code review | **Fixed** |
| 14 | A new promo with an existing code overwrote it; duplicate product slugs | **Yes** | **Fixed** |
| 15 | Image uploads in demo mode filled browser storage with no error shown | Yes, by code review | **Fixed**: smaller WebP and a clear message |
| 16 | Cart and menu scroll locks could unlock each other | Yes, by code review | **Fixed**: counted lock on Lenis |
| 17 | Checkout ignored the cash-on-delivery switch | Yes, by code review | **Fixed**: the switch now pauses ordering |
| 18 | A catalog error showed an empty store | Yes, by code review | **Fixed**: error message with a retry button, plus an error boundary |
| 19 | CSV export allowed formula injection | **Yes** | **Fixed** |
| 20 | Images of 600–900 kB, no responsive sizes | Yes (Lighthouse) | **Fixed**: WebP, `srcset`, preload |
| 21 | Intro blocked every new session for 2.9 s | **Yes**: it couldn't be skipped | **Fixed**: shown once, skippable, off for reduced motion |
| 22–23 | Missing focus traps and Escape key, low-contrast footer, wrong ARIA roles | **Yes** (axe) | **Fixed** |
| 24 | No per-page SEO, no sitemap, link previews showed the same image | Yes | **Fixed**: SEO tags, JSON-LD, prerendering, sitemap, robots |
| 25 | Unused dependency, duplicated helpers, template README | Yes | **Fixed** |
| 26 | No analytics | — | **Added**: GA4, Meta and TikTok behind a consent bar |
| new | Firebase was in the main bundle (1.2 MB) | Yes (build output) | **Fixed**: loaded on demand |
| new | Shop filter dropped a click when two were made quickly | Found by a flaky test | **Fixed** |
| new | After checkout, the account page could show the address book without the new address | Found by the Firebase-mode tests | **Fixed** |

## New features (all tested)

- **Customers:** accounts (email and Google), order history, address book, prefilled checkout, wishlist that syncs to the account, reviews from delivered orders, notify-me for sold-out sizes and upcoming drops, drop countdown, "What's your mood today?" picker.
- **Admin:**
  - Orders: paged list, manual orders, packing slips, courier tracking links.
  - Customers: notes and tags.
  - Reviews: moderation with public replies.
  - Banners, plus scheduled product drops.
  - Product SEO fields and drag-to-reorder.
  - Activity log.
  - Team roles: owner, admin and staff.
  - Notification settings.
  - Dashboard comparisons with the previous period.
- **Backend:**
  - Order emails (Resend) and WhatsApp messages (Cloud API).
  - Morning low-stock digest.
  - Rate limits, plus optional App Check.

## Not covered, or needs real accounts

- **Live email and WhatsApp sending** needs your Resend key and approved WhatsApp templates. The tests confirm the triggers run and skip cleanly without keys.
- **Google sign-in** works in Firebase but can't run on the emulators in CI. Email sign-up is tested.
- **The scheduled functions** (`publishScheduledDrops`, `lowStockDigest`) aren't run by the tests. The same publish logic is tested in demo mode.
- **Out of scope for now:**
  - Online card and wallet payments; the store stays cash on delivery for now.
  - Arabic. Copy is kept in components, so it can be extracted to a translation file later.

## Screenshots

Desktop (1440 px) and mobile (Pixel 7) screenshots of the main pages are in [`docs/screens/`](screens/).
