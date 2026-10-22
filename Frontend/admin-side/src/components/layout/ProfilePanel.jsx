import { useEffect, useMemo, useState } from 'react'
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  updatePassword,
  updateProfile,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import {
  X, UserRound, Mail, Phone, ShieldCheck, Pencil, KeyRound, LogOut,
  Eye, EyeOff, LoaderCircle, CheckCircle2, AlertCircle,
} from 'lucide-react'
import { auth, db } from '../../firebase.js'

const inputClass = 'w-full rounded-xl border border-cream-darker bg-white px-3 py-2.5 text-sm text-brown outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20'
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-brown-light'

function friendlyError(error) {
  const code = error?.code || ''
  if (code.includes('requires-recent-login')) return 'For your security, please sign out and sign in again, then retry this change.'
  if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'The current password was not accepted. Please check it and try again.'
  if (code.includes('email-already-in-use')) return 'That email address is already linked to another account.'
  if (code.includes('weak-password')) return 'Choose a stronger password with at least 6 characters.'
  if (code.includes('provider-already-linked')) return 'Email and password sign-in is already enabled for this account.'
  if (code.includes('popup-closed-by-user')) return 'The Google sign-in window was closed before verification finished.'
  if (code.includes('network-request-failed')) return 'Network error. Check your connection and try again.'
  return error?.message || 'Something went wrong. Please try again.'
}

export default function ProfilePanel({ open, onClose, onSignOut }) {
  const user = auth.currentUser
  const [profile, setProfile] = useState({ name: '', mobile: '' })
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [section, setSection] = useState('profile')
  const [notice, setNotice] = useState(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)

  const providers = useMemo(() => user?.providerData?.map((item) => item.providerId) || [], [user])
  const hasPassword = providers.includes('password')
  const hasGoogle = providers.includes('google.com')

  useEffect(() => {
    if (!open || !user) return
    let active = true
    setLoading(true)
    setNotice(null)
    getDoc(doc(db, 'users', user.uid))
      .then((snapshot) => {
        if (!active) return
        const data = snapshot.exists() ? snapshot.data() : {}
        const next = {
          name: data.name || user.displayName || '',
          mobile: data.mobile || '',
        }
        setProfile(next)
        setName(next.name)
        setMobile(next.mobile)
      })
      .catch((error) => {
        if (active) setNotice({ type: 'error', text: friendlyError(error) })
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, user])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const saveProfile = async (event) => {
    event.preventDefault()
    if (!user) return
    const cleanName = name.trim()
    const cleanMobile = mobile.trim()
    if (!cleanName) return setNotice({ type: 'error', text: 'Please enter your name.' })
    if (!/^\+?[0-9\s()-]{7,20}$/.test(cleanMobile)) return setNotice({ type: 'error', text: 'Enter a valid mobile number (7–20 digits, with optional +, spaces or dashes).' })
    setSaving(true); setNotice(null)
    try {
      const ref = doc(db, 'users', user.uid)
      const snapshot = await getDoc(ref)
      const fields = { name: cleanName, mobile: cleanMobile, updatedAt: serverTimestamp() }
      if (snapshot.exists()) {
        await updateDoc(ref, fields)
      } else {
        await setDoc(ref, {
          ...fields,
          email: user.email || '',
          createdAt: serverTimestamp(),
        })
      }
      if (user.displayName !== cleanName) await updateProfile(user, { displayName: cleanName })
      setProfile({ name: cleanName, mobile: cleanMobile })
      setEditing(false)
      setNotice({ type: 'success', text: 'Your profile has been updated.' })
    } catch (error) {
      setNotice({ type: 'error', text: friendlyError(error) })
    } finally { setSaving(false) }
  }

  const savePassword = async (event) => {
    event.preventDefault()
    if (!user || !user.email) return setNotice({ type: 'error', text: 'This account does not have an email address available for password sign-in.' })
    if (newPassword.length < 6) return setNotice({ type: 'error', text: 'Your new password must contain at least 6 characters.' })
    if (newPassword !== confirmPassword) return setNotice({ type: 'error', text: 'The new passwords do not match.' })
    setSaving(true); setNotice(null)
    try {
      if (hasPassword) {
        if (!currentPassword) throw new Error('Enter your current password to continue.')
        const credential = EmailAuthProvider.credential(user.email, currentPassword)
        await reauthenticateWithCredential(user, credential)
        await updatePassword(user, newPassword)
        setNotice({ type: 'success', text: 'Your password has been changed.' })
      } else if (hasGoogle) {
        await reauthenticateWithPopup(user, new GoogleAuthProvider())
        const credential = EmailAuthProvider.credential(user.email, newPassword)
        await linkWithCredential(user, credential)
        setNotice({ type: 'success', text: 'Email and password sign-in has been added to your account.' })
      } else {
        setNotice({ type: 'error', text: 'This account does not support password management through the available sign-in methods.' })
      }
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    } catch (error) {
      setNotice({ type: 'error', text: friendlyError(error) })
    } finally { setSaving(false) }
  }

  const avatarText = (profile.name || user?.email || 'A').trim().charAt(0).toUpperCase()

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-brown/40 backdrop-blur-[2px] animate-[profileFade_.18s_ease-out]" />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-cream-darker bg-cream shadow-2xl animate-[profileSlide_.24s_ease-out]" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <div className="bg-maroon px-6 pb-6 pt-5 text-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[.2em] text-gold-light">Account settings</span>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-white/80 transition hover:bg-white/10 hover:text-white" aria-label="Close profile panel"><X size={20} /></button>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-gold-light bg-cream text-xl font-bold text-maroon">{avatarText}</div>
            <div className="min-w-0"><h2 id="profile-title" className="font-serif text-2xl">{profile.name || user?.displayName || 'Admin profile'}</h2><p className="mt-1 truncate text-sm text-white/75">{user?.email || 'No email available'}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-cream-darker bg-white p-3">
          <button type="button" onClick={() => { setSection('profile'); setNotice(null) }} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${section === 'profile' ? 'bg-maroon text-white' : 'text-brown-light hover:bg-cream'}`}><UserRound size={16} /> Profile</button>
          <button type="button" onClick={() => { setSection('security'); setNotice(null) }} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${section === 'security' ? 'bg-maroon text-white' : 'text-brown-light hover:bg-cream'}`}><ShieldCheck size={16} /> Security</button>
        </div>

        <div className="flex-1 px-6 py-5">
          {notice && <div className={`mb-4 flex items-start gap-2 rounded-xl border px-3 py-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-green-200 bg-green-50 text-green-800'}`} role="status">{notice.type === 'error' ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={18} className="mt-0.5 shrink-0" />}<span>{notice.text}</span></div>}
          {loading ? <div className="flex items-center justify-center gap-2 py-16 text-sm text-brown-light"><LoaderCircle size={18} className="animate-spin" /> Loading your profile…</div> : section === 'profile' ? (
            <>
              <div className="mb-5 flex items-center justify-between"><div><h3 className="font-serif text-xl text-brown">Personal details</h3><p className="mt-1 text-xs text-brown-light">Keep your account information up to date.</p></div><button type="button" onClick={() => { setEditing((value) => !value); setName(profile.name); setMobile(profile.mobile); setNotice(null) }} className="inline-flex items-center gap-1.5 rounded-lg border border-cream-darker bg-white px-3 py-2 text-xs font-semibold text-maroon transition hover:border-gold hover:bg-gold-50"><Pencil size={14} /> {editing ? 'Cancel' : 'Edit profile'}</button></div>
              {editing ? <form onSubmit={saveProfile} className="space-y-4">
                <div><label className={labelClass} htmlFor="profile-name">Full name</label><input id="profile-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" required /></div>
                <div><label className={labelClass} htmlFor="profile-email">Email address</label><div className="relative"><Mail size={16} className="absolute left-3 top-3 text-brown-light" /><input id="profile-email" className={`${inputClass} pl-9 opacity-70`} value={user?.email || ''} readOnly aria-describedby="email-help" /></div><p id="email-help" className="mt-1 text-xs text-brown-light">Email is managed by your sign-in account.</p></div>
                <div><label className={labelClass} htmlFor="profile-mobile">Mobile number</label><div className="relative"><Phone size={16} className="absolute left-3 top-3 text-brown-light" /><input id="profile-mobile" className={`${inputClass} pl-9`} value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={20} autoComplete="tel" inputMode="tel" required /></div></div>
                <div className="flex gap-2 pt-2"><button type="button" className="btn-ghost flex-1 justify-center" onClick={() => { setEditing(false); setName(profile.name); setMobile(profile.mobile) }}>Cancel</button><button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? <LoaderCircle size={16} className="animate-spin" /> : null}{saving ? 'Saving…' : 'Save changes'}</button></div>
              </form> : <div className="space-y-3">
                <div className="rounded-xl border border-cream-darker bg-white p-4"><div className="mb-1 flex items-center gap-2 text-xs font-medium text-brown-light"><UserRound size={15} /> Full name</div><p className="break-words font-medium text-brown">{profile.name || 'Not added yet'}</p></div>
                <div className="rounded-xl border border-cream-darker bg-white p-4"><div className="mb-1 flex items-center gap-2 text-xs font-medium text-brown-light"><Mail size={15} /> Email address</div><p className="break-words font-medium text-brown">{user?.email || 'Not available'}</p></div>
                <div className="rounded-xl border border-cream-darker bg-white p-4"><div className="mb-1 flex items-center gap-2 text-xs font-medium text-brown-light"><Phone size={15} /> Mobile number</div><p className="break-words font-medium text-brown">{profile.mobile || 'Not added yet'}</p></div>
              </div>}
            </>
          ) : (
            <>
              <div className="mb-5"><h3 className="font-serif text-xl text-brown">Sign-in & password</h3><p className="mt-1 text-xs text-brown-light">Manage how you securely access the dashboard.</p></div>
              <div className="mb-5 rounded-xl border border-cream-darker bg-white p-4"><p className="text-xs font-semibold uppercase tracking-wide text-brown-light">Sign-in methods</p><div className="mt-3 flex flex-wrap gap-2">{hasGoogle && <span className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-brown">Google</span>}{hasPassword && <span className="rounded-full bg-cream px-3 py-1.5 text-xs font-semibold text-brown">Email & password</span>}{!hasGoogle && !hasPassword && <span className="text-sm text-brown-light">No supported provider found.</span>}</div></div>
              {hasPassword || hasGoogle ? <form onSubmit={savePassword} className="space-y-4">
                {hasPassword && <div><label className={labelClass} htmlFor="current-password">Current password</label><input id="current-password" className={inputClass} type={showPasswords ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /></div>}
                <div><label className={labelClass} htmlFor="new-password">{hasPassword ? 'New password' : 'Create a password'}</label><input id="new-password" className={inputClass} type={showPasswords ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required /><p className="mt-1 text-xs text-brown-light">Use at least 6 characters.</p></div>
                <div><label className={labelClass} htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" className={inputClass} type={showPasswords ? 'text' : 'password'} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required /></div>
                <button type="button" onClick={() => setShowPasswords((value) => !value)} className="inline-flex items-center gap-2 text-xs font-semibold text-maroon hover:text-maroon-dark">{showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}{showPasswords ? 'Hide passwords' : 'Show passwords'}</button>
                <button type="submit" disabled={saving} className="btn-primary w-full justify-center">{saving ? <LoaderCircle size={16} className="animate-spin" /> : <KeyRound size={16} />}{saving ? 'Please wait…' : hasPassword ? 'Change password' : 'Add password sign-in'}</button>
                {!hasPassword && hasGoogle && <p className="text-xs leading-relaxed text-brown-light">You'll be asked to confirm your Google account in a secure popup before email/password sign-in is added.</p>}
              </form> : <p className="rounded-xl border border-cream-darker bg-white p-4 text-sm text-brown-light">Password management isn't available for the sign-in method currently linked to this account.</p>}
              <p className="mt-5 text-xs leading-relaxed text-brown-light">For your protection, Firebase may ask you to verify your identity again. Your password is never saved in your profile or displayed after submission.</p>
            </>
          )}
        </div>

        <div className="mt-auto border-t border-cream-darker bg-white px-6 py-4">
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 transition hover:border-red-300 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>
      <style>{`@keyframes profileFade_{from{opacity:0}to{opacity:1}}@keyframes profileSlide_{from{transform:translateX(24px);opacity:.7}to{transform:translateX(0);opacity:1}}@media(prefers-reduced-motion:reduce){.animate-\[profileFade_\.18s_ease-out\],.animate-\[profileSlide_\.24s_ease-out\]{animation:none}}`}</style>
    </div>
  )
}
