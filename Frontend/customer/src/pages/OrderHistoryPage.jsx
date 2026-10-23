import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight, RotateCw } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { fetchOrdersByUser } from '../functions/orders'
import { formatINR } from '../utils/money.js'
import { formatDate } from '../utils/date.js'

export default function OrderHistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadOrders = async ({ quiet = false } = {}) => {
    if (!user) return
    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const data = await fetchOrdersByUser(user.uid)
      setOrders(data)
    } catch (err) {
      setError(err?.message || 'Could not load orders. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (authLoading || !user) return
    loadOrders()
    // Re-fetch when the authenticated user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, authLoading])

  if (authLoading) return null

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🔐</div>
        <h1 className="font-serif text-2xl text-brown mb-3">Sign in to view orders</h1>
        <p className="text-brown-light mb-6">Please sign in to see your order history.</p>
        <Link to="/login" className="btn-primary inline-flex items-center gap-2">
          <ArrowRight size={16} /> Sign in
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <Loader className="mx-auto text-maroon mb-4 animate-spin" size={32} />
        <p className="text-brown-light">Loading your orders…</p>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>My Orders — Vatvruksha Spiritual Vastu Bhandar</title>
        <meta
          name="description"
          content="View your order history and track your spiritual purchases."
        />
      </Helmet>

      <div className="bg-cream-dark border-b border-cream-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav aria-label="Breadcrumb" className="text-xs text-brown-light">
            <Link to="/" className="hover:text-maroon">Home</Link>
            <span className="mx-2">›</span>
            <span className="text-brown font-medium">My Orders</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-gold font-semibold">Order History</p>
          <h1 className="font-serif text-3xl text-brown mt-2">My Orders</h1>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-sm text-brown-light">Showing your 30 most recent orders.</p>
          <button
            type="button"
            onClick={() => loadOrders({ quiet: true })}
            disabled={loading || refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-cream-dark bg-white px-4 py-2 text-sm font-medium text-maroon hover:bg-cream disabled:opacity-60"
          >
            <RotateCw size={15} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh orders'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-700 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span>{error}</span>
            <button type="button" onClick={() => loadOrders()} className="font-semibold underline">Try again</button>
          </div>
        )}

        {!error && orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-cream-dark p-10 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="font-serif text-2xl text-brown mb-3">No orders yet</h2>
            <p className="text-brown-light mb-6">
              Your spiritual purchases will appear here once you place an order.
            </p>
            <Link to="/shop" className="btn-primary inline-flex items-center gap-2">
              <ArrowRight size={16} /> Browse Products
            </Link>
          </div>
        ) : orders.length > 0 ? (
          <>
            {/* Mobile: compact, tappable order cards with no horizontal scrolling. */}
            <div className="md:hidden space-y-3">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  aria-label={`View order ${order.orderNumber || order.id}`}
                  className="block min-w-0 rounded-2xl border border-cream-dark bg-white p-4 shadow-sm transition-colors hover:bg-maroon-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-maroon"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-brown-light mb-1">Order ID</p>
                      <p className="break-all font-mono text-sm font-semibold text-brown">
                        {order.orderNumber || order.id}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${statusClass(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-brown-light mb-1">Date</p>
                      <p className="text-sm text-brown">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="min-w-0 text-right">
                      <p className="text-xs text-brown-light mb-1">Amount</p>
                      <p className="text-sm font-semibold text-brown">{formatINR(order.totals?.total ?? 0)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-1 text-sm font-medium text-maroon">
                    View details <ArrowRight size={15} aria-hidden="true" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Desktop: retain the existing full order table. */}
            <div className="hidden md:block overflow-x-auto rounded-2xl border border-cream-dark bg-white">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-cream-dark">
                    <th className="pb-4 text-sm font-semibold text-brown">Order ID</th>
                    <th className="pb-4 text-sm font-semibold text-brown">Date</th>
                    <th className="pb-4 text-sm font-semibold text-brown">Total</th>
                    <th className="pb-4 text-sm font-semibold text-brown">Payment method</th>
                    <th className="pb-4 text-sm font-semibold text-brown">Order status</th>
                    <th className="pb-4 text-sm font-semibold text-brown">Payment status</th>
                    <th className="pb-4 text-sm font-semibold text-brown">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-cream-dark hover:bg-maroon-50 transition-colors">
                      <td className="py-4 text-sm font-mono font-semibold text-brown">{order.orderNumber || order.id}</td>
                      <td className="py-4 text-sm text-brown-light">{formatDate(order.createdAt)}</td>
                      <td className="py-4 text-sm font-semibold text-brown">{formatINR(order.totals?.total ?? 0)}</td>
                      <td className="py-4 text-sm text-brown-light capitalize">
                        {order.paymentMethod === 'cod' ? 'Cash on Delivery' : order.paymentMethod || '—'}
                      </td>
                      <td className="py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${paymentStatusClass(order.payment?.status)}`}>
                          {paymentStatusLabel(order.payment?.status, order.paymentMethod)}
                        </span>
                      </td>
                      <td className="py-4 text-sm">
                        <Link to={`/orders/${order.id}`} className="text-maroon font-medium hover:underline">View details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}

function Loader({ className, size }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  )
}


function statusLabel(status) {
  const labels = {
    pending_payment: 'Payment pending', confirmed: 'Confirmed', shipped: 'Shipped',
    delivered: 'Delivered', payment_failed: 'Payment failed', expired: 'Expired', cancelled: 'Cancelled',
  }
  return labels[status] || (status ? String(status).replaceAll('_', ' ') : 'Unknown')
}

function statusClass(status) {
  if (status === 'delivered') return 'bg-green-50 text-green-700'
  if (status === 'confirmed' || status === 'shipped') return 'bg-maroon-50 text-maroon'
  if (status === 'pending_payment') return 'bg-gold-50 text-gold-dark'
  if (status === 'payment_failed') return 'bg-red-50 text-red-700'
  if (status === 'expired' || status === 'cancelled') return 'bg-orange-50 text-orange-700'
  return 'bg-cream text-brown'
}

function paymentStatusLabel(status, method) {
  if (status === 'paid') return 'Paid'
  if (status === 'collected') return 'Cash collected'
  if (status === 'failed') return 'Failed'
  if (status === 'uncertain') return 'Needs verification'
  if (status === 'pending') return method === 'cod' ? 'Due on delivery' : 'Pending'
  return status ? String(status).replaceAll('_', ' ') : 'Not available'
}

function paymentStatusClass(status) {
  if (status === 'paid' || status === 'collected') return 'bg-green-50 text-green-700'
  if (status === 'failed') return 'bg-red-50 text-red-700'
  if (status === 'uncertain') return 'bg-orange-50 text-orange-700'
  return 'bg-gold-50 text-gold-dark'
}
