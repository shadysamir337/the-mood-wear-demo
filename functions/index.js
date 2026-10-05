/**
 * THE MOOD — Cloud Functions.
 * Every write that money or stock depends on happens here, inside a transaction.
 */
import { onDocumentWritten } from 'firebase-functions/firestore'
import { setGlobalOptions } from 'firebase-functions'
import { auditWrite } from './src/admin.js'

setGlobalOptions({ region: process.env.FUNCTIONS_REGION || 'us-central1' })

export { createOrder, validatePromo, trackOrder, updateOrderStatus, subscribeNewsletter } from './src/orders.js'
export { reviewableItems, submitReview, onReviewWritten, linkMyOrders, requestRestockAlert } from './src/customers.js'
export { onOrderCreated, onOrderUpdated, onProductRestock, onProductLive, lowStockDigest, publishScheduledDrops } from './src/notify.js'
export { setStaffRole } from './src/admin.js'

const audited = (col) => onDocumentWritten(`${col}/{id}`, (event) => auditWrite(col, event))
export const auditProducts = audited('products')
export const auditPromos = audited('promos')
export const auditSales = audited('sales')
export const auditSettings = audited('settings')
export const auditMoods = audited('moods')
