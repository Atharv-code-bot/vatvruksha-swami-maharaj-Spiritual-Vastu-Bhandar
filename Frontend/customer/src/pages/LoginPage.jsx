import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { firebaseConfigStatus } from '../firebase'

const GoogleMark = () => (
  <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 5)"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.95 46.98 31.86 46.98 24.55Z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.15 15.91-5.8l-7.73-6c-2.15 1.45-4.9 2.3-8.18 2.3-6.28 0-11.6-4.24-13.5-9.94l-8 6.18C6.46 43.1 14.6 48 24 48Z"/>
    <path fill="#FBBC05" d="M10.5 28.56a14.4 14.4 0 0 1 0-9.12l-8-6.18a24 24 0 0 0 0 21.48l8-6.18Z"/>
  </svg>
)

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, signInEmail, signUpEmail, signInGoogle, resetPassword, loading } = useAuth()
  const [mode, setMode] = useState('signin')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [pendingAuthUser, setPendingAuthUser] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [resetMode, setResetMode] = useState(false)

  const finishAuth = useCallback(({ user, profile }) => {
    const destination = location.state?.from?.pathname === '/account' ? '/' : location.state?.from?.pathname || '/'
    if (!user?.emailVerified) toast('Please verify your email before checkout.', { icon: '✉️' })
    if (!profile?.mobile || !/^\d{10}$/.test(String(profile.mobile).trim())) {
      navigate('/account', { replace: true, state: { completeProfile: true, from: destination } })
      return
    }
    navigate(destination, { replace: true })
  }, [location.state, navigate])
  useEffect(() => {
    if (!pendingAuthUser || loading || user?.uid !== pendingAuthUser.uid) return

    finishAuth({ user, profile })
    setPendingAuthUser(null)
  }, [pendingAuthUser, user, profile, loading, finishAuth])


  const run = async (action) => {
    setBusy(true)
    try {
      const result = await action()
      if (result?.user && result?.profile) {
        finishAuth(result)
      } else if (result?.user) {
        // Wait for AuthContext's onAuthStateChanged listener to finish profile loading.
        setPendingAuthUser(result.user)
      }
      return result
    } catch (error) {
      toast.error(error?.message || 'Unable to continue. Please try again.')
      return null
    } finally {
      setBusy(false)
    }
  }

  const submit = (event) => {
    event.preventDefault()
    if (resetMode) {
      run(async () => {
        await resetPassword(form.email)
        toast.success('If an account exists for that email, a password-reset email has been sent.')
        setResetMode(false)
      })
      return
    }
    if (mode === 'signup') {
      if (form.password.length < 6) {
        toast.error('Use a password with at least 6 characters.')
        return
      }
      run(() => signUpEmail(form))
    } else {
      run(() => signInEmail(form.email, form.password))
    }
  }

  const disabled = busy || loading || !firebaseConfigStatus.ready

  return (
    <>
      <Helmet>
        <title>{resetMode ? 'Reset password' : mode === 'signup' ? 'Create account' : 'Sign in'} | Spiritual Vastu Bhandar</title>
        <meta name="description" content="Sign in or create your Spiritual Vastu Bhandar customer account." />
      </Helmet>

      <main className="min-h-[calc(100vh-80px)] bg-[#fbf7f0] px-4 py-8 sm:px-6 sm:py-14">
        <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-[#e8dcc8] bg-white shadow-[0_24px_80px_rgba(61,34,25,.10)] md:grid-cols-[0.92fr_1.08fr]">
          <aside className="relative hidden min-h-[620px] flex-col justify-between overflow-hidden bg-[#591c28] p-10 text-[#fff8ec] md:flex">
            <div className="absolute -right-20 top-24 h-64 w-64 rounded-full border border-[#d5ae62]/30" />
            <div className="absolute -right-8 top-36 h-40 w-40 rounded-full border border-[#d5ae62]/40" />
            <div className="relative">
              <Link to="/" className="inline-flex items-center gap-3 font-serif text-xl font-semibold">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d5ae62]/70 text-2xl">ॐ</span>
                Spiritual Vastu Bhandar
              </Link>
            </div>
            <div className="relative max-w-sm">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[.25em] text-[#e4c77f]">A more mindful home</p>
              <h1 className="font-serif text-4xl leading-tight xl:text-5xl">Bring harmony into the spaces you love.</h1>
              <p className="mt-5 text-sm leading-7 text-[#f2dfd5]">Discover thoughtfully chosen spiritual essentials, vastu items and meaningful gifts.</p>
              <div className="mt-8 flex items-center gap-3 text-sm text-[#f2dfd5]"><ShieldCheck size={18} className="text-[#e4c77f}" /> Secure sign-in for your orders</div>
            </div>
            <p className="relative text-xs text-[#e8cfc4]">Your journey, your account, your peace of mind.</p>
          </aside>

          <section className="px-5 py-8 sm:px-10 sm:py-12 lg:px-14">
            <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#7a1f2b] hover:underline md:hidden"><ArrowLeft size={16} /> Back to store</Link>
            <div className="mx-auto max-w-md">
              <div className="mb-8">
                <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#a87820]">{resetMode ? 'Account recovery' : mode === 'signup' ? 'Join our community' : 'Welcome back'}</p>
                <h2 className="mt-2 font-serif text-3xl font-bold text-[#2b1a14] sm:text-4xl">{resetMode ? 'Reset your password' : mode === 'signup' ? 'Create your account' : 'Sign in to continue'}</h2>
                <p className="mt-3 text-sm leading-6 text-[#765e53]">{resetMode ? 'We’ll send a password-reset link to your email address.' : mode === 'signup' ? 'Create an account to keep your details and orders together.' : 'Your next meaningful find is just around the corner.'}</p>
              </div>

              {!firebaseConfigStatus.ready && (
                <div role="alert" className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                  <strong>Firebase setup needed.</strong> The current local environment has missing or demo Firebase values. Copy the real Web App configuration from Firebase Console into your local <code>.env</code>, then restart Vite. Don’t use demo values for production.
                </div>
              )}

              {!resetMode && (
                <>
                  <button type="button" disabled={disabled} onClick={() => run(signInGoogle)} className="flex w-full items-center justify-center gap-3 rounded-xl border border-[#e7ddcf] bg-white px-4 py-3.5 text-sm font-semibold text-[#39251e] transition hover:bg-[#fbf7f0] disabled:cursor-not-allowed disabled:opacity-50">
                    <GoogleMark /> Continue with Google
                  </button>
                  <div className="my-6 flex items-center gap-4 text-xs text-[#a08a7b]"><span className="h-px flex-1 bg-[#eee4d8]" /> OR WITH EMAIL <span className="h-px flex-1 bg-[#eee4d8]" /></div>
                </>
              )}

              <form onSubmit={submit} className="space-y-4">
                {mode === 'signup' && !resetMode && (
                  <label className="block text-sm font-medium text-[#493128]">Full name
                    <span className="relative mt-1.5 block"><UserRound size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9c8779]" /><input autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-[#e7ddcf] bg-[#fffdfa] py-3.5 pl-11 pr-4 outline-none transition focus:border-[#a87820] focus:ring-2 focus:ring-[#c9962b]/15" placeholder="Your full name" required /></span>
                  </label>
                )}
                <label className="block text-sm font-medium text-[#493128]">Email address
                  <span className="relative mt-1.5 block"><Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9c8779]" /><input type="email" autoComplete="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-[#e7ddcf] bg-[#fffdfa] py-3.5 pl-11 pr-4 outline-none transition focus:border-[#a87820] focus:ring-2 focus:ring-[#c9962b]/15" placeholder="you@example.com" required /></span>
                </label>
                {!resetMode && <label className="block text-sm font-medium text-[#493128]">Password
                  <span className="relative mt-1.5 block"><LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9c8779]" /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full rounded-xl border border-[#e7ddcf] bg-[#fffdfa] py-3.5 pl-11 pr-12 outline-none transition focus:border-[#a87820] focus:ring-2 focus:ring-[#c9962b]/15" placeholder={mode === 'signup' ? 'At least 6 characters' : 'Enter your password'} minLength={mode === 'signup' ? 6 : undefined} required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9c8779]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span>
                </label>}
                {mode === 'signin' && !resetMode && <div className="-mt-1 text-right"><button type="button" onClick={() => setResetMode(true)} className="text-xs font-semibold text-[#7a1f2b] hover:underline">Forgot password?</button></div>}
                <button type="submit" disabled={disabled} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7a1f2b] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5c1620] disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? <LoaderCircle size={17} className="animate-spin" /> : resetMode ? <KeyRound size={17} /> : <ArrowRight size={17} />}
                  {busy ? 'Please wait…' : resetMode ? 'Send reset link' : mode === 'signup' ? 'Create account' : 'Sign in'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-[#765e53]">
                {resetMode ? <button onClick={() => setResetMode(false)} className="font-semibold text-[#7a1f2b] hover:underline">Back to sign in</button> : mode === 'signin' ? <>New to Spiritual Vastu Bhandar? <button onClick={() => setMode('signup')} className="font-semibold text-[#7a1f2b] hover:underline">Create an account</button></> : <>Already have an account? <button onClick={() => setMode('signin')} className="font-semibold text-[#7a1f2b] hover:underline">Sign in</button></>}
              </div>
              {mode === 'signup' && !resetMode && <p className="mt-5 rounded-xl bg-[#fbf7f0] p-3 text-xs leading-5 text-[#765e53]">We’ll email you a verification link. Your email must be verified before checkout. We’ll ask for your mobile number to complete your customer profile.</p>}
              <p className="mt-8 text-center text-xs text-[#a08a7b]">By continuing, you agree to use your account responsibly and keep your sign-in details secure.</p>
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
