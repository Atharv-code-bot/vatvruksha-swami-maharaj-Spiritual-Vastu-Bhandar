import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { MapPin, Mail, Phone, Clock, Send } from 'lucide-react'
import STORE from '../config/store'

export default function ContactPage() {
  const [emailDraftOpened, setEmailDraftOpened] = useState(false)

  // The supplied integration guide does not define a contact-message backend.
  // Open a prefilled email draft instead of falsely claiming a message was stored.
  const handleSubmit = (e) => {
    e.preventDefault()
    const form = e.currentTarget
    const values = new FormData(form)
    const subject = String(values.get('subject') || 'Website enquiry').trim()
    const body = [
      `Name: ${String(values.get('name') || '').trim()}`,
      `Phone: ${String(values.get('phone') || '').trim()}`,
      '',
      'Message:',
      String(values.get('message') || '').trim(),
    ].join('\n')
    window.location.href = `mailto:${STORE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setEmailDraftOpened(true)
  }

  return (
    <>
      <Helmet>
        <title>Contact Us — Vatvruksha Spiritual Vastu Bhandar</title>
        <meta name="description" content="Get in touch with Vatvruksha Spiritual Vastu Bhandar for guidance, custom orders and spiritual product inquiries." />
      </Helmet>

      <div className="bg-cream-dark border-b border-cream-darker">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <nav aria-label="Breadcrumb" className="text-xs text-brown-light">
            <Link to="/" className="hover:text-maroon">Home</Link>
            <span className="mx-2">›</span>
            <span className="text-brown font-medium">Contact</span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8">
          <div className="space-y-6">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-gold font-semibold">Get In Touch</p>
              <h1 className="font-serif text-4xl text-brown mt-2">Contact Us</h1>
            </div>

            <div className="bg-white rounded-2xl border border-cream-dark p-5 shadow-sm space-y-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-50 text-maroon flex items-center justify-center"><Phone size={18} /></div>
                <div>
                  <p className="text-sm text-brown-light">Phone</p>
                  <a href={`tel:${STORE.phone}`} className="font-medium text-brown hover:text-maroon">{STORE.phone}</a>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-50 text-maroon flex items-center justify-center"><Mail size={18} /></div>
                <div>
                  <p className="text-sm text-brown-light">Email</p>
                  <a href={`mailto:${STORE.email}`} className="font-medium text-brown hover:text-maroon">{STORE.email}</a>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-50 text-maroon flex items-center justify-center"><MapPin size={18} /></div>
                <div>
                  <p className="text-sm text-brown-light">Address</p>
                  <p className="font-medium text-brown">{STORE.address.full}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-gold-50 text-maroon flex items-center justify-center"><Clock size={18} /></div>
                <div>
                  <p className="text-sm text-brown-light">Business Hours</p>
                  <p className="font-medium text-brown">{STORE.hours}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-cream-dark bg-gradient-to-br from-cream to-white p-4">
              <div className="overflow-hidden rounded-xl border border-cream-dark bg-white">
                <iframe
                  title="Vatvruksha store location map"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(STORE.address.full)}&output=embed`}
                  className="block h-64 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
              <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-brown-light">{STORE.address.full}</p>
                <a
                  href={STORE.address.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-cream-dark px-3 py-2 text-sm font-semibold text-maroon transition-colors hover:bg-cream"
                >
                  Open in Google Maps
                </a>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-cream-dark p-5 md:p-6 shadow-sm">
            <h2 className="font-serif text-3xl text-brown mb-5">Send a Message</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-brown mb-2" htmlFor="name">Your Name</label>
                <input id="name" name="name" type="text" autoComplete="name" required className="w-full rounded-xl border border-cream-dark px-3 py-2.5" placeholder="Enter your name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-brown mb-2" htmlFor="phone">Phone</label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" className="w-full rounded-xl border border-cream-dark px-3 py-2.5" placeholder="+91 99999 99999" />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-brown mb-2" htmlFor="subject">Subject</label>
              <input id="subject" name="subject" type="text" required className="w-full rounded-xl border border-cream-dark px-3 py-2.5" placeholder="How can we help?" />
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-brown mb-2" htmlFor="message">Message</label>
              <textarea id="message" name="message" rows="6" required className="w-full rounded-xl border border-cream-dark px-3 py-2.5" placeholder="Tell us about your requirements..." />
            </div>

            <button type="submit" className="btn-primary mt-5 inline-flex items-center gap-2">
              <Send size={16} /> Send Message
            </button>

            {emailDraftOpened && (
              <p className="mt-4 text-sm text-brown-light" role="status">Your email app should open with this message prepared. Please send the email there to contact us. If no email app opens, use the email address shown on this page.</p>
            )}
          </form>
        </div>
      </div>
    </>
  )
}
