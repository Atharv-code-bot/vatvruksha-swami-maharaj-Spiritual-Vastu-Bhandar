// Customer Firebase clients. Keep the app configuration in the local Vite .env.
// Never put Paytm credentials or other server secrets in frontend environment variables.
import { initializeApp, getApps } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions'

const env = import.meta.env
const required = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID',
]
const missing = required.filter((key) => !env[key]?.trim())
const isPlaceholder = ['demo-project', 'demo-api-key'].includes(env.VITE_FIREBASE_PROJECT_ID) ||
  ['demo-project', 'demo-api-key'].includes(env.VITE_FIREBASE_API_KEY)

export const firebaseConfigStatus = {
  ready: missing.length === 0 && !isPlaceholder,
  missing,
  isPlaceholder,
}
if (!firebaseConfigStatus.ready) {
  console.error('[Firebase] Configuration is missing or still contains demo placeholders. Check .env against Firebase Console > Project settings > Your apps.')
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)
const functions = getFunctions(app, 'asia-south1')

const useEmulator = env.VITE_FIREBASE_EMULATOR === 'true'
if (useEmulator) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, 'localhost', 8080)
  connectStorageEmulator(storage, 'localhost', 9199)
  connectFunctionsEmulator(functions, 'localhost', 5001)
}

export { app, auth, db, storage, functions, useEmulator }
