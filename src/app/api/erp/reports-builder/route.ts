import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/session'

// GET /api/erp/reports-builder - list saved custom reports
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  // Return available data sources + fields for the report builder
  const dataSources = [
    { id: 'products', label: 'Products', fields: ['name', 'sku', 'category', 'price', 'cost', 'stockQty', 'reorderLevel', 'warehouse'] },
    { id: 'orders', label: 'Sales Orders', fields: ['orderNumber', 'customer', 'status', 'total', 'paidAmount', 'createdAt'] },
    { id: 'customers', label: 'Customers', fields: ['name', 'company', 'email', 'phone', 'status', 'totalSpent'] },
    { id: 'transactions', label: 'Transactions', fields: ['type', 'category', 'amount', 'description', 'date'] },
    { id: 'employees', label: 'Employees', fields: ['name', 'email', 'department', 'role', 'salary', 'status'] },
    { id: 'suppliers', label: 'Suppliers', fields: ['name', 'contactName', 'email', 'country', 'rating'] },
  ]

  return NextResponse.json({ dataSources })
}

// POST - execute a custom report query
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['OWNER', 'TENANT_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  const tenantId = user.tenantId
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 400 })

  try {
    const { dataSource, fields, filters, groupBy, sortBy, limit } = await req.json()

    let results: any[] = []
    const select: any = {}
    const where: any = { tenantId }

    // Build select from requested fields
    if (fields && fields.length > 0) {
      for (const f of fields) select[f] = true
    }

    // Apply filters
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== null && value !== '' && value !== undefined) {
          where[key] = typeof value === 'string' ? { contains: value, mode: 'insensitive' } : value
        }
      }
    }

    const take = Math.min(parseInt(limit) || 100, 500)

    switch (dataSource) {
      case 'products':
        results = await db.product.findMany({ where, take, orderBy: sortBy ? { [sortBy.field]: sortBy.direction } : { name: 'asc' }, include: { supplier: { select: { name: true } } } })
        break
      case 'orders':
        results = await db.salesOrder.findMany({ where, take, orderBy: sortBy ? { [sortBy.field]: sortBy.direction } : { createdAt: 'desc' }, include: { customer: { select: { company: true, name: true } } } })
        break
      case 'customers':
        results = await db.customer.findMany({ where, take, orderBy: sortBy ? { [sortBy.field]: sortBy.direction } : { name: 'asc' } })
        break
      case 'transactions':
        results = await db.transaction.findMany({ where, take, orderBy: sortBy ? { [sortBy.field]: sortBy.direction } : { date: 'desc' } })
        break
      case 'employees':
        results = await db.employee.findMany({ where, take, orderBy: sortBy ? { [sortBy.field]: sortBy.direction } : { name: 'asc' } })
        break
      case 'suppliers':
        results = await db.supplier.findMany({ where, take, orderBy: sortBy ? { [sortBy.field]: sortBy.direction } : { name: 'asc' } })
        break
      default:
        return NextResponse.json({ error: 'Unknown data source' }, { status: 400 })
    }

    // Apply grouping if requested
    let grouped: any = null
    if (groupBy) {
      const groups: Record<string, any[]> = {}
      for (const r of results) {
        const key = r[groupBy] || 'N/A'
        if (!groups[key]) groups[key] = []
        groups[key].push(r)
      }
      grouped = Object.entries(groups).map(([key, items]) => ({
        key,
        count: items.length,
        total: items.reduce((s, i) => s + (i.total || i.amount || i.price || 0), 0),
      }))
    }

    return NextResponse.json({ results, grouped, count: results.length })
  } catch (e: any) {
    console.error('Report builder error:', e?.message)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
