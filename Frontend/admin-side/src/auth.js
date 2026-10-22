
import { auth } from './firebase.js'

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  signOut,
  updateProfile,
  getIdToken,
  GoogleAuthProvider,
} from 'firebase/auth'

// Shared Google provider for Google sign-in.
const provider = new GoogleAuthProvider()

// Export Firebase Auth and the Firebase SDK helpers used elsewhere
// in the admin application.
export {
  auth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  signOut,
  updateProfile,
  getIdToken,
  GoogleAuthProvider,
  provider,
}

// Sign in an existing user using email and password.
export function signInEmail(email, password) {
  return signInWithEmailAndPassword(auth, email.trim(), password)
}

// Account creation helper retained for compatibility with the existing
// AuthContext. Public admin registration will not be exposed in the UI.
export function signUpEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email.trim(), password)
}

// Sign in using the Google account popup.
export function signInGoogle() {
  return signInWithPopup(auth, provider)
}

// Send a verification email to the supplied Firebase user.
export function sendVerification(user) {
  return sendEmailVerification(user)
}

// Sign out the currently authenticated user.
export function signOutUser() {
  return signOut(auth)
}

// Update the authenticated user's Firebase display name.
export function updateUserProfile(user, { displayName }) {
  return updateProfile(user, { displayName: displayName?.trim() ?? '' })
}

// Force-refresh the user's Firebase ID token.
export function refreshIdToken(user) {
  return getIdToken(user, true)
}
