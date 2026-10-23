/**
 * Section title with gold ornamental dividers
 * @param {string} title - Main heading text
 * @param {string} subtitle - Optional subtitle
 * @param {string} ornament - Optional decorative char (default: ॐ)
 * @param {string} align - 'center' | 'left'
 */
export default function SectionTitle({ title, subtitle, ornament = '— ॐ —', align = 'center' }) {
  const isCenter = align === 'center'

  return (
    <div className={`mb-10 ${isCenter ? 'text-center' : 'text-left'}`}>
      {ornament && (
        <p className="text-gold font-medium text-sm mb-2 tracking-widest">
          {ornament}
        </p>
      )}
      <h2 className="font-serif text-3xl md:text-4xl font-bold text-brown">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 text-brown-light text-sm md:text-base max-w-xl mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
      <div className={`mt-4 ${isCenter ? 'flex justify-center' : ''}`}>
        <div className="flex items-center gap-3 w-48">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
          <span className="text-gold text-lg">🌸</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
        </div>
      </div>
    </div>
  )
}
