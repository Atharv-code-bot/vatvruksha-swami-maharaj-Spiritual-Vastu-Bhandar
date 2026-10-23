import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight, RotateCw } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { fetchOrderById } from '../functions/orders'
import { callVerifyPaytmPayment } from '../functions/checkout'
import { formatINR } from '../utils/money.js'
import { formatDateTime, toDate } from '../utils/date.js'

export default function OrderDetailPage() {
  const { orderId } = useParams()
  const { user, refreshIdToken } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!user || !orderId) {
      setLoading(false)
      if (user && !orderId) setError('The order link is missing an order ID.')
      return
    }
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchOrderById(orderId)
        // Tolerate missing optional fields on old orders
        if (active) {
          setOrder(data)
          if (!data) setError(null)
        }
      } catch (err) {
        if (active) setError(err?.message || 'Could not load order details.')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [user, orderId])

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center" role="status" aria-live="polite">
        <RotateCw className="mx-auto text-maroon mb-4 animate-spin" size={28} />
        <p className="text-brown-light">Loading order details…</p>
      </div>
    )
  }
  if (!user) return null
  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="font-serif text-2xl text-brown mb-3">Order not found</h1>
        <p className="text-brown-light mb-6">{error}</p>
        <Link to="/orders" className="btn-primary inline-flex items-center gap-2">
          <ArrowRight size={16} /> Back to Orders
        </Link>
      </div>
    )
  }
  if (!order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">📭</div>
        <h1 className="font-serif text-2xl text-brown mb-3">Order not found</h1>
        <p className="text-brown-light mb-6">This order does not exist or you do not have access to it.</p>
        <Link to="/orders" className="btn-primary inline-flex items-center gap-2">
          <ArrowRight size={16} /> Back to Orders
        </Link>
      </div>
    )
  }

  const handleRecheckPayment = async () => {
    if (order.paymentMethod !== 'paytm' || verifying) return
    setVerifying(true)
    try {
      await refreshIdToken()
      const resp = await callVerifyPaytmPayment({ orderId: order.id })
      const data = resp.data || resp
      const nextPaymentStatus = data.paymentStatus ?? data.payment?.status
      const nextOrderStatus = data.orderStatus ?? data.status

      if (data.ok === false || data.status === 'data-loss' || nextPaymentStatus === 'data-loss' || data.code === 'data-loss') {
        toast.error('Payment verification is temporarily unavailable. Your payment remains unconfirmed; please try again later or contact support.')
        return
      }

      // A confirmed order status alone is not proof that Paytm payment was paid.
      if (nextPaymentStatus === 'paid' || data.payment?.status === 'paid') {
        setOrder((prev) => ({
          ...prev,
          payment: { ...(prev.payment || {}), ...(data.payment || {}), status: 'paid' },
          paymentStatus: 'paid',
          status: nextOrderStatus || prev.status,
        }))
        toast.success('Paytm payment verified by the server.')
      } else if (nextPaymentStatus === 'failed' || data.payment?.status === 'failed') {
        setOrder((prev) => ({
          ...prev,
          payment: { ...(prev.payment || {}), ...(data.payment || {}), status: 'failed' },
          paymentStatus: 'failed',
          status: nextOrderStatus || prev.status,
        }))
        toast.error('The server reports that payment failed. If money was deducted, contact support with your order ID.')
      } else {
        // Never infer failure/success from a redirect, order status, or incomplete response.
        setOrder((prev) => ({
          ...prev,
          ...(nextOrderStatus ? { status: nextOrderStatus } : {}),
          payment: { ...(prev.payment || {}), ...(data.payment || {}), status: nextPaymentStatus || prev.payment?.status || 'uncertain' },
          paymentStatus: nextPaymentStatus || prev.paymentStatus || 'uncertain',
        }))
        toast('Payment is still pending or its final status is uncertain. Do not place another order yet.', { icon: '⏳' })
      }
    } catch (err) {
      toast.error(err?.message || 'Could not verify payment. Your payment status remains unconfirmed.')
    } finally {
      setVerifying(false)
    }
  }

  const handleRefreshOrder = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      const latest = await fetchOrderById(orderId)
      if (!latest) {
        setError('This order could not be found for your account.')
        setOrder(null)
      } else {
        setOrder(latest)
        setError(null)
      }
    } catch (err) {
      toast.error(err?.message || 'Could not refresh order details.')
    } finally {
      setRefreshing(false)
    }
  }

  const statusLabel = (s) => {
    switch (s) {
      case 'pending_payment': return 'Payment Pending'
      case 'confirmed': return 'Confirmed'
      case 'shipped': return 'Shipped'
      case 'delivered': return 'Delivered'
      case 'payment_failed': return 'Payment Failed'
      case 'expired': return 'Expired'
      case 'cancelled': return 'Cancelled'
      default: return s ? String(s).replaceAll('_', ' ') : 'Unknown'
    }
  }

  const statusVariant = (s) => {
    switch (s) {
      case 'delivered': return 'bg-green-50 text-green-700 border-green-100'
      case 'confirmed': return 'bg-maroon-50 text-maroon border-maroon-100'
      case 'pending_payment': return 'bg-gold-50 text-gold-dark border-gold-100'
      case 'payment_failed': return 'bg-red-50 text-red-700 border-red-100'
      case 'expired': return 'bg-orange-50 text-orange-700 border-orange-100'
      case 'cancelled': return 'bg-gray-50 text-gray-700 border-gray-100'
      default: return 'bg-cream text-brown border-cream-dark'
    }
  }

  return (
    <>
      <Helmet>
        <title>Order {order.orderNumber || order.id} — Vatvruksha Spiritual Vastu Bhandar</title>
        <meta name="description" content="Order details and tracking." />
      </Helmet>

      <div className="bg-cream-dark border-b border-cream-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav aria-label="Breadcrumb" className="text-xs text-brown-light">
            <Link to="/" className="hover:text-maroon">Home</Link>
            <span className="mx-2">›</span>
            <Link to="/orders" className="hover:text-maroon">My Orders</Link>
            <span className="mx-2">›</span>
            <span className="text-brown font-medium">Order Details</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-gold font-semibold">Order Details</p>
            <h1 className="font-serif text-3xl text-brown mt-2">
              Order #{order.orderNumber || order.id}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={handleRefreshOrder} disabled={refreshing} className="text-maroon font-medium hover:underline inline-flex items-center gap-1 disabled:opacity-60">
              <RotateCw size={14} className={refreshing ? 'animate-spin' : ''} /> {refreshing ? 'Refreshing…' : 'Refresh order'}
            </button>
            <Link to="/orders" className="text-maroon font-medium hover:underline inline-flex items-center gap-1">
              <ArrowRight size={14} /> Back to Orders
            </Link>
          </div>
        </div>

        {order.paymentMethod === 'paytm' &&
          (['pending', 'uncertain'].includes(order.payment?.status || order.paymentStatus) || order.status === 'pending_payment') && (
            <div className="mb-6 p-4 rounded-xl bg-gold-50 border border-gold-200 text-sm">
              <div className="flex items-start gap-3">
                <div className="text-gold-dark mt-0.5">⏳</div>
                <div>
                  <p className="font-medium text-brown">Payment being verified</p>
                  <p className="text-brown-light">
                    The server has not confirmed a final payment result. You can recheck the status; do not place another order or assume payment failed.
                  </p>
                  <button
                    onClick={handleRecheckPayment}
                    disabled={verifying}
                    className="mt-3 text-sm font-medium text-maroon hover:underline flex items-center gap-1"
                  >
                    <RotateCw size={14} className={verifying ? 'animate-spin' : ''} />
                    {verifying ? 'Verifying…' : 'Check Payment Status'}
                  </button>
                </div>
              </div>
            </div>
          )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Order summary */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-2xl border border-cream-dark p-6">
              <h3 className="font-serif text-xl text-brown mb-4">Order Summary</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between text-brown-light">
                  <span>Order ID</span>
                  <span className="font-mono font-semibold">{order.orderNumber || order.id}</span>
                </div>
                <div className="flex justify-between text-brown-light">
                  <span>Date</span>
                  <span>{formatDateTime(order.createdAt)}</span>
                </div>
                <div className="flex justify-between text-brown-light">
                  <span>Payment method</span>
                    <span className="capitalize">{order.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-brown-light">
                  <span>Order status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusVariant(order.status)}`}>
                    {statusLabel(order.status)}
                  </span>
                </div>
                <div className="flex justify-between text-brown-light">
                  <span>Payment status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusVariant(order.payment?.status || order.paymentStatus || 'pending')}`}>
                    {paymentStatusLabel(order.payment?.status || order.paymentStatus, order.paymentMethod)}
                  </span>
                </div>
                {order.trackingId && (
                  <div className="flex justify-between text-brown-light">
                    <span>Tracking ID</span>
                    <span className="font-mono font-semibold">{order.trackingId}</span>
                  </div>
                )}
                <div className="border-t border-cream-dark pt-4 space-y-2">
                  {order.totals?.subtotal != null && <div className="flex justify-between text-brown-light"><span>Subtotal</span><span>{formatINR(order.totals.subtotal)}</span></div>}
                  {order.totals?.shipping != null && <div className="flex justify-between text-brown-light"><span>Shipping</span><span>{formatINR(order.totals.shipping)}</span></div>}
                  {order.totals?.codFee != null && order.paymentMethod === 'cod' && <div className="flex justify-between text-brown-light"><span>COD fee</span><span>{formatINR(order.totals.codFee)}</span></div>}
                  {order.totals?.discount != null && order.totals.discount > 0 && <div className="flex justify-between text-brown-light"><span>Discount</span><span>−{formatINR(order.totals.discount)}</span></div>}
                  <div className="flex justify-between text-base font-bold text-brown"><span>Total</span><span>{formatINR(order.totals?.total ?? 0)}</span></div>
                  <p className="text-xs text-brown-light">Totals are taken from the order record created by the server.</p>
                </div>
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-2xl border border-cream-dark p-6">
              <h3 className="font-serif text-xl text-brown mb-4">Items</h3>
              <div className="space-y-4">
                {(Array.isArray(order.items) ? order.items : []).map((item, index) => (
                  <div key={`${item.productId || item.id || 'item'}-${item.variantId || index}`} className="flex gap-4 border-b border-cream-dark pb-4 last:border-0 last:pb-0">
                    <div className="flex-1">
                      <p className="font-medium text-brown line-clamp-1">{item.productName || item.name || 'Product'}</p>
                      {item.variantLabel && <p className="text-xs text-brown-light">{item.variantLabel}</p>}
                      {item.variantId && item.variantId !== 'default' && (
                        <p className="text-xs text-brown-light">Variant: {item.variantId}</p>
                      )}
                      <p className="text-sm text-brown-light">Qty: {item.quantity}</p>
                      <p className="text-sm text-brown-light">
                        {formatINR(item.unitPrice ?? item.price ?? 0)} each
                      </p>
                      <p className="text-sm font-semibold text-brown">
                        Line total: {formatINR(item.lineTotal ?? ((item.unitPrice ?? item.price ?? 0) * (item.quantity || 0)))}
                      </p>
                    </div>
                  </div>
                ))}
                {(!Array.isArray(order.items) || order.items.length === 0) && (
                  <p className="text-brown-light text-sm">No item snapshots available.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Shipping address and payment details */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white rounded-2xl border border-cream-dark p-6">
              <h3 className="font-serif text-xl text-brown mb-4">Shipping Address</h3>
              <div className="space-y-2 text-sm text-brown-light">
                <p className="font-medium text-brown">{order.shippingAddress?.fullName || '—'}</p>
                <p>{order.shippingAddress?.mobile || '—'}</p>
                <p>{order.shippingAddress?.addressLine1 || '—'}</p>
                {order.shippingAddress?.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                {order.shippingAddress?.landmark && <p>{order.shippingAddress.landmark}</p>}
                <p>
                  {order.shippingAddress?.city || '—'},{' '}
                  {order.shippingAddress?.state || '—'} -{' '}
                  {order.shippingAddress?.pincode || '—'}
                </p>
              </div>
              {(!order.shippingAddress || Object.keys(order.shippingAddress).length === 0) && (
                <p className="text-brown-light text-sm">No address snapshot available.</p>
              )}
            </div>


            {order.paymentMethod === 'paytm' && order.payment && (
              <div className="bg-white rounded-2xl border border-cream-dark p-6">
                <h3 className="font-serif text-xl text-brown mb-4">Payment Details</h3>
                <div className="space-y-2 text-sm text-brown-light">
                  <p><span className="font-medium text-brown">Amount:</span> {formatINR(order.payment.amount ?? 0)}</p>
                  {order.payment.transactionRef && (
                    <p><span className="font-medium text-brown">Transaction:</span> <span className="font-mono">{order.payment.transactionRef}</span></p>
                  )}
                  {order.payment.verifiedAt && (
                    <p><span className="font-medium text-brown">Verified at:</span> {toDate(order.payment.verifiedAt)?.toLocaleString('en-IN') || '—'}</p>
                  )}
                </div>
                {order.payment.needsReview && (
                  <p className="mt-3 text-xs text-red-700 bg-red-50 p-3 rounded">
                    ⚠️ This payment needs manual review. Please contact support.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {order.status === 'expired' && (
          <div className="mt-8 p-4 rounded-xl bg-orange-50 border border-orange-200 text-sm text-orange-700">
            ⚠️ This order has expired. If money was deducted, please contact support with your order ID.
          </div>
        )}
      </div>
    </>
  )
}


function paymentStatusLabel(status, method) {
  if (status === 'paid') return 'Paid'
  if (status === 'collected') return 'Cash collected'
  if (status === 'failed') return 'Failed'
  if (status === 'uncertain') return 'Needs verification'
  if (status === 'pending') return method === 'cod' ? 'Due on delivery' : 'Pending'
  return status ? String(status).replaceAll('_', ' ') : 'Not available'
}
