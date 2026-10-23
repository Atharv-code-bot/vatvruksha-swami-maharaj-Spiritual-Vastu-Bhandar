export function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const date = toDate(value)
  return date ? date.toLocaleDateString('en-IN', options) : '—'
}

export function formatDateTime(value) {
  const date = toDate(value)
  return date ? date.toLocaleString('en-IN') : '—'
}
