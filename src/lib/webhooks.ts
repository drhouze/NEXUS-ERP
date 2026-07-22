import { db } from './db'
import { sendEmail } from './email'

// Fire webhooks for a given event
export async function fireWebhooks(tenantId: string, event: string, payload: any) {
  try {
    const webhooks = await db.webhook.findMany({
      where: { tenantId, isActive: true },
    })

    for (const webhook of webhooks) {
      const events: string[] = JSON.parse(webhook.events || '[]')
      if (!events.includes(event) && !events.includes('*')) continue

      // Create delivery record
      const delivery = await db.webhookDelivery.create({
        data: {
          webhookId: webhook.id,
          event,
          payload: JSON.stringify(payload),
          status: 'pending',
        },
      })

      // Attempt delivery (async, non-blocking)
      deliverWebhook(delivery.id, webhook.url, webhook.secret, event, payload).catch(console.error)
    }
  } catch (e) {
    console.error('Fire webhooks error:', e)
  }
}

async function deliverWebhook(deliveryId: string, url: string, secret: string | null, event: string, payload: any) {
  const maxAttempts = 3
  let attempt = 0

  while (attempt < maxAttempts) {
    attempt++
    try {
      const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() })

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Nexus-Event': event,
      }

      // HMAC signature if secret is set
      if (secret) {
        const crypto = await import('crypto')
        const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')
        headers['X-Nexus-Signature'] = signature
      }

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })

      clearTimeout(timeout)

      const responseText = await res.text().catch(() => '')

      await db.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: res.ok ? 'success' : 'failed',
          statusCode: res.status,
          response: responseText.slice(0, 2000),
          attempts: attempt,
          deliveredAt: new Date(),
        },
      })

      if (res.ok) return // Success, stop retrying
    } catch (e: any) {
      // Network error, retry
      await db.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: attempt >= maxAttempts ? 'failed' : 'pending',
          attempts: attempt,
          response: e.message?.slice(0, 2000),
        },
      })
    }

    if (attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, 1000 * attempt)) // backoff
    }
  }

  // If all attempts failed, notify tenant admins
  if (attempt >= maxAttempts) {
    const delivery = await db.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { webhook: true } })
    if (delivery) {
      const admins = await db.user.findMany({
        where: { tenantId: delivery.webhook.tenantId, role: 'TENANT_ADMIN', status: 'active' },
      })
      for (const admin of admins) {
        await sendEmail({
          to: admin.email,
          subject: `Webhook delivery failed: ${delivery.event}`,
          body: `A webhook delivery to ${delivery.webhook.url} failed after ${maxAttempts} attempts.\n\nEvent: ${delivery.event}\nDelivery ID: ${delivery.id}\n\nPlease check the webhook URL or disable it in Settings.`,
          type: 'webhook_failure',
          tenantId: delivery.webhook.tenantId,
        })
      }
    }
  }
}
