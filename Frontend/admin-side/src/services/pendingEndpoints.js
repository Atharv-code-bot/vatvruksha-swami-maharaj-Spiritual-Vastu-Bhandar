// // services/pendingEndpoints.js
// //
// // Stubs for backend endpoints that are NOT yet exported (per Admin Dashboard
// // Integration Guide section 7). The UI keeps these controls DISABLED with a
// // visible "Backend endpoint pending" label and NEVER writes to Firestore
// // directly to simulate them.
// //
// // Wiring the real callable later is a one-file change here: replace each stub
// // with `httpsCallable(functions, '<functionName>')` and call it.
// import { functions } from '../firebase.js'
// import { httpsCallable } from 'firebase/functions'

// // Mark an order shipped / delivered, add tracking ID.
// // Required backend protection: callable validates admin, legal transition,
// // trackingId, actor/history. Not currently exported.
// export const markOrderShipped = async ({ orderId, status, trackingId, actor }) => {
//   const fn = httpsCallable(functions, 'markOrderShipped')
//   return await fn({ orderId, status, trackingId, actor })
// }

// // Record COD collection.
// // Required backend protection: callable sets collected status, collectedAt and
// // actor idempotently. Not currently exported.
// export const recordCODCollection = async ({ orderId, amount, actor }) => {
//   const fn = httpsCallable(functions, 'recordCODCollection')
//   return await fn({ orderId, amount, actor })
// }

// // Adjust stock (transactional). Never write an old whole product doc back.
// // Required backend protection: transactional callable to avoid race with sales.
// // Not currently exported.
// export const adjustStock = async ({ productId, variantId, delta, actor }) => {
//   const fn = httpsCallable(functions, 'adjustStock')
//   return await fn({ productId, variantId, delta, actor })
// }

// // Cancel / refund order. Deferred; atomic status + restore stock once.
// export const cancelOrder = async ({ orderId, reason, actor }) => {
//   const fn = httpsCallable(functions, 'cancelOrder')
//   return await fn({ orderId, reason, actor })
// }

// export const refundOrder = async ({ orderId, amount, actor }) => {
//   const fn = httpsCallable(functions, 'refundOrder')
//   return await fn({ orderId, amount, actor })
// }

// // Resend emails (verification, receipt, etc.). Deferred — email provider TBD.
// export const resendEmail = async ({ email, type }) => {
//   const fn = httpsCallable(functions, 'resendEmail')
//   return await fn({ email, type })
// }

// // Admin resolve of uncertain Paytm payments.
// // Existing verifyPaytmPayment is owner-only; an admin review function may be
// // needed. Not currently exported.
// export const resolvePaytmPayment = async ({ orderId, decision, actor }) => {
//   const fn = httpsCallable(functions, 'resolvePaytmPayment')
//   return await fn({ orderId, decision, actor })
// }

// // Admin grant/revoke admin role — EXISTING callable (available).
// export const setAdminRole = async ({ email, makeAdmin }) => {
//   const fn = httpsCallable(functions, 'setAdminRole')
//   return await fn({ email, makeAdmin })
// }
