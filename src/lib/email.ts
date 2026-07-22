import { db } from './db'

// Email service - console provider (logs to EmailLog table)
// In production, swap send() to use SendGrid/Postmark
export interface EmailParams {
  to: string
  subject: string
  body: string
  type: string // password_reset | notification | welcome | 2fa_setup | webhook_failure
  tenantId?: string
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    // Log the email (acts as the "sent" record)
    await db.emailLog.create({
      data: {
        to: params.to,
        subject: params.subject,
        body: params.body,
        type: params.type,
        status: 'sent',
        tenantId: params.tenantId || null,
      },
    })

    // In production: actually send via SendGrid/Postmark here
    // await sendgrid.send({ to: params.to, from: 'noreply@nexus-erp.com', subject: params.subject, html: params.body })

    console.log(`[EMAIL] ${params.type} → ${params.to}: ${params.subject}`)
    return true
  } catch (e) {
    console.error('Email send failed:', e)
    return false
  }
}

export async function sendPasswordResetEmail(email: string, resetLink: string, tenantId?: string) {
  return sendEmail({
    to: email,
    subject: 'Password Reset - Nexus ERP',
    body: `A password reset was requested for your account. Click the link below to reset your password:\n\n${resetLink}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    type: 'password_reset',
    tenantId,
  })
}

export async function sendNotificationEmail(email: string, title: string, message: string, tenantId?: string) {
  return sendEmail({
    to: email,
    subject: `${title} - Nexus ERP`,
    body: `${title}\n\n${message}\n\n---\nThis is an automated notification from Nexus ERP.`,
    type: 'notification',
    tenantId,
  })
}

export async function send2FASetupEmail(email: string, backupCodes: string[], tenantId?: string) {
  return sendEmail({
    to: email,
    subject: '2FA Enabled - Save Your Backup Codes',
    body: `Two-factor authentication has been enabled on your account.\n\nSave these backup codes in a secure place. Each can be used once if you lose access to your authenticator app:\n\n${backupCodes.join('\n')}\n\n---\nNexus ERP Security`,
    type: '2fa_setup',
    tenantId,
  })
}
