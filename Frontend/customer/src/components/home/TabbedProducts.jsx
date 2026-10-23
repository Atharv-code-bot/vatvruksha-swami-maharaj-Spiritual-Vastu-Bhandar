import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SectionTitle from '../ui/SectionTitle'
import ProductCard from '../product/ProductCard'
import { SkeletonCard } from '../ui/Skeleton'
import { useCatalogue } from '../../context/CatalogueContext'

const TABS = [
  { id: 'best', label: 'Featured' },
  { id: 'new', label: 'Recently added' },
  { id: 'sale', label: 'Offers' },
]

export default function TabbedProducts() {
  const [activeTab, setActiveTab] = useState('best')
  const { products, loading, error } = useCatalogue()
  const shown = useMemo(() => {
    const sorted = [...products].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    if (activeTab === 'new') return [...sorted].reverse()
    if (activeTab === 'sale') return sorted.filter(p => Object.values(p.variants || {}).some(v => v?.isActive !== false && Number(v?.mrp) > Number(v?.price)))
    return sorted
  }, [products, activeTab])

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle title="Sacred Selections" subtitle="Explore products available in our live catalogue" />
        <div className="flex justify-center gap-2 mb-10 flex-wrap">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${activeTab === tab.id ? 'bg-maroon text-white shadow-md' : 'bg-cream text-brown hover:bg-cream-dark border border-cream-dark'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        {error ? <p role="alert" className="text-center text-sm text-red-700">{error}</p> :
          loading ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">{Array.from({length:4}, (_,i) => <SkeletonCard key={i} />)}</div> :
          shown.length ? <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">{shown.slice(0,8).map(product => <ProductCard key={product.id} product={product} />)}</div> :
          <p className="text-center text-sm text-brown-light py-8">No products match this selection yet.</p>}
        <div className="text-center mt-10"><Link to="/shop" className="btn-primary inline-flex items-center gap-2">View All Products →</Link></div>
      </div>
    </section>
  )
}
