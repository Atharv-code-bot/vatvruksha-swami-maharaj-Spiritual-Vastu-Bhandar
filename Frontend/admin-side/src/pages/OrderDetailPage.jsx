import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight, Clock, AlertCircle, RotateCw, RefreshCw } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAdminAuth } from '../context/AuthContext'
import { fetchOrderById } from '../functions/queries'
import { callVerifyPaytmPayment } from '../functions/checkout'
import { formatINR } from '../../../shared/money.js'

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

function formatDateTime(value) {
  const date = toDate(value)
  return date ? date.toLocaleString('en-IN') : '—'
}

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

function paymentLabel(status) {
  const labels = {
    pending: 'Pending',
    paid: 'Paid',
    collected: 'Collected',
    failed: 'Failed',
    uncertain: 'Uncertain',
  }
  return labels[status] || String(status || 'Unknown').replaceAll('_', ' ')
}

function formatActor(actor) {
  if (actor == null) return ''
  if (typeof actor === 'string' || typeof actor === 'number') return String(actor)
  if (typeof actor === 'object') {
    // Status-history actor can be an object such as { uid, type }.
    // Render a readable field rather than passing an object to React.
    return String(actor.email || actor.name || actor.displayName || actor.type || actor.uid || '')
  }
  return ''
}

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const { user, refreshClaims } = useAdminAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadOrder = useCallback(async ({ quiet = false } = {}) => {
    if (!user || !orderId) {
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (!quiet) setLoading(true)
    if (quiet) setRefreshing(true)
    setError('')
    try {
      const data = await fetchOrderById(orderId)
      setOrder(data || null)
      if (!data) setError('This order could not be found.')
    } catch (err) {
      setError(err?.message || 'Could not load order details.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, orderId])

  useEffect(() => {
    loadOrder()
  }, [loadOrder, refreshKey])

  const handleRecheckPayment = async () => {
    if (!order?.id || verifying) return

    setVerifying(true)
    try {
      await refreshClaims()
      const response = await callVerifyPaytmPayment({ orderId: order.id })
      const data = response?.data || response || {}

      if (data.ok === false || data.status === 'data-loss' || data.paymentStatus === 'data-loss') {
        toast.error('Payment could not be confirmed. Please review the order and check again.')
        return
      }

      toast.success('Payment verification request completed.')
      setRefreshKey((value) => value + 1)
    } catch (err) {
      toast.error(err?.message || 'Payment verification failed.')
    } finally {
      setVerifying(false)
    }
  }

  const isPaytmPending =
    order?.paymentMethod === 'paytm' &&
    ['pending', 'uncertain'].includes(order?.payment?.status)

  if (loading) {
    return (
      <div role="status" aria-label="Loading order details" className="space-y-4">
        <div className="skeleton h-8 w-56" />
        <div className="skeleton h-40 w-full rounded-2xl" />
        <p className="text-sm text-brown-light">Loading order details…</p>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-6 text-red-600" size={48} />
        <h1 className="mb-3 font-serif text-2xl text-brown">Order not found</h1>
        <p className="mb-6 break-words text-brown-light">{error || 'This order could not be found.'}</p>
        <Link to="/admin/orders" className="btn-primary inline-flex items-center gap-2">
          <ArrowRight size={16} /> Back to Orders
        </Link>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Order {order.orderNumber || order.id} — Vatvruksha Admin</title>
      </Helmet>

      <div className="min-w-0 space-y-6 rounded-3xl bg-cream/60 p-2 sm:p-4 md:p-5 lg:p-7">
        <section className="relative overflow-hidden rounded-3xl bg-maroon px-4 py-6 text-cream shadow-sm sm:px-8 sm:py-9 lg:px-10">
          <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[28px] border-gold/15" />
          <div className="pointer-events-none absolute -bottom-24 right-28 h-48 w-48 rounded-full bg-cream/5" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-cream/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                Order management
              </div>
              <p className="text-sm text-cream/75">Order details</p>
              <h1 className="mt-2 break-words font-serif text-3xl leading-tight sm:text-4xl">
                Order #{order.orderNumber || order.id}
              </h1>
              <p className="mt-3 text-sm leading-6 text-cream/80">Customer, items, payment, totals, and fulfilment history.</p>
            </div>
            <div className="relative flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => loadOrder({ quiet: true })}
            disabled={refreshing}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cream/60 bg-cream px-4 py-2 text-sm font-semibold text-maroon shadow-sm transition hover:border-gold hover:bg-gold-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <RefreshCw
              size={16}
              className={refreshing ? 'animate-spin' : ''}
            />
            Refresh
          </button>
          <Link to="/admin/orders" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cream/25 bg-cream/10 px-4 py-2 text-sm font-medium text-cream transition hover:bg-cream/20 sm:w-auto">
            <ArrowRight size={14} /> Back to Orders
          </Link>
          </div>
        </div>
      </section>

      {isPaytmPending && (
        <div className="mb-6 rounded-2xl border border-gold-200 bg-gold-50 p-4 text-sm shadow-sm">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-5 w-5 text-gold-dark" />
            <div>
              <p className="font-medium text-brown">
                Paytm payment {order.payment?.status === 'uncertain' ? 'requires verification' : 'pending'}
              </p>
              <p className="mt-1 text-brown-light">
                Fulfilment and stock release must wait until the payment outcome is confirmed by the backend.
              </p>
              <button
                type="button"
                onClick={handleRecheckPayment}
                disabled={verifying}
                className="mt-3 inline-flex items-center gap-1 font-medium text-maroon hover:underline disabled:opacity-60"
              >
                <RotateCw size={14} className={verifying ? 'animate-spin' : ''} />
                {verifying ? 'Verifying…' : 'Check Payment Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {order.payment?.needsReview === true && (
        <div role="alert" className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
          <p className="font-semibold">Payment requires manual review</p>
          <p className="mt-1">Check the payment provider's final status before taking fulfilment or stock-related action.</p>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="min-w-0 space-y-5 sm:space-y-6 lg:col-span-4 lg:space-y-8">
          <section className="min-w-0 rounded-2xl border border-cream-dark bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6">
            <h2 className="mb-4 font-serif text-xl text-brown">Customer</h2>
            <div className="space-y-2 break-words text-sm text-brown-light">
              <p className="font-medium text-brown">{order.customer?.name || '—'}</p>
              <p>{order.customer?.email || '—'}</p>
              <p>{order.customer?.mobile || '—'}</p>
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-cream-dark bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6">
            <h2 className="mb-4 font-serif text-xl text-brown">Shipping Address</h2>
            <div className="space-y-2 text-sm text-brown-light">
              <p>{order.shippingAddress?.fullName || '—'}</p>
              <p>{order.shippingAddress?.mobile || '—'}</p>
              <p>{order.shippingAddress?.addressLine1 || '—'}</p>
              {order.shippingAddress?.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
              {order.shippingAddress?.landmark && <p>{order.shippingAddress.landmark}</p>}
              <p>
                {order.shippingAddress?.city || '—'}, {order.shippingAddress?.state || '—'} - {order.shippingAddress?.pincode || '—'}
              </p>
            </div>
          </section>
        </div>

        <div className="min-w-0 space-y-5 sm:space-y-6 lg:col-span-8 lg:space-y-8">
          <section className="min-w-0 rounded-2xl border border-cream-dark bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6">
            <h2 className="mb-4 font-serif text-xl text-brown">Items</h2>
            <div className="space-y-4">
              {(order.items || []).map((item, index) => {
                const unitPrice = Number(item.unitPrice ?? item.price ?? 0)
                const lineTotal = Number(item.lineTotal ?? unitPrice * Number(item.quantity ?? 0))
                return (
                  <div
                    key={`${item.productId || 'item'}-${item.variantId || index}-${index}`}
                    className="flex gap-4 border-b border-cream-dark pb-4 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium text-brown">
                        {item.productName || item.name || 'Unnamed product'}
                      </p>
                      {item.variantLabel && item.variantLabel !== 'Default' && (
                        <p className="text-sm text-brown-light">{item.variantLabel}</p>
                      )}
                      <p className="text-sm text-brown-light">Quantity: {item.quantity ?? '—'}</p>
                      <p className="text-sm text-brown-light">Unit price: {formatINR(unitPrice)}</p>
                      <p className="mt-1 text-sm font-semibold text-brown">Line total: {formatINR(lineTotal)}</p>
                    </div>
                  </div>
                )
              })}
              {(!order.items || order.items.length === 0) && (
                <p className="text-sm text-brown-light">No item snapshots available.</p>
              )}
            </div>
          </section>

          <section className="min-w-0 rounded-2xl border border-cream-dark bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6">
            <h2 className="mb-4 font-serif text-xl text-brown">Totals</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4 text-brown-light">
                <span>Subtotal</span><span>{formatINR(order.totals?.subtotal ?? 0)}</span>
              </div>
              <div className="flex justify-between gap-4 text-brown-light">
                <span>Shipping</span><span>{formatINR(order.totals?.shipping ?? 0)}</span>
              </div>
              <div className="flex justify-between gap-4 text-brown-light">
                <span>COD Fee</span><span>{formatINR(order.totals?.codFee ?? 0)}</span>
              </div>
              <div className="flex justify-between gap-4 border-t border-cream-dark pt-3 text-base font-bold text-brown">
                <span>Total</span><span>{formatINR(order.totals?.total ?? 0)}</span>
              </div>
              {order.paymentMethod === 'cod' && (
                <div className="rounded-lg bg-gold-50 p-3 font-semibold text-brown">
                  Amount to collect: {formatINR(order.totals?.total ?? 0)}
                </div>
              )}
            </div>
            <div className="mt-4 space-y-2 border-t border-cream-dark pt-4 text-xs text-brown-light">
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                <span>Payment method</span><span className="capitalize">{order.paymentMethod || '—'}</span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                <span>Payment status</span>
                <span className={`badge status-badge ${statusVariant(order.payment?.status)}`}>
                  {paymentLabel(order.payment?.status)}
                </span>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                <span>Order status</span>
                <span className={`badge status-badge ${statusVariant(order.status)}`}>
                  {statusLabel(order.status)}
                </span>
              </div>
              {order.trackingId && (
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <span>Tracking ID</span><span className="break-all font-mono">{order.trackingId}</span>
                </div>
              )}
              {order.reservedUntil && (
                <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                  <span>Reserved until</span><span>{formatDateTime(order.reservedUntil)}</span>
                </div>
              )}
            </div>
          </section>

          {order.paymentMethod === 'paytm' && order.payment && (
            <section className="min-w-0 rounded-2xl border border-cream-dark bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md sm:p-6">
              <h2 className="mb-4 font-serif text-xl text-brown">Payment References</h2>
              <div className="space-y-2 break-words text-sm text-brown-light">
                <div className="flex flex-col gap-1 border-b border-cream-dark pb-2 sm:flex-row sm:justify-between sm:gap-4">
                  <span>Transaction reference</span>
                  <span className="break-all text-right font-mono text-brown">
                    {order.payment.transactionRef || order.payment.transactionId || order.payment.txnId || order.payment.bankTxnId || 'Not available'}
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-b border-cream-dark pb-2 sm:flex-row sm:justify-between sm:gap-4">
                  <span>Amount</span><span className="text-right text-brown">{formatINR(order.payment.amount ?? order.totals?.total ?? 0)}</span>
                </div>
                {order.payment.verifiedAt && (
                  <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
                    <span>Verified at</span><span>{formatDateTime(order.payment.verifiedAt)}</span>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      <section className="mt-5 min-w-0 rounded-2xl border border-cream-dark bg-white/90 p-4 shadow-sm transition-shadow hover:shadow-md sm:mt-6 sm:p-6">
        <h2 className="mb-4 font-serif text-xl text-brown">Status History</h2>
        <div className="space-y-4">
          {(order.statusHistory || []).map((entry, index) => (
            <div key={`${entry.status || 'status'}-${index}`} className="flex gap-3 text-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream-dark text-xs font-semibold text-brown">
                {index + 1}
              </div>
              <div>
                <p className="font-medium text-brown">{statusLabel(entry.status)}</p>
                {entry.timestamp && <p className="text-xs text-brown-light">{formatDateTime(entry.timestamp)}</p>}
                {formatActor(entry.actor) && (
                  <p className="text-xs text-brown-light">
                    By: {formatActor(entry.actor)}
                  </p>
                )}
              </div>
            </div>
          ))}
          {(!order.statusHistory || order.statusHistory.length === 0) && (
            <p className="text-sm text-brown-light">No status history available.</p>
          )}
        </div>
      </section>
      </div>
    </>
  )
}
