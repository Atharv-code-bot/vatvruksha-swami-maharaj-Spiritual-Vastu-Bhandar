import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Heart, ShoppingCart, Minus, Plus, Package, Ruler, ChevronRight } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useCatalogue } from '../context/CatalogueContext'
import useCartStore from '../store/cartStore'
import useWishlistStore from '../store/wishlistStore'
import useCartDrawerStore from '../store/cartDrawerStore'
import { buildProductWhatsAppUrl } from '../utils/whatsapp'
import { formatINR } from '../utils/money.js'
import ProductCard from '../components/product/ProductCard'
import SectionTitle from '../components/ui/SectionTitle'
import Image from '../components/ui/Image'

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

export default function ProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { getProductById, getProductBySlug, getCategoryBySlug, products: allProducts, loading: catalogueLoading, error: catalogueError } = useCatalogue()
  // Resolve canonical IDs first, then exact slugs, then a conservative normalized-name
  // fallback for legacy/test URLs such as /product/test-brass-diya. Keep this page-level
  // so the shared catalogue helpers and their contracts remain unchanged.
  const normalizeProductKey = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const requestedKey = normalizeProductKey(id)
  const productsForLookup = Array.isArray(allProducts) ? allProducts : []
  const lookupKeys = requestedKey.startsWith('test-')
    ? [requestedKey, requestedKey.slice(5)]
    : [requestedKey]
  const product = getProductById(id)
    || getProductBySlug(id)
    || productsForLookup.find((item) => lookupKeys.includes(normalizeProductKey(item.slug)))
    || productsForLookup.find((item) => lookupKeys.includes(normalizeProductKey(item.name)))
    || productsForLookup.find((item) => lookupKeys.includes(normalizeProductKey(item.id)))
  const [selectedImage, setSelectedImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [selectedVariantId, setSelectedVariantId] = useState('default')

  const addItem = useCartStore((s) => s.addItem)
  const openCart = useCartDrawerStore((s) => s.open)
  const toggleItem = useWishlistStore((s) => s.toggleItem)
  const isWishlisted = useWishlistStore((s) => s.isWishlisted(id))

  if (!product && catalogueLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16" role="status" aria-live="polite">
        <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="aspect-square rounded-2xl bg-cream-dark" />
          <div className="space-y-4"><div className="h-8 w-3/4 rounded bg-cream-dark" /><div className="h-6 w-1/3 rounded bg-cream-dark" /><div className="h-24 rounded bg-cream-dark" /></div>
        </div>
        <p className="text-center text-sm text-brown-light mt-6">Loading product details…</p>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-lg mx-auto text-center px-4 py-20">
        <div className="text-5xl mb-4">🙏</div>
        <h1 className="font-serif text-2xl text-brown mb-3">{catalogueError ? 'Product details are unavailable' : 'Product not found'}</h1>
        <p className="text-brown-light text-sm mb-6">{catalogueError || 'This product may be unavailable or the link may be incorrect. Browse our active products to find what you need.'}</p>
        <Link to="/shop" className="btn-primary inline-flex justify-center">Browse All Products</Link>
      </div>
    )
  }

  const variants = product.variants || {}
  const variantIds = Object.keys(variants).sort((a, b) => (variants[a]?.sortOrder ?? 0) - (variants[b]?.sortOrder ?? 0))
  const firstActiveVariantId = variantIds.find(vid => variants[vid]?.isActive !== false) || variantIds[0] || 'default'
  const effectiveVariantId = variants[selectedVariantId]?.isActive !== false && variants[selectedVariantId] ? selectedVariantId : firstActiveVariantId
  const selectedVariant = variants[effectiveVariantId]
  const category = getCategoryBySlug(product?.categoryId)
  const related = allProducts
    .filter((p) => p.categoryId === product?.categoryId && p.id !== product.id)
    .slice(0, 4)
  const productImages = Array.isArray(product.images) ? product.images : []
  const price = selectedVariant?.price ?? 0 // paise
  const mrp = selectedVariant?.mrp ?? 0 // paise
  const discountPct = mrp && price < mrp ? Math.round(((mrp - price) / mrp) * 100) : null
  const stock = selectedVariant?.stock ?? 0
  const hasValidStock = typeof selectedVariant?.stock === 'number' && Number.isFinite(selectedVariant.stock) && selectedVariant.stock >= 0
  const variantIsActive = selectedVariant?.isActive !== false
  // The legacy WhatsApp helper expects a rupee-denominated product.price.
  // Catalogue variant prices are stored in paise, so adapt the data at this
  // page boundary instead of changing the shared helper contract.
  const whatsAppProduct = {
    ...product,
    price: Number.isFinite(price) ? price / 100 : 0,
    salePrice: undefined,
    material: product.material || product.specs?.material || 'Not specified',
    size: selectedVariant?.label || product.specs?.size || 'Standard',
  }

  const handleSelectVariant = (variantId) => {
    setSelectedVariantId(variantId)
    setQuantity(1)
  }

  const handleAddToCart = () => {
    if (!selectedVariant || !variantIsActive || stock === 0) return
    const added = addItem(product.id, effectiveVariantId, quantity, stock)
    if (!added) {
      toast.error(`Your cart would exceed the available stock of ${stock} unit(s).`)
      return
    }
    openCart()
    toast.success(
      `${quantity}× ${product.name.split('—')[0].trim()} (${
        selectedVariant?.label || effectiveVariantId
      }) added to cart 🛒`,
    )
  }

  const handleWishlist = () => {
    const added = toggleItem(product)
    toast(added ? '❤️ Added to wishlist' : 'Removed from wishlist')
  }

  const handleBuyNow = () => {
    if (!selectedVariant || !variantIsActive || stock < 1) {
      toast.error('This variant is currently unavailable.')
      return
    }
    const added = addItem(product.id, effectiveVariantId, quantity, stock)
    if (!added) {
      toast.error(`Your cart would exceed the available stock of ${stock} unit(s). Review your cart before continuing.`)
      return
    }
    navigate('/checkout')
  }

  return (
    <>
      <Helmet>
        <title>{product.name} — Vatvruksha Spiritual Vastu Bhandar</title>
        <meta
          name="description"
          content={`Buy ${product.name}. ${(product.description || '').slice(0, 130)}... Fast delivery across India.`}
        />
      </Helmet>

      {/* Breadcrumb */}
      <div className="bg-cream-dark border-b border-cream-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav aria-label="Breadcrumb" className="text-xs text-brown-light flex items-center gap-1 flex-wrap">
            <Link to="/" className="hover:text-maroon">Home</Link>
            <ChevronRight size={12} />
            <Link to="/shop" className="hover:text-maroon">Shop</Link>
            {category && (
              <>
                <ChevronRight size={12} />
                <Link to={`/category/${category.id}`} className="hover:text-maroon">{category.name}</Link>
              </>
            )}
            <ChevronRight size={12} />
            <span className="text-brown font-medium line-clamp-1">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Product */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Gallery */}
          <div>
            {/* Main image */}
            <div className="relative aspect-square bg-cream rounded-2xl overflow-hidden border border-cream-dark mb-4">
              {productImages.length > 0 ? <Image
                src={
                  selectedVariant?.imagePath
                    ? productImages.find((p) => p === selectedVariant.imagePath) || selectedVariant.imagePath
                    : productImages[selectedImage] || productImages[0]
                }
                alt={`${product.name} — view ${selectedImage + 1}`}
                className="w-full h-full object-cover"
              /> : <div className="w-full h-full flex items-center justify-center text-brown-light text-sm">Product image unavailable</div>}
              {discountPct && (
                <span className="absolute top-4 left-4 badge-sale text-sm">
                  {discountPct}% OFF
                </span>
              )}
            </div>
            {/* Thumbnails */}
            {(product.images || []).length > 1 && (
              <div className="flex gap-3">
                {(product.images || []).map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImage === i
                        ? 'border-maroon shadow-md'
                        : 'border-cream-dark hover:border-gold'
                    }`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <Image src={img} alt={`${product.name} image ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {/* Category */}
            {category && (
              <Link
                to={`/category/${category.id}`}
                className="text-xs font-semibold text-gold uppercase tracking-widest hover:text-gold-dark transition-colors"
              >
                {category.name}
              </Link>
            )}

            {/* Title */}
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-brown mt-2 leading-tight">
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-3 mt-4">
              <span className="font-serif text-3xl font-bold text-maroon">
                {formatINR(price)}
              </span>
              {mrp && price < mrp && (
                <>
                  <span className="text-lg text-gray-400 line-through">
                    {formatINR(mrp)}
                  </span>
                  <span className="badge-sale">Save {discountPct}%</span>
                </>
              )}
            </div>

            {/* Variant selector */}
            {variantIds.length > 1 && (
              <div className="mt-6">
                <label className="block text-sm font-medium text-brown mb-3">
                  Select variant
                </label>
                <div className="flex flex-wrap gap-2">
                  {variantIds.map((vid) => {
                    const v = variants[vid]
                    const isSelected = effectiveVariantId === vid
                    const isInactive = v.isActive === false
                    return (
                      <button
                        key={vid}
                        onClick={() => handleSelectVariant(vid)}
                        disabled={isInactive}
                        className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-maroon bg-maroon-50 text-maroon font-semibold shadow-sm'
                            : isInactive
                            ? 'border-cream-dark bg-gray-50 text-gray-400'
                            : 'border-cream-dark bg-white text-brown hover:border-maroon hover:text-maroon'
                        }`}
                        aria-label={v.label || vid}
                      >
                        <span
                          className={`text-xs font-semibold ${isInactive ? 'opacity-50' : ''}`}
                        >
                          {v.label || vid}
                        </span>
                        <span
                          className={`text-[10px] ${isInactive ? 'text-gray-400' : 'text-brown-light'} ${
                            isSelected ? 'font-medium' : ''
                          }`}
                        >
                          {formatINR(v.price ?? 0)}
                        </span>
                        {isInactive && (
                          <span className="text-[10px] text-red-500">Inactive</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Details */}
            <div className="flex flex-wrap gap-3 mt-4">
              <span className="flex items-center gap-1.5 text-xs bg-cream rounded-full px-3 py-1.5 text-brown">
                <Package size={12} /> {product.material}
              </span>
              <span className="flex items-center gap-1.5 text-xs bg-cream rounded-full px-3 py-1.5 text-brown">
                <Ruler size={12} /> {product.size}
              </span>
              {product.weight && (
                <span className="text-xs bg-cream rounded-full px-3 py-1.5 text-brown">
                  ⚖️ {product.weight}
                </span>
              )}
            </div>

            {/* Stock */}
            <p className={`mt-3 text-sm font-medium ${hasValidStock ? 'inline-flex max-w-full items-center rounded-full border px-3 py-1.5 font-semibold' : ''} ${
              variantIsActive === false
                ? 'border-gray-200 bg-gray-50 text-gray-500'
                : stock > 5
                ? 'border-green-200 bg-green-50 text-green-700'
                : stock > 0
                ? 'border-gold/60 bg-cream text-maroon'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
            >
              {!variantIsActive
                ? '✗ This variant is inactive'
                : stock > 5
                ? `✓ In Stock (${stock} available)`
                : stock > 0
                ? `⚡ Low Stock — Only ${stock} left!`
                : '✗ Out of Stock'}
            </p>

            {/* Divider */}
            <div className="my-5 h-px bg-gradient-to-r from-transparent via-cream-darker to-transparent" />

            {/* Quantity */}
            <div className="product-quantity-control flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4 mb-5">
              <span className="text-sm font-medium text-brown">Quantity</span>
              <div className="flex items-center gap-2 border border-cream-dark rounded-lg overflow-hidden">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 hover:bg-cream transition-colors text-brown"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>
                <span className="px-4 py-2 text-sm font-semibold text-brown min-w-[3rem] text-center">
                  {quantity}
                </span>
                <button
                  onClick={() =>
                    setQuantity(Math.min(99, stock, quantity + 1))
                  }
                  className="px-3 py-2 hover:bg-cream transition-colors text-brown"
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleAddToCart}
                disabled={!variantIsActive || stock === 0}
                className="btn-primary flex-1 flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart size={18} />
                Add to Cart
              </button>
              <button
                onClick={handleBuyNow}
                disabled={!variantIsActive || stock === 0}
                className="btn-primary flex-1 flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Buy Now
              </button>
              <button
                onClick={handleWishlist}
                className={`flex items-center justify-center gap-2 px-5 py-3 rounded-md border text-sm font-semibold transition-all ${
                  isWishlisted
                    ? 'border-red-400 text-red-500 bg-red-50 hover:bg-red-100'
                    : 'border-cream-dark text-brown hover:border-maroon hover:text-maroon'
                }`}
              >
                <Heart size={16} fill={isWishlisted ? 'currentColor' : 'none'} />
                {isWishlisted ? 'Wishlisted' : 'Wishlist'}
              </button>
            </div>

            {/* WhatsApp */}
            <a
              href={buildProductWhatsAppUrl(whatsAppProduct)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-whatsapp w-full justify-center mt-3 py-3 text-base"
            >
              <WhatsAppIcon />
              Order on WhatsApp
            </a>

            {/* Trust */}
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs text-brown-light">
              <span className="flex items-center gap-1.5">🚚 Free shipping above ₹2,000</span>
              <span className="flex items-center gap-1.5">🔄 7-day return policy</span>
              <span className="flex items-center gap-1.5">🔒 Safe & secure</span>
              <span className="flex items-center gap-1.5">🙏 Blessed by pundits</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-14 border-t border-cream-dark pt-6">
          <h2 className="font-serif text-xl font-semibold text-brown mb-3">Description</h2>
          <p className="text-brown-light leading-relaxed text-sm md:text-base max-w-3xl">
            {product.description || 'Product details will be updated soon.'}
          </p>
        </div>

        {/* Related Products */}
        {related.length > 0 && (
          <div className="mt-14">
            <SectionTitle
              title="You May Also Like"
              subtitle={`More divine ${category?.name || 'idols'} from our collection`}
              align="left"
              ornament=""
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
              {related.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
