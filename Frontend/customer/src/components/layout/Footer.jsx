import { Link } from 'react-router-dom'
import {
  Phone, Mail, MapPin,
  Shield, RefreshCw, Headphones, Truck,
} from 'lucide-react'
import STORE from '../../config/store'

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

const footerLinks = {
  'Quick Links': [
    { label: 'Home', to: '/' },
    { label: 'Shop All', to: '/shop' },
    { label: 'Wishlist', to: '/wishlist' },
    { label: 'About Us', to: '/about' },
    { label: 'Contact', to: '/contact' },
  ],
}

export default function Footer() {
  return (
    <footer className="bg-brown text-cream/80 mt-0">
      {/* Trust Strip */}
      <div className="bg-maroon-dark border-b border-cream/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: <Truck size={22} />, title: 'Free Shipping', desc: 'On orders above ₹2,000' },
              { icon: <RefreshCw size={22} />, title: 'Easy Returns', desc: '7-day return policy' },
              { icon: <Headphones size={22} />, title: '24/7 Support', desc: 'Call or WhatsApp anytime' },
              { icon: <Shield size={22} />, title: 'Safe Shopping', desc: '100% secure checkout' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3">
                <div className="text-gold mt-0.5 flex-shrink-0">{item.icon}</div>
                <div>
                  <p className="text-sm font-semibold text-cream">{item.title}</p>
                  <p className="text-xs text-cream/60">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-block mb-4 rounded-md overflow-hidden bg-cream p-1.5 max-w-[15rem]">
              <img
                src="/images/vatvruksha-logo.png"
                alt="Vatvruksha Spiritual Vastu Bhandar"
                className="block w-full h-auto object-contain"
                loading="lazy"
              />
            </Link>
            <p className="text-sm text-cream/60 leading-relaxed mb-5 max-w-xs">
              Authentic handcrafted divine idols and spiritual items, curated with devotion
              for your sacred space. Serving devotees across India since decades.
            </p>
            {/* Contact */}
            <div className="space-y-2 text-sm">
              <a
                href={`tel:${STORE.phone}`}
                className="flex items-center gap-2 text-cream/70 hover:text-gold transition-colors"
              >
                <Phone size={14} /> {STORE.phone}
              </a>
              <a
                href={`mailto:${STORE.email}`}
                className="flex items-center gap-2 text-cream/70 hover:text-gold transition-colors"
              >
                <Mail size={14} /> {STORE.email}
              </a>
              <span className="flex items-start gap-2 text-cream/70">
                <MapPin size={14} className="mt-0.5 flex-shrink-0" />
                {STORE.address.full}
              </span>
            </div>
            {/* Social */}
            <div className="flex items-center gap-3 mt-5">
              <a
                href={STORE.social.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 transition-colors"
                aria-label="WhatsApp"
              >
                <WhatsAppIcon />
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="text-gold font-semibold text-sm uppercase tracking-wider mb-4">
                {heading}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-cream/60 hover:text-gold transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-cream/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-cream/40">
          <p>© {new Date().getFullYear()} {STORE.name}. All rights reserved.</p>
          <p>🙏 Made with devotion in India</p>
        </div>
      </div>
    </footer>
  )
}
