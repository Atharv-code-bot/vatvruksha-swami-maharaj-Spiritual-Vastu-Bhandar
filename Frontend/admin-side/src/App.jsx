
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useNavigationType,
} from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { HelmetProvider } from 'react-helmet-async'
import { Toaster } from 'react-hot-toast'

import { AdminAuthProvider, useAdminAuth } from './context/AuthContext'

import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import UnauthorizedPage from './pages/UnauthorizedPage'
import OverviewPage from './pages/OverviewPage'
import OrdersPage from './pages/OrdersPage'
import OrderDetailPage from './pages/OrderDetailPage'
import ProductsPage from './pages/ProductsPage'
import CategoriesPage from './pages/CategoriesPage'
import InventoryPage from './pages/InventoryPage'
import CustomersPage from './pages/CustomersPage'
import ExceptionsPage from './pages/ExceptionsPage'
import AdminRolesPage from './pages/AdminRolesPage'

// Shared loading screen while Firebase restores the session or checks claims.
function AuthLoading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-cream text-brown"
      role="status"
      aria-live="polite"
    >
      <div className="text-3xl mb-4" aria-hidden="true">
        🪔
      </div>
      <p className="font-medium">Verifying your admin access…</p>
      <p className="text-sm text-brown-light mt-2">
        Please wait.
      </p>
    </div>
  )
}

// Centralized browser Back handling for admin routes.
// Works with Chrome's Back button and device/browser Back navigation
// on mobile, tablet, and desktop.
function AdminBackNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const navigationType = useNavigationType()
  const previousPathRef = useRef(location.pathname)

  useEffect(() => {
    const previousPath = previousPathRef.current
    const currentPath = location.pathname

    if (navigationType === 'POP') {
      let destination = null
      const previousSegments = previousPath.split('/').filter(Boolean)

      const wasOrderDetail =
        previousSegments.length === 3 &&
        previousSegments[0] === 'admin' &&
        previousSegments[1] === 'orders'

      const wasOrdersListing = previousPath === '/admin/orders'

      const mainSections = [
        '/admin/products',
        '/admin/categories',
        '/admin/inventory',
        '/admin/customers',
        '/admin/exceptions',
        '/admin/roles',
      ]
      const wasMainSection = mainSections.includes(previousPath)

      if (wasOrderDetail) {
        destination = '/admin/orders'
      } else if (wasOrdersListing || wasMainSection) {
        destination = '/admin'
      } else if (previousPath === '/admin' || previousPath === '/admin/') {
        destination = '/admin'
      }

      if (destination && currentPath !== destination) {
        navigate(destination, { replace: true })
        return
      }
    }

    previousPathRef.current = location.pathname
  }, [location.pathname, navigationType, navigate])

  return null
}

// Requires an authenticated Firebase user.
function RequireAuth() {
  const { user, loading } = useAdminAuth()
  const location = useLocation()

  if (loading) {
    return <AuthLoading />
  }

  if (!user) {
    return (
      <Navigate
        to="/admin/login"
        state={{ from: location }}
        replace
      />
    )
  }

  return <Outlet />
}

// Requires both the admin custom claim and a verified email.
function RequireAdmin() {
  const { isAdmin, loading } = useAdminAuth()

  if (loading) {
    return <AuthLoading />
  }

  if (!isAdmin) {
    return <Navigate to="/admin/unauthorized" replace />
  }

  return <Outlet />
}

export default function App() {
  return (
    <AdminAuthProvider>
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
                iconTheme: {
                  primary: '#C9962B',
                  secondary: '#FFF8EC',
                },
              },
            }}
          />

          <AdminBackNavigation />

          <Routes>
            <Route
              path="/admin/login"
              element={<LoginPage />}
            />

            <Route
              path="/admin/unauthorized"
              element={<UnauthorizedPage />}
            />

            <Route element={<RequireAuth />}>
              <Route element={<RequireAdmin />}>
                <Route element={<Layout />}>
                  <Route
                    path="/admin"
                    element={<OverviewPage />}
                  />

                  <Route
                    path="/admin/orders"
                    element={<OrdersPage />}
                  />

                  <Route
                    path="/admin/orders/:orderId"
                    element={<OrderDetailPage />}
                  />

                  <Route
                    path="/admin/products"
                    element={<ProductsPage />}
                  />

                  <Route
                    path="/admin/categories"
                    element={<CategoriesPage />}
                  />

                  <Route
                    path="/admin/inventory"
                    element={<InventoryPage />}
                  />

                  <Route
                    path="/admin/customers"
                    element={<CustomersPage />}
                  />

                  <Route
                    path="/admin/exceptions"
                    element={<ExceptionsPage />}
                  />

                  <Route
                    path="/admin/roles"
                    element={<AdminRolesPage />}
                  />
                </Route>
              </Route>
            </Route>

            <Route
              path="/"
              element={<Navigate to="/admin" replace />}
            />

            <Route
              path="*"
              element={<Navigate to="/admin" replace />}
            />
          </Routes>
        </BrowserRouter>
      </HelmetProvider>
    </AdminAuthProvider>
  )
}
