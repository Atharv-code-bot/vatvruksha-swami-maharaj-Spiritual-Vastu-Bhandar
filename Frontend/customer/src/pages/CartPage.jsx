import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag } from 'lucide-react'
import useCartStore from '../store/cartStore'
import { useCatalogue } from '../context/CatalogueContext'
import { formatINR } from '../utils/money.js'
import Image from '../components/ui/Image'

export default function CartPage() {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const clearCart = useCartStore((s) => s.clearCart)
  const { products: allProducts } = useCatalogue()

  const productById = {}
  allProducts.forEach((p) => {
    productById[p.id] = p
  })

  // Subtotal in paise, re-looked-up from catalogue (never from cart-stored prices).
  const subtotal = items.reduce((sum, item) => {
    const product = productById[item.productId]
    const price = product?.variants?.[item.variantId]?.price ?? 0
    return sum + price * item.quantity
  }, 0)

  const total = subtotal // estimate only; final totals come from the trusted checkout function
  const hasUnavailableItems = items.some(item => {
    const product = productById[item.productId]
    const variant = product?.variants?.[item.variantId]
    return !product || product.isActive === false || !variant || variant.isActive === false || !Number.isInteger(variant.stock) || variant.stock < 1 || item.quantity > variant.stock
  })

  if (items.length === 0) {
    return (
      <>
        <Helmet>
          <title>Cart — Vatvruksha Spiritual Vastu Bhandar</title>
          <meta name="description" content="Your cart is empty. Explore handcrafted Hindu idols, vastu items and pooja essentials." />
        </Helmet>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <div className="text-6xl mb-5">🛒</div>
          <h1 className="font-serif text-4xl text-brown mb-3">Your cart is empty</h1>
          <p className="text-brown-light mb-8 max-w-lg mx-auto">
            Add your favourite deity idols, daily pooja essentials or vastu items to continue your sacred shopping journey.
          </p>
          <Link to="/shop" className="btn-primary inline-flex items-center gap-2">
            <ShoppingBag size={18} /> Continue Shopping
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>Cart — Vatvruksha Spiritual Vastu Bhandar</title>
        <meta name="description" content="Review your spiritual purchases, adjust quantities, and continue to checkout with ease." />
      </Helmet>

      <div className="bg-cream-dark border-b border-cream-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav aria-label="Breadcrumb" className="text-xs text-brown-light">
            <Link to="/" className="hover:text-maroon">Home</Link>
            <span className="mx-2">›</span>
            <span className="text-brown font-medium">Cart</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_0.9fr] gap-8">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="font-serif text-3xl md:text-4xl text-brown">My Cart</h1>
              <button
                type="button"
                onClick={clearCart}
                className="text-sm font-medium text-maroon hover:underline"
              >
                Clear cart
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-cream-dark overflow-hidden">
              {items.map((item) => {
                const product = productById[item.productId]
                const variant = product?.variants?.[item.variantId]
                const price = variant?.price ?? 0
                const lineTotal = price * item.quantity
                const imagePath =
                  product?.images?.[0] ||
                  (variant?.imagePath ?? null)

                if (!product) return (
                  <div key={`${item.productId}-${item.variantId}`} className="p-4 border-b border-cream-dark bg-amber-50 text-amber-900">
                    <p className="font-semibold">Product unavailable</p>
                    <p className="text-sm mt-1">This item is no longer in the active catalogue. Remove it before checkout.</p>
                    <button type="button" onClick={() => removeItem(item.productId, item.variantId)} className="mt-2 text-sm underline font-semibold">Remove item</button>
                  </div>
                )
                if (!variant || variant.isActive === false || !Number.isInteger(variant.stock) || variant.stock < 1) return (
                  <div key={`${item.productId}-${item.variantId}`} className="p-4 border-b border-cream-dark bg-amber-50 text-amber-900">
                    <p className="font-semibold">{product.name} — variant unavailable</p>
                    <p className="text-sm mt-1">Remove this item before checkout.</p>
                    <button type="button" onClick={() => removeItem(item.productId, item.variantId)} className="mt-2 text-sm underline font-semibold">Remove item</button>
                  </div>
                )

                return (
                  <div
                    key={`${item.productId}-${item.variantId}`}
                    className="flex flex-col sm:flex-row gap-4 p-4 border-b border-cream-dark last:border-0"
                  >
                    <Link to={`/product/${item.productId}`} className="block w-full sm:w-28">
                      <Image
                        src={imagePath}
                        alt={product.name}
                        className="w-full h-28 object-cover rounded-xl"
                      />
                    </Link>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                        <div>
                          <Link to={`/product/${item.productId}`} className="font-serif text-xl text-brown hover:text-maroon transition-colors">
                            {product.name}
                          </Link>
                          {variant && variant.label && variant.label !== 'default' && (
                            <span className="text-xs text-brown-light mt-1">
                              {variant.label}
                            </span>
                          )}
                          {item.quantity > variant.stock && (
                            <p className="mt-2 text-xs font-medium text-red-700">Only {variant.stock} unit(s) currently available. Reduce quantity to continue.</p>
                          )}
                        </div>

                        <div className="text-lg font-bold text-maroon">
                          {formatINR(lineTotal)}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
                        <div className="inline-flex items-center gap-2 border border-cream-dark rounded-lg overflow-hidden bg-cream">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.variantId,
                                item.quantity - 1,
                                variant.stock
                              )
                            }
                            className="p-2 text-brown hover:text-maroon"
                            aria-label={`Decrease quantity for ${product.name}`}
                          >
                            <Minus size={14} />
                          </button>
                          <span className="min-w-8 text-center font-semibold text-brown">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= Math.min(99, variant.stock)}
                            onClick={() =>
                              updateQuantity(
                                item.productId,
                                item.variantId,
                                item.quantity + 1,
                                variant.stock
                              )
                            }
                            className="p-2 text-brown hover:text-maroon"
                            aria-label={`Increase quantity for ${product.name}`}
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.productId, item.variantId)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:text-red-700"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 h-fit">
            <div className="bg-white rounded-2xl border border-cream-dark p-5 shadow-sm">
              <h2 className="font-serif text-2xl text-brown mb-4">Order Summary</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-brown-light">
                  <span>Subtotal</span>
                  <span>{formatINR(subtotal)}</span>
                </div>
                <div className="flex justify-between text-brown-light">
                  <span>Shipping</span>
                  <span>To be confirmed</span>
                </div>
                <div className="h-px bg-cream-dark" />
                <div className="flex justify-between text-base font-bold text-brown">
                  <span>Total</span>
                  <span>{formatINR(total)}</span>
                </div>
              </div>

              <div className="mt-5 text-xs text-brown-light">
                Shipping and COD fees are confirmed by the server at checkout.
              </div>

              {hasUnavailableItems && <p className="mt-4 text-sm text-red-700">Resolve unavailable items or quantities before continuing to checkout.</p>}
              <button
                type="button"
                disabled={hasUnavailableItems}
                onClick={() => navigate('/checkout')}
                className="btn-primary w-full mt-5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proceed to Checkout <ArrowRight size={16} />
              </button>

              <Link to="/shop" className="mt-3 block text-center text-sm font-medium text-maroon hover:underline">
                Continue shopping
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
