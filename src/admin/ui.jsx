import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api'
import { Icon } from '../components/Icons'
import { useFocusTrap, useScrollLock } from '../lib/hooks'
import { imgSrc } from '../lib/images'

/* ------------------------------ data hooks ------------------------------ */

export const useList = (name, opts = {}) => useQuery({ queryKey: ['admin', name], queryFn: () => api.list(name), ...opts })

const invalidate = (qc, name) => {
  qc.invalidateQueries({ queryKey: ['admin', name] })
  qc.invalidateQueries({ queryKey: ['catalog'] })
}
const showError = (e) => toast(e?.message || 'Something went wrong.', 'err')
export function useSave(name) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (obj) => api.save(name, obj), onSuccess: () => invalidate(qc, name), onError: showError })
}
export function useRemove(name) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id) => api.remove(name, id), onSuccess: () => invalidate(qc, name), onError: showError })
}

/* -------------------------------- toasts -------------------------------- */

let pushToast = () => {}
export const toast = (msg, type = 'ok') => pushToast({ msg, type, id: Math.random() })
export function Toaster() {
  const [items, setItems] = useState([])
  useEffect(() => {
    pushToast = (t) => {
      setItems((x) => [...x, t])
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 3200)
    }
  }, [])
  return (
    <div className="toasts">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} className={`toast toast--${t.type}`} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}>{t.msg}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

/* -------------------------------- layout -------------------------------- */

export function PageHead({ title, sub, children }) {
  return (
    <div className="a-head">
      <div><h1 className="a-title serif">{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
      <div className="a-head__actions">{children}</div>
    </div>
  )
}

export function Modal({ title, onClose, children, footer, wide }) {
  const trap = useFocusTrap(true, onClose)
  useScrollLock(true)
  return (
    <motion.div className="a-modal-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="a-modal-bg" onClick={onClose} />
      <motion.div ref={trap} className={`a-modal ${wide ? 'a-modal--wide' : ''}`} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="a-modal__head"><h2 className="serif">{title}</h2><button onClick={onClose} aria-label="Close"><Icon.Close /></button></div>
        <div className="a-modal__body">{children}</div>
        {footer && <div className="a-modal__foot">{footer}</div>}
      </motion.div>
    </motion.div>
  )
}

/* -------------------------------- inputs -------------------------------- */

export function Field({ label, hint, children, className = '' }) {
  return (
    <div className={`field ${className}`}>
      <label>{label}</label>
      {children}
      {hint && <small className="muted">{hint}</small>}
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <i />
      {label && <span>{label}</span>}
    </label>
  )
}


export function Pill({ children, tone }) {
  const t = tone || String(children).toLowerCase()
  return <span className={`pill pill--${t}`}>{children}</span>
}

/** Choose "everything", specific moods, or specific products. */
export function ScopeEditor({ value, onChange, moods, products }) {
  const scope = value || { type: 'all' }
  const toggle = (key, id) => {
    const cur = scope[key] || []
    onChange({ ...scope, [key]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }
  return (
    <div className="scope">
      <select className="select" value={scope.type} onChange={(e) => onChange({ type: e.target.value })}>
        <option value="all">Whole store</option>
        <option value="moods">Specific moods</option>
        <option value="products">Specific products</option>
      </select>
      {scope.type === 'moods' && (
        <div className="scope__list">{moods.map((m) => (
          <label key={m.id} className="check"><input type="checkbox" checked={(scope.moodIds || []).includes(m.id)} onChange={() => toggle('moodIds', m.id)} /> {m.name}</label>
        ))}</div>
      )}
      {scope.type === 'products' && (
        <div className="scope__list">{products.map((p) => (
          <label key={p.id} className="check"><input type="checkbox" checked={(scope.productIds || []).includes(p.id)} onChange={() => toggle('productIds', p.id)} /> {p.name}</label>
        ))}</div>
      )}
    </div>
  )
}

/** Multi-image uploader with drag-to-reorder. First image = main, second = hover. */
export function ImageUploader({ images = [], onChange }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(null)

  const upload = async (files) => {
    setBusy(true)
    try {
      const urls = []
      for (const f of files) urls.push(await api.uploadImage(f))
      onChange([...images, ...urls])
    } catch (e) {
      toast(e?.message || "Couldn't upload that image.", 'err')
    }
    setBusy(false)
  }
  const drop = (to) => {
    if (drag === null || drag === to) return
    const next = [...images]
    const [m] = next.splice(drag, 1)
    next.splice(to, 0, m)
    onChange(next)
    setDrag(null)
  }
  return (
    <div className="uploader">
      {images.map((img, i) => (
        <div key={imgSrc(img).slice(-40) + i} className="uploader__item" draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(i)}>
          <img src={imgSrc(img)} alt="" />
          {i < 2 && <span className="uploader__tag">{i === 0 ? 'Main' : 'Hover'}</span>}
          <button type="button" onClick={() => onChange(images.filter((_, k) => k !== i))} aria-label="Remove image"><Icon.Close width={14} /></button>
        </div>
      ))}
      <button type="button" className="uploader__add" onClick={() => input.current.click()} disabled={busy}>
        <Icon.Plus />{busy ? 'Uploading…' : 'Add images'}
      </button>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { upload([...e.target.files]); e.target.value = '' }} />
    </div>
  )
}
