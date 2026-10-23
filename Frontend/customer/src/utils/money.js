// All prices and totals in the Firestore schema are integer paise.
export function formatINR(paise = 0) {
  const value = Number.isFinite(Number(paise)) ? Number(paise) / 100 : 0
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value)
}
