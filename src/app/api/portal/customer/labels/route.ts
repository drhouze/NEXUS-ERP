import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/portal/customer/labels?email=xxx — get module labels for the tenant that owns this customer
export async function GET(req: Request) {
  const url = new URL(req.url)
  const email = url.searchParams.get('email')

  if (!email) {
    // If no email, try to infer from the customer's orders (already logged in)
    return NextResponse.json({ labels: {} })
  }

  const customer = await db.customer.findFirst({
    where: { email: email.toLowerCase() },
    select: { tenantId: true },
  })

  if (!customer) return NextResponse.json({ labels: {} })

  const labels = await db.moduleLabel.findMany({ where: { tenantId: customer.tenantId } })
  const labelMap: Record<string, { label: string; description?: string }> = {}
  for (const l of labels) {
    labelMap[l.moduleKey] = { label: l.customLabel, description: l.customDescription || undefined }
  }

  return NextResponse.json({ labels: labelMap })
}
