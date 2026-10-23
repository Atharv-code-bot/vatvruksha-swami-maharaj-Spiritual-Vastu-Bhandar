import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

export default function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Page Not Found — Vatvruksha Spiritual Vastu Bhandar</title>
        <meta name="description" content="The page you are looking for could not be found." />
      </Helmet>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="text-7xl mb-5">🙏</div>
        <p className="text-sm uppercase tracking-[0.2em] text-gold font-semibold">404 Error</p>
        <h1 className="font-serif text-4xl md:text-5xl text-brown mt-3">This page is not available</h1>
        <p className="text-brown-light mt-4 max-w-lg mx-auto">
          The page you are looking for might have moved, been removed, or does not exist. Explore our spiritual collection instead.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className="btn-primary">Back to Home</Link>
          <Link to="/shop" className="btn-gold">Browse Products</Link>
        </div>
      </div>
    </>
  )
}
