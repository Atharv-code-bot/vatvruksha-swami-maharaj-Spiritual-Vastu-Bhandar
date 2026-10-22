
import { initializeApp } from 'firebase/app'
import {
  getAuth,
  connectAuthEmulator,
} from 'firebase/auth'
import {
  getFirestore,
  connectFirestoreEmulator,
} from 'firebase/firestore'
import {
  getStorage,
  connectStorageEmulator,
} from 'firebase/storage'
import {
  getFunctions,
  connectFunctionsEmulator,
} from 'firebase/functions'

const REQUIRED_ENV_VARS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_APP_ID',
]

const missingEnvVars = REQUIRED_ENV_VARS.filter(
  (key) => !import.meta.env[key]?.trim(),
)

if (missingEnvVars.length > 0) {
  throw new Error(
    `[Firebase] Missing required environment variables: ${missingEnvVars.join(', ')}. ` +
      'Check the admin-side .env file before starting the app.',
  )
}

const useEmulator =
  import.meta.env.VITE_FIREBASE_EMULATOR === 'true'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (
  !useEmulator &&
  import.meta.env.MODE === 'production' &&
  !firebaseConfig.projectId
) {
  throw new Error(
    '[Firebase] Production project configuration is missing.',
  )
}

const app = initializeApp(firebaseConfig)

const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)
const functions = getFunctions(app, 'asia-south1')

if (useEmulator) {
  if (import.meta.env.PROD) {
    throw new Error(
      '[Firebase] Emulator mode must not be enabled in a production build.',
    )
  }

  connectAuthEmulator(
    auth,
    'http://localhost:9099',
    { disableWarnings: true },
  )

  connectFirestoreEmulator(db, 'localhost', 8080)
  connectStorageEmulator(storage, 'localhost', 9199)
  connectFunctionsEmulator(functions, 'localhost', 5001)
}

export {
  app,
  auth,
  db,
  storage,
  functions,
  useEmulator,
}
