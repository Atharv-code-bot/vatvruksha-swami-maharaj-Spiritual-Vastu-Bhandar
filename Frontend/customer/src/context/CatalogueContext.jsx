// Live catalogue provider following Firestore Schema Reference v1.
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore'
import { db, firebaseConfigStatus } from '../firebase.js'

const CatalogueContext = createContext(null)

function bySortOrder(a, b) {
  return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)
}

export function CatalogueProvider({ children }) {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      if (!firebaseConfigStatus.ready) {
        setError('Firebase is not configured. Check the local .env file.')
        setLoading(false)
        return
      }
      try {
        const [productSnap, categorySnap] = await Promise.all([
          getDocs(query(collection(db, 'products'), where('isActive', '==', true), orderBy('sortOrder', 'asc'))),
          getDocs(query(collection(db, 'categories'), where('isActive', '==', true), orderBy('sortOrder', 'asc'))),
        ])
        if (cancelled) return
        const nextProducts = productSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.isActive === true)
          .map(p => ({
            ...p,
            images: Array.isArray(p.images) ? p.images.filter(x => typeof x === 'string') : [],
            variants: p.variants && typeof p.variants === 'object' ? p.variants : {},
          }))
        const nextCategories = categorySnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.isActive === true)
        setProducts(nextProducts)
        setCategories(nextCategories)
      } catch (e) {
        if (!cancelled) {
          console.error('[Catalogue] Failed to load active catalogue:', e)
          setError(e?.code === 'permission-denied'
            ? 'The catalogue could not be read. Check Firestore customer read rules.'
            : e?.code === 'failed-precondition'
              ? 'A required Firestore index is missing. Check the console error for the index link.'
              : 'Could not load the catalogue. Check your connection and Firebase configuration.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const value = useMemo(() => {
    const getProductById = id => products.find(p => p.id === id)
    const getProductBySlug = slug => products.find(p => p.slug === slug)
    // Schema v1 does not require a category slug; category document IDs are canonical.
    const getCategoryBySlug = key => categories.find(c => c.id === key || c.slug === key)
    const getProductsByCategory = categoryId => products.filter(p => p.categoryId === categoryId)
    return { products, categories, loading, error, getProductById, getProductBySlug, getCategoryBySlug, getProductsByCategory }
  }, [products, categories, loading, error])

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>
}

export const useCatalogue = () => {
  const ctx = useContext(CatalogueContext)
  if (!ctx) throw new Error('useCatalogue must be used within CatalogueProvider')
  return ctx
}
