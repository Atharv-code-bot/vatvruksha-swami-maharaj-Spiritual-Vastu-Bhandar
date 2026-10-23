import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react'
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, sendEmailVerification, sendPasswordResetEmail, signOut,
  updateProfile, GoogleAuthProvider, getIdToken, EmailAuthProvider,
  reauthenticateWithCredential, updatePassword, linkWithCredential,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase.js'

const AuthContext = createContext(null)
const googleProvider = new GoogleAuthProvider()
const mobilePattern = /^\d{10}$/

function authMessage(error) {
  const code = error?.code || ''
  const messages = {
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/user-not-found': 'No account exists with this email.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/wrong-password': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'An account already exists with this email. Try signing in.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before completion.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait a while and try again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Firebase configuration is invalid. Check the customer app .env values against the Firebase Web App configuration.',
    'permission-denied': 'Firebase denied access. Check the Firestore rules for the signed-in user.',
  }
  return messages[code] || error?.message || 'Something went wrong. Please try again.'
}

async function getOrCreateProfile(user) {
  const ref = doc(db, 'users', user.uid)
  const snapshot = await getDoc(ref)
  if (snapshot.exists()) return snapshot.data()

  const now = serverTimestamp()
  const profile = {
    name: user.displayName || '',
    email: user.email || '',
    mobile: '',
    createdAt: now,
    updatedAt: now,
  }
  await setDoc(ref, profile)
  return profile
}

async function readProfile(uid) {
  const snapshot = await getDoc(doc(db, 'users', uid))
  return snapshot.exists() ? snapshot.data() : null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  const refreshProfile = useCallback(async (uid = auth.currentUser?.uid) => {
    if (!uid) {
      setProfile(null)
      return null
    }
    setProfileLoading(true)
    try {
      const data = await readProfile(uid)
      setProfile(data)
      return data
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!alive) return
      setUser(nextUser)
      setLoading(true)
      try {
        if (nextUser) {
          await getOrCreateProfile(nextUser)
          const data = await readProfile(nextUser.uid)
          if (alive) setProfile(data)
        } else if (alive) {
          setProfile(null)
        }
      } catch (error) {
        console.error('[auth] Could not load customer profile:', error)
        if (alive) setProfile(null)
      } finally {
        if (alive) setLoading(false)
      }
    })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [])

  const signInEmail = useCallback(async (email, password) => {
    try {
      // Authentication only. onAuthStateChanged owns profile initialization/loading.
      const result = await signInWithEmailAndPassword(auth, email.trim(), password)
      return { user: result.user }
    } catch (error) {
      throw new Error(authMessage(error), { cause: error })
    }
  }, [])

  const signUpEmail = useCallback(async ({ name, email, password }) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password)
      const cleanName = name.trim()
      if (cleanName) await updateProfile(result.user, { displayName: cleanName })
      const now = serverTimestamp()
      const nextProfile = {
        name: cleanName,
        email: result.user.email || email.trim(),
        mobile: '',
        createdAt: now,
        updatedAt: now,
      }
      await setDoc(doc(db, 'users', result.user.uid), nextProfile)
      await sendEmailVerification(result.user)
      setUser(result.user)
      setProfile(nextProfile)
      return { user: result.user, profile: nextProfile }
    } catch (error) {
      throw new Error(authMessage(error), { cause: error })
    }
  }, [])

  const signInGoogle = useCallback(async () => {
    try {
      // Authentication only. onAuthStateChanged owns profile initialization/loading.
      const result = await signInWithPopup(auth, googleProvider)
      return { user: result.user }
    } catch (error) {
      throw new Error(authMessage(error), { cause: error })
    }
  }, [])

  const sendVerificationEmail = useCallback(async () => {
    const current = auth.currentUser
    if (!current) throw new Error('Sign in before requesting email verification.')
    try {
      await sendEmailVerification(current)
    } catch (error) {
      throw new Error(authMessage(error), { cause: error })
    }
  }, [])

  const refreshIdToken = useCallback(async () => {
    const current = auth.currentUser
    if (!current) return null
    try {
      await current.reload()
      const token = await getIdToken(current, true)
      setUser(auth.currentUser)
      return token
    } catch (error) {
      throw new Error(authMessage(error), { cause: error })
    }
  }, [])

  const refreshVerification = useCallback(async () => {
    const current = auth.currentUser
    if (!current) return false
    await current.reload()
    await getIdToken(current, true)
    setUser(auth.currentUser)
    return Boolean(auth.currentUser?.emailVerified)
  }, [])

  const saveProfile = useCallback(async ({ name, mobile }) => {
    const current = auth.currentUser
    if (!current) throw new Error('Please sign in first.')
    const cleanMobile = String(mobile ?? '').replace(/\D/g, '')
    if (!mobilePattern.test(cleanMobile)) throw new Error('Enter a valid 10-digit mobile number.')
    const cleanName = String(name ?? current.displayName ?? '').trim()
    if (!cleanName) throw new Error('Enter your full name.')
    try {
      const ref = doc(db, 'users', current.uid)
      const snapshot = await getDoc(ref)
      await setDoc(ref, {
        name: cleanName,
        email: current.email || '',
        mobile: cleanMobile,
        ...(snapshot.exists() ? {} : { createdAt: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      }, { merge: true })
      const data = await readProfile(current.uid)
      setProfile(data)
      if (cleanName && cleanName !== current.displayName) {
        await updateProfile(current, { displayName: cleanName })
        setUser(auth.currentUser)
      }
      return data
    } catch (error) {
      throw new Error(authMessage(error), { cause: error })
    }
  }, [])

  const resetPassword = useCallback(async (email) => {
    if (!email?.trim()) throw new Error('Enter your email address first.')
    try {
      await sendPasswordResetEmail(auth, email.trim())
    } catch (error) {
      throw new Error(authMessage(error), { cause: error })
    }
  }, [])

  // Set a password for social-login accounts, or securely change an existing password.
  const setAccountPassword = useCallback(async ({ currentPassword, newPassword }) => {
    const current = auth.currentUser
    if (!current) throw new Error('Please sign in first.')
    if (!current.email) throw new Error('A verified email account is required to set a password.')
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new Error('Choose a password with at least 6 characters.')
    }

    const hasPasswordProvider = current.providerData?.some(
      (provider) => provider.providerId === 'password'
    )

    try {
      if (hasPasswordProvider) {
        if (!currentPassword) throw new Error('Enter your current password.')
        const credential = EmailAuthProvider.credential(current.email, currentPassword)
        await reauthenticateWithCredential(current, credential)
        await updatePassword(current, newPassword)
      } else {
        const credential = EmailAuthProvider.credential(current.email, newPassword)
        await linkWithCredential(current, credential)
      }
      await current.reload()
      setUser(auth.currentUser)
      return true
    } catch (error) {
      const code = error?.code || ''
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        throw new Error('Your current password is incorrect.', { cause: error })
      }
      if (code === 'auth/requires-recent-login') {
        throw new Error('For your security, please sign in again and retry this password change.', { cause: error })
      }
      if (code === 'auth/credential-already-in-use' || code === 'auth/provider-already-linked') {
        throw new Error('A password sign-in method is already linked to this account. Try changing your password instead.', { cause: error })
      }
      throw new Error(authMessage(error), { cause: error })
    }
  }, [])

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth)
      setUser(null)
      setProfile(null)
    } catch (error) {
      throw new Error(authMessage(error), { cause: error })
    }
  }, [])

  const value = useMemo(() => ({
    user, profile, loading, profileLoading,
    isAuthenticated: Boolean(user),
    isEmailVerified: Boolean(user?.emailVerified),
    isProfileComplete: Boolean(profile?.mobile && mobilePattern.test(String(profile.mobile).trim())),
    refreshProfile, refreshIdToken, refreshVerification,
    signInEmail, signUpEmail, signInGoogle, sendVerificationEmail,
    saveProfile, resetPassword, setAccountPassword, signOut: signOutUser,
  }), [user, profile, loading, profileLoading, refreshProfile, refreshIdToken,
    refreshVerification, signInEmail, signUpEmail, signInGoogle,
    sendVerificationEmail, saveProfile, resetPassword, setAccountPassword, signOutUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
