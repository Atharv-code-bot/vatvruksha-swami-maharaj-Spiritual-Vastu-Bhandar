import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'react-hot-toast'
import { Send } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CatalogueProvider } from './context/CatalogueContext'
import Layout from './components/layout/Layout'
import HomePage from './pages/HomePage'
import ShopPage from './pages/ShopPage'
import CategoryPage from './pages/CategoryPage'
import ProductPage from './pages/ProductPage'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import WishlistPage from './pages/WishlistPage'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import AccountPage from './pages/AccountPage'
import OrderHistoryPage from './pages/OrderHistoryPage'
import OrderDetailPage from './pages/OrderDetailPage'
import AddressBookPage from './pages/AddressBookPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'

// Keep a product-page runtime failure visible instead of allowing React to blank the app.
class ProductPageErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('[ProductPage] Render failed:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto px-4 py-20 text-center" role="alert">
          <div className="text-5xl mb-4">🙏</div>
          <h1 className="font-serif text-2xl text-brown mb-3">We couldn’t load this product</h1>
          <p className="text-brown-light text-sm mb-6">Something went wrong while displaying this product. Please return to the shop and try again.</p>
          <Link to="/shop" className="btn-primary inline-flex justify-center">Browse All Products</Link>
        </div>
      )
    }
    return this.props.children
  }
}

// Requires sign-in; sends unauthenticated users to login, preserving intended route.
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  // Keep protected routes from rendering blank while Firebase restores the session.
  if (loading) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center" role="status" aria-live="polite">
        <p className="text-brown-light">Checking your sign-in…</p>
      </div>
    )
  }

  return user
    ? children
    : <Navigate to="/login" replace state={{ from: location }} />
}

// Requires a complete customer profile before allowing checkout and order actions.
function RequireProfile({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  const hasValidMobile = !!profile?.mobile && /^\d{10}$/.test(String(profile.mobile).trim())
  if (!hasValidMobile) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-cream-dark p-8 md:p-10 shadow-sm text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50 text-xl">📱</span>
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700">
              Profile required
            </span>
          </div>

          <h2 className="font-serif text-3xl font-bold text-brown mb-3">Complete your account profile</h2>
          <p className="text-brown-light text-sm leading-6 mb-6">
            Before you can continue, add your 10-digit mobile number. This is required for sign-in, order updates, and delivery coordination.
          </p>

          <div className="rounded-2xl border border-cream-dark bg-cream p-4 text-left mb-6">
            <div className="grid gap-3 text-sm text-brown">
              <div className="flex items-center justify-between gap-3">
                <span className="text-brown-light">Required field</span>
                <span className="font-semibold text-brown">Mobile number</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-brown-light">Format</span>
                <span className="font-semibold text-brown">10 digits</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-brown-light">Purpose</span>
                <span className="font-semibold text-brown">Orders & support</span>
              </div>
            </div>
          </div>

          <Link to="/account" className="btn-primary inline-flex w-full items-center justify-center gap-2">
            Go to profile settings
          </Link>
        </div>
      </div>
    )
  }

  return children
}

// Requires email verification for checkout; shows verification prompt otherwise.
function RequireVerified({ children }) {
  const { user, isEmailVerified, sendVerificationEmail } = useAuth()
  const [isSendingVerification, setIsSendingVerification] = React.useState(false)
  const [verificationMessage, setVerificationMessage] = React.useState(null)

  const handleResendVerification = async () => {
    if (isSendingVerification) return
    setIsSendingVerification(true)
    setVerificationMessage(null)

    try {
      await sendVerificationEmail()
      setVerificationMessage({ type: 'success', text: 'Verification email sent. Check your inbox and spam folder.' })
    } catch (error) {
      setVerificationMessage({
        type: 'error',
        text: error?.message || 'Could not send the verification email. Please try again shortly.',
      })
    } finally {
      setIsSendingVerification(false)
    }
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isEmailVerified) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl border border-cream-dark p-8 md:p-10 shadow-sm text-center">
          <div className="text-4xl mb-4">📧</div>
          <h2 className="font-serif text-2xl font-bold text-brown mb-3">Verify your email</h2>
          <p className="text-brown-light text-sm mb-6">
            Please verify your email address before you can place an order.
          </p>
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={isSendingVerification}
            aria-busy={isSendingVerification}
            className="btn-primary mb-4 inline-flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Send size={16} /> {isSendingVerification ? 'Sending verification email…' : 'Resend verification email'}
          </button>
          {verificationMessage && (
            <p
              role={verificationMessage.type === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className={`mb-4 text-sm ${verificationMessage.type === 'error' ? 'text-red-700' : 'text-green-700'}`}
            >
              {verificationMessage.text}
            </p>
          )}
          <p className="text-xs text-brown-light">
            Check your inbox, then click the link and return here.
          </p>
        </div>
      </div>
    )
  }
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <HelmetProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#2B1A14',
                color: '#FFF8EC',
                fontFamily: 'Poppins, sans-serif',
                fontSize: '0.875rem',
                borderRadius: '0.5rem',
                boxShadow: '0 8px 32px rgba(43,26,20,0.25)',
              },
              success: {
                iconTheme: { primary: '#C9962B', secondary: '#FFF8EC' },
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<CatalogueProvider><Layout /></CatalogueProvider>}>
              <Route path="/" element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/category/:slug" element={<CategoryPage />} />
              <Route path="/product/:id" element={<ProductPageErrorBoundary><ProductPage /></ProductPageErrorBoundary>} />
              <Route path="/cart" element={<CartPage />} />
              <Route
                path="/checkout"
                element={
                  <RequireAuth>
                    <RequireProfile>
                      <RequireVerified>
                        <CheckoutPage />
                      </RequireVerified>
                    </RequireProfile>
                  </RequireAuth>
                }
              />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/orders" element={<RequireAuth><OrderHistoryPage /></RequireAuth>} />
              <Route path="/orders/:orderId" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
              <Route path="/account/addresses" element={<RequireAuth><AddressBookPage /></RequireAuth>} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </HelmetProvider>
    </AuthProvider>
  )
}
