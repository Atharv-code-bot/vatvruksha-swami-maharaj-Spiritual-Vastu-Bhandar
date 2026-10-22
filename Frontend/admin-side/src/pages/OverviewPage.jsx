import { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Package,
  RefreshCw,
  Truck,
  Wallet,
  AlertTriangle,
} from 'lucide-react'
import {
  collection,
  getDocs,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore'
import { useAdminAuth } from '../context/AuthContext'
import { db } from '../firebase'
import { fetchOrders, fetchProducts } from '../functions/queries'
import { formatINR } from '../../../shared/money.js'
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../../../shared/constants.js'

const PAGE_SIZE = 100
const RECENT_ORDERS_LIMIT = 8
const DAY_MS = 24 * 60 * 60 * 1000

const INITIAL_STATS = {
  newOrdersToday: 0,
  pendingPaytm: 0,
  confirmed: 0,
  shipped: 0,
  delivered: 0,
  codDue: 0,
  exceptions: 0,
  lowStock: 0,
}

function toDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') {
    const date = value.toDate()
    return Number.isNaN(date.getTime()) ? null : date
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = toDate(value)
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function statusLabel(status) {
  const labels = {
    pending_payment: 'Pending payment',
    confirmed: 'Confirmed',
    shipped: 'Shipped',
    delivered: 'Delivered',
    payment_failed: 'Payment failed',
    expired: 'Expired',
    cancelled: 'Cancelled',
  }
  return labels[status] || 'Unknown'
}

function statusClass(status) {
  const classes = {
    pending_payment: 'bg-amber-50 text-amber-800 border-amber-200',
    confirmed: 'bg-blue-50 text-blue-800 border-blue-200',
    shipped: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    delivered: 'bg-green-50 text-green-800 border-green-200',
    payment_failed: 'bg-red-50 text-red-800 border-red-200',
    expired: 'bg-gray-100 text-gray-700 border-gray-200',
    cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
  }
  return classes[status] || 'bg-cream text-brown border-cream-dark'
}

function MetricCard({ title, value, subtitle, icon: Icon, iconClass = 'bg-maroon-50 text-maroon' }) {
  return (
    <div className="group relative h-full overflow-hidden rounded-2xl border border-cream-dark bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-md sm:p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gold opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex h-full items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-brown-light">{title}</p>
          <p className="mt-2 font-serif text-2xl font-bold tabular-nums text-brown sm:text-3xl">{value}</p>
          {subtitle && <p className="mt-1 text-xs leading-5 text-brown-light">{subtitle}</p>}
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-black/5 ${iconClass}`}>
          <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

async function fetchAllOrdersByStatus(status) {
  const items = []
  let cursor = null
  let hasMore = true

  while (hasMore) {
    const result = await fetchOrders({
      status,
      pageSize: PAGE_SIZE,
      ...(cursor ? { startAfterDoc: cursor } : {}),
    })
    items.push(...(Array.isArray(result?.items) ? result.items : []))
    hasMore = Boolean(result?.hasMore)
    cursor = result?.lastDoc ?? null

    if (hasMore && !cursor) {
      throw new Error(`Could not finish loading ${statusLabel(status).toLowerCase()} orders. Please refresh and try again.`)
    }
  }

  return items
}

async function fetchAllProducts() {
  const items = []
  let cursor = null
  let hasMore = true

  while (hasMore) {
    const result = await fetchProducts({
      pageSize: 500,
      ...(cursor ? { startAfterDoc: cursor } : {}),
    })
    items.push(...(Array.isArray(result?.items) ? result.items : []))
    hasMore = Boolean(result?.hasMore)
    cursor = result?.lastDoc ?? null

    if (hasMore && !cursor) {
      throw new Error('Could not finish loading inventory. Please refresh and try again.')
    }
  }

  return items
}

async function fetchTodayOrdersCount() {
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const snapshot = await getDocs(query(
    collection(db, 'orders'),
    where('createdAt', '>=', Timestamp.fromDate(startOfToday)),
    orderBy('createdAt', 'desc'),
  ))

  return snapshot.size
}

async function fetchPendingPaymentOrders() {
  const snapshot = await getDocs(query(
    collection(db, 'orders'),
    where('payment.status', '==', 'pending'),
  ))
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
}

async function fetchPaytmOrders() {
  const snapshot = await getDocs(query(
    collection(db, 'orders'),
    where('paymentMethod', '==', 'paytm'),
  ))
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
}

async function fetchOrdersMarkedForReview() {
  const snapshot = await getDocs(query(
    collection(db, 'orders'),
    where('payment.needsReview', '==', true),
  ))
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }))
}

function countLowStockVariants(products) {
  let count = 0

  for (const product of products) {
    if (product?.isActive === false) continue
    const variants = product?.variants && typeof product.variants === 'object'
      ? product.variants
      : {}

    for (const variant of Object.values(variants)) {
      if (!variant || variant.isActive === false) continue
      const stock = Number(variant.stock ?? 0)
      if (Number.isFinite(stock) && stock > 0 && stock <= DEFAULT_LOW_STOCK_THRESHOLD) {
        count += 1
      }
    }
  }

  return count
}

export default function OverviewPage() {
  const { user } = useAdminAuth()
  const [stats, setStats] = useState(INITIAL_STATS)
  const [recentOrders, setRecentOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadOverview = useCallback(async ({ quiet = false } = {}) => {
    if (!user) {
      setStats(INITIAL_STATS)
      setRecentOrders([])
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (quiet) setRefreshing(true)
    else setLoading(true)
    setError('')

    try {
      const [
        newOrdersToday,
        pendingPaymentOrders,
        paytmOrders,
        confirmedOrders,
        shippedOrders,
        deliveredOrders,
        reviewOrders,
        recentResult,
        products,
      ] = await Promise.all([
        fetchTodayOrdersCount(),
        fetchPendingPaymentOrders(),
        fetchPaytmOrders(),
        fetchAllOrdersByStatus('confirmed'),
        fetchAllOrdersByStatus('shipped'),
        fetchAllOrdersByStatus('delivered'),
        fetchOrdersMarkedForReview(),
        fetchOrders({ pageSize: RECENT_ORDERS_LIMIT }),
        fetchAllProducts(),
      ])

      const staleCutoff = Date.now() - DAY_MS
      const stalePendingPaytmOrders = pendingPaymentOrders.filter((order) => {
        const createdAt = toDate(order.createdAt)
        return order.paymentMethod === 'paytm' && createdAt && createdAt.getTime() < staleCutoff
      })
      const amountMismatchOrders = paytmOrders.filter((order) => {
        const paymentAmount = order.payment?.amount
        const orderTotal = order.totals?.total
        return Number.isSafeInteger(paymentAmount) &&
          Number.isSafeInteger(orderTotal) &&
          paymentAmount !== orderTotal
      })
      const exceptionIds = new Set([
        ...reviewOrders.map((order) => order.id),
        ...stalePendingPaytmOrders.map((order) => order.id),
        ...amountMismatchOrders.map((order) => order.id),
      ])

      setStats({
        newOrdersToday,
        pendingPaytm: pendingPaymentOrders.filter((order) => order.paymentMethod === 'paytm').length,
        confirmed: confirmedOrders.length,
        shipped: shippedOrders.length,
        delivered: deliveredOrders.length,
        codDue: pendingPaymentOrders.filter((order) => order.paymentMethod === 'cod').length,
        exceptions: exceptionIds.size,
        lowStock: countLowStockVariants(products),
      })
      setRecentOrders(Array.isArray(recentResult?.items) ? recentResult.items : [])
    } catch (loadError) {
      setError(loadError?.message || 'We could not load the dashboard. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  const handleRefresh = () => loadOverview({ quiet: true })

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-live="polite">
        <div className="overflow-hidden rounded-2xl bg-maroon p-6 text-cream shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Vatvruksha Admin</p>
          <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Overview</h1>
          <p className="mt-2 text-sm text-cream/80">Getting your latest shop updates…</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-32 animate-pulse rounded-2xl border border-cream-dark bg-white" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-cream-dark bg-white" />
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Overview — Vatvruksha Admin</title>
      </Helmet>

      <style>{`
        @keyframes overviewLandingIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .overview-landing-item { animation: overviewLandingIn 560ms cubic-bezier(.2,.7,.25,1) both; }
        .overview-landing-delay-1 { animation-delay: 70ms; }
        .overview-landing-delay-2 { animation-delay: 150ms; }
        .overview-landing-delay-3 { animation-delay: 230ms; }
        @media (prefers-reduced-motion: reduce) {
          .overview-landing-item { animation: none !important; }
        }
      `}</style>
      <div className="overview-landing-item mb-8 overflow-hidden rounded-2xl bg-maroon text-cream shadow-sm">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gold">Vatvruksha Admin</p>
            <h1 className="mt-2 font-serif text-3xl sm:text-4xl">Overview</h1>
            <p className="mt-2 text-sm text-cream/85">Here’s what’s happening with your shop.</p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-cream/30 bg-cream/10 px-4 py-3 text-sm font-semibold text-cream transition hover:bg-cream/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh overview
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="shrink-0 self-start font-semibold underline sm:self-center"
          >
            Try again
          </button>
        </div>
      )}

      <section aria-label="Order overview" className="overview-landing-item overview-landing-delay-1 mb-8">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-maroon text-gold">
            <CalendarDays size={18} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-serif text-xl text-brown">Orders at a glance</h2>
            <p className="mt-0.5 text-xs text-brown-light">A quick look at your shop’s activity</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          <MetricCard title="New Orders Today" value={stats.newOrdersToday} subtitle="Orders placed today" icon={Package} />
          <MetricCard title="Paytm Pending" value={stats.pendingPaytm} subtitle="Waiting for payment confirmation" icon={Clock3} iconClass="bg-amber-50 text-amber-800" />
          <MetricCard title="Confirmed" value={stats.confirmed} subtitle="Orders being prepared" icon={CheckCircle2} iconClass="bg-green-50 text-green-800" />
          <MetricCard title="Shipped" value={stats.shipped} subtitle="Orders on the way" icon={Truck} iconClass="bg-blue-50 text-blue-800" />
          <MetricCard title="Delivered" value={stats.delivered} subtitle="Successfully delivered" icon={Package} iconClass="bg-green-50 text-green-800" />
          <MetricCard title="COD to Collect" value={stats.codDue} subtitle="Cash due on delivery" icon={Wallet} iconClass="bg-amber-50 text-amber-800" />
          <Link to="/admin/exceptions" className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2">
            <MetricCard title="Orders to Review" value={stats.exceptions} subtitle="Open the review queue" icon={AlertCircle} iconClass="bg-red-50 text-red-800" />
          </Link>
          <Link to="/admin/inventory" className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-maroon focus-visible:ring-offset-2">
            <MetricCard title="Low Stock" value={stats.lowStock} subtitle={`Active variants with stock up to ${DEFAULT_LOW_STOCK_THRESHOLD}`} icon={AlertTriangle} iconClass="bg-orange-50 text-orange-800" />
          </Link>
        </div>
      </section>

      <section className="overview-landing-item overview-landing-delay-2 overflow-hidden rounded-2xl border border-cream-dark bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-cream-dark bg-cream/50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-maroon text-gold">
                <Package size={18} aria-hidden="true" />
              </div>
              <h2 className="font-serif text-xl text-brown">Recent Orders</h2>
            </div>
            <p className="mt-2 text-sm text-brown-light">The latest orders received by your shop.</p>
          </div>
          <Link to="/admin/orders" className="inline-flex items-center gap-2 self-start rounded-xl border border-cream-dark bg-white px-3.5 py-2.5 text-sm font-semibold text-maroon transition hover:border-maroon hover:bg-maroon-50">
            View all orders <ArrowRight size={16} />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="px-5 py-12 text-center sm:px-6">
            <Package size={30} className="mx-auto text-gold" />
            <p className="mt-3 font-medium text-brown">No orders yet</p>
            <p className="mt-1 text-sm text-brown-light">New orders will appear here.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 sm:p-4 lg:hidden">
              {recentOrders.map((order) => (
                <Link
                  key={order.id}
                  to={`/admin/orders/${encodeURIComponent(order.id)}`}
                  aria-label={`View order ${order.orderNumber || order.id}`}
                  className="block rounded-xl border border-cream-dark bg-cream/30 px-3 py-3 transition hover:border-maroon/40 hover:bg-maroon-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon sm:px-4"
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <span className="min-w-0 truncate font-mono text-xs font-semibold text-brown sm:text-sm" title={order.orderNumber || order.id}>
                      {(order.orderNumber || order.id).slice(0, 14)}…
                    </span>
                    <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(order.status)}`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <div className="mt-2 flex min-w-0 items-start justify-between gap-3 border-t border-cream-dark pt-2">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-brown">{order.customer?.name || 'Customer'}</p>
                      <p className="mt-0.5 break-words text-xs text-brown-light">{order.customer?.email || '—'}</p>
                      <p className="mt-1 text-xs text-brown-light">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-brown">{formatINR(order.totals?.total ?? 0)}</p>
                      <p className="mt-0.5 text-xs text-brown-light">
                        {(order.paymentMethod || '—').toUpperCase()} · {order.payment?.status || '—'}
                      </p>
                    </div>
                  </div>
                  {order.payment?.needsReview === true && (
                    <p className="mt-2 text-xs font-semibold text-red-700">Needs review</p>
                  )}
                </Link>
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-cream/70 text-xs uppercase tracking-wide text-brown-light">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Order</th>
                    <th className="px-5 py-3 font-semibold">Customer</th>
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Payment</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right font-semibold">Total</th>
                    <th className="px-5 py-3 text-right font-semibold"> </th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-cream-dark transition-colors hover:bg-maroon-50/30">
                      <td className="px-5 py-4 font-semibold text-brown">{order.orderNumber || order.id}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-brown">{order.customer?.name || 'Customer'}</p>
                        <p className="mt-0.5 text-xs text-brown-light">{order.customer?.email || '—'}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-brown-light">{formatDate(order.createdAt)}</td>
                      <td className="px-5 py-4 text-brown">
                        <span className="capitalize">{order.paymentMethod || '—'}</span>
                        <p className="mt-0.5 text-xs text-brown-light">{order.payment?.status || '—'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                        {order.payment?.needsReview === true && (
                          <p className="mt-1 text-xs font-semibold text-red-700">Needs review</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right font-semibold text-brown">
                        {formatINR(order.totals?.total ?? 0)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          to={`/admin/orders/${encodeURIComponent(order.id)}`}
                          aria-label={`View order ${order.orderNumber || order.id}`}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 font-semibold text-maroon hover:bg-maroon-50"
                        >
                          View <ArrowRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  )
}
