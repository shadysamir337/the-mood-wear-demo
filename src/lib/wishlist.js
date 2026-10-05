import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from './api'

/**
 * Wishlist works without an account (saved in this browser) and syncs to
 * wishlists/{uid} once someone signs in.
 */
export const useWishlist = create(
  persist(
    (set, get) => ({
      ids: [],
      uid: null,
      has: (id) => get().ids.includes(id),
      toggle: (id) => {
        const ids = get().ids.includes(id) ? get().ids.filter((x) => x !== id) : [id, ...get().ids].slice(0, 200)
        set({ ids })
        const { uid } = get()
        if (uid) api.saveWishlist(uid, ids).catch(() => {})
      },
      /** On sign-in: merge local and saved lists. On sign-out: keep the local copy. */
      attach: async (uid) => {
        set({ uid })
        if (!uid) return
        try {
          const saved = await api.getWishlist(uid)
          const ids = [...new Set([...get().ids, ...saved])].slice(0, 200)
          set({ ids })
          if (ids.length !== saved.length) await api.saveWishlist(uid, ids)
        } catch { /* offline: keep local */ }
      },
    }),
    { name: 'mood:wishlist', partialize: (s) => ({ ids: s.ids }) },
  ),
)
