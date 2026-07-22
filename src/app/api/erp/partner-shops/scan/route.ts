import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'

/**
 * POST /api/erp/partner-shops/scan
 * Body: { token: string } or { code: string }
 *
 * Shop owner scans the QR code (or enters the short code manually).
 * Looks up the redemption, verifies it belongs to a shop they own, and
 * marks it as "scanned" — moves it to the employee's confirm screen.
 *
 * Returns the redemption details (item, employee, points) so the shop
 * owner can verify what the employee wants before the employee confirms.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { token, code } = await req.json()

    // Find the redemption by token (from QR) or short code (manual entry)
    let redemption: any = null
    if (token) {
      redemption = await db.redemptionCode.findUnique({
        where: { token },
        include: { item: true, shop: true },
      })
    } else if (code) {
      redemption = await db.redemptionCode.findUnique({
        where: { code: code.toUpperCase().trim() },
        include: { item: true, shop: true },
      })
    }

    if (!redemption) {
      return NextResponse.json({ error: 'Invalid code — no redemption found' }, { status: 404 })
    }

    // Cross-tenant scanning is allowed for global shops — the shop owner
    // may belong to a different tenant than the employee who generated the QR.
    // We verify ownership by checking if the current user owns the SHOP (not the tenant).

    // Verify the current user is the shop owner — a shop owner can only scan
    // QR codes generated for items at THEIR shop, not any other shop.
    const isOwner = redemption.shop.ownerUserId === user.id
    const isAdmin = user.role === 'OWNER' || user.role === 'TENANT_ADMIN'
    if (!isOwner && !isAdmin) {
      return NextResponse.json({
        error: `This QR code is for "${redemption.shop.name}", but you are the owner of a different shop. Only the shop owner can scan their own shop's QR codes.`,
      }, { status: 403 })
    }

    // Check status — return details for already-scanned/confirmed/cancelled
    // (the shop owner polls by re-scanning the same code to detect status changes)
    if (redemption.status === 'confirmed' || redemption.status === 'cancelled') {
      const employee = await db.user.findUnique({
        where: { id: redemption.employeeId },
        select: { id: true, name: true, email: true },
      })
      return NextResponse.json({
        redemption: {
          id: redemption.id,
          code: redemption.code,
          status: redemption.status,
          pointsCost: redemption.pointsCost,
          item: redemption.item,
          shop: { id: redemption.shop.id, name: redemption.shop.name },
          employee,
          scannedAt: redemption.scannedAt,
          confirmedAt: redemption.confirmedAt,
        },
        message: redemption.status === 'confirmed'
          ? 'This redemption has been confirmed.'
          : 'This redemption was cancelled.',
      })
    }
    if (redemption.status === 'scanned') {
      // Already scanned — just return the details (idempotent)
      const employee = await db.user.findUnique({
        where: { id: redemption.employeeId },
        select: { id: true, name: true, email: true },
      })
      return NextResponse.json({
        redemption: {
          id: redemption.id,
          code: redemption.code,
          status: redemption.status,
          pointsCost: redemption.pointsCost,
          item: redemption.item,
          shop: { id: redemption.shop.id, name: redemption.shop.name },
          employee,
          scannedAt: redemption.scannedAt,
        },
        message: 'Already scanned — waiting for employee to confirm.',
      })
    }

    // Mark as scanned
    const updated = await db.redemptionCode.update({
      where: { id: redemption.id },
      data: {
        status: 'scanned',
        scannedAt: new Date(),
        scannedBy: user.id,
      },
    })

    const employee = await db.user.findUnique({
      where: { id: redemption.employeeId },
      select: { id: true, name: true, email: true },
    })

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId },
      action: 'scan',
      entityType: 'redemption_code',
      entityId: redemption.id,
      entityName: redemption.code,
      summary: `Shop owner ${user.name} scanned redemption ${redemption.code} for ${employee?.name} — waiting for employee confirmation`,
    })

    return NextResponse.json({
      redemption: {
        id: updated.id,
        code: updated.code,
        status: updated.status,
        pointsCost: updated.pointsCost,
        item: redemption.item,
        shop: { id: redemption.shop.id, name: redemption.shop.name },
        employee,
        scannedAt: updated.scannedAt,
      },
    })
  } catch (e: any) {
    console.error('Scan error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
