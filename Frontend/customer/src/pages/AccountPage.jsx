
import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { Package, Heart, Bell, LogOut, LockKeyhole } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const cards = [
  {
    icon: <Package size={18} />,
    title: 'Orders',
    desc: 'Track your spiritual purchases and order history.',
    to: '/orders',
  },
  {
    icon: <Heart size={18} />,
    title: 'Wishlist',
    desc: 'Review your saved deity idols and pooja essentials.',
    to: '/wishlist',
  },
  {
    icon: <Bell size={18} />,
    title: 'Notifications',
    desc: 'Receive festival offers and new arrivals.',
    to: '/contact',
  },
]

export default function AccountPage() {
  const { user, profile, saveProfile, setAccountPassword, isEmailVerified, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [signingOut, setSigningOut] = useState(false)
  const [profileError, setProfileError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', mobile: '' })
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)

  const hasPasswordProvider = Boolean(user?.providerData?.some((provider) => provider.providerId === 'password'))

  useEffect(() => {
    if (user) {
      setForm({
        name: user.displayName || profile?.name || '',
        mobile: profile?.mobile || '',
      })
    }
  }, [user, profile])

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      toast.success('You have been logged out.')
      navigate('/', { replace: true })
    } catch (err) {
      toast.error(err?.message || 'Could not log out. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setProfileError(null)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setProfileError(null)
    setSaving(true)
    try {
      await saveProfile({ name: form.name, mobile: form.mobile })
    } catch (err) {
      setProfileError(err?.message || 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordError('')

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Choose a password with at least 6 characters.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('The new password and confirmation do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      await setAccountPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      toast.success(hasPasswordProvider ? 'Password changed successfully.' : 'Password created successfully. You can now sign in with email and password.')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setPasswordError(err?.message || 'Could not update your password. Please try again.')
    } finally {
      setPasswordSaving(false)
    }
  }

  if (loading) return null

  return (
    <>
      <Helmet>
        <title>My Account — Vatvruksha Spiritual Vastu Bhandar</title>
        <meta
          name="description"
          content="Access your account overview, saved items, orders and spiritual recommendations."
        />
      </Helmet>

      <div className="bg-cream-dark border-b border-cream-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav aria-label="Breadcrumb" className="text-xs text-brown-light">
            <Link to="/" className="hover:text-maroon">Home</Link>
            <span className="mx-2">›</span>
            <span className="text-brown font-medium">My Account</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        {/* Account header */}
        <div className="mb-8 bg-white rounded-2xl border border-cream-dark p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-gold font-semibold">
                Account
              </p>
              <h1 className="font-serif text-4xl text-brown mt-2">
                Welcome back{user ? `, ${user.displayName || user.email || ''}` : ''}
              </h1>
            </div>

            <div className="flex gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  isEmailVerified
                    ? 'bg-green-50 text-green-700 border-green-100'
                    : 'bg-maroon-50 text-maroon border-maroon-100'
                }`}
              >
                {isEmailVerified ? '✓ Email verified' : '✗ Email not verified'}
              </span>

            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-cream rounded-xl p-4">
              <p className="text-xs text-brown-light font-medium">Name</p>
              <p className="font-medium text-brown">
                {user?.displayName || profile?.name || '—'}
              </p>
            </div>

            <div className="bg-cream rounded-xl p-4 min-w-0">
              <p className="text-xs text-brown-light font-medium">Email</p>
              <p className="font-medium text-brown break-all">{user?.email || '—'}</p>
            </div>

            <div className="bg-cream rounded-xl p-4">
              <p className="text-xs text-brown-light font-medium">Mobile</p>
              <p className="font-medium text-brown">
                {profile?.mobile || form.mobile || '—'}
              </p>
            </div>

          </div>
        </div>

        {/* Profile update form */}
        <div className="mb-8 bg-white rounded-2xl border border-cream-dark p-6 md:p-8 shadow-sm">
          <h3 className="font-serif text-xl text-brown mb-4">Update Profile</h3>

          <p className="text-brown-light text-sm mb-4">
            Your name and mobile are saved to your private profile document.
            Mobile number is required before checkout and order communication.
          </p>

          {profileError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
              {profileError}
            </div>
          )}

          <form
            onSubmit={handleSave}
            className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
          >
            <div>
              <label className="block text-sm font-medium text-brown mb-1">
                Full Name
              </label>
              <input
                name="name"
                value={form.name}
                required
                onChange={handleChange}
                className="w-full rounded-xl border border-cream-dark px-3 py-2.5 bg-cream text-brown focus:outline-none focus:border-maroon"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brown mb-1">
                Mobile Number
              </label>
              <input
                name="mobile"
                type="tel"
                value={form.mobile}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    mobile: e.target.value.replace(/\D/g, '').slice(0, 10),
                  }))
                }
                className="w-full rounded-xl border border-cream-dark px-3 py-2.5 bg-cream text-brown focus:outline-none focus:border-maroon"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full py-3 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>

        {/* Create or change password */}
        <div className="mb-8 bg-white rounded-2xl border border-cream-dark p-6 md:p-8 shadow-sm">
          <div className="flex items-start gap-3 mb-2">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gold-50 text-maroon flex items-center justify-center">
              <LockKeyhole size={19} />
            </div>
            <div>
              <h3 className="font-serif text-xl text-brown">
                {hasPasswordProvider ? 'Change Password' : 'Create Password'}
              </h3>
              <p className="text-brown-light text-sm mt-1">
                {hasPasswordProvider
                  ? 'Confirm your current password before choosing a new one.'
                  : 'Your account currently uses a social sign-in. Create a password to also sign in with your email.'}
              </p>
            </div>
          </div>

          {passwordError && (
            <div role="alert" className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 text-sm">
              {passwordError}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {hasPasswordProvider && (
              <div className="md:col-span-1">
                <label htmlFor="current-password" className="block text-sm font-medium text-brown mb-1">
                  Current Password
                </label>
                <input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  required
                  className="w-full min-w-0 rounded-xl border border-cream-dark px-3 py-2.5 bg-cream text-brown focus:outline-none focus:border-maroon"
                />
              </div>
            )}
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-brown mb-1">
                {hasPasswordProvider ? 'New Password' : 'Create Password'}
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                minLength={6}
                required
                className="w-full min-w-0 rounded-xl border border-cream-dark px-3 py-2.5 bg-cream text-brown focus:outline-none focus:border-maroon"
              />
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-brown mb-1">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                minLength={6}
                required
                className="w-full min-w-0 rounded-xl border border-cream-dark px-3 py-2.5 bg-cream text-brown focus:outline-none focus:border-maroon"
              />
            </div>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={passwordSaving}
                className="btn-primary w-full md:w-auto min-h-11 px-6 py-3 disabled:opacity-60"
              >
                {passwordSaving ? 'Saving Password…' : hasPasswordProvider ? 'Change Password' : 'Create Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Quick Access */}
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-gold font-semibold">
            Quick Access
          </p>
          <h2 className="font-serif text-3xl text-brown mt-2">Your Account</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {cards.map((card) => (
            <div
              key={card.title}
              className="bg-white rounded-2xl border border-cream-dark p-5 shadow-sm"
            >
              <div className="w-11 h-11 rounded-xl bg-gold-50 text-maroon flex items-center justify-center mb-4">
                {card.icon}
              </div>
              <h2 className="font-serif text-2xl text-brown mb-2">{card.title}</h2>
              <p className="text-sm text-brown-light leading-relaxed">{card.desc}</p>
              {card.to && (
                <Link
                  to={card.to}
                  className="mt-4 block text-sm font-medium text-maroon hover:underline"
                >
                  Open →
                </Link>
              )}
            </div>
          ))}
        </div>

        {/* Log out */}
        <div className="mt-8 flex justify-end">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-cream-darker px-5 py-3 text-sm font-semibold text-maroon transition-colors hover:bg-cream-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut size={17} />
            {signingOut ? 'Logging out…' : 'Log Out'}
          </button>
        </div>
      </div>
    </>
  )
}
