import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Award, HeartHandshake, Leaf, Truck } from 'lucide-react'

const values = [
  {
    icon: <Award size={28} />,
    title: 'Authentic Craftsmanship',
    text: 'Each idol is shaped by dedicated artisans using time-honoured techniques and carefully selected materials.',
  },
  {
    icon: <Leaf size={28} />,
    title: 'Sacred Materials',
    text: 'From brass and marble to natural stone and pooja essentials, every item is chosen with devotion and quality in mind.',
  },
  {
    icon: <HeartHandshake size={28} />,
    title: 'Customer First',
    text: 'We believe in respectful guidance, honest recommendations, and helping every family choose the right spiritual piece.',
  },
  {
    icon: <Truck size={28} />,
    title: 'Trusted Delivery',
    text: 'We ensure safe packaging and reliable shipping across Maharashtra and the rest of India.',
  },
]

export default function AboutPage() {
  return (
    <>
      <Helmet>
        <title>About Us — Vatvruksha Spiritual Vastu Bhandar</title>
        <meta name="description" content="Learn about our spiritual store, craftsmanship standards, and devotion-driven service for households across Maharashtra and India." />
      </Helmet>

      <div className="bg-cream-dark border-b border-cream-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav aria-label="Breadcrumb" className="text-xs text-brown-light">
            <Link to="/" className="hover:text-maroon">Home</Link>
            <span className="mx-2">›</span>
            <span className="text-brown font-medium">About Us</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-gold font-semibold">Our Story</p>
            <h1 className="font-serif text-4xl md:text-5xl text-brown mt-3">Devotion, craft, and sacred living.</h1>
            <p className="mt-5 text-brown-light leading-relaxed">
              Vatvruksha Swami Maharaj Spiritual Vastu Bhandar was founded with a simple mission: to make sacred worship items accessible to families who want spirituality and authenticity in their homes.
            </p>
            <p className="mt-4 text-brown-light leading-relaxed">
              We curate handcrafted idols, murtis, vastu essentials, pooja items and devotional décor that honour tradition while fitting beautifully into modern homes.
            </p>
            <Link to="/shop" className="btn-primary inline-flex mt-6">Explore Collection</Link>
          </div>

          <div className="bg-white rounded-3xl border border-cream-dark p-6 shadow-sm">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-maroon via-saffron to-gold flex items-center justify-center text-7xl shadow-inner">
              🕉️
            </div>
          </div>
        </section>

        <section className="mt-16">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {values.map((value) => (
              <div key={value.title} className="bg-white rounded-2xl border border-cream-dark p-5 shadow-sm hover:shadow-md transition-all">
                <div className="w-12 h-12 rounded-xl bg-gold-50 text-maroon flex items-center justify-center mb-4">{value.icon}</div>
                <h3 className="font-serif text-2xl text-brown mb-2">{value.title}</h3>
                <p className="text-sm text-brown-light leading-relaxed">{value.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
