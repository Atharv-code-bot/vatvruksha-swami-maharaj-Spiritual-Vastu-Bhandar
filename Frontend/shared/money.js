// Shared money helpers — single source of truth.
// All money is integer PAISE in state/Firestore. Convert to rupees ONLY at the display edge.

/** Convert paise (integer) to rupees (number, 2 decimals). Returns 0 for non-finite input. */
export const paiseToRupees = (paise) => {
  const p = Number(paise)
  if (!Number.isFinite(p)) return 0
  return p / 100
}

/** Format paise to INR display string, e.g. 129900 -> "₹1,299.00" */
export const formatINR = (paise) => {
  const rupees = paiseToRupees(paise)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees)
}

/** Format paise to rupees without currency symbol, e.g. 129900 -> "1,299.00" */
export const formatRupees = (paise) => {
  const rupees = paiseToRupees(paise)
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees)
}

/** Parse a rupee display string back to integer paise. Safe fallback to 0. */
export const rupeesToPaise = (rupees) => {
  const n = Number(String(rupees).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
