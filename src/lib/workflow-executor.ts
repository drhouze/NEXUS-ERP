import { db } from './db'
import { createNotification } from './audit'
import { sendNotificationEmail } from './email'

// Trigger workflows for a given event
export async function triggerWorkflows(tenantId: string, trigger: string, context: { entityType?: string; entityId?: string; data?: any }) {
  try {
    const workflows = await db.workflow.findMany({
      where: { tenantId, trigger, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    })

    for (const workflow of workflows) {
      await executeWorkflow(workflow, tenantId, trigger, context)
    }
  } catch (e) {
    console.error('Trigger workflows error:', e)
  }
}

async function executeWorkflow(workflow: any, tenantId: string, trigger: string, context: any) {
  const execution = await db.workflowExecution.create({
    data: {
      tenantId,
      workflowId: workflow.id,
      trigger,
      entityType: context.entityType || null,
      entityId: context.entityId || null,
      status: 'running',
      stepsTotal: workflow.steps.length,
      stepsDone: 0,
      startedAt: new Date(),
    },
  })

  try {
    let stepsDone = 0
    const results: any[] = []

    for (const step of workflow.steps) {
      const config = JSON.parse(step.config || '{}')
      const result = await executeStep(step.type, config, tenantId, context)
      results.push({ step: step.order, type: step.type, result })
      stepsDone++

      await db.workflowExecution.update({
        where: { id: execution.id },
        data: { stepsDone },
      })
    }

    await db.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        result: JSON.stringify(results),
      },
    })
  } catch (e: any) {
    await db.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: e.message,
      },
    })
  }
}

async function executeStep(type: string, config: any, tenantId: string, context: any): Promise<any> {
  switch (type) {
    case 'send_notification': {
      const admins = await db.user.findMany({ where: { tenantId, role: 'TENANT_ADMIN', status: 'active' } })
      for (const admin of admins) {
        await createNotification({
          tenantId, userId: admin.id,
          type: config.notificationType || 'info',
          category: config.category || 'system',
          title: config.title || 'Workflow Notification',
          message: config.message || `Triggered by ${context.entityType || 'event'}`,
        })
      }
      return { notified: admins.length }
    }

    case 'send_email': {
      if (config.recipientEmail) {
        await sendNotificationEmail(config.recipientEmail, config.subject || 'Notification', config.body || '', tenantId)
        return { sent: true }
      }
      return { sent: false, reason: 'no recipient' }
    }

    case 'create_task': {
      // Create a notification as a "task"
      const admins = await db.user.findMany({ where: { tenantId, role: 'TENANT_ADMIN', status: 'active' } })
      for (const admin of admins) {
        await createNotification({
          tenantId, userId: admin.id, type: 'warning', category: 'system',
          title: `Task: ${config.taskTitle || 'Review required'}`,
          message: config.taskDescription || `Review ${context.entityType || 'item'} ${context.entityId || ''}`,
        })
      }
      return { created: admins.length }
    }

    case 'call_webhook': {
      if (!config.url) return { called: false }
      try {
        const res = await fetch(config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger: context, config }),
        })
        return { called: true, status: res.status }
      } catch (e) {
        return { called: false, error: (e as Error).message }
      }
    }

    case 'wait': {
      const ms = (config.seconds || 0) * 1000
      if (ms > 0 && ms < 30000) await new Promise(r => setTimeout(r, ms))
      return { waited: config.seconds || 0 }
    }

    default:
      return { skipped: true, reason: `Unknown step type: ${type}` }
  }
}
