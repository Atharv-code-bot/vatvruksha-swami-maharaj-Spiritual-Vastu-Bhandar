import STORE from '../config/store'

/**
 * Build a pre-filled WhatsApp message URL
 * @param {Array} items - cart items [{product, quantity}]
 * @param {Object} formData - { name, phone, address, city, pincode }
 */
export const buildWhatsAppOrderUrl = (items, formData = null) => {
  const lines = items.map((item) => {
    const price = item.product.salePrice || item.product.price
    return `• ${item.product.name} — ${STORE.currency}${price.toLocaleString('en-IN')} × ${item.quantity}`
  })

  const subtotal = items.reduce((sum, item) => {
    const price = item.product.salePrice || item.product.price
    return sum + price * item.quantity
  }, 0)

  const shipping =
    subtotal >= STORE.freeShippingThreshold ? 'FREE' : `${STORE.currency}99`

  let message = `Shri Swami Samarth✨🙏🏻!! I would like to place an order:\n\n`
  message += lines.join('\n')
  message += `\n\n💰 Subtotal: ${STORE.currency}${subtotal.toLocaleString('en-IN')}`
  message += `\n🚚 Shipping: ${shipping}`

  if (formData) {
    message += `\n\n📦 Delivery Address:\n`
    message += `Name: ${formData.name}\n`
    message += `Phone: ${formData.phone}\n`
    message += `Address: ${formData.address}\n`
    if (formData.city) message += `City: ${formData.city}\n`
    message += `Pincode: ${formData.pincode}`
  }

  message += `\n\nKindly confirm availability and payment details. 🙏`

  const encoded = encodeURIComponent(message)
  return `https://wa.me/${STORE.whatsapp}?text=${encoded}`
}

/**
 * Build a single product WhatsApp inquiry URL
 */
export const buildProductWhatsAppUrl = (product) => {
  const price = product.salePrice || product.price
  const message =
    `🙏 Namaste! I'm interested in:\n\n` +
    `*${product.name}*\n` +
    `Material: ${product.material}\n` +
    `Size: ${product.size}\n` +
    `Price: ${STORE.currency}${price.toLocaleString('en-IN')}\n\n` +
    `Kindly share availability and delivery details. 🙏`

  return `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(message)}`
}
