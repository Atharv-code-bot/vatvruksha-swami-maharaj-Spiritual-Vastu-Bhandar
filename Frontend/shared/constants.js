// Shared constants — brand palette, routes, validation patterns

export const BRAND = {
  saffron: '#E8741A',
  maroon: '#7A1F2B',
  gold: '#C9962B',
  cream: '#FFF8EC',
  brown: '#2B1A14',
}

export const STORAGE_IMAGE_PLACEHOLDER =
  'https://placehold.co/400x400/F5EDDA/7A1F2B?text=%F0%9F%AA%A4'

export const REQUEST_ID_REGEX = /^[A-Za-z0-9_-]{8,128}$/

export const DEFAULT_LOW_STOCK_THRESHOLD = 5 // pending confirmation (see open decisions)

export const PAYMENT_METHOD = {
  COD: 'cod',
  PAYTM: 'paytm',
}

export const ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  PAYMENT_FAILED: 'payment_failed',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
}

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
}

export const ROUTES = {
  HOME: '/',
  SHOP: '/shop',
  CATEGORY: (slug) => `/category/${slug}`,
  PRODUCT: (id) => `/product/${id}`,
  CART: '/cart',
  CHECKOUT: '/checkout',
  WISHLIST: '/wishlist',
  ABOUT: '/about',
  CONTACT: '/contact',
  ACCOUNT: '/account',
  NOT_FOUND: '*',
  // Admin
  ADMIN_LOGIN: '/admin/login',
  ADMIN_UNAUTHORIZED: '/admin/unauthorized',
  ADMIN_ROOT: '/admin',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_ORDER_DETAIL: (id) => `/admin/orders/${id}`,
  ADMIN_PRODUCTS: '/admin/products',
  ADMIN_CATEGORIES: '/admin/categories',
  ADMIN_INVENTORY: '/admin/inventory',
  ADMIN_CUSTOMERS: '/admin/customers',
  ADMIN_EXCEPTIONS: '/admin/exceptions',
  ADMIN_ROLES: '/admin/admin-roles',
}

export const APP_NAME = 'Vatvruksha Swami Maharaj Spiritual Vastu Bhandar'
export const CURRENCY_CODE = 'INR'
