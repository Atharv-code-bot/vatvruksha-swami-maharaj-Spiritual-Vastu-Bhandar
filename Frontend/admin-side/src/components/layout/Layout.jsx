import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, ChevronDown } from 'lucide-react'
import { useAdminAuth } from '../../context/AuthContext'
import ProfilePanel from './ProfilePanel.jsx'

const links = [
  { label: 'Overview', to: '/admin', end: true },
  { label: 'Orders', to: '/admin/orders' },
  { label: 'Products', to: '/admin/products' },
  { label: 'Categories', to: '/admin/categories' },
  { label: 'Inventory', to: '/admin/inventory' },
  { label: 'Customers', to: '/admin/customers' },
  { label: 'Exceptions', to: '/admin/exceptions' },
  { label: 'Admin Roles', to: '/admin/roles' },
]

const linkClass = ({ isActive }) => `rounded-lg border px-2.5 py-2 text-sm transition-all duration-200 ${isActive ? 'border-gold/70 bg-maroon font-semibold shadow-sm ring-1 ring-gold/20' : 'border-transparent font-medium text-brown hover:border-cream-darker hover:bg-cream-dark hover:text-maroon'}`
const linkStyle = ({ isActive }) => ({ color: isActive ? '#FFF1D6' : undefined })

export default function Layout() {
  const { user, handleSignOut, isAdmin, loading } = useAdminAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [profileOpen, setProfileOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Close transient UI whenever the route changes, including programmatic navigation.
  useEffect(() => {
    setProfileOpen(false)
    setMobileMenuOpen(false)
  }, [location.pathname])

  if (loading) return null

  const handleSignOutClick = async () => {
    try {
      await handleSignOut()
      navigate('/admin/login')
    } catch {
      // The auth context surfaces sign-out errors.
    }
  }

  const initials = (user?.displayName || user?.email || 'A').trim().charAt(0).toUpperCase()

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="sticky top-0 z-40 border-b border-cream-dark bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-16 items-center justify-between gap-3 py-2">
            <NavLink to="/admin" className="flex shrink-0 items-center gap-2.5" aria-label="Vatvruksha admin home">
              <span className="text-2xl" aria-hidden="true">🪔</span>
              <span className="font-serif text-xl font-bold leading-tight text-maroon sm:text-2xl">Vatvruksha</span>
              <span className="hidden border-l border-cream-darker pl-3 text-[0.62rem] font-semibold uppercase tracking-[.17em] text-gold-dark sm:block">Admin<br />Dashboard</span>
            </NavLink>

            <nav className="hidden flex-1 items-center justify-center gap-1 xl:flex" aria-label="Admin navigation">
              {links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} className={linkClass} style={linkStyle}>{link.label}</NavLink>)}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => setProfileOpen(true)} className="group flex items-center gap-2 rounded-full border border-cream-darker bg-cream/70 p-1 pr-2 transition hover:border-gold hover:bg-gold-50" aria-label="Open profile and account settings" aria-haspopup="dialog">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-gold/70 bg-maroon font-semibold text-white shadow-sm transition group-hover:scale-105">{initials}</span>
                <ChevronDown size={15} className="hidden text-brown-light sm:block" />
              </button>
              <button type="button" onClick={() => setMobileMenuOpen((open) => !open)} className="rounded-lg p-2 text-brown hover:bg-cream-dark xl:hidden" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileMenuOpen}>{mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}</button>
            </div>
          </div>
          {mobileMenuOpen && <nav className="grid grid-cols-2 gap-2 border-t border-cream-dark py-3 sm:grid-cols-3 xl:hidden" aria-label="Mobile admin navigation">{links.map((link) => <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setMobileMenuOpen(false)} className={linkClass} style={linkStyle}>{link.label}</NavLink>)}</nav>}
        </div>
      </header>

      <main id="main-content" className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {!isAdmin && !loading ? <div className="py-20 text-center"><h1 className="mb-3 font-serif text-3xl text-brown">Access Denied</h1><p className="text-brown-light">You do not have access to this dashboard.</p></div> : <Outlet />}
      </main>

      <footer className="mt-auto border-t border-cream-dark bg-white py-5"><div className="mx-auto max-w-[1600px] px-4 text-xs text-brown-light sm:px-6 lg:px-8">© {new Date().getFullYear()} Vatvruksha Swami Maharaj Spiritual Vastu Bhandar.</div></footer>
      <ProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} onSignOut={handleSignOutClick} />
    </div>
  )
}
