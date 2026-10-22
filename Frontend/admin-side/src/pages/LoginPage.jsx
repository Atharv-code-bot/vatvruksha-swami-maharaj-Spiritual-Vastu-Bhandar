import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Mail, Lock, ArrowRight, AlertCircle } from 'lucide-react'
import { useAdminAuth } from '../context/AuthContext'

const initialSignIn = { email: '', password: '' }

function friendlyAuthError(error) {
  const code = error?.code || ''
  const message = typeof error === 'string' ? error : error?.message || ''
  const combined = `${code} ${message}`.toLowerCase()

  if (
    combined.includes('auth/invalid-credential') ||
    combined.includes('auth/wrong-password') ||
    combined.includes('auth/user-not-found') ||
    combined.includes('auth/invalid-login-credentials')
  ) {
    return 'The email address or password is incorrect. Please check your details and try again.'
  }
  if (combined.includes('auth/too-many-requests')) {
    return 'Too many unsuccessful attempts. Please wait a little while before trying again.'
  }
  if (combined.includes('auth/user-disabled')) {
    return 'This account is currently disabled. Please contact the administrator.'
  }
  if (combined.includes('auth/invalid-email')) {
    return 'Please enter a valid email address.'
  }
  if (combined.includes('auth/network-request-failed')) {
    return 'We could not connect to the sign-in service. Check your internet connection and try again.'
  }
  if (
    combined.includes('auth/popup-closed-by-user') ||
    combined.includes('auth/cancelled-popup-request')
  ) {
    return 'Google sign-in was cancelled. You can try again whenever you are ready.'
  }
  if (combined.includes('auth/popup-blocked')) {
    return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
  }
  if (combined.includes('auth/account-exists-with-different-credential')) {
    return 'This email is already associated with another sign-in method. Sign in using the method you originally used.'
  }
  if (combined.includes('auth/operation-not-allowed')) {
    return 'This sign-in method is not enabled. Please contact the administrator.'
  }
  if (combined.includes('auth/email-not-verified') || combined.includes('email_verified')) {
    return 'Please verify your email address before accessing the admin dashboard.'
  }
  if (combined.includes('admin') && (combined.includes('claim') || combined.includes('access'))) {
    return 'This account does not have admin access. Please use an authorized admin account.'
  }
  if (combined.includes('firebase: error (')) {
    return 'We could not sign you in. Check your details and try again.'
  }
  return message && !message.toLowerCase().includes('auth/')
    ? message
    : 'We could not sign you in. Please try again.'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    handleSignInEmail,
    handleSignInGoogle,
    refreshClaims,
    loading,
    error,
    clearError,
  } = useAdminAuth()

  const [signIn, setSignIn] = useState(initialSignIn)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState('')

  const finishSignIn = async () => {
    const claims = await refreshClaims()

    if (claims?.admin === true && claims?.email_verified === true) {
      // Always start authenticated admins on the Overview page after sign-in,
      // regardless of which section they visited before logging out.
      navigate('/admin', { replace: true })
      return
    }

    await Promise.resolve()
    navigate('/admin/unauthorized', { replace: true })
  }

  const handleSignIn = async (event) => {
    event.preventDefault()
    clearError()
    setLocalError('')
    setSubmitting(true)

    try {
      await handleSignInEmail(signIn.email.trim(), signIn.password)
      await finishSignIn()
    } catch (authError) {
      setLocalError(friendlyAuthError(authError))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    clearError()
    setLocalError('')
    setSubmitting(true)

    try {
      await handleSignInGoogle()
      await finishSignIn()
    } catch (authError) {
      setLocalError(friendlyAuthError(authError))
    } finally {
      setSubmitting(false)
    }
  }

  const changeSignIn = (event) => {
    setSignIn((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
    if (localError) setLocalError('')
    if (error) clearError()
  }

  const isBusy = loading || submitting
  const visibleError = localError || (error ? friendlyAuthError(error) : '')

  return (
    <>
      <Helmet>
        <title>Admin Sign In — Vatvruksha</title>
      </Helmet>

      <div className="mx-auto w-full max-w-md px-3 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-16">
        <div className="rounded-2xl border border-cream-dark bg-white p-5 shadow-sm sm:p-7 md:p-10">
          <div className="mb-6 text-center sm:mb-8">
            <Link to="/" className="inline-block mb-4">
              <span className="font-serif text-gold text-2xl font-bold">
                🪔 Vatvruksha
              </span>
            </Link>

            <h1 className="font-serif text-2xl font-bold text-brown sm:text-3xl md:text-4xl">
              Admin Sign In
            </h1>

            <p className="text-brown-light text-sm mt-2">
              Sign in with an authorized admin account. Your email must be
              verified and your account must have admin access.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={isBusy}
            className="mb-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cream-dark bg-white px-3 py-3 text-sm font-medium text-brown transition-colors hover:bg-cream disabled:opacity-60 sm:mb-6 sm:px-4 sm:text-base"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s0-1.43.22-2.09H12v4.18H7.05c-.52 1.5-1.99 2.68-3.8 2.68C3.3 18.5 1 16.11 1 13.5s2.3-5 4.7-5 .98.18 1.4.43l1.44 1.12z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.57 4.16 1.48l2.15-2.15C16.11 2.3 10.99 1 6.97 1 3.3 1 .79 3.39.22 6.98l2.62 2.02c.63-2.09 2.43-3.62 4.71-3.62z" />
            </svg>
            Continue with Google
          </button>

          <div className="border-t border-cream-dark mt-6 pt-6">
            <h3 className="text-sm font-semibold text-brown mb-4">
              Or sign in with email
            </h3>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-brown mb-1">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-2.5 text-brown-light" />
                  <input
                    id="admin-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    value={signIn.email}
                    onChange={changeSignIn}
                    placeholder="admin@example.com"
                    className="w-full min-w-0 rounded-xl border border-cream-dark bg-cream py-3 pl-10 pr-3 text-base text-brown focus:outline-none focus:border-maroon sm:pr-4"
                    required
                    disabled={isBusy}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-brown mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-2.5 text-brown-light" />
                  <input
                    id="admin-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={signIn.password}
                    onChange={changeSignIn}
                    placeholder="Enter your password"
                    className="w-full min-w-0 rounded-xl border border-cream-dark bg-cream py-3 pl-10 pr-3 text-base text-brown focus:outline-none focus:border-maroon sm:pr-4"
                    required
                    disabled={isBusy}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isBusy}
                className="btn-primary inline-flex min-h-11 w-full items-center justify-center gap-2 py-3 disabled:opacity-60"
              >
                <ArrowRight size={16} />
                {isBusy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <p className="mt-5 text-xs text-brown-light text-center">
              Admin accounts are provisioned separately. Public admin
              registration is not available here.
            </p>
          </div>

          {visibleError && (
            <div
              role="alert"
              aria-live="polite"
              className="mt-5 flex min-w-0 items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 sm:mt-6"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{visibleError}</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
