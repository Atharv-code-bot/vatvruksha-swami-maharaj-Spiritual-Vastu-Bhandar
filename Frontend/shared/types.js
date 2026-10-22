// Shared JSDoc typedefs (JavaScript, no TypeScript build step).
//
// Product document (products/{productId})
/**
 * @typedef {Object} ProductVariant
 * @property {string} label
 * @property {string} sku
 * @property {number} price        // paise
 * @property {number} mrp          // paise
 * @property {number} stock
 * @property {boolean} isActive
 * @property {number} sortOrder
 * @property {number} [weightGrams]
 */

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string} slug
 * @property {string} description
 * @property {string} categoryId
 * @property {string[]} images     // Storage paths, NOT URLs
 * @property {Object.<string, ProductVariant>} variants  // keyed by variantId; "default" if no options
 * @property {Object} [specs]
 * @property {boolean} isActive
 * @property {number} sortOrder
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} slug
 * @property {string} name
 * @property {string} [description]
 * @property {string} [imagePath]  // Storage path
 * @property {boolean} isActive
 * @property {number} sortOrder
 * @property {string} createdAt
 * @property {string} updatedAt
 */

// Address (users/{uid}/addresses/{addressId})
/**
 * @typedef {Object} Address
 * @property {string} fullName
 * @property {string} mobile
 * @property {string} addressLine1
 * @property {string} [addressLine2]
 * @property {string} [landmark]
 * @property {string} city
 * @property {string} state
 * @property {string} pincode
 * @property {boolean} isDefault
 * @property {string} createdAt
 * @property {string} updatedAt
 */

// Cart item (client state only — sent to backend as {productId, variantId, quantity})
/**
 * @typedef {Object} CartItem
 * @property {string} productId
 * @property {string} variantId
 * @property {number} quantity
 */

// Order document (orders/{orderId}) — backend-owned; browser only reads
/**
 * @typedef {Object} OrderTotals
 * @property {number} subtotal   // paise
 * @property {number} shipping   // paise
 * @property {number} codFee     // paise
 * @property {number} total      // paise
 */

/**
 * @typedef {Object} OrderPayment
 * @property {string} status             // pending | paid | failed
 * @property {number} amount             // paise
 * @property {string} [transactionRef]
 * @property {string} [verifiedAt]
 */

/**
 * @typedef {Object} OrderItemSnapshot
 * @property {string} productId
 * @property {string} variantId
 * @property {string} name
 * @property {number} quantity
 * @property {number} price            // paise (snapshot)
 */

/**
 * @typedef {Object} Order
 * @property {string} id
 * @property {string} orderNumber
 * @property {string} userId
 * @property {Object} customer           // {name, email, mobile}
 * @property {Object} shippingAddress    // snapshot
 * @property {OrderItemSnapshot[]} items
 * @property {OrderTotals} totals
 * @property {'cod'|'paytm'} paymentMethod
 * @property {OrderPayment} payment
 * @property {'pending_payment'|'confirmed'|'shipped'|'delivered'|'payment_failed'|'expired'|'cancelled'} status
 * @property {Object[]} statusHistory
 * @property {string} [trackingId]
 * @property {string} [reservedUntil]
 * @property {string} [stockReleasedAt]
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} [schemaVersion]
 * @property {boolean} [payment.needsReview]  // may be absent
 */
