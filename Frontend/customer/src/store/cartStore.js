import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const MAX_QUANTITY = 99

function validItem(item) {
  return Boolean(
    item &&
    typeof item.productId === 'string' && item.productId.trim() &&
    typeof item.variantId === 'string' && /^[a-z0-9_]+$/.test(item.variantId) &&
    Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= MAX_QUANTITY
  )
}

function sanitizeItems(items) {
  if (!Array.isArray(items)) return []
  const merged = new Map()
  for (const raw of items) {
    if (!validItem(raw)) continue
    const key = `${raw.productId}::${raw.variantId}`
    const quantity = Math.min(MAX_QUANTITY, (merged.get(key)?.quantity || 0) + raw.quantity)
    merged.set(key, { productId: raw.productId, variantId: raw.variantId, quantity })
  }
  return [...merged.values()]
}

// Cart storage contains identifiers and quantities only. Price and totals are always
// resolved from the current catalogue and recalculated by the trusted backend at checkout.
const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (productId, variantId = 'default', quantity = 1, maxStock = MAX_QUANTITY) => {
        if (typeof productId !== 'string' || !productId.trim() ||
            typeof variantId !== 'string' || !/^[a-z0-9_]+$/.test(variantId) ||
            !Number.isInteger(quantity) || quantity < 1) return false
        const stockLimit = Number.isFinite(maxStock) ? Math.max(0, Math.floor(maxStock)) : MAX_QUANTITY
        if (stockLimit < 1) return false
        const items = sanitizeItems(get().items)
        const existing = items.find(i => i.productId === productId && i.variantId === variantId)
        const nextQuantity = (existing?.quantity || 0) + quantity
        if (nextQuantity > Math.min(MAX_QUANTITY, stockLimit)) return false
        if (existing) {
          set({ items: items.map(i => i.productId === productId && i.variantId === variantId ? { ...i, quantity: nextQuantity } : i) })
        } else {
          set({ items: [...items, { productId, variantId, quantity }] })
        }
        return true
      },

      removeItem: (productId, variantId = 'default') => set({
        items: get().items.filter(i => !(i.productId === productId && i.variantId === variantId)),
      }),

      updateQuantity: (productId, variantId, quantity) => {
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) return false
        // Allow quantity reductions even when the saved quantity has become stale
        // relative to current stock; the UI disables increases above the stock limit.
        const items = sanitizeItems(get().items)
        if (!items.some(i => i.productId === productId && i.variantId === variantId)) return false
        set({ items: items.map(i => i.productId === productId && i.variantId === variantId ? { ...i, quantity } : i) })
        return true
      },

      clearCart: () => set({ items: [] }),
      findItem: (productId, variantId = 'default') => get().items.find(i => i.productId === productId && i.variantId === variantId),
    }),
    {
      name: 'vatvruksha-cart',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => ({ ...persisted, items: sanitizeItems(persisted?.items) }),
      merge: (persisted, current) => ({ ...current, ...persisted, items: sanitizeItems(persisted?.items) }),
      partialize: (state) => ({ items: sanitizeItems(state.items) }),
    }
  )
)

export default useCartStore
