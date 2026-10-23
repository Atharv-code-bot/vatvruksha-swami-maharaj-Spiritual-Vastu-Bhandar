import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Heart, ShoppingBag } from 'lucide-react'
import useWishlistStore from '../store/wishlistStore'
import ProductCard from '../components/product/ProductCard'

export default function WishlistPage() {
  const items = useWishlistStore((s) => s.items)

  return (
    <>
      <Helmet>
        <title>Wishlist — Vatvruksha Spiritual Vastu Bhandar</title>
        <meta name="description" content="Save your favourite spiritual idols and pooja essentials in your wishlist." />
      </Helmet>

      <div className="bg-cream-dark border-b border-cream-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav aria-label="Breadcrumb" className="text-xs text-brown-light">
            <Link to="/" className="hover:text-maroon">Home</Link>
            <span className="mx-2">›</span>
            <span className="text-brown font-medium">Wishlist</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-gold font-semibold">Saved Items</p>
            <h1 className="font-serif text-3xl md:text-4xl text-brown mt-2">My Wishlist</h1>
          </div>
          <div className="text-brown-light text-sm">{items.length} items</div>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-cream-dark p-10 text-center">
            <div className="text-6xl mb-4">💝</div>
            <h2 className="font-serif text-3xl text-brown mb-3">No items saved yet</h2>
            <p className="text-brown-light mb-6 max-w-lg mx-auto">
              Add your favourite spiritual idols to your wishlist and compare later whenever you’re ready to order.
            </p>
            <Link to="/shop" className="btn-primary inline-flex items-center gap-2">
              <ShoppingBag size={18} /> Explore Shop
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
