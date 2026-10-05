import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from './api'
import { priceProduct } from './pricing'

/* ------------------------------ cart store ------------------------------- */

export const useCart = create(
  persist(
    (set, get) => ({
      items: [],
      open: false,
      promoCode: '',
      /** Adds to the cart, never past `max` (the variant's stock) or 10. */
      add: ({ productId, color, size, qty = 1, max = 10 }) => {
        const key = `${productId}|${color}|${size}`
        const cap = Math.max(0, Math.min(10, max))
        const items = get().items
        const found = items.find((i) => i.key === key)
        set({
          items: found
            ? items.map((i) => (i.key === key ? { ...i, qty: Math.min(cap, i.qty + qty) } : i))
            : cap > 0 ? [...items, { key, productId, color, size, qty: Math.min(cap, qty) }] : items,
          open: true,
        })
      },
      setQty: (key, qty) =>
        set({
          items: get().items
            .map((i) => (i.key === key ? { ...i, qty: Math.max(0, Math.min(10, qty)) } : i))
            .filter((i) => i.qty > 0),
        }),
      remove: (key) => set({ items: get().items.filter((i) => i.key !== key) }),
      clear: () => set({ items: [], promoCode: '' }),
      setPromo: (promoCode) => set({ promoCode }),
      openDrawer: () => set({ open: true }),
      closeDrawer: () => set({ open: false }),
    }),
    { name: 'mood:cart', partialize: (s) => ({ items: s.items, promoCode: s.promoCode }) },
  ),
)

/* ----------------------------- catalog hooks ----------------------------- */

export function useCatalog() {
  return useQuery({ queryKey: ['catalog'], queryFn: () => api.catalog(), staleTime: 30_000 })
}

/** Products enriched with mood + live (sale-aware) pricing. */
export function useProducts() {
  const { data, isLoading } = useCatalog()
  const products = useMemo(() => {
    if (!data) return []
    return data.products.map((p) => ({
      ...p,
      mood: data.moods.find((m) => m.id === p.moodId),
      pricing: priceProduct(p, data.sales),
    }))
  }, [data])
  return { products, moods: data?.moods || [], settings: data?.settings, sales: data?.sales || [], isLoading }
}

/** Cart lines joined with current catalog data. */
export function useCartLines() {
  const items = useCart((s) => s.items)
  const { products, isLoading } = useProducts()
  const lines = useMemo(
    () =>
      items
        .map((i) => {
          const product = products.find((p) => p.id === i.productId)
          if (!product) return null
          const stock = product.variants.find((v) => v.color === i.color && v.size === i.size)?.stock || 0
          return { ...i, product, unitPrice: product.pricing.price, compareAt: product.pricing.compareAt, stock }
        })
        .filter(Boolean),
    [items, products],
  )
  return { lines, isLoading }
}
