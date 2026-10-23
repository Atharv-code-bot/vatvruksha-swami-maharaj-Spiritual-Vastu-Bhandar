import { Helmet } from 'react-helmet-async'
import HeroBanner from '../components/home/HeroBanner'
import CategoryTile from '../components/product/CategoryTile'
import ProductCard from '../components/product/ProductCard'
import TabbedProducts from '../components/home/TabbedProducts'
import SectionTitle from '../components/ui/SectionTitle'
import { useCatalogue } from '../context/CatalogueContext'
import {
  Package, Star, Truck, HeartHandshake,
  Shield, Leaf, Award, Clock,
} from 'lucide-react'

const whyChooseUs = [
  {
    num: '01',
    icon: <Award size={28} />,
    title: 'Authentic Craftsmanship',
    desc: 'Every murti is handcrafted by skilled artisans using traditional techniques passed down through generations. We never compromise on quality.',
  },
  {
    num: '02',
    icon: <Leaf size={28} />,
    title: 'Sacred Materials Only',
    desc: 'We use only pure brass, panchadhatu, marble, and natural materials — no cheap plastic or toxic paints. Your idol deserves the finest.',
  },
  {
    num: '03',
    icon: <HeartHandshake size={28} />,
    title: 'Blessed & Consecrated',
    desc: 'Our murtis are energised through traditional Prana Pratishtha rituals, bringing positive energy and divine blessings into your home.',
  },
  {
    num: '04',
    icon: <Truck size={28} />,
    title: 'Safe & Fast Delivery',
    desc: 'Carefully packed with protective materials and delivered safely across all of India. Free shipping on orders above ₹2,000.',
  },
]

export default function HomePage() {
  const { products: allProducts, categories: catList } = useCatalogue()

  const featuredProducts = [...allProducts].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const featuredCategories = catList.slice(0, 9)
  const extraCategories = catList.slice(9)

  return (
    <>
      <Helmet>
        <title>Vatvruksha Swami Maharaj Spiritual Vastu Bhandar — Divine Idols & Pooja Items</title>
        <meta
          name="description"
          content="Shop authentic handcrafted Hindu god idols, brass murtis, vastu items and daily pooja essentials. Fast delivery across India. Order on WhatsApp."
        />
      </Helmet>

      {/* Hero */}
      <HeroBanner />

      {/* ── Deity Category Grid ── */}
      <section className="py-16 bg-cream" aria-labelledby="categories-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title="Shop by Deity"
            subtitle="Find the perfect murti for every beloved deity"
          />

          {/* Main 9 deity tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
            {featuredCategories.map((cat) => (
              <CategoryTile key={cat.id} category={cat} />
            ))}
          </div>

          {/* Extra 3 categories */}
          <div className="grid grid-cols-3 gap-4 md:gap-6">
            {extraCategories.map((cat) => (
              <CategoryTile key={cat.id} category={cat} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Our Collection ── */}
      <section className="py-16 bg-white" aria-labelledby="collection-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle
            id="collection-heading"
            title="Our Collection"
            subtitle="Handpicked divine idols and spiritual items for your sacred space"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {featuredProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="/shop" className="btn-gold inline-block">
              Shop All Products
            </a>
          </div>
        </div>
      </section>

      {/* ── Tabbed Products ── */}
      <TabbedProducts />

      {/* ── Why Choose Us ── */}
      <section className="py-16 bg-cream" aria-labelledby="why-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle
            id="why-heading"
            title="Why Choose Us"
            subtitle="We've been trusted by devotees across Maharashtra for over two decades"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {whyChooseUs.map((item) => (
              <div
                key={item.num}
                className="flex gap-5 bg-white rounded-2xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300"
              >
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 bg-maroon-50 rounded-xl flex items-center justify-center text-maroon">
                    {item.icon}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gold">
                      {item.num}
                    </span>
                    <h3 className="font-serif text-lg font-bold text-brown">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-sm text-brown-light leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>



    </>
  )
}
