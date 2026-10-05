// Makes responsive WebP copies of the images in public/images: name-480.webp and name-full.webp (original width, max 1600).
// Run after adding images: npm run images
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'

const dir = 'public/images'
const WIDTHS = [480, 'full']
for (const f of await readdir(dir)) {
  if (!/\.(jpe?g|png)$/i.test(f)) continue
  const base = f.replace(/\.[^.]+$/, '')
  const meta = await sharp(join(dir, f)).metadata()
  for (const w of WIDTHS) {
    const out = join(dir, `${base}-${w}.webp`)
    const width = w === 'full' ? Math.min(1600, meta.width) : Math.min(w, meta.width)
    await sharp(join(dir, f)).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toFile(out)
    console.log(out, `${width}w`, `${Math.round((await stat(out)).size / 1024)} kB`)
  }
}
