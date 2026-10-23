
export default function AnnouncementBar() {
  const messages = [
    '🙏 Free Shipping on orders above ₹2,000 · All India Delivery',
    '✨ Authentic Handcrafted Murtis — Blessed by Pundits',
    '📞 Order on WhatsApp: +91 80555 41777',
    '🪔 Diwali Special — Up to 30% off on select items',
    '🚚 Express delivery available for Maharashtra',
  ]
  const repeated = [...messages, ...messages]

  return (
    <div
      className="bg-maroon text-cream text-xs font-medium py-2 overflow-hidden"
      role="marquee"
      aria-label="Announcements"
    >
      <div
        className="whitespace-nowrap animate-marquee inline-block"
        style={{ animationDuration: '40s' }}
      >
        {repeated.map((msg, i) => (
          <span key={i} className="mx-10">
            {msg}
          </span>
        ))}
      </div>
    </div>
  )
}
