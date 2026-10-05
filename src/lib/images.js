/**
 * Product images are either a plain URL string (seed data, older uploads)
 * or { src, srcset } for responsive WebP uploads. These helpers accept both.
 */
export const imgSrc = (img) => (typeof img === 'string' ? img : img?.src || '')
export const imgSrcSet = (img) => (typeof img === 'string' ? undefined : img?.srcset || undefined)

/** Spread onto an <img>: src, srcSet and sizes in one go. */
export const imgProps = (img, sizes = '(max-width: 760px) 50vw, 25vw') => {
  const srcSet = imgSrcSet(img)
  return { src: imgSrc(img), ...(srcSet ? { srcSet, sizes } : {}) }
}

/** Resizes an image file in the browser to each width (never upscaling) as WebP blobs. */
export async function resizeImage(file, widths, quality = 0.8) {
  const bitmap = await createImageBitmap(file)
  const out = []
  for (const w of widths) {
    const scale = Math.min(1, w / bitmap.width)
    const c = document.createElement('canvas')
    c.width = Math.round(bitmap.width * scale)
    c.height = Math.round(bitmap.height * scale)
    c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height)
    const blob = await new Promise((r) => c.toBlob(r, 'image/webp', quality))
    out.push({ blob, width: c.width })
    if (scale === 1) break
  }
  bitmap.close?.()
  return out
}
