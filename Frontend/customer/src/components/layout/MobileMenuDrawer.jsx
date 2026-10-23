import { Link, NavLink, useNavigate } from 'react-router-dom'
import { X, ChevronRight, LogIn, LogOut } from 'lucide-react'
import { useCatalogue } from '../../context/CatalogueContext'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function MobileMenuDrawer({ isOpen, onClose, links }) {
  const { categories: catList } = useCatalogue()
  const { isAuthenticated, signOut } = useAuth()
  const navigate = useNavigate()
  const handleAuthAction = async () => {
    if (!isAuthenticated) {
      onClose()
      navigate('/login')
      return
    }
    try {
      await signOut()
      onClose()
      navigate('/')
      toast.success('You have been logged out.')
    } catch (error) {
      toast.error(error?.message || 'Could not log out. Please try again.')
    }
  }
  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed inset-y-0 left-0 z-50 w-80 bg-cream flex flex-col shadow-2xl animate-slide-up"
        style={{ animationFillMode: 'both' }}
        role="dialog"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-maroon">
          <Link to="/" onClick={onClose} className="text-cream font-serif text-lg font-bold">
            🪔 Vatvruksha
          </Link>
          <button
            onClick={onClose}
            className="p-1 text-cream/80 hover:text-cream transition-colors"
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto py-4">
          {links.map((link) => (
            <div key={link.label}>
              {link.children ? (
                <div>
                  <span className="flex items-center justify-between px-5 py-3 text-sm font-semibold text-gold-dark uppercase tracking-wider">
                    {link.label}
                  </span>
                  {link.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-2 pl-8 pr-5 py-2.5 text-sm transition-colors ${
                          isActive
                            ? 'text-maroon font-semibold bg-maroon-50'
                            : 'text-brown hover:text-maroon hover:bg-cream-dark'
                        }`
                      }
                    >
                      <ChevronRight size={14} className="text-gold flex-shrink-0" />
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              ) : (
                <NavLink
                  to={link.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors border-l-2 ${
                      isActive
                        ? 'text-maroon bg-maroon-50 border-maroon font-semibold'
                        : 'text-brown hover:text-maroon hover:bg-cream-dark border-transparent'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              )}
            </div>
          ))}

          {/* Extra categories */}
          <div className="mt-4 border-t border-cream-dark pt-4">
            <span className="px-5 text-xs font-semibold text-gold-dark uppercase tracking-wider">
              More Categories
            </span>
            {catList.slice(9).map((cat) => (
              <NavLink
                key={cat.slug}
                to={`/category/${cat.slug}`}
                onClick={onClose}
                className="flex items-center gap-2 pl-8 pr-5 py-2.5 text-sm text-brown hover:text-maroon hover:bg-cream-dark transition-colors"
              >
                <ChevronRight size={14} className="text-gold flex-shrink-0" />
                {cat.name}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Sign in / sign out */}
        <div className="px-5 pt-3 bg-cream border-t border-cream-dark">
          <button
            type="button"
            onClick={handleAuthAction}
            className="flex w-full items-center gap-3 rounded-xl border border-cream-darker px-4 py-3 text-sm font-semibold text-maroon hover:bg-cream-dark transition-colors"
          >
            {isAuthenticated ? <LogOut size={18} /> : <LogIn size={18} />}
            {isAuthenticated ? 'Log Out' : 'Log In'}
          </button>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 bg-cream-dark border-t border-cream-darker text-xs text-brown-light">
          📞 +91 80555 41777 · Order on WhatsApp
        </div>
      </div>
    </>
  )
}
