import { Link } from 'react-router-dom'
import { Heart, ShoppingCart, Eye } from 'lucide-react'
import { toast } from 'react-hot-toast'
import useCartStore from '../../store/cartStore'
import useWishlistStore from '../../store/wishlistStore'
import useCartDrawerStore from '../../store/cartDrawerStore'
import { formatINR } from '../../utils/money.js'
import Image from '../ui/Image'

export default function ProductCard({ product }) {
  const addItem = useCartStore((s) => s.addItem)
  const openCart = useCartDrawerStore((s) => s.open)
  const toggleItem = useWishlistStore((s) => s.toggleItem)
  const isWishlisted = useWishlistStore((s) => s.isWishlisted(product.id))

  const variantEntries = Object.entries(product?.variants || {}).sort((a, b) => (a[1]?.sortOrder ?? 0) - (b[1]?.sortOrder ?? 0))
  const defaultEntry = variantEntries.find(([id, v]) => id === 'default' && v?.isActive !== false) || variantEntries.find(([, v]) => v?.isActive !== false)
  const defaultVariantId = defaultEntry?.[0] || 'default'
  const defaultVariant = defaultEntry?.[1]
  const price = defaultVariant?.price ?? 0 // paise
  const mrp = defaultVariant?.mrp ?? 0 // paise
  const discountPct = mrp && price < mrp ? Math.round(((mrp - price) / mrp) * 100) : null
  const stock = defaultVariant?.stock ?? 0
  const hasValidStock = typeof defaultVariant?.stock === 'number' && Number.isFinite(defaultVariant.stock) && defaultVariant.stock >= 0
  const variantIsActive = defaultVariant?.isActive !== false
  const activeVariantCount = variantEntries.filter(([, v]) => v?.isActive !== false).length
  const variantCount = activeVariantCount

  const handleAddToCart = (e) => {
    e.preventDefault()
    if (!variantIsActive || stock === 0) return
    const added = addItem(product.id, defaultVariantId, 1, stock)
    if (!added) {
      toast.error(`Only ${stock} unit(s) are currently available.`)
      return
    }
    openCart()
    toast.success(`${product.name.split('—')[0].trim()} added to cart 🛒`)
  }

  const handleWishlist = (e) => {
    e.preventDefault()
    const added = toggleItem(product)
    toast(added ? '❤️ Added to wishlist' : 'Removed from wishlist', {
      icon: added ? '❤️' : '💔',
    })
  }

  const imagePath = product?.images?.[0] ?? null

  return (
    <article className="product-card bg-white rounded-2xl overflow-hidden border border-cream-dark group relative">
      {/* Badges */}
      <div className="absolute top-3 left-3 z-10 flex flex-col items-start gap-1">
        {hasValidStock && stock === 0 && (
          <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[10px] font-bold leading-tight text-red-700 shadow-sm" role="status">
            Out of Stock
          </span>
        )}
        {hasValidStock && stock > 0 && stock <= 5 && (
          <span className="inline-flex items-center rounded-full border border-gold/60 bg-cream px-2.5 py-1 text-[10px] font-bold leading-tight text-maroon shadow-sm" role="status">
            Very Few Left
          </span>
        )}
        {discountPct && (
          <span className="badge-sale">{discountPct}% OFF</span>
        )}
        {product.tags?.includes('new') && !discountPct && (
          <span className="badge-new">New</span>
        )}
        {product.tags?.includes('best') && (
          <span className="badge-best">⭐ Best</span>
        )}
      </div>

      {/* Wishlist button */}
      <button
        onClick={handleWishlist}
        className={`absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 shadow-sm transition-all duration-200 hover:scale-110 ${
          isWishlisted ? 'text-red-500' : 'text-brown-light hover:text-red-400'
        }`}
        aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
      </button>

      {/* Product Image */}
      <Link to={`/product/${product.id}`}>
        <div className="relative aspect-square bg-cream-dark overflow-hidden">
          <Image
            src={imagePath}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Quick View Overlay */}
          <div className="absolute inset-0 bg-brown/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="flex items-center gap-1.5 bg-white text-brown text-xs font-semibold px-3 py-2 rounded-full shadow-lg">
              <Eye size={13} /> Quick View
            </span>
          </div>
        </div>
      </Link>

      {/* Info */}
      <div className="p-4">
        <p className="text-[11px] text-gold font-semibold uppercase tracking-wider mb-1">
          {product.color || defaultVariant?.label || ''}
        </p>
        <Link to={`/product/${product.id}`}>
          <h3 className="font-serif text-sm font-semibold text-brown leading-snug line-clamp-2 hover:text-maroon transition-colors mb-2">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex text-gold" aria-label={`Rating: ${Number(product.rating) || 0} out of 5`}>
            {[1,2,3,4,5].map((star) => (
              <svg key={star} className="w-3 h-3" viewBox="0 0 20 20" fill={star <= Math.round(Number(product.rating) || 0) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <span className="text-[11px] text-brown-light">({Number(product.reviewCount) || 0})</span>
        </div>

        {/* Price + Cart */}
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="price-sale">{formatINR(price)}</span>
            {mrp && price < mrp && (
              <span className="price-original ml-1.5">{formatINR(mrp)}</span>
            )}
            {variantCount > 1 && (
              <span className="ml-2 text-[10px] text-brown-light bg-cream px-2 py-0.5 rounded">
                {variantCount} variants
              </span>
            )}
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!defaultVariant || !variantIsActive || stock === 0}
            className="flex items-center gap-1 bg-maroon text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-maroon-dark transition-all hover:shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Add ${product.name} to cart`}
          >
            <ShoppingCart size={13} />
            <span className="hidden sm:inline">Add</span>
          </button>
        </div>
      </div>
    </article>
  )
}
