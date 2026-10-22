import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { AlertCircle, ArrowRight, ClipboardList, RefreshCw, ShieldAlert } from 'lucide-react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { useAdminAuth } from '../context/AuthContext'
import { db } from '../firebase.js'
import { formatINR } from '../../../shared/money.js'

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'number' || typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof value.seconds === 'number') {
    const parsed = new Date(value.seconds * 1000)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function formatDate(value) {
  const date = toDate(value)
  if (!date) return '—'
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function reviewReason(order) {
  const reasons = []
  if (order.payment?.needsReview === true) {
    reasons.push(order.payment?.reviewReason || 'Flagged for manual review')
  }
  if (order.status === 'payment_review') {
    reasons.push('Payment outcome needs review')
  }
  if (order.status === 'paid_review_required') {
    reasons.push('Payment succeeded but fulfilment requires review')
  }
  if (order.payment?.status === 'review_required') {
    reasons.push('Payment marked as requiring review')
  }
  return [...new Set(reasons)].join(' · ') || 'Flagged for review by the order system'
}

function paymentLabel(order) {
  const status = order.payment?.status || 'unknown'
  return String(status).replaceAll('_', ' ')
}

async function fetchReviewQueue() {
  const ordersRef = collection(db, 'orders')

  // These are explicit review markers from the schema/backend. We deliberately
  // do not infer exceptions from age or amount comparisons in the frontend.
  const queries = [
    query(ordersRef, where('payment.needsReview', '==', true)),
    query(ordersRef, where('status', 'in', ['payment_review', 'paid_review_required'])),
    query(ordersRef, where('payment.status', '==', 'review_required')),
  ]

  const snapshots = await Promise.all(queries.map((reviewQuery) => getDocs(reviewQuery)))
  const unique = new Map()

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((document) => {
      const order = { id: document.id, ...document.data() }
      unique.set(document.id, order)
    })
  })

  return [...unique.values()].sort((a, b) => {
    const aTime = toDate(a.createdAt)?.getTime() ?? 0
    const bTime = toDate(b.createdAt)?.getTime() ?? 0
    return bTime - aTime
  })
}

export default function ExceptionsPage() {
  const { user } = useAdminAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadExceptions = useCallback(async ({ quiet = false } = {}) => {
    if (!user) {
      setOrders([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const reviewOrders = await fetchReviewQueue()
      setOrders(reviewOrders)
    } catch (err) {
      setError(err?.message || 'Could not load the review queue. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    loadExceptions()
  }, [loadExceptions])

  return (
    <>
      <Helmet>
        <title>Exceptions — Vatvruksha Admin</title>
      </Helmet>

      <div className="exceptions-enter mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">Order review</p>
          <h1 className="mt-2 font-serif text-3xl text-brown">Exceptions Queue</h1>
          
        </div>
        <button
          type="button"
          onClick={() => loadExceptions({ quiet: true })}
          disabled={loading || refreshing}
          className="exceptions-refresh btn-ghost inline-flex shrink-0 items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-gold hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="exceptions-enter-late mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="exceptions-card rounded-2xl border border-cream-dark bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50 text-gold-dark">
              <ShieldAlert size={21} />
            </div>
            <div>
              <p className="text-sm text-brown-light">Orders needing review</p>
              <p className="mt-0.5 text-2xl font-semibold text-brown">{loading ? '—' : orders.length}</p>
            </div>
          </div>
        </div>
        <div className="exceptions-card exceptions-card-delay rounded-2xl border border-cream-dark bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-maroon/5 text-maroon">
              <ClipboardList size={21} />
            </div>
            <div>
              <p className="text-sm text-brown-light">Queue access</p>
              <p className="mt-0.5 text-base font-semibold text-brown">Read-only</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Could not load exceptions</p>
            <p className="mt-1 break-words">{error}</p>
            <button type="button" onClick={() => loadExceptions()} className="mt-3 font-semibold underline underline-offset-2">
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="exceptions-enter-later overflow-hidden rounded-2xl border border-cream-dark bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
        <div className="flex items-center justify-between gap-3 border-b border-cream-dark bg-cream/70 px-4 py-3 sm:px-5">
          <div>
            <h2 className="font-serif text-lg text-brown">Orders requiring attention</h2>
            <p className="mt-0.5 text-xs text-brown-light">Select an order to view its existing details page.</p>
          </div>
          {!loading && <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brown border border-cream-dark">{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span>}
        </div>

        {loading ? (
          <div className="space-y-3 p-4 sm:p-5" role="status" aria-label="Loading exceptions">
            <div className="exceptions-skeleton h-10 w-full rounded-lg" />
            <div className="exceptions-skeleton h-10 w-full rounded-lg" />
            <div className="exceptions-skeleton h-10 w-full rounded-lg" />
            <p className="text-sm text-brown-light">Loading the review queue…</p>
          </div>
        ) : (
          <>
            {/* Compact cards for mobile and tablet */}
            <div className="divide-y divide-cream-dark xl:hidden">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/admin/orders/${encodeURIComponent(order.id)}`}
                  className="block min-w-0 p-4 transition-colors hover:bg-maroon-50/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-maroon sm:p-5"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-sm font-semibold text-brown">
                        {order.orderNumber || order.id}
                      </p>
                      <p className="mt-1 truncate font-medium text-brown">
                        {order.customer?.name || 'Customer not named'}
                      </p>
                    </div>
                    <span className="badge payment-failed max-w-[45%] shrink-0 capitalize">
                      {paymentLabel(order)}
                    </span>
                  </div>

                  {order.customer?.email && (
                    <p className="mt-1 break-all text-xs text-brown-light">{order.customer.email}</p>
                  )}

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div className="min-w-0">
                      <p className="text-xs text-brown-light">Amount</p>
                      <p className="mt-0.5 font-semibold text-brown">{formatINR(order.totals?.total ?? 0)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-brown-light">Date</p>
                      <p className="mt-0.5 break-words text-brown-light">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <p className="text-xs text-brown-light">Reason for review</p>
                      <p className="mt-0.5 break-words text-sm text-brown">{reviewReason(order)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-1.5 text-xs font-semibold text-maroon">
                    View details <ArrowRight size={14} />
                  </div>
                </Link>
              ))}
              {orders.length === 0 && !error && (
                <div className="px-4 py-12 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream text-brown-light">
                    <ClipboardList size={22} />
                  </div>
                  <p className="mt-3 font-medium text-brown">No orders need review</p>
                  <p className="mt-1 text-sm text-brown-light">Orders explicitly flagged by the order system will appear here.</p>
                </div>
              )}
            </div>

            {/* Preserve the full table on laptop and desktop */}
            <div className="hidden overflow-x-auto xl:block">
              <table className="table min-w-[850px]">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Payment</th>
                    <th>Reason for review</th>
                    <th className="text-right">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-cream-dark transition-colors hover:bg-maroon-50/30">
                      <td className="font-mono text-sm font-semibold text-brown">
                        {order.orderNumber || order.id}
                      </td>
                      <td>
                        <div className="font-medium text-brown">{order.customer?.name || 'Customer not named'}</div>
                        {order.customer?.email && <div className="mt-0.5 text-xs text-brown-light">{order.customer.email}</div>}
                      </td>
                      <td className="whitespace-nowrap text-sm text-brown-light">{formatDate(order.createdAt)}</td>
                      <td className="whitespace-nowrap font-medium text-brown">{formatINR(order.totals?.total ?? 0)}</td>
                      <td>
                        <span className="badge payment-failed capitalize">{paymentLabel(order)}</span>
                      </td>
                      <td className="max-w-xs whitespace-normal text-sm text-brown-light">{reviewReason(order)}</td>
                      <td className="text-right">
                        <Link to={`/admin/orders/${encodeURIComponent(order.id)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-cream-dark bg-white px-3 py-2 text-xs font-semibold text-maroon transition-all duration-200 hover:-translate-y-0.5 hover:border-gold hover:bg-gold-50 hover:shadow-sm">
                          View details <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && !error && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-cream text-brown-light">
                          <ClipboardList size={22} />
                        </div>
                        <p className="mt-3 font-medium text-brown">No orders need review</p>
                        <p className="mt-1 text-sm text-brown-light">Orders explicitly flagged by the order system will appear here.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      
      <style>{`
        @keyframes exceptionsRiseIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes exceptionsSoftPulse {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }
        .exceptions-enter { animation: exceptionsRiseIn .38s ease-out both; }
        .exceptions-enter-late { animation: exceptionsRiseIn .46s ease-out .08s both; }
        .exceptions-enter-later { animation: exceptionsRiseIn .5s ease-out .16s both; }
        .exceptions-card { animation: exceptionsRiseIn .42s ease-out .08s both; }
        .exceptions-card-delay { animation-delay: .14s; }
        .exceptions-refresh:not(:disabled):hover svg { transform: rotate(35deg); }
        .exceptions-refresh svg { transition: transform .25s ease; }
        .exceptions-skeleton { background: linear-gradient(90deg, #f3e8d8 25%, #fffaf1 50%, #f3e8d8 75%); background-size: 200% 100%; animation: exceptionsShimmer 1.35s ease-in-out infinite; }
        @keyframes exceptionsShimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
        @media (prefers-reduced-motion: reduce) {
          .exceptions-enter, .exceptions-enter-late, .exceptions-enter-later, .exceptions-card { animation: none !important; }
          .exceptions-refresh svg { transition: none; }
          .exceptions-skeleton { animation: none; }
        }
      `}</style>
    </>
  )
}
