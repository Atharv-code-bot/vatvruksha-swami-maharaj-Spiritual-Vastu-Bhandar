import { useCallback, useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { ArrowRight, RefreshCw, Search, Users } from 'lucide-react'
import { useAdminAuth } from '../context/AuthContext'
import { fetchUsers } from '../functions/queries'

const PAGE_SIZE = 20

function formatCreatedAt(value) {
  if (!value) return '—'

  try {
    const date =
      typeof value?.toDate === 'function'
        ? value.toDate()
        : value instanceof Date
          ? value
          : new Date(value)

    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleDateString('en-IN')
  } catch {
    return '—'
  }
}

export default function CustomersPage() {
  const { user } = useAdminAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [lastDoc, setLastDoc] = useState(null)
  const [hasMore, setHasMore] = useState(false)

  const loadUsers = useCallback(
    async ({ reset = true, quiet = false } = {}) => {
      if (!user) {
        setUsers([])
        setLastDoc(null)
        setHasMore(false)
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
        return
      }

      if (reset && quiet) setRefreshing(true)
      else if (reset) setLoading(true)
      else setLoadingMore(true)

      setError('')

      try {
        const result = await fetchUsers({
          pageSize: PAGE_SIZE,
          startAfterDoc: reset ? null : lastDoc,
        })

        if (reset) setUsers(result.items || [])
        else {
          setUsers((current) => {
            const existingIds = new Set(current.map((item) => item.id))
            return [
              ...current,
              ...(result.items || []).filter((item) => !existingIds.has(item.id)),
            ]
          })
        }

        setLastDoc(result.lastDoc || null)
        setHasMore(Boolean(result.hasMore))
      } catch (err) {
        setError(err?.message || 'Could not load customers. Please try again.')
      } finally {
        setLoading(false)
        setRefreshing(false)
        setLoadingMore(false)
      }
    },
    [user, lastDoc]
  )

  useEffect(() => {
    loadUsers({ reset: true })
    // Reset pagination and load the first page when the authenticated user changes.
    // loadUsers intentionally isn't a dependency here because it also depends on the pagination cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    if (!query) return users

    return users.filter((customer) =>
      [customer.name, customer.email, customer.mobile].some((value) =>
        String(value || '').toLocaleLowerCase().includes(query)
      )
    )
  }, [users, searchQuery])

  if (loading) {
    return (
      <div className="space-y-5 rounded-3xl bg-cream/60 p-4 sm:p-6 lg:p-8">
        <div className="skeleton h-36 w-full rounded-2xl" />
        <div className="skeleton h-12 w-full rounded-xl" />
        <div className="skeleton h-72 w-full rounded-2xl" />
        <p className="text-sm text-brown-light">Loading customers…</p>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Customers — Vatvruksha Admin</title>
      </Helmet>

      <div className="space-y-6 rounded-3xl bg-cream/60 p-3 sm:p-5 lg:p-7">
        <section className="relative overflow-hidden rounded-3xl bg-maroon px-5 py-7 text-cream shadow-sm sm:px-8 sm:py-9 lg:px-10">
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[28px] border-gold/15" />
          <div className="pointer-events-none absolute -bottom-24 right-28 h-48 w-48 rounded-full bg-cream/5" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-cream/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                <Users size={14} /> Customer management
              </div>
              <h1 className="font-serif text-3xl leading-tight sm:text-4xl">Customer Directory</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-cream/80 sm:text-base">
                View customer contact details in one place. Customer information is read-only from this page.
              </p>
            </div>

            <div className="flex min-w-36 items-center gap-3 rounded-2xl border border-cream/15 bg-cream/10 px-4 py-3.5 backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <Users size={21} />
              </div>
              <div>
                <p className="text-2xl font-semibold leading-none tabular-nums">{users.length}</p>
                <p className="mt-1.5 text-xs text-cream/75">Loaded customers</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-cream-dark bg-white/70 p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-serif text-xl text-brown sm:text-2xl">Customer list</h2>
              <p className="mt-1 text-sm text-brown-light">
                {searchQuery.trim()
                  ? `${filteredUsers.length} matching customer${filteredUsers.length === 1 ? '' : 's'} in the loaded records`
                  : `Showing ${users.length} loaded customer${users.length === 1 ? '' : 's'}`}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
              <label className="relative block min-w-0 flex-1 sm:min-w-[300px] lg:flex-none">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brown-light"
                />
                <input
                  type="search"
                  placeholder="Search name, email, or mobile…"
                  aria-label="Search loaded customers by name, email, or mobile"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-xl border border-cream-dark bg-cream px-4 py-3 pl-10 text-sm text-brown outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/10"
                />
              </label>

              <button
                type="button"
                onClick={() => loadUsers({ reset: true, quiet: true })}
                disabled={refreshing || loadingMore}
                className="btn-ghost inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cream-dark px-4 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center sm:justify-between"
            >
              <p>{error}</p>
              <button
                type="button"
                onClick={() => loadUsers({ reset: true, quiet: users.length > 0 })}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-red-200 bg-white px-3 py-2 font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60 sm:self-auto"
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                Try again
              </button>
            </div>
          )}

          {/* Compact customer cards for mobile and tablet */}
          <div className="mt-5 space-y-3 xl:hidden">
            {filteredUsers.map((customer) => (
              <article
                key={customer.id}
                className="min-w-0 rounded-xl border border-cream-dark bg-cream/60 p-4"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold text-brown">{customer.name || '—'}</p>
                  <p className="mt-1 break-all text-sm text-brown-light">{customer.email || '—'}</p>
                </div>
                <div className="mt-3 border-t border-cream-dark pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brown-light">Mobile number</p>
                  <p className="mt-1 break-words text-sm text-brown">{customer.mobile || '—'}</p>
                </div>
              </article>
            ))}
            {filteredUsers.length === 0 && (
              <div className="rounded-xl border border-cream-dark bg-cream/40 px-4 py-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-maroon/5 text-maroon">
                  <Search size={20} />
                </div>
                <p className="mt-3 font-medium text-brown">
                  {searchQuery.trim() ? 'No matching customers' : 'No customers found'}
                </p>
                <p className="mt-1 text-sm text-brown-light">
                  {searchQuery.trim()
                    ? 'Try another name, email address, or mobile number.'
                    : 'Customer records will appear here when available.'}
                </p>
              </div>
            )}
          </div>

          {/* Keep the original full table on larger laptop and desktop screens */}
          <div className="mt-5 hidden overflow-hidden rounded-2xl border border-cream-dark bg-cream/40 xl:block">
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead className="bg-maroon text-cream">
                  <tr>
                    <th className="w-1/3 px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-cream sm:px-6">Customer name</th>
                    <th className="w-1/3 px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-cream sm:px-6">Email address</th>
                    <th className="w-1/3 px-5 py-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-cream sm:px-6">Mobile number</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-cream-dark last:border-b-0 transition-colors hover:bg-maroon/5"
                    >
                      <td className="break-words px-5 py-5 font-medium text-brown sm:px-6">{customer.name || '—'}</td>
                      <td className="break-all px-5 py-5 text-brown-light sm:px-6">{customer.email || '—'}</td>
                      <td className="px-5 py-5 text-brown-light sm:px-6">{customer.mobile || '—'}</td>
                    </tr>
                  ))}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-14 text-center sm:px-6">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-maroon/5 text-maroon">
                          <Search size={20} />
                        </div>
                        <p className="mt-3 font-medium text-brown">
                          {searchQuery.trim() ? 'No matching customers' : 'No customers found'}
                        </p>
                        <p className="mt-1 text-sm text-brown-light">
                          {searchQuery.trim()
                            ? 'Try another name, email address, or mobile number.'
                            : 'Customer records will appear here when available.'}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-center text-xs text-brown-light sm:text-left">
              Search covers the customers loaded so far. Load more to include additional records.
            </p>
            {hasMore && (
              <button
                type="button"
                onClick={() => loadUsers({ reset: false })}
                disabled={loadingMore || refreshing}
                className="btn-primary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingMore ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Loading customers…
                  </>
                ) : (
                  <>
                    Load More Customers
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
