import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import ShopPage from './ShopPage'
import { useCatalogue } from '../context/CatalogueContext'

export default function CategoryPage() {
  const { getCategoryBySlug } = useCatalogue()
  const { slug } = useParams()
  const category = getCategoryBySlug(slug)

  if (!category) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-4">🙏</div>
        <h1 className="font-serif text-2xl text-brown mb-3">Category not found</h1>
        <Link to="/shop" className="btn-primary">Browse All Products</Link>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>{category.name} Idols & Murtis — Vatvruksha Bhandar</title>
        <meta
          name="description"
          content={`Shop authentic ${category.name} idols and murtis. ${category.description || ''} Fast delivery across India.`}
        />
      </Helmet>

      {/* Category Hero */}
      <div
        className="relative py-14 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${(category.color || '#C9962B')}22 0%, ${(category.color || '#C9962B')}11 100%)`,
          borderBottom: `3px solid ${(category.color || '#C9962B')}33`,
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb" className="text-xs text-brown-light mb-4">
            <Link to="/" className="hover:text-maroon">Home</Link>
            <span className="mx-2">›</span>
            <Link to="/shop" className="hover:text-maroon">Shop</Link>
            <span className="mx-2">›</span>
            <span className="text-brown font-medium">{category.name}</span>
          </nav>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-gold font-medium text-sm mb-1">{category.devanagari || ''}</p>
              <h1 className="font-serif text-4xl md:text-5xl font-bold text-brown">
                {category.name}
              </h1>
              <p className="mt-2 text-brown-light text-base max-w-xl">
                {category.description || ''}
              </p>
            </div>
          </div>
        </div>
      </div>

      <ShopPage preCategory={slug} />
    </>
  )
}
