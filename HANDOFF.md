# THE MOOD: handoff

This is for whoever picks up the project next. The setup details are in [README.md](README.md). Test results and the full list of findings are in [docs/test-report.md](docs/test-report.md).

## State of the project

- **Ready to launch once it's connected to Firebase.** The storefront, admin panel and backend are finished and tested. The store takes cash on delivery only, and the site is in English only.
- **Demo mode** runs the whole store with no setup: `npm install && npm run dev`, and the admin login is `admin@themood.co` / `mood2026`. Production builds refuse demo mode.
- **Tests are all green:**

  | Suite | Result |
  | --- | --- |
  | Unit | 24 / 24 |
  | Browser, demo mode (desktop + mobile) | 74 / 74 |
  | Security rules and functions (emulators) | 21 / 21 |
  | Browser, against the Firebase emulators | 33 / 33, plus 1 skipped |

  CI runs all of them on every push (`.github/workflows/ci.yml`).

## Architecture in one screen

```
src/pages, src/components   storefront (React 19, Vite, Framer Motion, Lenis)
src/admin                   admin panel (/admin), role-aware: owner / admin / staff
src/lib/api.js              picks the data adapter:
  api-local.js              demo mode, a seeded database in localStorage (keys mood:v1:*)
  api-remote.js             Firebase, loaded on demand (Firestore, Functions, Storage)
src/lib/auth.js             one login system for customers and staff (staff = custom claim "role")
shared/pricing.js           THE pricing/promo/shipping/order engine, used by the app AND the functions
shared/seed.js              starter catalog (moods, products, promos, settings)
functions/                  Cloud Functions: orders (transactions), promos, tracking, reviews,
                            notifications (Resend email + WhatsApp), roles, schedules, audit log
firestore.rules             who can read/write what; money and stock are server-only
storage.rules               image uploads: admins only, images under 8 MB
scripts/                    prerender.mjs (SEO + sitemap), optimize-images.mjs (WebP)
tests/ tests-firebase/ e2e/ unit / emulator / Playwright tests
```

## Go-live checklist (in order)

1. **Create the Firebase project.** Turn on the Blaze plan, Firestore, Auth (Email/Password and Google) and Storage.
2. **Point the app at it.** Copy `.env.example` to `.env.local` and fill in the web config. Put the project id in `.firebaserc`, and set `VITE_SITE_URL` to the real domain.
3. **Set the secrets:**
   ```
   firebase functions:secrets:set RESEND_API_KEY
   firebase functions:secrets:set WHATSAPP_TOKEN
   ```
   Use the value `none` to switch a channel off.
4. **Verify the email domain** in Resend, then set `MAIL_FROM`.
5. **Get the WhatsApp templates approved** in Meta Business Manager. You need `order_received`, `order_shipped`, `order_delivered` and `admin_new_order`; their parameters are in `functions/src/templates.js`. Then set `WHATSAPP_PHONE_ID`.
6. **Deploy:**
   ```
   npm ci --prefix functions
   firebase deploy
   ```
   The deploy asks for any params that aren't set yet.
7. **Seed the catalog:**
   ```
   GOOGLE_APPLICATION_CREDENTIALS=… GCLOUD_PROJECT=… npm --prefix functions run seed
   ```
8. **Make the first owner.** The owner signs up on `/login`, then run:
   ```
   npm --prefix functions run set-role -- owner@email owner
   ```
   Add the rest of the team in Admin → Settings → Team.
9. **Fill in Admin → Settings:** shipping fees per governorate, notification emails and WhatsApp numbers, and couriers.
10. **Replace the sample content.** Swap the seed products and photos for real ones. Upload in the admin, which resizes to WebP automatically, or run `npm run images` for files in `public/images`.
11. **Optional:**
    - App Check: set `VITE_FIREBASE_APPCHECK_KEY`, and put `APPCHECK=1` in `functions/.env`.
    - Analytics: set `VITE_GA_ID`, `VITE_META_PIXEL_ID` and `VITE_TIKTOK_PIXEL_ID`. Nothing loads until a visitor accepts cookies.

## How to test

```
npm run lint && npm test           # lint and unit tests
npm run e2e                        # Playwright, demo mode
npm run test:firebase              # rules and functions on the emulators (needs Java)
npm run e2e:firebase               # Playwright against the emulators
npm run build:seo                  # production build, prerender, sitemap
```

In Claude's cloud sandbox, the emulators only start with the proxy variables removed. Prefix the command like this:

```
env -u HTTPS_PROXY -u https_proxy -u GLOBAL_AGENT_HTTPS_PROXY -u npm_config_https_proxy npm run test:firebase
```

On a normal machine or in CI this isn't needed.

## Known gaps (not verified)

- **Live email and WhatsApp sending.** It needs real keys and approved templates. The tests only confirm the triggers run and skip cleanly without keys.
- **Google sign-in.** It can't run on the emulators. Email sign-up is tested.
- **The scheduled functions** (`publishScheduledDrops` every 15 min, `lowStockDigest` daily) aren't run by the tests. The publish logic is tested in demo mode.
- **Lighthouse scores** (90 / 96 / 100 on mobile) were measured without Google Fonts, which the sandbox blocks. Re-measure on the live site.
- **Out of scope by decision:** card and wallet payments, and Arabic.

## Suggested next steps

1. **Online payments with Paymob.** The checkout has a "Card & wallets, coming soon" option ready. Add a `createPaymentIntent` function and a webhook that marks orders as `paid`.
2. **Arabic and right-to-left layout.** Copy is inline in the components, so extract it to a translation file first.
3. **Real photography and copy** for each mood drop.
4. **Monitoring.** Set up Functions error alerts in Cloud Logging, budget alerts, and uptime checks.
5. **Backups.** Schedule a daily Firestore export to a Cloud Storage bucket.

## Gotchas

- **Prices, promos, shipping and order rules** live only in `shared/pricing.js`. `functions/shared` is a generated copy (`npm --prefix functions run sync-shared`), so never edit it.
- **Admin writes to products** must include `updatedBy` (the user's email). The rules reject them otherwise, and `api-remote.js` already does this.
- **Orders, promo usage, counters and stock** are only written by Cloud Functions. The client can't write them, and that's intentional.
- **Production builds show "Opening soon"** when there are no Firebase keys. Set `VITE_ALLOW_DEMO=1` only for preview links.
- **Firebase Hosting serves `dist/app.html`** for the routes that aren't prerendered (admin, account, checkout). The prerendered pages are static `index.html` files under `dist/`.
- **Product images** are either URL strings or `{ src, srcset }` objects. Always use `imgSrc` and `imgProps` from `src/lib/images.js`.
