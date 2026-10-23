// Customer address book helpers. Paths are always scoped to the current Auth UID.
// Schema: users/{uid}/addresses/{addressId}
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { auth, db } from '../firebase.js'

function ownUid(uid) {
  const currentUid = auth.currentUser?.uid
  if (!currentUid) throw new Error('Please sign in first.')
  if (uid && uid !== currentUid) throw new Error('You can only manage your own addresses.')
  return currentUid
}

const addressCollection = (uid) => collection(db, 'users', ownUid(uid), 'addresses')
const addressRef = (uid, addressId) => doc(db, 'users', ownUid(uid), 'addresses', addressId)

export const fetchAddresses = async (uid) => {
  const snap = await getDocs(addressCollection(uid))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)))
}

export const fetchAddressById = async (uid, addressId) => {
  const snap = await getDoc(addressRef(uid, addressId))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export const saveAddress = async (uid, addressId, input) => {
  const ownerUid = ownUid(uid)
  const addressesRef = collection(db, 'users', ownerUid, 'addresses')
  const targetRef = addressId ? doc(addressesRef, addressId) : doc(addressesRef)
  const existingSnap = await getDoc(targetRef)
  const allSnap = await getDocs(addressesRef)

  const clean = {
    fullName: String(input.fullName ?? '').trim(),
    mobile: String(input.mobile ?? '').trim(),
    addressLine1: String(input.addressLine1 ?? '').trim(),
    city: String(input.city ?? '').trim(),
    state: String(input.state ?? '').trim(),
    pincode: String(input.pincode ?? '').trim(),
    isDefault: Boolean(input.isDefault),
  }
  // Keep optional string fields explicit so editing them to blank clears old values.
  clean.addressLine2 = String(input.addressLine2 ?? '').trim()
  clean.landmark = String(input.landmark ?? '').trim()

  // Make the first saved address the default. A batch clears other defaults and
  // writes the selected address atomically; Firestore rules must allow own-address writes.
  const otherDefault = allSnap.docs.some((d) => d.id !== targetRef.id && d.data().isDefault === true)
  clean.isDefault = clean.isDefault || (!existingSnap.exists() && !otherDefault)

  const batch = writeBatch(db)
  if (clean.isDefault) {
    allSnap.docs.forEach((d) => {
      if (d.id !== targetRef.id && d.data().isDefault === true) {
        batch.update(d.ref, { isDefault: false, updatedAt: serverTimestamp() })
      }
    })
  }
  batch.set(targetRef, {
    ...clean,
    ...(existingSnap.exists() ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp(),
  }, { merge: true })
  await batch.commit()
  return targetRef.id
}

export const deleteAddress = async (uid, addressId) => {
  await deleteDoc(addressRef(uid, addressId))
}
