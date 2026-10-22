// Admin query functions — cursor-based pagination per guide.
// Never downloads all orders/users.
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore'
import { db } from '../firebase.js'

// Orders list with optional status filter and cursor pagination.
// Uses orders status + createdAt composite index.
export const fetchOrders = async ({ status, pageSize = 15, startAfterDoc }) => {
  let q = query(
    collection(db, 'orders'),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1) // +1 to detect more pages
  )
  if (status) {
    q = query(
      collection(db, 'orders'),
      where('status', '==', status),
      orderBy('createdAt', 'desc'),
      limit(pageSize + 1)
    )
  }
  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc))
  }

  const snap = await getDocs(q)
  const docs = snap.docs
  const hasMore = docs.length > pageSize
  const pageDocs = hasMore ? docs.slice(0, -1) : docs
  const lastDoc = pageDocs.length ? pageDocs[pageDocs.length - 1] : null

  return {
    items: pageDocs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc,
    hasMore,
  }
}

// Exact order-ID search by orderNumber (equality — automatic single-field index)
export const searchOrderById = async (orderNumber) => {
  const q = query(
    collection(db, 'orders'),
    where('orderNumber', '==', orderNumber)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const fetchOrderById = async (orderId) => {
  const snap = await getDoc(doc(db, 'orders', orderId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

// Products list — admin may see active and inactive records
export const fetchProducts = async ({ pageSize = 15, startAfterDoc }) => {
  let q = query(
    collection(db, 'products'),
    orderBy('sortOrder'),
    limit(pageSize + 1)
  )
  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc))
  }
  const snap = await getDocs(q)
  const docs = snap.docs
  const hasMore = docs.length > pageSize
  const pageDocs = hasMore ? docs.slice(0, -1) : docs
  const lastDoc = pageDocs.length ? pageDocs[pageDocs.length - 1] : null
  return {
    items: pageDocs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc,
    hasMore,
  }
}

// Categories list
export const fetchCategories = async ({ pageSize = 15, startAfterDoc }) => {
  let q = query(
    collection(db, 'categories'),
    orderBy('sortOrder'),
    limit(pageSize + 1)
  )
  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc))
  }
  const snap = await getDocs(q)
  const docs = snap.docs
  const hasMore = docs.length > pageSize
  const pageDocs = hasMore ? docs.slice(0, -1) : docs
  const lastDoc = pageDocs.length ? pageDocs[pageDocs.length - 1] : null
  return {
    items: pageDocs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc,
    hasMore,
  }
}

// Customers list from users/{uid} — read-only, paginated
export const fetchUsers = async ({ pageSize = 15, startAfterDoc }) => {
  let q = query(
    collection(db, 'users'),
    orderBy('createdAt', 'desc'),
    limit(pageSize + 1)
  )
  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc))
  }
  const snap = await getDocs(q)
  const docs = snap.docs
  const hasMore = docs.length > pageSize
  const pageDocs = hasMore ? docs.slice(0, -1) : docs
  const lastDoc = pageDocs.length ? pageDocs[pageDocs.length - 1] : null
  return {
    items: pageDocs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc,
    hasMore,
  }
}
