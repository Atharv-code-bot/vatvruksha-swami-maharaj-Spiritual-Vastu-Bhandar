import { Link } from 'react-router-dom'
import { useState } from 'react'
import Image from '../ui/Image'

export default function CategoryTile({ category }) {
  const [imgError, setImgError] = useState(false)

  return (
    <Link
      to={`/category/${category.id}`}
      className="group relative overflow-hidden rounded-2xl aspect-[3/4] block shadow-card hover:shadow-card-hover transition-all duration-300"
      aria-label={`Browse ${category.name}`}
    >
      {category.imagePath ? (
        <Image src={category.imagePath} alt={`${category.name} category`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
      ) : (
        <img
          src={imgError ? '/images/category-placeholder.svg' : (category.image || '/images/category-placeholder.svg')}
          alt={`${category.name} idol category`}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
        />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-brown/90 via-brown/30 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
        <p className="text-xs text-gold font-medium mb-1 opacity-90">
          {category.devanagari || ''}
        </p>
        <h3 className="font-serif text-cream text-lg font-bold leading-tight">
          {category.name}
        </h3>
        <div className="mt-2 inline-flex items-center gap-1 text-xs text-cream/70 border border-cream/30 rounded-full px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          Shop Now →
        </div>
      </div>

      {/* Gold border on hover */}
      <div className="absolute inset-0 rounded-2xl ring-0 group-hover:ring-2 group-hover:ring-gold transition-all duration-300" />
    </Link>
  )
}
