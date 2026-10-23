import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import useCartStore from '../store/cartStore'
import { useCatalogue } from '../context/CatalogueContext'
import { useAuth } from '../context/AuthContext'
import {
  callCreateCodOrder,
  callCreatePaytmOrder,
  callVerifyPaytmPayment,
  generateRequestId,
} from '../functions/checkout'
import { fetchAddresses } from '../functions/addresses'
import { formatINR } from '../utils/money.js'

const PAYMENT_METHOD = { COD: 'cod' } // Paytm temporarily disabled
const REQUEST_ID_REGEX = /^[A-Za-z0-9_-]{8,128}$/

const isRequestIdValid = (id) => REQUEST_ID_REGEX.test(id)

export default function CheckoutPage() {
  // ── All hooks must be called unconditionally, before any early return ──
  const navigate = useNavigate()
  const { user, isEmailVerified, refreshVerification } = useAuth()
  const items = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clearCart)
  const { products: allProducts } = useCatalogue()

  const productById = {}
  allProducts.forEach((p) => {
    productById[p.id] = p
  })

  const hasUnavailableItems = items.some(item => {
    const product = productById[item.productId]
    const variant = product?.variants?.[item.variantId]
    return !product || product.isActive === false || !variant || variant.isActive === false || !Number.isInteger(variant.stock) || variant.stock < 1 || item.quantity > variant.stock
  })

  const subtotal = items.reduce((sum, item) => {
    const product = productById[item.productId]
    const price = product?.variants?.[item.variantId]?.price ?? 0
    return sum + price * item.quantity
  }, 0)

  const [requestId] = useState(() => {
    const id = generateRequestId()
    return isRequestIdValid(id) ? id : 'default-request-id'
  })

  const [form, setForm] = useState({
    fullName: '',
    mobile: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
  })
  const [errors, setErrors] = useState({})

  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHOD.COD)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState('form') // 'form' | 'processing' | 'confirm' | 'paytm' | 'error'
  const [orderResult, setOrderResult] = useState(null)
  const [paytmError, setPaytmError] = useState(null)
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)

  // Saved addresses
  const [savedAddresses, setSavedAddresses] = useState([])
  const [useSavedAddress, setUseSavedAddress] = useState(null)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      try {
        const data = await fetchAddresses(user.uid)
        setSavedAddresses(data)
      } catch {} // addresses optional — checkout still works with one-time form
    }
    load()
  }, [user])

  // Keep the viewport stable during payment verification and prevent the page
  // from jumping to the footer while the payment provider/callback is active.
  useEffect(() => {
    if (!isVerifyingPayment) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isVerifyingPayment])

  const fillFormFromAddress = (addr) => {
    setForm({
      fullName: addr.fullName || '',
      mobile: addr.mobile || '',
      addressLine1: addr.addressLine1 || '',
      addressLine2: addr.addressLine2 || '',
      landmark: addr.landmark || '',
      city: addr.city || '',
      state: addr.state || '',
      pincode: addr.pincode || '',
    })
    setUseSavedAddress(addr.id)
  }

  if (items.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <CheckCircle2 className="mx-auto text-green-600 mb-4" size={48} />
        <h1 className="font-serif text-4xl text-brown mb-3">Your cart is empty</h1>
        <p className="text-brown-light mb-8">
          Please add products before proceeding to checkout.
        </p>
        <Link to="/shop" className="btn-primary inline-flex items-center gap-2">
          Browse products <ArrowRight size={16} />
        </Link>
      </div>
    )
  }

  const validateForm = (f) => {
    const e = {}
    if (!f.fullName.trim()) e.fullName = 'Full name is required.'
    if (!/^\d{10}$/.test(f.mobile.trim()))
      e.mobile = 'Enter a valid 10-digit mobile number.'
    if (!f.addressLine1.trim()) e.addressLine1 = 'Address line 1 is required.'
    if (!f.city.trim()) e.city = 'City is required.'
    if (!f.state.trim()) e.state = 'State is required.'
    if (!/^\d{6}$/.test(f.pincode.trim()))
      e.pincode = 'Enter a valid 6-digit pincode.'
    return e
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const buildItemsPayload = () =>
    items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    }))

  const buildShippingAddress = () => {
    const addr = {
      fullName: form.fullName,
      mobile: form.mobile,
      addressLine1: form.addressLine1,
      city: form.city,
      state: form.state,
      pincode: form.pincode,
    }
    if (form.addressLine2) addr.addressLine2 = form.addressLine2
    if (form.landmark) addr.landmark = form.landmark
    return addr
  }

  // ── COD flow ──
  const handleCOD = async () => {
    if (hasUnavailableItems) { toast.error('Please return to your cart and resolve unavailable items or stock quantities.'); return }
    setLoading(true)
    setStage('processing')
    try {
      const request = {
        requestId,
        items: buildItemsPayload(),
        shippingAddress: buildShippingAddress(),
      }
      const resp = await callCreateCodOrder(request)
      const data = resp.data || resp
      const orderId = data.orderId || data.orderNumber
      if (!orderId) {
        setPaytmError('The server response did not include an order ID. The order may still exist; do not start a new attempt until the result is checked.')
        setStage('error')
        return
      }
      setOrderResult({
        orderId,
        total: subtotal,
        paymentMethod: 'cod',
        paymentStatus: data.paymentStatus ?? data.payment?.status ?? 'pending',
      })
      // A successful callable response is the only point at which COD clears the cart.
      clearCart()
      toast.success('Order placed successfully (Cash on Delivery).')
      setStage('confirm')
    } catch (err) {
      const code = err?.code ?? ''
      const message = err?.message ?? ''

      if (code === 'unavailable' || code === 'deadline-exceeded') {
        setPaytmError(
          'The request timed out. We will check for an existing order before creating a duplicate.'
        )
        setStage('error')
        return
      }

      if (code === 'invalid-argument') {
        setErrors({ _form: message || 'Invalid request. Please check your details.' })
        return
      }

      setPaytmError(message || 'Could not place order. Please try again.')
      setStage('error')
    } finally {
      setLoading(false)
    }
  }

  // ── Paytm flow ──
  const handlePaytm = async () => {
    if (hasUnavailableItems) { toast.error('Please return to your cart and resolve unavailable items or stock quantities.'); return }
    setLoading(true)
    setStage('processing')
    try {
      const request = {
        requestId,
        items: buildItemsPayload(),
        shippingAddress: buildShippingAddress(),
      }
      const resp = await callCreatePaytmOrder(request)
      const data = resp.data || resp
      // The HTML reference returns Paytm credentials under result.payment.
      const payment = data.payment || data
      const orderId = data.orderId || data.orderNumber
      const { mid, txnToken, amount, environment } = payment

      setOrderResult({
        orderId,
        total: subtotal,
        paymentMethod: 'paytm',
        paymentStatus: 'pending',
      })

      if (!orderId || !mid || !txnToken || amount == null || !environment) {
        setPaytmError('The backend created or may have created a pending order, but its Paytm response is incomplete. Do not submit a new order; check payment status or contact support.')
        setStage('error')
        return
      }
      // Never launch production payment checkout from this customer frontend until
      // production mode has been explicitly approved and verified.
      if (String(environment).toLowerCase() === 'production') {
        setPaytmError('A pending order was created, but Paytm checkout was blocked because the backend reports production mode. Contact support before retrying.')
        setStage('error')
        return
      }
      setStage('paytm')
      await launchPaytmCheckout({ mid, txnToken, amount, environment, orderId })
    } catch (err) {
      const code = err?.code ?? ''
      const message = err?.message ?? ''

      if (code === 'unavailable' || code === 'deadline-exceeded') {
        setPaytmError(
          'The payment request timed out. We will check for an existing order before retrying.'
        )
        setStage('error')
        return
      }

      setPaytmError(message || 'Could not initiate payment. Please try again.')
      setStage('error')
    } finally {
      setLoading(false)
    }
  }

  // Match the tested HTML workflow: merchant-specific CheckoutJS, server
  // credentials, and server-side verification after every transaction callback.
  const launchPaytmCheckout = async ({ mid, txnToken, amount, environment, orderId }) => {
    const host = String(environment).toLowerCase() === 'production'
      ? 'https://secure.paytmpayments.com'
      : 'https://securestage.paytmpayments.com'
    const scriptUrl = `${host}/merchantpgpui/checkoutjs/merchants/${encodeURIComponent(mid)}.js`

    return new Promise((resolve) => {
      const existing = document.querySelector('script[data-paytm-checkout="true"]')
      if (existing) existing.remove()
      try { delete window.Paytm } catch { /* browser may disallow deleting globals */ }

      const script = document.createElement('script')
      script.src = scriptUrl
      script.async = true
      script.crossOrigin = 'anonymous'
      script.dataset.paytmCheckout = 'true'

      const verifyFromServer = async () => {
        try {
          // Use the order ID returned by the backend directly. React state may
          // not have committed setOrderResult yet when Paytm fires its callback.
          await handleVerifyPayment(orderId)
          resolve()
        } catch {
          // handleVerifyPayment owns UI state and user-facing error handling.
          resolve()
        }
      }

      script.onload = () => {
        if (!window.Paytm?.CheckoutJS) {
          setPaytmError('Paytm CheckoutJS loaded without the expected API. The order may still be pending. Use Check Payment Status before attempting another order.')
          setStage('error')
          resolve()
          return
        }

        let callbackReceived = false
        const config = {
          // Mount CheckoutJS inside the checkout page's dedicated container,
          // rather than letting it choose a root at the end of the document.
          root: '#paytm-checkout-root',
          flow: 'DEFAULT',
          data: {
            orderId,
            token: txnToken,
            tokenType: 'TXN_TOKEN',
            amount: String(amount),
          },
          merchant: { mid, redirect: false },
          handler: {
            notifyMerchant: (eventName) => {
              if ((eventName === 'APP_CLOSED' || eventName === 'SESSION_EXPIRED') && !callbackReceived) {
                void verifyFromServer()
              }
            },
            transactionStatus: () => {
              callbackReceived = true
              try { window.Paytm.CheckoutJS.close() } catch { /* checkout may already be closed */ }
              void verifyFromServer()
            },
          },
        }

        try {
          window.Paytm.CheckoutJS.onLoad(() => {
            window.Paytm.CheckoutJS.init(config)
              .then(() => {
                window.Paytm.CheckoutJS.invoke()
                resolve()
              })
              .catch(() => {
                setPaytmError('Paytm checkout could not be initialized. The order may remain pending; check its payment status before retrying.')
                setStage('error')
                resolve()
              })
          })
        } catch {
          setPaytmError('Paytm checkout could not be started. The order may remain pending; check its payment status before retrying.')
          setStage('error')
          resolve()
        }
      }

      script.onerror = () => {
        setPaytmError('Paytm CheckoutJS could not load. The order may remain pending; check its payment status before retrying.')
        setStage('error')
        resolve()
      }
      document.head.appendChild(script)
    })
  }

  // Verify Paytm payment with backend (owner-only callable)
  const handleVerifyPayment = async (knownOrderId = orderResult?.orderId) => {
    if (!knownOrderId || isVerifyingPayment) return
    setLoading(true)
    setIsVerifyingPayment(true)
    setPaytmError(null)
    try {
      const resp = await callVerifyPaytmPayment({ orderId: knownOrderId })
      const data = resp.data || resp
      const status = data.status
      const paymentStatus = data.paymentStatus ?? data.payment?.status
      const ok = data.ok

      // A missing optional `ok` flag is not itself a failure. Known staging issue:
      // functions/data-loss — could not be authenticated.
      if (ok === false || status === 'data-loss' || paymentStatus === 'data-loss' || data.code === 'data-loss') {
        setPaytmError(
          'We could not verify payment yet; check again. Please use "Check Payment Status" below.'
        )
        setStage('error')
        return
      }

      setOrderResult((prev) => ({
        ...prev,
        status,
        paymentStatus: paymentStatus ?? 'uncertain',
      }))

      if (paymentStatus === 'paid' || data.payment?.status === 'paid') {
        setStage('confirm')
        toast.success('Payment verified. Order confirmed.')
        clearCart()
        // Navigate only after the backend confirms payment as paid.
        // Keep pending/uncertain and failed payment handling unchanged.
        navigate(`/orders/${encodeURIComponent(knownOrderId)}`, { replace: true })
      } else if (paymentStatus === 'failed' || data.payment?.status === 'failed') {
        setStage('error')
        setPaytmError(
          'Payment failed. Please contact support if money was deducted.'
        )
      } else {
        setStage('error')
        setPaytmError(
          'Payment is still pending or its final state is uncertain. Please check again shortly. Do not create another order or assume payment failed.'
        )
      }
    } catch (err) {
      setPaytmError(
        err?.message ||
          'Verification failed. Please try again or contact support.'
      )
      setStage('error')
    } finally {
      setLoading(false)
      setIsVerifyingPayment(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) {
      toast.error('Please sign in before checking out.')
      return
    }
    try {
      const verifiedNow = await refreshVerification()
      if (!verifiedNow) {
        toast.error('Please verify your email, then return to checkout.')
        return
      }
    } catch {
      toast.error('Could not refresh your verification status. Please try again.')
      return
    }
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Please fix the highlighted details.')
      return
    }

    // Paytm is temporarily disabled. Keep its implementation below commented
    // out of the checkout flow until the payment service is reopened.
    handleCOD()
    // if (paymentMethod === PAYMENT_METHOD.PAYTM) {
    //   handlePaytm()
    // }
  }

  const handleRetry = () => {
    setPaytmError(null)
    setStage('form')
    setLoading(false)
  }

  const isPaytmPending =
    stage === 'paytm' ||
    (stage === 'processing' && paymentMethod === PAYMENT_METHOD.PAYTM)

  return (
    <>
      <Helmet>
        <title>
          {stage === 'confirm' ? 'Order Confirmed' : 'Checkout'} — Vatvruksha
          Spiritual Vastu Bhandar
        </title>
        <meta
          name="description"
          content={stage === 'confirm'
            ? 'Your order has been confirmed.'
            : 'Place your order with Cash on Delivery.'}
        />
      </Helmet>

      {/* ── Confirmation screen ── */}
      {stage === 'confirm' && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <CheckCircle2 className="mx-auto text-green-600 mb-6" size={64} />
          <h1 className="font-serif text-4xl text-brown mb-3">
            Order Confirmed 🙏
          </h1>
          <p className="text-brown-light mb-8">
            Thank you for your order. Your order ID is{' '}
            <span className="font-mono font-semibold text-maroon">
              {orderResult?.orderId}
            </span>
          </p>

          <div className="bg-white rounded-2xl border border-cream-dark p-8 inline-block text-left">
            <div className="space-y-4 text-sm">
              <div className="flex justify-between text-brown-light">
                <span>Order ID</span>
                <span className="font-mono font-semibold">
                  {orderResult?.orderId}
                </span>
              </div>
              <div className="flex justify-between text-brown-light">
                <span>Payment method</span>
                <span>
                  {orderResult?.paymentMethod === 'cod'
                    ? 'Cash on Delivery'
                    : 'Paytm'}
                </span>
              </div>
              <div className="flex justify-between text-brown-light">
                <span>Payment status</span>
                <span className="font-medium">
                  {orderResult?.paymentStatus === 'pending'
                    ? 'Pending (cash to collect)'
                    : orderResult?.paymentStatus === 'paid'
                    ? 'Paid'
                    : orderResult?.paymentStatus}
                </span>
              </div>
              <div className="border-t border-cream-dark pt-4 flex justify-between text-base font-bold text-brown">
                <span>Total</span>
                <span>{formatINR(orderResult?.total ?? subtotal)}</span>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs text-brown-light">
            Save your order ID for reference. COD orders are confirmed while
            payment remains pending until cash is collected.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            {orderResult?.orderId && (
              <Link to={`/orders/${encodeURIComponent(orderResult.orderId)}`} className="btn-gold inline-flex items-center gap-2">
                View Order Details <ArrowRight size={16} />
              </Link>
            )}
            <Link to="/orders" className="btn-primary inline-flex items-center gap-2">
              My Orders <ArrowRight size={16} />
            </Link>
            <Link to="/shop" className="inline-flex items-center gap-2 rounded-lg border border-cream-dark px-5 py-3 font-medium text-maroon hover:bg-cream">
              Continue Shopping <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}

      {/* ── Error screen ── */}
      {stage === 'error' && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="bg-white rounded-2xl border border-cream-dark p-8 text-center">
            <AlertCircle className="mx-auto text-red-600 mb-6" size={48} />
            <h2 className="font-serif text-2xl text-brown mb-2">
              Something went wrong
            </h2>
            <p className="text-brown-light mb-6">{paytmError}</p>
            {orderResult?.orderId && (
              <div className="mb-6 text-left bg-maroon-50 rounded-xl p-4 text-sm">
                <p className="font-semibold text-maroon mb-2">
                  Your order may already exist: {orderResult.orderId}
                </p>
                <p className="text-brown-light mb-4">
                  Avoid placing another order while this result is uncertain.
                </p>
                <Link
                  to={`/orders/${encodeURIComponent(orderResult.orderId)}`}
                  className="inline-flex items-center gap-2 font-semibold text-maroon underline"
                >
                  View order and payment status <ArrowRight size={15} />
                </Link>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {!orderResult?.orderId && (
                <button
                  onClick={handleRetry}
                  className="btn-primary inline-flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} /> Try Again
                </button>
              )}
              {/* Paytm payment-status action temporarily disabled. */}
            </div>
          </div>
        </div>
      )}

      {/* Paytm pending screen temporarily disabled while Paytm is closed.
      {isPaytmPending && (
        <div className="max-w-md mx-auto px-4 py-16">
          <div id="paytm-checkout-root" className="relative bg-white rounded-2xl border border-cream-dark p-8 text-center">
            <Loader2 className="mx-auto text-maroon mb-6 animate-spin" size={32} />
            <h2 className="font-serif text-2xl text-brown mb-3">Redirecting to Paytm…</h2>
            <p className="text-brown-light mb-6">Please complete the payment on the Paytm page. Do not close this tab until you return.</p>
            <p className="text-xs text-brown-light">Order: {orderResult?.orderId}</p>
          </div>
        </div>
      )}
      */}

      {/* ── COD order creation progress ── */}
      {stage === 'processing' && paymentMethod === PAYMENT_METHOD.COD && (
        <div
          className="min-h-[55vh] max-w-md mx-auto px-4 py-16 flex items-center justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="w-full bg-white rounded-2xl border border-cream-dark p-8 text-center shadow-sm">
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-4 border-cream-dark" />
              <span className="absolute inset-0 rounded-full border-4 border-maroon border-t-transparent animate-spin" />
              <Loader2 className="text-maroon animate-spin" size={30} aria-hidden="true" />
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-brown mb-3">
              Placing your order…
            </h1>
            <p className="text-brown-light text-sm leading-6">
              Please wait while we securely submit your Cash on Delivery order.
              Do not refresh or close this page.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-brown-light">
              <span className="h-2 w-2 rounded-full bg-maroon animate-pulse" />
              Confirming order with Vatvruksha
            </div>
          </div>
        </div>
      )}

      {/* ── Payment verification overlay ── */}
      {isVerifyingPayment && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-8"
          role="status"
          aria-live="polite"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded-2xl border border-cream-dark bg-white p-8 text-center shadow-2xl">
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-4 border-cream-dark" />
              <span className="absolute inset-0 rounded-full border-4 border-maroon border-t-transparent animate-spin" />
              <Loader2 className="text-maroon animate-spin" size={30} aria-hidden="true" />
            </div>
            <h2 className="mb-3 font-serif text-2xl text-brown">Verifying your payment…</h2>
            <p className="text-sm leading-6 text-brown-light">
              Please wait while we confirm your payment status securely. Do not refresh or close this page.
            </p>
          </div>
        </div>
      )}

      {/* ── Checkout form ── */}
      {stage === 'form' && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="bg-cream-dark border-b border-cream-darker">
            {hasUnavailableItems && <div className="max-w-7xl mx-auto px-4 pt-6"><div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">One or more cart items are no longer available or exceed current stock. Return to your cart to resolve them before placing an order.</div><Link to="/cart" className="mt-2 inline-block text-sm font-semibold text-maroon underline">Return to cart</Link></div>}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <nav aria-label="Breadcrumb" className="text-xs text-brown-light">
                <Link to="/" className="hover:text-maroon">Home</Link>
                <span className="mx-2">›</span>
                <Link to="/cart" className="hover:text-maroon">Cart</Link>
                <span className="mx-2">›</span>
                <span className="text-brown font-medium">Checkout</span>
              </nav>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-cream-dark p-6 md:p-8 shadow-sm space-y-6">
              <h1 className="font-serif text-3xl text-brown mb-2">Checkout</h1>
              <p className="text-brown-light text-sm">
                Please verify your shipping details before placing your order.
              </p>

              {/* Payment method */}
              <div className="border border-cream-dark rounded-xl p-4 bg-cream/40">
                <p className="text-sm font-medium text-brown mb-3">
                  Payment method
                </p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={PAYMENT_METHOD.COD}
                      checked={paymentMethod === PAYMENT_METHOD.COD}
                      onChange={() => setPaymentMethod(PAYMENT_METHOD.COD)}
                      className="accent-maroon rounded"
                    />
                    Cash on Delivery
                  </label>
                  {/* Paytm temporarily disabled; restore this option when payments reopen.
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="paytm"
                      checked={paymentMethod === 'paytm'}
                      onChange={() => setPaymentMethod('paytm')}
                      className="accent-maroon rounded"
                    />
                    Paytm
                  </label>
                  */}
                </div>
                {paymentMethod === PAYMENT_METHOD.COD && (
                  <p className="mt-2 text-xs text-brown-light">
                    Cash collected on delivery. Order is confirmed while payment remains pending.
                  </p>
                )}
                {/* Paytm payment instructions temporarily disabled. */}
              </div>

              {/* Saved address selection */}
              {user && savedAddresses.length > 0 && (
                <div className="mt-6 border border-cream-dark rounded-xl p-4 bg-cream/40">
                  <p className="text-sm font-medium text-brown mb-3">Delivery address</p>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer border border-cream-dark rounded-xl p-3 hover:bg-maroon-50 transition-colors">
                      <input
                        type="radio"
                        name="addressSource"
                        value="one-time"
                        checked={useSavedAddress === null}
                        onChange={() => setUseSavedAddress(null)}
                        className="accent-maroon rounded"
                      />
                      <span>Enter a new address</span>
                    </label>
                    {savedAddresses.map((addr) => (
                      <label
                        key={addr.id}
                        className="flex items-center gap-2 cursor-pointer border border-cream-dark rounded-xl p-3 hover:bg-maroon-50 transition-colors"
                      >
                        <input
                          type="radio"
                          name="addressSource"
                          value={addr.id}
                          checked={useSavedAddress === addr.id}
                          onChange={() => fillFormFromAddress(addr)}
                          className="accent-maroon rounded"
                        />
                        <div>
                          <p className="text-sm font-medium text-brown">
                            {addr.fullName}
                          </p>
                          <p className="text-xs text-brown-light">
                            {addr.addressLine1}, {addr.city}, {addr.state} - {addr.pincode}
                          </p>
                          {addr.isDefault && (
                            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded">
                              Default
                            </span>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brown mb-1">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    className={`w-full rounded-xl border px-3 py-2.5 ${
                      errors.fullName ? 'border-red-400' : 'border-cream-dark'
                    }`}
                    required
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-xs text-red-600">{errors.fullName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-brown mb-1">
                    Mobile Number
                  </label>
                  <input
                    id="mobile"
                    name="mobile"
                    value={form.mobile}
                    onChange={handleChange}
                    className={`w-full rounded-xl border px-3 py-2.5 ${
                      errors.mobile ? 'border-red-400' : 'border-cream-dark'
                    }`}
                    required
                  />
                  {errors.mobile && (
                    <p className="mt-1 text-xs text-red-600">{errors.mobile}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-brown mb-1">
                  Address Line 1
                </label>
                <input
                  id="addressLine1"
                  name="addressLine1"
                  value={form.addressLine1}
                  onChange={handleChange}
                  className={`w-full rounded-xl border px-3 py-2.5 ${
                    errors.addressLine1 ? 'border-red-400' : 'border-cream-dark'
                  }`}
                  required
                />
                {errors.addressLine1 && (
                  <p className="mt-1 text-xs text-red-600">{errors.addressLine1}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-brown mb-1">
                  Address Line 2 (optional)
                </label>
                <input
                  id="addressLine2"
                  name="addressLine2"
                  value={form.addressLine2}
                  onChange={handleChange}
                  className="w-full rounded-xl border px-3 py-2.5 border-cream-dark"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-brown mb-1">
                  Landmark (optional)
                </label>
                <input
                  id="landmark"
                  name="landmark"
                  value={form.landmark}
                  onChange={handleChange}
                  className="w-full rounded-xl border px-3 py-2.5 border-cream-dark"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-brown mb-1">
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    className={`w-full rounded-xl border px-3 py-2.5 ${
                      errors.city ? 'border-red-400' : 'border-cream-dark'
                    }`}
                    required
                  />
                  {errors.city && (
                    <p className="mt-1 text-xs text-red-600">{errors.city}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-brown mb-1">
                    State
                  </label>
                  <input
                    id="state"
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    className={`w-full rounded-xl border px-3 py-2.5 ${
                      errors.state ? 'border-red-400' : 'border-cream-dark'
                    }`}
                    required
                  />
                  {errors.state && (
                    <p className="mt-1 text-xs text-red-600">{errors.state}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-brown mb-1">
                  Pincode
                </label>
                <input
                  id="pincode"
                  name="pincode"
                  value={form.pincode}
                  onChange={handleChange}
                  className={`w-full rounded-xl border px-3 py-2.5 ${
                    errors.pincode ? 'border-red-400' : 'border-cream-dark'
                  }`}
                  required
                />
                {errors.pincode && (
                  <p className="mt-1 text-xs text-red-600">{errors.pincode}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !isEmailVerified || hasUnavailableItems}
                className="btn-primary w-full py-4 inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Processing…
                  </>
                ) : paymentMethod === PAYMENT_METHOD.COD ? (
                  <>
                    <ArrowRight size={16} /> Place Order (COD)
                  </>
                ) : (
                  <>
                    <ArrowRight size={16} /> Pay with Paytm
                  </>
                )}
              </button>
            </form>

            <aside className="bg-white rounded-2xl border border-cream-dark p-6 shadow-sm h-fit">
              <h2 className="font-serif text-2xl text-brown mb-4">Your Order</h2>

              <div className="space-y-3">
                {items.map((item) => {
                  const product = productById[item.productId]
                  const variant = product?.variants?.[item.variantId]
                  const price = variant?.price ?? 0
                  if (!product) return null
                  return (
                    <div
                      key={`${item.productId}-${item.variantId}`}
                      className="flex justify-between gap-3 text-sm border-b border-cream-dark pb-2"
                    >
                      <div>
                        <p className="font-medium text-brown line-clamp-1">
                          {product.name}
                        </p>
                        <p className="text-brown-light">
                          {variant?.label && variant.label !== 'default'
                            ? variant.label
                            : 'Default'}
                          × {item.quantity}
                        </p>
                      </div>
                      <span className="font-semibold text-brown">
                        {formatINR(price * item.quantity)}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 space-y-2 border-t border-cream-dark pt-4 text-sm">
                <div className="flex justify-between text-brown-light">
                  <span>Subtotal</span>
                  <span>{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-brown">
                  <span>Total</span>
                  <span>{formatINR(subtotal)}</span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </>
  )
}
