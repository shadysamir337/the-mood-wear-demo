import { useEffect, useRef } from 'react'

/* ------------------------------ scroll lock ------------------------------ */

let locks = 0
const applyLock = () => {
  const on = locks > 0
  document.documentElement.classList.toggle('lenis-stopped', on)
  document.documentElement.style.overflow = on ? 'hidden' : ''
  const lenis = window.__lenis
  if (lenis) (on ? lenis.stop() : lenis.start())
}

/** Locks page scroll while `active`. Counted, so overlapping overlays don't unlock each other. */
export function useScrollLock(active) {
  useEffect(() => {
    if (!active) return
    locks++
    applyLock()
    return () => {
      locks = Math.max(0, locks - 1)
      applyLock()
    }
  }, [active])
}

/* ------------------------------- focus trap ------------------------------ */

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keeps keyboard focus inside the returned ref while `active`, closes on Escape,
 * and gives focus back to whatever had it before.
 */
export function useFocusTrap(active, onClose) {
  const ref = useRef(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])

  useEffect(() => {
    if (!active) return
    const before = document.activeElement
    const node = ref.current
    const items = () => [...(node?.querySelectorAll(FOCUSABLE) || [])].filter((el) => el.offsetParent !== null || el === document.activeElement)
    const t = setTimeout(() => {
      if (node && !node.contains(document.activeElement)) (node.querySelector('[data-autofocus]') || items()[0] || node).focus()
    }, 60)
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current?.() }
      if (e.key !== 'Tab' || !node) return
      const list = items()
      if (!list.length) return
      const first = list[0]
      const last = list[list.length - 1]
      if (!node.contains(document.activeElement)) { e.preventDefault(); first.focus() }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      if (before instanceof HTMLElement) before.focus({ preventScroll: true })
    }
  }, [active])
  return ref
}
