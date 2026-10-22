import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import {
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Users,
  Search,
  UserRoundPlus,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useAdminAuth } from '../context/AuthContext'
import { db, functions } from '../firebase'

// Call Firebase callable functions directly.
const listAdminRolesCallable = httpsCallable(functions, 'listAdminRoles')
const setAdminRoleCallable = httpsCallable(functions, 'setAdminRole')

function displayName(person) {
  return person?.name?.trim() || person?.displayName?.trim() || 'Name unavailable'
}

function getErrorMessage(error, fallback) {
  return error?.message || fallback
}

export default function AdminRolesPage() {
  const { user, isAdmin } = useAdminAuth()
  const [customers, setCustomers] = useState([])
  const [admins, setAdmins] = useState([])
  const [selectedUid, setSelectedUid] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [savingUid, setSavingUid] = useState('')
  const [error, setError] = useState('')

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    if (!user || !isAdmin) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      // Customer profiles are only candidates; the backend verifies the actual Auth account.
      const [profilesSnap, adminResult] = await Promise.all([
        getDocs(query(collection(db, 'users'), limit(500))),
        listAdminRolesCallable({}),
      ])

      const profileRows = profilesSnap.docs.map((docSnap) => ({
        uid: docSnap.id,
        ...docSnap.data(),
      }))
      const adminRows = Array.isArray(adminResult?.data?.admins) ? adminResult.data.admins : []

      profileRows.sort((a, b) =>
        displayName(a).localeCompare(displayName(b), undefined, { sensitivity: 'base' }),
      )
      adminRows.sort((a, b) =>
        String(a.email || '').localeCompare(String(b.email || ''), undefined, { sensitivity: 'base' }),
      )

      setCustomers(profileRows)
      setAdmins(adminRows)
      setSelectedUid((current) =>
        current && profileRows.some((person) => person.uid === current) ? current : '',
      )
    } catch (loadError) {
      setError(getErrorMessage(loadError, 'Could not load admin roles.'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, isAdmin])

  useEffect(() => {
    loadData()
  }, [loadData])

  const adminUids = useMemo(() => new Set(admins.map((admin) => admin.uid)), [admins])
  const selectedCustomer = customers.find((person) => person.uid === selectedUid) || null
  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return customers.filter((person) => {
      if (!term) return true
      return [displayName(person), person.email, person.mobile, person.uid]
        .some((value) => String(value || '').toLowerCase().includes(term))
    })
  }, [customers, search])

  const handleGrant = async (event) => {
    event.preventDefault()
    if (!selectedCustomer) {
      setError('Select a customer before granting admin access.')
      return
    }
    if (!selectedCustomer.email?.trim()) {
      setError('This customer profile has no email address. Select a profile with an email.')
      return
    }
    if (adminUids.has(selectedCustomer.uid)) {
      setError('This account is already an admin.')
      return
    }
    if (!window.confirm(`Grant admin access to ${displayName(selectedCustomer)} (${selectedCustomer.email})?`)) return

    setSavingUid(selectedCustomer.uid)
    setError('')
    try {
      await setAdminRoleCallable({ email: selectedCustomer.email.trim(), makeAdmin: true })
      toast.success(`Admin access granted to ${selectedCustomer.email}.`)
      toast('They may need to sign in again before the new access takes effect.', { icon: 'ℹ️' })
      setSelectedUid('')
      await loadData({ quiet: true })
    } catch (grantError) {
      setError(getErrorMessage(grantError, 'Failed to grant admin access.'))
    } finally {
      setSavingUid('')
    }
  }

  const handleRevoke = async (admin) => {
    if (!admin?.email || !admin?.uid) return
    if (admin.uid === user?.uid) {
      setError('You cannot revoke your own admin access.')
      return
    }
    if (!window.confirm(`Revoke admin access from ${admin.email}? They may need to sign in again before the change takes effect.`)) return

    setSavingUid(admin.uid)
    setError('')
    try {
      await setAdminRoleCallable({ email: admin.email, makeAdmin: false })
      toast.success(`Admin access revoked for ${admin.email}.`)
      await loadData({ quiet: true })
    } catch (revokeError) {
      setError(getErrorMessage(revokeError, 'Failed to revoke admin access.'))
    } finally {
      setSavingUid('')
    }
  }


  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-40 rounded-2xl bg-maroon animate-pulse" />
        <div className="skeleton h-10 w-64" />
        <div className="skeleton h-56 w-full rounded-2xl" />
        <p className="text-sm text-brown-light">Loading admin access…</p>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Admin Roles — Vatvruksha Admin</title>
      </Helmet>

      <div className="mb-8 overflow-hidden rounded-2xl bg-maroon text-cream shadow-sm">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Admin Management</p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Admin Roles</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-cream/85">
              Grant admin access to an existing customer or revoke access from another admin.
              Your own admin access cannot be revoked here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadData({ quiet: true })}
            disabled={refreshing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-cream/30 bg-cream/10 px-4 py-3 text-sm font-medium text-cream transition hover:bg-cream/20 disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">{error}</div>
          <button type="button" onClick={() => loadData({ quiet: true })} className="font-semibold underline">Retry</button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-2xl border border-cream-dark bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-maroon text-gold">
              <UserRoundPlus size={21} />
            </div>
            <div>
              <h2 className="font-serif text-xl text-brown">Grant admin access</h2>
              <p className="mt-1 text-sm leading-5 text-brown-light">Choose an existing customer to give them admin access.</p>
            </div>
          </div>

          <form onSubmit={handleGrant} className="space-y-5">
            <div>
              <label htmlFor="customerSearch" className="mb-2 block text-sm font-semibold text-brown">Find customer</label>
              <div className="relative">
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brown-light" />
                <input
                  id="customerSearch"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, email, or mobile…"
                  className="w-full rounded-xl border border-cream-dark bg-cream py-3 pl-10 pr-3 text-brown outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="targetCustomer" className="mb-2 block text-sm font-semibold text-brown">Select customer</label>
              <select
                id="targetCustomer"
                value={selectedUid}
                onChange={(event) => setSelectedUid(event.target.value)}
                className="w-full rounded-xl border border-cream-dark bg-cream px-3 py-3 text-brown outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/10"
              >
                <option value="">Choose a customer…</option>
                {filteredCustomers.map((person) => (
                  <option key={person.uid} value={person.uid} disabled={adminUids.has(person.uid)}>
                    {displayName(person)} — {person.email || 'No email'}{adminUids.has(person.uid) ? ' (already admin)' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-brown-light">Showing customer profiles currently loaded from Firestore ({customers.length}). Search only covers these loaded profiles.</p>
            </div>

            {selectedCustomer && (
              <div className="rounded-xl border border-cream-dark bg-cream/70 p-4">
                <p className="font-semibold text-brown">{displayName(selectedCustomer)}</p>
                <p className="mt-1 break-all text-sm text-brown-light">{selectedCustomer.email || 'No email address'}</p>
                <p className="mt-1 text-sm text-brown-light">Mobile: {selectedCustomer.mobile || '—'}</p>
                {adminUids.has(selectedCustomer.uid) && <p className="mt-2 text-sm font-medium text-maroon">This customer already has admin access.</p>}
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedCustomer || adminUids.has(selectedCustomer.uid) || !selectedCustomer.email || !!savingUid}
              className="btn-primary inline-flex w-full items-center justify-center gap-2 py-3 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck size={17} />
              {savingUid === selectedUid ? 'Granting access…' : 'Grant Admin Access'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-cream-dark bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-maroon text-gold">
                <Users size={21} />
              </div>
              <div>
                <h2 className="font-serif text-xl text-brown">Current admins</h2>
                <p className="mt-1 text-sm text-brown-light">People who currently have admin access.</p>
              </div>
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-maroon-50 px-3 py-1 text-sm font-semibold text-maroon">{admins.length} total</span>
          </div>

          {admins.length === 0 ? (
            <div className="rounded-xl border border-dashed border-cream-dark bg-cream/60 px-5 py-10 text-center">
              <ShieldCheck size={28} className="mx-auto text-gold-dark" />
              <p className="mt-3 font-medium text-brown">No admin accounts returned</p>
              <p className="mt-1 text-sm text-brown-light">Admins will appear here once access has been assigned.</p>
            </div>
          ) : (
            <>
            <div className="space-y-3 xl:hidden">
              {admins.map((admin) => {
                const isSelf = admin.uid === user?.uid
                return (
                  <div
                    key={admin.uid}
                    className="min-w-0 rounded-xl border border-cream-dark bg-cream/40 p-4"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="break-words font-semibold text-brown">
                          {admin.displayName || admin.email || 'Unnamed admin'}
                        </p>
                        <p className="mt-1 break-all text-xs text-brown-light">
                          {admin.email || 'No email'}
                        </p>
                        {isSelf && (
                          <span className="mt-2 inline-flex rounded-full bg-gold/20 px-2 py-1 text-xs font-semibold text-brown">
                            You
                          </span>
                        )}
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
                        <ShieldCheck size={13} /> Admin
                      </span>
                    </div>
                    <div className="mt-3 flex flex-col gap-3 border-t border-cream-dark pt-3 sm:flex-row sm:items-center sm:justify-between">
                      {!admin.emailVerified ? (
                        <p className="text-xs text-red-700">Email not verified</p>
                      ) : (
                        <span className="text-xs text-brown-light">Email verified</span>
                      )}
                      {isSelf ? (
                        <span className="text-xs font-medium text-brown-light sm:text-right">
                          Cannot revoke self
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRevoke(admin)}
                          disabled={!!savingUid}
                          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60 sm:w-auto"
                        >
                          {savingUid === admin.uid ? <RefreshCw size={14} className="animate-spin" /> : <ShieldOff size={14} />}
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-cream-dark xl:block">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-maroon text-cream">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Admin</th>
                    <th className="px-4 py-3 font-semibold">Access</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin) => {
                    const isSelf = admin.uid === user?.uid
                    return (
                      <tr key={admin.uid} className="border-t border-cream-dark transition-colors hover:bg-maroon-50/30">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-brown">{admin.displayName || admin.email || 'Unnamed admin'}</p>
                          <p className="mt-1 break-all text-xs text-brown-light">{admin.email || 'No email'}</p>
                          {isSelf && <span className="mt-2 inline-flex rounded-full bg-gold/20 px-2 py-1 text-xs font-semibold text-brown">You</span>}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">
                            <ShieldCheck size={13} /> Admin
                          </span>
                          {!admin.emailVerified && <p className="mt-1 text-xs text-red-700">Email not verified</p>}
                        </td>
                        <td className="px-4 py-4 text-right">
                          {isSelf ? (
                            <span className="text-xs font-medium text-brown-light">Cannot revoke self</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRevoke(admin)}
                              disabled={!!savingUid}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                            >
                              {savingUid === admin.uid ? <RefreshCw size={14} className="animate-spin" /> : <ShieldOff size={14} />}
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </section>
      </div>



    </>
  )
}
