
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'

import {
  onAuthStateChanged,
  getIdTokenResult,
} from 'firebase/auth'

import {
  auth,
  signInEmail,
  signUpEmail,
  signInGoogle,
  signOutUser,
} from '../auth.js'

const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [claims, setClaims] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!active) return

      setLoading(true)
      setUser(currentUser)
      setClaims(null)
      setError(null)

      if (!currentUser) {
        setLoading(false)
        return
      }

      try {
        // Refresh the ID token so updated custom claims are retrieved.
        const tokenResult = await getIdTokenResult(currentUser, true)

        if (!active) return

        setClaims(tokenResult.claims)
      } catch (err) {
        if (!active) return

        setError(err.message || 'Unable to verify your account.')
        setClaims(null)
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  // A signed-in user is an admin only when both claims are true.
  const isAdmin =
    claims?.admin === true &&
    claims?.email_verified === true

  const handleRefreshClaims = useCallback(async () => {
    const currentUser = auth.currentUser

    if (!currentUser) {
      setUser(null)
      setClaims(null)
      return null
    }

    setError(null)

    try {
      const tokenResult = await getIdTokenResult(currentUser, true)

      setUser(currentUser)
      setClaims(tokenResult.claims)

      return tokenResult.claims
    } catch (err) {
      setClaims(null)
      setError(err.message || 'Unable to refresh account permissions.')
      return null
    }
  }, [])

  const handleSignInEmail = useCallback(async (email, password) => {
    setError(null)

    try {
      return await signInEmail(email, password)
    } catch (err) {
      setError(err.message || 'Sign-in failed.')
      throw err
    }
  }, [])

  // Retained for compatibility with existing consumers.
  // Public registration will be removed from the login interface.
  const handleSignUpEmail = useCallback(async (email, password) => {
    setError(null)

    try {
      return await signUpEmail(email, password)
    } catch (err) {
      setError(err.message || 'Account creation failed.')
      throw err
    }
  }, [])

  const handleSignInGoogle = useCallback(async () => {
    setError(null)

    try {
      return await signInGoogle()
    } catch (err) {
      setError(err.message || 'Google sign-in failed.')
      throw err
    }
  }, [])

  const handleSignOut = useCallback(async () => {
    setError(null)

    try {
      await signOutUser()
      setUser(null)
      setClaims(null)
    } catch (err) {
      setError(err.message || 'Sign-out failed.')
      throw err
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = {
    user,
    claims,
    loading,
    error,
    clearError,
    isAuthenticated: Boolean(user),
    isAdmin,
    handleSignInEmail,
    handleSignUpEmail,
    handleSignInGoogle,
    handleSignOut,
    refreshClaims: handleRefreshClaims,
  }

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)

  if (!context) {
    throw new Error(
      'useAdminAuth must be used within AdminAuthProvider',
    )
  }

  return context
}
