// Callable Cloud Functions — customer checkout
// Region: asia-south1. No merchant secrets in React — backend returns only
// CheckoutJS values (mid, txnToken, amount, environment, order ID).
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'

const createCodOrder = httpsCallable(functions, 'createCodOrder')
const createPaytmOrder = httpsCallable(functions, 'createPaytmOrder')
const verifyPaytmPayment = httpsCallable(functions, 'verifyPaytmPayment')

// requestId: 8–128 chars [A-Za-z0-9_-], generated once per attempt and reused on retry.
export const generateRequestId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-'
  let result = ''
  for (let i = 0; i < 24; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export const callCreateCodOrder = async (request) => {
  return await createCodOrder(request)
}

export const callCreatePaytmOrder = async (request) => {
  return await createPaytmOrder(request)
}

export const callVerifyPaytmPayment = async ({ orderId }) => {
  return await verifyPaytmPayment({ orderId })
}
