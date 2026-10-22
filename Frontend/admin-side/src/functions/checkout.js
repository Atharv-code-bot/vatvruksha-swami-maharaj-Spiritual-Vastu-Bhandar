// Callable Cloud Functions — admin app
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase.js'

export const verifyPaytmPayment = httpsCallable(functions, 'verifyPaytmPayment')

export const callVerifyPaytmPayment = async ({ orderId }) => {
  return await verifyPaytmPayment({ orderId })
}
