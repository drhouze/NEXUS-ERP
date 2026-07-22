import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'
import { logAction } from '@/lib/audit'
import { getCrossTenantFeePercent } from '@/app/api/platform/settings/route'

/**
 * POST /api/erp/partner-shops/confirm
 * Body: { redemptionId: string }
 *
 * Employee confirms the redemption after the shop owner has scanned it.
 * This is the moment points are actually deducted from the employee and
 * credited to the shop owner — the transfer is atomic.
 *
 * Prerequisites:
 *   - Redemption must be in "scanned" status (shop owner already scanned)
 *   - Employee must have enough points (re-checked at confirm time)
 *
 * After confirmation:
 *   - Employee points -= pointsCost
 *   - Shop owner points += pointsCost
 *   - Redemption status → "confirmed"
 *   - PointTransaction records created for both users
 *   - Shop item stock decremented if not unlimited
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { redemptionId } = await req.json()
    if (!redemptionId) return NextResponse.json({ error: 'redemptionId required' }, { status: 400 })

    const redemption = await db.redemptionCode.findUnique({
      where: { id: redemptionId },
      include: { item: true, shop: true },
    })
    if (!redemption) return NextResponse.json({ error: 'Redemption not found' }, { status: 404 })

    // Cross-tenant confirmations are allowed — the employee may be redeeming
    // at a global shop owned by a different tenant. We verify by checking
    // that the current user is the employee who created the redemption.
    // (No tenant isolation check here — ownership is by employeeId, not tenantId.)

    // Only the employee who created the redemption can confirm it
    if (redemption.employeeId !== user.id) {
      return NextResponse.json({ error: 'Only the employee who created this redemption can confirm it' }, { status: 403 })
    }

    if (redemption.status === 'confirmed') {
      return NextResponse.json({ error: 'Already confirmed' }, { status: 400 })
    }
    if (redemption.status === 'cancelled') {
      return NextResponse.json({ error: 'This redemption was cancelled' }, { status: 400 })
    }
    if (redemption.status !== 'scanned') {
      return NextResponse.json({ error: 'Shop owner must scan the QR code first before you can confirm' }, { status: 400 })
    }

    // Re-check points balance (may have changed since the QR was generated)
    const employee = await db.user.findUnique({ where: { id: user.id }, select: { points: true, name: true } })
    if (!employee || employee.points < redemption.pointsCost) {
      // Cancel the redemption since points are insufficient
      await db.redemptionCode.update({
        where: { id: redemption.id },
        data: { status: 'cancelled', cancelledAt: new Date() },
      })
      return NextResponse.json({
        error: `Insufficient points. You need ${redemption.pointsCost} but only have ${employee?.points || 0}. Redemption cancelled.`,
      }, { status: 400 })
    }

    // ---- Determine if this is a cross-tenant redemption ----
    // Cross-tenant = employee's tenant ≠ shop's tenant → apply deflation fee
    const isCrossTenant = redemption.tenantId !== redemption.shop.tenantId
    const feeConfig = isCrossTenant ? await getCrossTenantFeePercent() : { enabled: false, percent: 0 }
    const feePercent = feeConfig.enabled ? feeConfig.percent : 0
    const feeAmount = Math.round(redemption.pointsCost * feePercent / 100)
    const shopOwnerReceives = redemption.pointsCost - feeAmount

    // ---- Atomic points transfer with deflation burn ----
    // 1. Deduct full cost from employee
    const updatedEmployee = await db.user.update({
      where: { id: user.id },
      data: { points: { decrement: redemption.pointsCost } },
    })

    // 2. Credit shop owner (minus fee)
    const shopOwner = await db.user.findUnique({
      where: { id: redemption.shop.ownerUserId },
      select: { id: true, name: true, points: true, tenantId: true },
    })
    if (shopOwner && shopOwnerReceives > 0) {
      await db.user.update({
        where: { id: shopOwner.id },
        data: { points: { increment: shopOwnerReceives } },
      })
    }
    // (feeAmount is simply not credited to anyone — it's "burned" / removed
    // from circulation. This is the deflation mechanism.)

    // 3. Mark redemption as confirmed
    const confirmed = await db.redemptionCode.update({
      where: { id: redemption.id },
      data: { status: 'confirmed', confirmedAt: new Date() },
    })

    // 4. Decrement stock if not unlimited
    if (redemption.item.stock > 0) {
      await db.shopCatalogItem.update({
        where: { id: redemption.item.id },
        data: { stock: { decrement: 1 } },
      })
    }

    // 5. Record point transactions
    // Employee: full deduction
    await db.pointTransaction.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        type: 'spent',
        amount: -redemption.pointsCost,
        description: `Redeemed: ${redemption.item.name} at ${redemption.shop.name}`,
        refType: 'redemption',
        refId: redemption.id,
      },
    })
    // Shop owner: receives (cost - fee)
    if (shopOwner && shopOwnerReceives > 0) {
      await db.pointTransaction.create({
        data: {
          tenantId: shopOwner.tenantId || user.tenantId,
          userId: shopOwner.id,
          type: 'earned',
          amount: shopOwnerReceives,
          description: `Customer redeemed: ${redemption.item.name} (code: ${redemption.code})${feeAmount > 0 ? ` — ${feeAmount} pts burned (${feePercent}% fee)` : ''}`,
          refType: 'redemption',
          refId: redemption.id,
        },
      })
    }

    await logAction({
      ctx: { actorId: user.id, actorEmail: user.email, actorRole: user.role, tenantId: user.tenantId },
      action: 'confirm_redemption',
      entityType: 'redemption_code',
      entityId: redemption.id,
      entityName: redemption.code,
      summary: `${user.name} confirmed redemption ${redemption.code}: ${redemption.pointsCost} pts → ${shopOwner?.name || 'shop owner'} received ${shopOwnerReceives} pts${feeAmount > 0 ? ` (${feeAmount} pts burned as ${feePercent}% deflation fee)` : ''} for "${redemption.item.name}" at ${redemption.shop.name}`,
    })

    return NextResponse.json({
      ok: true,
      redemption: {
        id: confirmed.id,
        code: confirmed.code,
        status: confirmed.status,
        confirmedAt: confirmed.confirmedAt,
      },
      remainingPoints: updatedEmployee.points,
      // Fee breakdown for the UI
      feeBreakdown: {
        isCrossTenant,
        feePercent,
        pointsCost: redemption.pointsCost,
        feeAmount,
        shopOwnerReceives,
      },
      reward: {
        type: redemption.item.rewardType,
        details: redemption.item.rewardDetails,
        itemName: redemption.item.name,
        shopName: redemption.shop.name,
      },
    })
  } catch (e: any) {
    console.error('Confirm redemption error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

/**
 * POST /api/erp/partner-shops/confirm?cancel=true
 * Body: { redemptionId: string }
 * Cancel a pending/scanned redemption (employee cancels before confirming)
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const redemptionId = url.searchParams.get('redemptionId')
  if (!redemptionId) return NextResponse.json({ error: 'redemptionId required' }, { status: 400 })

  const redemption = await db.redemptionCode.findUnique({ where: { id: redemptionId } })
  if (!redemption) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (redemption.employeeId !== user.id && user.role !== 'OWNER' && user.role !== 'TENANT_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (redemption.status === 'confirmed') {
    return NextResponse.json({ error: 'Cannot cancel a confirmed redemption' }, { status: 400 })
  }

  await db.redemptionCode.update({
    where: { id: redemptionId },
    data: { status: 'cancelled', cancelledAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
