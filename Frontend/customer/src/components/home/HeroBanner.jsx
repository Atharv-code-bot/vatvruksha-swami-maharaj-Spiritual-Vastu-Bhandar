import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const slides = [
  {
    id: 1,
    title: 'Divine Murtis for\nYour Sacred Space',
    subtitle: 'Handcrafted with devotion by master artisans',
    cta: 'Explore Collection',
    ctaLink: '/shop',
    bg: 'from-maroon-dark via-maroon to-saffron-dark',
    accent: '#C9962B',
    emoji: '',
  },
  {
    id: 2,
    title: 'Authentic Brass\nIdols & Statues',
    subtitle: 'Sacred metals, blessed by pundits — for your pooja ghar',
    cta: 'Shop Brass Murtis',
    ctaLink: '/shop',
    bg: 'from-brown via-brown-medium to-maroon',
    accent: '#E8741A',
    emoji: '',
  },
  {
    id: 3,
    title: 'Complete Pooja\nEssentials',
    subtitle: 'Diyas, agarbatti, thali sets and more — all in one place',
    cta: 'Shop Pooja Items',
    ctaLink: '/shop',
    bg: 'from-saffron-dark via-saffron to-gold',
    accent: '#FFF8EC',
    emoji: '',
  },
]

export default function HeroBanner() {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const timerRef = useRef(null)

  const goTo = (idx) => {
    if (animating) return
    setAnimating(true)
    setCurrent(idx)
    setTimeout(() => setAnimating(false), 500)
  }

  const next = () => goTo((current + 1) % slides.length)
  const prev = () => goTo((current - 1 + slides.length) % slides.length)

  useEffect(() => {
    timerRef.current = setInterval(next, 5000)
    return () => clearInterval(timerRef.current)
  }, [current])

  const slide = slides[current]

  return (
    <section
      className={`relative isolate overflow-hidden bg-gradient-to-br ${slide.bg} transition-all duration-700`}
      aria-label="Hero banner"
    >
      {/* Decorative Pattern */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(201,150,43,0.4) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(232,116,26,0.3) 0%, transparent 40%)`,
        }}
      />

      {/* Slide-specific transparent product cutout, sized to stay inside the hero */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-0 hidden w-[43%] items-center justify-center overflow-hidden md:flex lg:w-[44%]"
        aria-hidden="true"
        style={{
          background: 'radial-gradient(ellipse at 58% 56%, rgba(224,174,75,0.28) 0%, rgba(224,174,75,0.10) 38%, transparent 72%)',
        }}
      >
        <img
          key={`hero-image-${slide.id}`}
          src={
            slide.id === 1
              ? '/images/swami-samarth-hero-cutout.png'
              : slide.id === 2
                ? '/images/swami-samarth-white-cutout.png'
                : '/images/gurucharitra-book-cutout.png'
          }
          alt={
            slide.id === 1
              ? 'Golden brass Swami Samarth murti with pooja incense'
              : slide.id === 2
                ? 'White Swami Samarth murti'
                : 'Shri Gurucharitra sacred book'
          }
          className="block max-h-[82%] max-w-[94%] object-contain object-center drop-shadow-[0_18px_24px_rgba(35,20,5,0.24)] lg:max-h-[86%]"
          loading="eager"
          fetchPriority="high"
        />
      </div>

      {/* Smaller mobile cutout, positioned below/right of copy without cropping */}
      <div className="pointer-events-none absolute bottom-14 right-1 z-0 w-[34%] max-w-36 opacity-25 sm:bottom-16 sm:w-[32%] sm:max-w-44 sm:opacity-30 md:hidden" aria-hidden="true">
        <img
          key={`mobile-hero-image-${slide.id}`}
          src={
            slide.id === 1
              ? '/images/swami-samarth-hero-cutout.png'
              : slide.id === 2
                ? '/images/swami-samarth-white-cutout.png'
                : '/images/gurucharitra-book-cutout.png'
          }
          alt=""
          className="block h-auto max-h-40 w-full object-contain object-bottom sm:max-h-48"
          loading="eager"
        />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-32 lg:px-8">
        <div className="max-w-2xl md:max-w-[58%]">
          {/* Ornament */}
          <p
            className="mb-4 text-3xl animate-fade-in"
            style={{ color: slide.accent }}
          >
            {slide.emoji}
          </p>

          {/* Title */}
          <h1
            key={`title-${current}`}
            className="whitespace-pre-line font-serif text-4xl font-bold leading-tight text-cream animate-fade-in md:text-6xl"
          >
            {slide.title}
          </h1>

          {/* Subtitle */}
          <p
            key={`sub-${current}`}
            className="mt-4 max-w-lg text-base leading-relaxed text-cream/80 animate-fade-in md:text-lg"
          >
            {slide.subtitle}
          </p>

          {/* CTA */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={slide.ctaLink}
              className="btn-gold px-6 py-3 text-base"
            >
              {slide.cta}
            </Link>
            <Link
              to="/about"
              className="rounded-md border border-cream/50 px-6 py-3 text-base font-medium text-cream transition-colors hover:bg-cream/10"
            >
              Our Story
            </Link>
          </div>

          {/* Trust badge */}
          <div className="mt-8 flex flex-wrap gap-4 text-xs text-cream/60">
            <span>✓ Authentic Materials</span>
            <span>✓ Blessed by Pundits</span>
            <span>✓ All India Delivery</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-cream/20 p-2 text-cream backdrop-blur-sm transition-all hover:bg-cream/30"
        aria-label="Previous slide"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full bg-cream/20 p-2 text-cream backdrop-blur-sm transition-all hover:bg-cream/30"
        aria-label="Next slide"
      >
        <ChevronRight size={22} />
      </button>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className={`rounded-full transition-all duration-300 ${
              i === current
                ? 'h-2 w-6 bg-gold'
                : 'h-2 w-2 bg-cream/40 hover:bg-cream/70'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </section>
  )
}
