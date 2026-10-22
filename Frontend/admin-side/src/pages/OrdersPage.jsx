import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight, AlertCircle, RefreshCw, Search } from 'lucide-react'
import { useAdminAuth } from '../context/AuthContext'
import { fetchOrders, searchOrderById } from '../functions/queries'
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { db } from '../firebase.js'
import { toast } from 'react-hot-toast'
import { formatINR } from '../../../shared/money.js'

const PAGE_SIZE = 15

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'payment_failed', label: 'Payment Failed' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
]

function statusLabel(status) {
  const labels = {
    pending_payment: 'Pending Payment',
    confirmed: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    payment_failed: 'Payment Failed',
    expired: 'Expired',
    cancelled: 'Cancelled',
  }
  return labels[status] || String(status || 'Unknown').replaceAll('_', ' ')
}

function statusVariant(status) {
  const variants = {
    delivered: 'status-delivered',
    confirmed: 'status-confirmed',
    shipped: 'status-shipped',
    pending_payment: 'status-pending_payment',
    payment_failed: 'status-payment_failed',
    expired: 'status-expired',
    cancelled: 'status-cancelled',
  }
  return variants[status] || 'bg-cream text-brown border-cream-dark'
}

function paymentVariant(status) {
  const variants = {
    pending: 'payment-pending',
    paid: 'payment-paid',
    collected: 'payment-paid',
    failed: 'payment-failed',
    uncertain: 'payment-failed',
  }
  return variants[status] || 'payment-pending'
}

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'number' || typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value.seconds === 'number') {
    const date = new Date(value.seconds * 1000)
    return Number.isNaN(date.getTime()) ? null : date
  }
  return null
}

function formatDate(value) {
  const date = toDate(value)
  return date
    ? date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'
}

export default function OrdersPage() {
  const { user } = useAdminAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [lastDoc, setLastDoc] = useState(null)
  const lastDocRef = useRef(null)
  const [hasMore, setHasMore] = useState(false)
  const [updatingOrderId, setUpdatingOrderId] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const loadOrders = useCallback(async ({ reset = true, quiet = false } = {}) => {
    if (!user) {
      setOrders([])
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
      return
    }

    if (reset && !quiet) setLoading(true)
    else if (!reset) setLoadingMore(true)
    if (quiet) setRefreshing(true)
    setError('')

    try {
      const query = searchQuery.trim()
      if (query) {
        // Try the existing exact order-number/document-ID lookup first.
        const exactResults = await searchOrderById(query)
        const normalizedQuery = query.toLocaleLowerCase()
        let results = Array.isArray(exactResults) ? exactResults : []

        // Firestore does not support arbitrary substring searches on nested
        // fields, so paginate through orders to support customer-name matches.
        const exactMatch = results.some((order) =>
          String(order.orderNumber || '').toLocaleLowerCase() === normalizedQuery ||
          String(order.id || '').toLocaleLowerCase() === normalizedQuery
        )

        if (!exactMatch) {
          const matchingOrders = []
          let cursor = null
          let hasMoreOrders = true

          while (hasMoreOrders) {
            const page = await fetchOrders({
              status: statusFilter || undefined,
              pageSize: 100,
              ...(cursor ? { startAfterDoc: cursor } : {}),
            })
            const items = Array.isArray(page?.items) ? page.items : []
            matchingOrders.push(...items.filter((order) => {
              const orderId = String(order.orderNumber || '').toLocaleLowerCase()
              const documentId = String(order.id || '').toLocaleLowerCase()
              const customerName = String(order.customer?.name || '').toLocaleLowerCase()
              return orderId.includes(normalizedQuery) ||
                documentId.includes(normalizedQuery) ||
                customerName.includes(normalizedQuery)
            }))
            hasMoreOrders = Boolean(page?.hasMore)
            cursor = page?.lastDoc ?? null
            if (hasMoreOrders && !cursor) {
              throw new Error('Could not finish searching orders. Please try again.')
            }
          }

          results = matchingOrders
        } else {
          results = results.filter((order) => {
            const orderId = String(order.orderNumber || '').toLocaleLowerCase()
            const documentId = String(order.id || '').toLocaleLowerCase()
            const customerName = String(order.customer?.name || '').toLocaleLowerCase()
            return orderId.includes(normalizedQuery) ||
              documentId.includes(normalizedQuery) ||
              customerName.includes(normalizedQuery)
          })
        }

        setOrders(results)
        lastDocRef.current = null
        setLastDoc(null)
        setHasMore(false)
        return
      }

      const result = await fetchOrders({
        status: statusFilter || undefined,
        pageSize: PAGE_SIZE,
        startAfterDoc: reset ? null : lastDocRef.current,
      })
      const items = Array.isArray(result?.items) ? result.items : []

      setOrders((current) => reset ? items : [...current, ...items])
      lastDocRef.current = result?.lastDoc ?? null
      setLastDoc(result?.lastDoc ?? null)
      setHasMore(Boolean(result?.hasMore))
    } catch (err) {
      setError(err?.message || 'Could not load orders. Please try again.')
    } finally {
      setLoading(false)
      setLoadingMore(false)
      setRefreshing(false)
    }
  }, [user, searchQuery, statusFilter])

  useEffect(() => {
    lastDocRef.current = null
    setLastDoc(null)
    loadOrders({ reset: true })
  }, [loadOrders])

  const reviewCount = useMemo(
    () => orders.filter((order) => order.payment?.needsReview === true).length,
    [orders]
  )

  const handleRefresh = () => loadOrders({ reset: true, quiet: true })

  const handleStatusChange = async (order, nextStatus) => {
    if (!order?.id || updatingOrderId) return
    if (!['shipped', 'delivered'].includes(nextStatus)) return
    if (nextStatus === 'shipped' && order.status !== 'confirmed') return
    if (nextStatus === 'delivered' && order.status !== 'shipped') return

    setUpdatingOrderId(order.id)
    try {
      const actor = {
        uid: user?.uid || '',
        email: user?.email || '',
        type: 'admin',
      }
      await updateDoc(doc(db, 'orders', order.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: nextStatus,
          timestamp: new Date(),
          actor,
        }),
      })
      toast.success(`Order marked ${nextStatus}.`)
      await loadOrders({ reset: true, quiet: true })
    } catch (err) {
      toast.error(
        err?.message ||
          'Could not update order status. Check the admin claim and deployed Firestore rules.'
      )
    } finally {
      setUpdatingOrderId('')
    }
  }

  return (
    <>
      <Helmet>
        <title>Orders — Vatvruksha Admin</title>
      </Helmet>

      <div className="min-w-0 space-y-6 rounded-3xl bg-cream/60 p-2 sm:p-4 md:p-5 lg:p-7">
        <section className="relative overflow-hidden rounded-3xl bg-maroon px-4 py-6 text-cream shadow-sm sm:px-8 sm:py-9 lg:px-10">
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[28px] border-gold/15" />
          <div className="pointer-events-none absolute -bottom-24 right-28 h-48 w-48 rounded-full bg-cream/5" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-cream/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                Order management
              </div>
              <h1 className="font-serif text-3xl leading-tight sm:text-4xl">Manage Orders</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-cream/80 sm:text-base">
                Review payments, track fulfilment, and open order details from one place.
              </p>
            </div>
            <div className="flex min-w-36 items-center gap-3 rounded-2xl border border-cream/15 bg-cream/10 px-4 py-3.5 backdrop-blur-sm">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15 text-gold">
                <RefreshCw size={21} />
              </div>
              <div>
                <p className="text-2xl font-semibold leading-none tabular-nums">{orders.length}</p>
                <p className="mt-1.5 text-xs text-cream/75">Loaded orders</p>
              </div>
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-cream-dark bg-white/70 p-3 shadow-sm sm:p-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-xl text-brown sm:text-2xl">Order list</h2>
              <p className="mt-1 text-sm text-brown-light">Search an exact order number or document ID, then filter by status.</p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading || loadingMore}
              className="btn-ghost inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cream-dark px-4 disabled:opacity-60"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            size={17}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brown-light"
          />
          <input
            type="search"
            placeholder="Search exact order number or ID…"
            aria-label="Search by exact order number or document ID"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-xl border border-cream-dark bg-cream px-4 py-3 pl-10 text-sm text-brown outline-none transition focus:border-maroon focus:ring-2 focus:ring-maroon/10"
          />
        </div>
        <p className="text-xs text-brown-light">
          {orders.length} order{orders.length === 1 ? '' : 's'}
          {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ''}
          {reviewCount > 0 ? ` · ${reviewCount} need review on this page` : ''}
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter orders by status">
        {STATUS_FILTERS.map((filter) => {
          const selected = statusFilter === filter.value
          return (
            <button
              key={filter.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-full border px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 ${
                selected
                  ? 'border-maroon bg-maroon text-white'
                  : 'border-cream-dark bg-cream text-brown hover:bg-maroon-50'
              }`}
            >
              {filter.label}
            </button>
          )
        })}
      </div>

      {error && (
        <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
            <button type="button" onClick={handleRefresh} className="mt-2 font-semibold underline">
              Try again
            </button>
          </div>
        </div>
      )}

      {loading && orders.length === 0 ? (
        <div role="status" aria-label="Loading orders" className="space-y-4">
          <div className="skeleton h-8 w-56" />
          <div className="skeleton h-40 w-full rounded-2xl" />
          <p className="text-sm text-brown-light">Loading orders…</p>
        </div>
      ) : (
        <>
        <div className="lg:hidden">
          {!loading && orders.length === 0 && (
            <div className="rounded-xl border border-cream-dark bg-white px-4 py-10 text-center text-sm text-brown-light">
              {searchQuery.trim() ? 'No matching order found.' : 'No orders found.'}
            </div>
          )}
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/admin/orders/${encodeURIComponent(order.id)}`}
              aria-label={`View order ${order.orderNumber || order.id}`}
              className="mb-3 block rounded-xl border border-cream-dark bg-white px-3 py-3 transition hover:border-maroon/40 hover:bg-maroon/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon"
            >
              <div className="flex min-w-0 items-center justify-between gap-3">
                <span className="min-w-0 truncate font-mono text-xs font-semibold text-brown" title={order.orderNumber || order.id}>
                  {(order.orderNumber || order.id).slice(0, 14)}…
                </span>
                <span className={`shrink-0 badge status-badge ${statusVariant(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              <div className="mt-2 flex min-w-0 items-start justify-between gap-3 border-t border-cream-dark pt-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-brown">{order.customer?.name || '—'}</p>
                  <p className="mt-0.5 break-words text-xs text-brown-light">{order.customer?.mobile || '—'}</p>
                  <p className="mt-1 text-xs text-brown-light">{formatDate(order.createdAt)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-brown">{formatINR(order.totals?.total ?? 0)}</p>
                  <p className="mt-0.5 text-xs text-brown-light">{(order.paymentMethod || 'cod').toUpperCase()}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="hidden overflow-hidden rounded-2xl border border-cream-dark bg-cream/40 lg:block"><div className="overflow-x-auto">
          <table className="table min-w-[900px]">
            <thead className="bg-maroon text-cream">
              <tr>
                <th className="px-2 sm:px-3">Order</th>
                <th className="hidden sm:table-cell">Date</th>
                <th className="px-2 sm:px-3">Customer</th>
                <th className="hidden sm:table-cell">Total</th>
                <th className="hidden sm:table-cell">Payment</th>
                <th className="px-2 sm:px-3">Order Status</th>
                <th className="hidden sm:table-cell">Review</th>
                <th className="px-2 sm:px-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const needsReview = order.payment?.needsReview === true
                return (
                  <tr key={order.id} className="border-b border-cream-dark last:border-b-0 transition-colors hover:bg-maroon/5">
                    <td className="max-w-[120px] break-words px-2 font-mono text-xs font-semibold text-brown sm:max-w-none sm:px-3 sm:text-sm">
                      {order.orderNumber || order.id}
                    </td>
                    <td className="hidden whitespace-nowrap text-sm text-brown-light sm:table-cell">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="max-w-[150px] break-words px-2 sm:max-w-none sm:px-3">
                      <p className="break-words text-sm font-medium text-brown">{order.customer?.name || '—'}</p>
                      <p className="mt-0.5 break-words text-xs text-brown-light">{order.customer?.mobile || '—'}</p>
                    </td>
                    <td className="hidden whitespace-nowrap font-semibold text-brown sm:table-cell">
                      {formatINR(order.totals?.total ?? 0)}
                    </td>
                    <td className="hidden sm:table-cell">
                      <span className={`badge status-badge ${paymentVariant(order.payment?.status)}`}>
                        {(order.paymentMethod || 'cod').toUpperCase()} · {order.payment?.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3">
                      <div className="flex min-w-[100px] flex-col items-start gap-2 sm:min-w-[145px]">
                        <span className={`badge status-badge ${statusVariant(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                        {(order.status === 'confirmed' || order.status === 'shipped') && (
                          <button
                            type="button"
                            disabled={Boolean(updatingOrderId)}
                            onClick={() => handleStatusChange(order, order.status === 'confirmed' ? 'shipped' : 'delivered')}
                            className="inline-flex min-h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-maroon/25 bg-cream px-3 py-2 text-xs font-semibold text-maroon transition hover:border-maroon hover:bg-maroon hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Mark order ${order.orderNumber || order.id} ${order.status === 'confirmed' ? 'shipped' : 'delivered'}`}
                          >
                            {updatingOrderId === order.id
                              ? 'Updating…'
                              : order.status === 'confirmed' ? 'Mark shipped' : 'Mark delivered'}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell">
                      {needsReview ? (
                        <span className="badge status-badge status-expired" title="Payment needs manual investigation">
                          Needs review
                        </span>
                      ) : (
                        <span className="text-xs text-brown-light">—</span>
                      )}
                    </td>
                    <td className="px-2 sm:px-3">
                      <Link
                        to={`/admin/orders/${encodeURIComponent(order.id)}`}
                        className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-maroon hover:underline"
                      >
                        View <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {!loading && orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-brown-light">
                    {searchQuery.trim() ? 'No matching order found.' : 'No orders found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
        </>
      )}

        {!searchQuery.trim() && hasMore && (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => loadOrders({ reset: false })}
            disabled={loading || loadingMore}
            className="btn-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={15} className={loadingMore ? 'animate-spin' : ''} />
            {loadingMore ? 'Loading…' : 'Load More Orders'}
          </button>
        </div>
      )}
        </section>
      </div>
    </>
  )
}
