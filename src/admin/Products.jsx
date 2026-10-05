import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { slugify } from '../lib/api'
import { totalStock, formatPrice } from '../lib/pricing'
import { Field, ImageUploader, Modal, PageHead, Pill, Toggle, toast, useList, useRemove, useSave } from './ui'
import { imgSrc } from '../lib/images'
import { fmtDateTime, toDateTimeInput } from '../lib/format'

/** Manual position first (set by dragging), newest first after that. */
const byPosition = (a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || (b.createdAt || 0) - (a.createdAt || 0)

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const blank = () => ({
  name: '', slug: '', statement: '', moodId: '', price: 1400, compareAtPrice: 0, images: [], status: 'draft',
  featured: false, isNew: true, description: '', details: [], colors: [{ name: 'Black', hex: '#111111' }], variants: [],
})

function syncVariants(colors, sizes, old = []) {
  return colors.flatMap((c) => sizes.map((size) => {
    const prev = old.find((v) => v.color === c.name && v.size === size)
    return { sku: prev?.sku || `${(c.name || 'X').slice(0, 3).toUpperCase()}-${size}`, color: c.name, size, stock: prev?.stock ?? 0 }
  }))
}

function Editor({ initial, moods, onClose }) {
  const [p, setP] = useState(() => ({ ...blank(), ...initial, details: initial?.details || [] }))
  const [sizes, setSizes] = useState(() => (initial?.variants?.length ? ALL_SIZES.filter((s) => initial.variants.some((v) => v.size === s)) : ['S', 'M', 'L', 'XL']))
  const [variants, setVariants] = useState(() => (initial?.variants?.length ? initial.variants : syncVariants(blank().colors, ['S', 'M', 'L', 'XL'])))
  const save = useSave('products')
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }))

  const updateColors = (colors) => { set('colors', colors); setVariants((v) => syncVariants(colors, sizes, v)) }
  const toggleSize = (s) => {
    const next = sizes.includes(s) ? sizes.filter((x) => x !== s) : ALL_SIZES.filter((x) => sizes.includes(x) || x === s)
    setSizes(next); setVariants((v) => syncVariants(p.colors, next, v))
  }
  const setStock = (color, size, stock) => setVariants((vs) => vs.map((v) => (v.color === color && v.size === size ? { ...v, stock: Math.max(0, +stock || 0) } : v)))

  const submit = async () => {
    if (!p.name.trim() || !p.moodId) return toast('Add a name and choose a mood.', 'err')
    if (!p.images.length) return toast('Add at least one image.', 'err')
    if (!variants.length) return toast('Add at least one colour and size.', 'err')
    if (p.status === 'scheduled' && !(p.publishAt > Date.now())) return toast('Pick a future time for the drop.', 'err')
    if (new Set(p.colors.map((c) => c.name.trim().toLowerCase())).size !== p.colors.length) return toast('Two colours have the same name.', 'err')
    const data = { ...p, slug: p.slug || slugify(p.name), price: +p.price, compareAtPrice: +p.compareAtPrice || 0, variants }
    try { await save.mutateAsync(data) } catch { return }
    toast('Product saved.')
    onClose()
  }

  return (
    <Modal wide title={initial?.id ? 'Edit product' : 'New product'} onClose={onClose}
      footer={<><button className="btn btn--ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={submit} disabled={save.isPending} id="save-product">{save.isPending ? 'Saving…' : 'Save product'}</button></>}>
      <div className="a-form">
        <div className="a-form__col">
          <Field label="Name"><input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} id="p-name" /></Field>
          <Field label="The sentence on the hoodie"><input className="input" value={p.statement} onChange={(e) => set('statement', e.target.value)} placeholder="maybe tonight." /></Field>
          <div className="two">
            <Field label="Mood (category)"><select className="select" value={p.moodId} onChange={(e) => set('moodId', e.target.value)} id="p-mood"><option value="">Choose…</option>{moods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
            <Field label="Status"><select className="select" value={p.status} onChange={(e) => set('status', e.target.value)} id="p-status"><option value="draft">Draft</option><option value="scheduled">Scheduled drop</option><option value="active">Active</option><option value="archived">Archived</option></select></Field>
          </div>
          <div className="two">
            <Field label="Price (EGP)"><input className="input" type="number" min="0" value={p.price} onChange={(e) => set('price', e.target.value)} id="p-price" /></Field>
            <Field label="Compare-at price" hint="Shown struck through"><input className="input" type="number" min="0" value={p.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} /></Field>
          </div>
          {p.status === 'scheduled' && <Field label="Goes live at" hint="Cairo time. Checked every 15 minutes."><input className="input" type="datetime-local" value={toDateTimeInput(p.publishAt)} onChange={(e) => set('publishAt', e.target.value ? new Date(e.target.value).getTime() : null)} id="p-publish" /></Field>}
          <Field label="Description"><textarea className="textarea" value={p.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <Field label="Details" hint="One per line"><textarea className="textarea" value={p.details.join('\n')} onChange={(e) => set('details', e.target.value.split('\n').filter(Boolean))} /></Field>
          <details className="a-seo">
            <summary className="eyebrow">Search & sharing</summary>
            <Field label="Page title" hint={`${(p.metaTitle || '').length}/60 · blank = “${p.name || 'Name'} — THE MOOD”`}><input className="input" maxLength={70} value={p.metaTitle || ''} onChange={(e) => set('metaTitle', e.target.value)} /></Field>
            <Field label="Description" hint={`${(p.metaDescription || '').length}/160 · shown on Google and when shared`}><textarea className="textarea" maxLength={200} value={p.metaDescription || ''} onChange={(e) => set('metaDescription', e.target.value)} /></Field>
          </details>
          <div className="a-toggles"><Toggle checked={p.featured} onChange={(v) => set('featured', v)} label="Featured on home" /><Toggle checked={p.isNew} onChange={(v) => set('isNew', v)} label="Show “New” badge" /></div>
        </div>

        <div className="a-form__col">
          <Field label="Images" hint="Drag to reorder. First is the main image, second shows on hover."><ImageUploader images={p.images} onChange={(v) => set('images', v)} /></Field>

          <Field label="Colours">
            <div className="colors">
              {p.colors.map((c, i) => (
                <div key={i} className="colors__row">
                  <input type="color" value={c.hex} onChange={(e) => updateColors(p.colors.map((x, k) => (k === i ? { ...x, hex: e.target.value } : x)))} aria-label="Colour" />
                  <input className="input" value={c.name} onChange={(e) => updateColors(p.colors.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
                  {p.colors.length > 1 && <button type="button" className="link" onClick={() => updateColors(p.colors.filter((_, k) => k !== i))}>Remove</button>}
                </div>
              ))}
              <button type="button" className="link" onClick={() => updateColors([...p.colors, { name: 'New colour', hex: '#999999' }])}>+ Add colour</button>
            </div>
          </Field>

          <Field label="Sizes"><div className="chips">{ALL_SIZES.map((s) => <button type="button" key={s} className={`chip ${sizes.includes(s) ? 'is-on' : ''}`} onClick={() => toggleSize(s)}>{s}</button>)}</div></Field>

          <Field label="Stock per variant">
            <table className="a-table a-table--tight">
              <thead><tr><th>Colour</th>{sizes.map((s) => <th key={s}>{s}</th>)}</tr></thead>
              <tbody>{p.colors.map((c) => (
                <tr key={c.name}><td>{c.name}</td>{sizes.map((s) => {
                  const v = variants.find((x) => x.color === c.name && x.size === s)
                  return <td key={s}><input className="input input--stock" type="number" min="0" value={v?.stock ?? 0} onChange={(e) => setStock(c.name, s, e.target.value)} aria-label={`${c.name} ${s} stock`} /></td>
                })}</tr>
              ))}</tbody>
            </table>
          </Field>
        </div>
      </div>
    </Modal>
  )
}

export default function Products() {
  const { data: products = [], isLoading } = useList('products')
  const { data: moods = [] } = useList('moods')
  const save = useSave('products')
  const remove = useRemove('products')
  const [edit, setEdit] = useState(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [sel, setSel] = useState([])

  const list = useMemo(() => products
    .filter((p) => (!status || p.status === status) && p.name.toLowerCase().includes(q.toLowerCase()))
    .sort(byPosition), [products, q, status])
  const [drag, setDrag] = useState(null)
  const canReorder = !q && !status
  const dropOn = async (target) => {
    if (drag == null || drag === target) return setDrag(null)
    const next = [...list]
    const [moved] = next.splice(drag, 1)
    next.splice(target, 0, moved)
    setDrag(null)
    // only rewrite rows whose position actually changed
    const changed = next.map((p, i) => ({ p, i })).filter(({ p, i }) => p.position !== i)
    try { await Promise.all(changed.map(({ p, i }) => save.mutateAsync({ ...p, position: i }))); toast('Order saved. The shop shows them like this.') } catch { /* toast from useSave */ }
  }

  const bulk = async (fn) => { for (const id of sel) await fn(products.find((p) => p.id === id)); setSel([]); toast('Done.') }
  const duplicate = (p) => save.mutateAsync({ ...p, id: undefined, name: `${p.name} (copy)`, slug: `${p.slug}-copy-${Math.random().toString(36).slice(2, 5)}`, status: 'draft' }).then(() => toast('Duplicated as draft.'))

  return (
    <>
      <PageHead title="Products" sub={`${products.length} pieces`}>
        <button className="btn" onClick={() => setEdit({})} id="new-product">New product</button>
      </PageHead>
      <div className="a-toolbar">
        <input className="input input--sm" placeholder="Search products" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="select select--sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter"><option value="">All statuses</option><option value="active">Active</option><option value="scheduled">Scheduled</option><option value="draft">Draft</option><option value="archived">Archived</option></select>
        {sel.length > 0 && (
          <div className="a-bulk">
            <span>{sel.length} selected</span>
            <button className="link" onClick={() => bulk((p) => save.mutateAsync({ ...p, status: 'active' }))}>Activate</button>
            <button className="link" onClick={() => bulk((p) => save.mutateAsync({ ...p, status: 'archived' }))}>Archive</button>
            <select className="select select--sm" value="" onChange={(e) => e.target.value && bulk((p) => save.mutateAsync({ ...p, moodId: e.target.value }))}><option value="">Move to mood…</option>{moods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <button className="link danger" onClick={() => confirm(`Delete ${sel.length} products?`) && bulk((p) => remove.mutateAsync(p.id))}>Delete</button>
          </div>
        )}
      </div>

      {canReorder && list.length > 1 && <p className="muted small">Drag rows to set the order pieces appear in the shop.</p>}
      <div className="a-card a-card--flush">
        <table className="a-table">
          <thead><tr><th style={{ width: 36 }}><input type="checkbox" checked={sel.length === list.length && list.length > 0} onChange={(e) => setSel(e.target.checked ? list.map((p) => p.id) : [])} aria-label="Select all" /></th><th>Product</th><th>Mood</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} draggable={canReorder} onDragStart={() => setDrag(list.indexOf(p))} onDragOver={(e) => canReorder && e.preventDefault()} onDrop={() => dropOn(list.indexOf(p))} className={canReorder ? 'is-draggable' : ''}>
                <td><input type="checkbox" checked={sel.includes(p.id)} onChange={() => setSel((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))} aria-label={`Select ${p.name}`} /></td>
                <td><div className="a-prod"><img src={imgSrc(p.images[0])} alt="" /><div><b>{p.name}</b><small className="muted">{p.statement}</small></div></div></td>
                <td>{moods.find((m) => m.id === p.moodId)?.name || '—'}</td>
                <td>{formatPrice(p.price)}{p.compareAtPrice > p.price && <small className="muted"> <s>{formatPrice(p.compareAtPrice)}</s></small>}</td>
                <td className={totalStock(p) === 0 ? 'danger' : ''}>{totalStock(p)}</td>
                <td><Pill>{p.status}</Pill>{p.status === 'scheduled' && p.publishAt && <small className="muted">{fmtDateTime(p.publishAt)}</small>}</td>
                <td className="a-actions"><button className="link" onClick={() => setEdit(p)}>Edit</button><button className="link" onClick={() => duplicate(p)}>Duplicate</button><button className="link danger" onClick={() => confirm(`Delete “${p.name}”?`) && remove.mutate(p.id, { onSuccess: () => toast('Deleted.') })}>Delete</button></td>
              </tr>
            ))}
            {!isLoading && !list.length && <tr><td colSpan={7} className="muted">No products match.</td></tr>}
          </tbody>
        </table>
      </div>
      <AnimatePresence>{edit && <Editor key={edit.id || 'new'} initial={edit.id ? edit : null} moods={moods} onClose={() => setEdit(null)} />}</AnimatePresence>
    </>
  )
}
