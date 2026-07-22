// Broadcast helper - called from API routes to push real-time updates to connected clients
// Makes an internal HTTP POST to the realtime service on port 3004

const BROADCAST_URL = 'http://localhost:3004/broadcast'

export async function broadcast(tenantId: string, event: string, data?: any) {
  try {
    await fetch(BROADCAST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, event, data }),
    })
  } catch (e) {
    // Silent fail - realtime is a nice-to-have, not critical
    // console.error('Broadcast failed:', e)
  }
}

// Common event types
export const REALTIME_EVENTS = {
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_PAID: 'order.paid',
  PO_CREATED: 'po.created',
  PO_RECEIVED: 'po.received',
  PRODUCT_CREATED: 'product.created',
  STOCK_LOW: 'stock.low',
  CUSTOMER_CREATED: 'customer.created',
  PAYMENT_RECEIVED: 'payment.received',
  NOTIFICATION: 'notification',
  DASHBOARD_REFRESH: 'dashboard.refresh',
} as const
