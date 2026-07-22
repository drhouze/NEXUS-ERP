import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  const keys = await db.apiKey.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ keys })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { name, scopes, expiresInDays } = await req.json()
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    // Generate key: nexus_<random>
    const rawKey = `nexus_${crypto.randomBytes(32).toString('hex')}`
    const keyHash = bcrypt.hashSync(rawKey, 10)
    const keyPrefix = rawKey.slice(0, 12)

    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 86400000) : null

    const apiKey = await db.apiKey.create({
      data: {
        tenantId, name,
        keyHash, keyPrefix,
        scopes: JSON.stringify(scopes || ['read']),
        expiresAt,
        isActive: true,
      },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId },
      action: 'create', entityType: 'api_key', entityId: apiKey.id, entityName: name,
      summary: `Generated API key "${name}" (scopes: ${JSON.stringify(scopes || ['read'])})`,
    })

    // Return the raw key ONCE
    return NextResponse.json({ apiKey, rawKey })
  } catch (e: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
