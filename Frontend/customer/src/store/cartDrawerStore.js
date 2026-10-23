import { create } from 'zustand'

const useCartDrawerStore = create((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))

export default useCartDrawerStore
