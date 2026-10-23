import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useWishlistStore = create(
  persist(
    (set, get) => ({
      items: [], // product objects

      addItem: (product) => {
        const { items } = get()
        if (!items.find((p) => p.id === product.id)) {
          set({ items: [...items, product] })
        }
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((p) => p.id !== productId) })
      },

      toggleItem: (product) => {
        const { items } = get()
        const exists = items.find((p) => p.id === product.id)
        if (exists) {
          set({ items: items.filter((p) => p.id !== product.id) })
          return false
        } else {
          set({ items: [...items, product] })
          return true
        }
      },

      isWishlisted: (productId) => {
        return !!get().items.find((p) => p.id === productId)
      },

      clearWishlist: () => set({ items: [] }),
    }),
    {
      name: 'vatvruksha-wishlist',
    }
  )
)

export default useWishlistStore
