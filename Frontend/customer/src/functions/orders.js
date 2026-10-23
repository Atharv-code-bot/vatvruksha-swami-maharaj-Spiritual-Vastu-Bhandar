// Orders query helpers — customer app
// Query: orders where userId == currentUser.uid, ordered by createdAt desc
// (Firestore rules require this owner filter.)
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  limit,
} from 'firebase/firestore'
import { auth, db } from '../firebase.js'

export const fetchOrdersByUser = async (uid) => {
  const q = query(
    collection(db, 'orders'),
    where('userId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(30)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export const fetchOrderById = async (orderId) => {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Please sign in to view this order.')
  const snap = await getDoc(doc(db, 'orders', orderId))
  if (!snap.exists()) return null
  const order = snap.data()
  if (order.userId !== uid) return null
  return { id: snap.id, ...order }
}
