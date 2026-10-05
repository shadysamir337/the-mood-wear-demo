// After `vite build`: renders every public page in a headless browser and saves static HTML
// (title, description, Open Graph, JSON-LD, content) so search engines and link previews
// (Instagram, Facebook, WhatsApp) see real pages. Also writes sitemap.xml and robots.txt.
//   npm run build:seo
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { chromium } from '@playwright/test'

const PORT = 4179
const ORIGIN = `http://localhost:${PORT}`
const SITE = (process.env.VITE_SITE_URL || 'https://themood.co').replace(/\/$/, '')
const STATIC = ['/', '/shop', '/moods', '/story', '/faq', '/shipping-returns', '/size-guide', '/contact', '/privacy']

// Keep the empty app shell for every route that isn't prerendered (admin, account, checkout…).
await copyFile('dist/index.html', 'dist/app.html')

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', env: process.env })
const stop = () => server.kill('SIGTERM')
process.on('exit', stop)

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(ORIGIN)).ok) return } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('preview server did not start')
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) })
try {
  await waitForServer()
  const page = await browser.newPage()
  await page.addInitScript(() => { try { localStorage.setItem('mood:intro', '2'); localStorage.setItem('mood:consent', 'no') } catch { /* ignore */ } })

  const routes = new Set(STATIC)
  const done = new Set()
  while ([...routes].some((r) => !done.has(r))) {
    const route = [...routes].find((r) => !done.has(r))
    done.add(route)
    await page.goto(ORIGIN + route, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500) // let entrance animations settle
    // discover product and mood pages from links
    for (const href of await page.$$eval('a[href^="/product/"], a[href^="/moods/"]', (as) => as.map((a) => a.getAttribute('href')))) {
      routes.add(href.split('?')[0])
    }
    const html = await page.evaluate(() => {
      // tag what React put in <head> so the app can remove it before it renders its own copy
      document.querySelectorAll('head title, head meta[name="description"], head meta[property^="og:"], head meta[name^="twitter:"], head meta[name="robots"], head link[rel="canonical"], script[type="application/ld+json"]')
        .forEach((el) => el.setAttribute('data-prerender', ''))
      document.querySelectorAll('.intro, .consent').forEach((el) => el.remove())
      return '<!doctype html>\n' + document.documentElement.outerHTML
    })
    const file = route === '/' ? 'dist/index.html' : join('dist', route, 'index.html')
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, html)
    console.log('prerendered', route)
  }

  const urls = [...done].sort()
  const today = new Date().toISOString().slice(0, 10)
  await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE}${u === '/' ? '/' : u}</loc><lastmod>${today}</lastmod><changefreq>${u.startsWith('/product/') ? 'weekly' : 'daily'}</changefreq></url>`).join('\n')}\n</urlset>\n`)
  await writeFile('dist/robots.txt', `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /checkout\nDisallow: /order/\nDisallow: /review/\nDisallow: /login\n\nSitemap: ${SITE}/sitemap.xml\n`)
  console.log(`sitemap.xml: ${urls.length} urls`)
} finally {
  await browser.close()
  stop()
}
