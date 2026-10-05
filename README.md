# THE MOOD — Wear What You Feel

The store for THE MOOD: a React storefront, a full admin panel and a Firebase backend, all in one project.

- **Storefront**: shop by mood, product pages with size/colour stock, cart, cash-on-delivery checkout, order tracking, accounts, wishlist, reviews, restock alerts.
- **Admin** (`/admin`): orders (paging, manual orders, invoices, packing slips, courier links), products (variants, images, scheduled drops, SEO, ordering), moods, inventory, promo codes, sales, banners, customers (notes, tags), reviews, activity log, settings (shipping, notifications, couriers, team).
- **Backend**: Cloud Functions do everything that touches money or stock, inside Firestore transactions. Security rules keep everything else locked down.

```
src/            React app (Vite)
  pages/        storefront pages
  admin/        admin panel
  lib/          data layer: api-local.js (demo), api-remote.js (Firebase), auth, cart, wishlist
shared/         pricing + order engine and seed data, used by the app AND the functions
functions/      Cloud Functions (orders, promos, reviews, notifications, roles, schedules)
firestore.rules storage.rules firestore.indexes.json firebase.json
tests/          unit tests (Vitest)
tests-firebase/ security-rules and functions tests (run on the emulators)
e2e/            browser tests (Playwright), run in demo mode and against the emulators
scripts/        image optimisation, prerender (SEO), etc.
```

## Run it locally

```bash
npm install
npm run dev            # http://localhost:5173
```

With no Firebase keys the site runs in **demo mode**: a seeded database in your browser, so you can click through everything. Admin login: `admin@themood.co` / `mood2026`. Demo mode is refused in production builds (the site shows "Opening soon") unless `VITE_ALLOW_DEMO=1`.

## Connect Firebase

1. Create a project at console.firebase.google.com. Turn on **Firestore**, **Authentication** (Email/Password and Google), **Storage**, and upgrade to the **Blaze** plan (needed for Cloud Functions).
2. Copy `.env.example` to `.env.local` and fill in the web app config. Set `.firebaserc` to your project id.
3. Install and deploy:
   ```bash
   npm install -g firebase-tools && firebase login
   npm ci --prefix functions
   firebase functions:secrets:set RESEND_API_KEY     # or "none" to turn email off
   firebase functions:secrets:set WHATSAPP_TOKEN     # or "none" to turn WhatsApp off
   firebase deploy
   ```
   On the first deploy the CLI asks for `WHATSAPP_PHONE_ID`, `MAIL_FROM` and `SITE_URL`.
4. Load the starter catalog and make yourself the owner (with a service-account key from Project settings → Service accounts):
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=./service-account.json GCLOUD_PROJECT=<project-id>
   npm --prefix functions run seed
   # sign up once on the site (/login), then:
   npm --prefix functions run set-role -- you@email.com owner
   ```
   After that, add the rest of the team from **Admin → Settings → Team**. Roles: **owner** (everything), **admin** (everything except the team), **staff** (orders, inventory, customers, reviews).

### Bot protection (optional)
Turn on App Check with reCAPTCHA Enterprise, put the site key in `VITE_FIREBASE_APPCHECK_KEY`, and set `APPCHECK=1` in `functions/.env` so the public functions (checkout, promo check, tracking) reject requests that don't come from your site. All public functions are also rate-limited.

### Notifications
- **Email** uses [Resend](https://resend.com). Verify your sending domain there and set `MAIL_FROM`.
- **WhatsApp** uses the WhatsApp Cloud API. Create message templates in Meta Business Manager named `order_received`, `order_shipped`, `order_delivered` and `admin_new_order` (their parameters are listed in `functions/src/templates.js`).
- Turn channels on and off in **Admin → Settings → Notifications**.

### Analytics
Set `VITE_GA_ID`, `VITE_META_PIXEL_ID` and/or `VITE_TIKTOK_PIXEL_ID`. Nothing loads until the visitor accepts the cookie bar. Events: `view_item`, `add_to_cart`, `add_to_wishlist`, `begin_checkout`, `purchase`.

## Build and deploy

```bash
npm run build:seo      # vite build + prerender every public page + sitemap.xml + robots.txt
firebase deploy        # runs build:seo for you (hosting predeploy)
```

The prerender step renders the home, shop, mood and product pages in a headless browser so Google and link previews on Instagram, Facebook and WhatsApp see real titles, descriptions and images.

New product photos uploaded in the admin are resized in the browser to WebP (480/960/1600). For images in `public/images`, run `npm run images`.

## Tests

| Command | What it checks |
| --- | --- |
| `npm run lint` | Oxlint |
| `npm test` | Pricing, promos, shipping, order building, status transitions, formatting (Vitest) |
| `npm run e2e` | Storefront, checkout, accounts, admin, accessibility (axe) and responsive layouts in demo mode (Playwright, desktop + mobile) |
| `npm run test:firebase` | Firestore rules and Cloud Functions on the emulators, including a concurrency test for the last units of stock (needs Java) |
| `npm run e2e:firebase` | The browser suite again, against the emulators |

`npm run emulators` starts the emulators; `npm run seed:emulator` loads the catalog into them; run the app against them with `VITE_FIREBASE_EMULATORS=1`.

The test report is in [docs/test-report.md](docs/test-report.md).
