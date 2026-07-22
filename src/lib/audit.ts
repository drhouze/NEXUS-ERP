import { db } from './db'
import { cookies } from 'next/headers'

export interface AuditContext {
  actorId?: string
  actorEmail: string
  actorRole: string
  tenantId?: string
  ipAddress?: string
}

export async function logAction(params: {
  ctx: AuditContext
  action: string // create | update | delete | suspend | unsuspend | upgrade | login | logout | backup_export | backup_import | status_change | disable | enable | reset_password
  entityType: string // tenant | user | product | customer | order | purchase_order | employee | transaction | plan | auth
  entityId?: string
  entityName?: string
  summary: string
  metadata?: Record<string, any>
}) {
  try {
    await db.auditLog.create({
      data: {
        tenantId: params.ctx.tenantId || null,
        actorId: params.ctx.actorId || null,
        actorEmail: params.ctx.actorEmail,
        actorRole: params.ctx.actorRole,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId || null,
        entityName: params.entityName || null,
        summary: params.summary,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ctx.ipAddress || null,
      },
    })
  } catch (e) {
    console.error('Audit log failed:', e)
  }
}

export async function createNotification(params: {
  tenantId: string
  userId?: string
  type?: string // info | success | warning | error
  category: string // order | inventory | customer | finance | hr | system | purchase
  title: string
  message: string
  link?: string
}) {
  try {
    await db.notification.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId || null,
        type: params.type || 'info',
        category: params.category,
        title: params.title,
        message: params.message,
        link: params.link || null,
      },
    })
  } catch (e) {
    console.error('Create notification failed:', e)
  }
}

// Get client IP from request headers
export function getClientIp(req?: Request): string | undefined {
  if (!req) return undefined
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]
  const real = req.headers.get('x-real-ip')
  if (real) return real
  return undefined
}
