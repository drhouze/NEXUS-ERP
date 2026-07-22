// Multi-Tenant ERP Seed Script
// Run with: bun run scripts/seed-erp.ts

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// ===== Demo users (password: "demo1234" for all) =====
const USERS = [
  // Platform owner
  { email: 'owner@nexus.com', name: 'Platform Owner', role: 'OWNER', tenantId: null },

  // Acme Corp tenant
  { email: 'admin@acme.com', name: 'Acme Admin', role: 'TENANT_ADMIN', tenantId: 'acme' },
  { email: 'manager@acme.com', name: 'Acme Manager', role: 'MANAGER', tenantId: 'acme' },
  { email: 'staff@acme.com', name: 'Acme Staff', role: 'EMPLOYEE', tenantId: 'acme' },

  // Globex Inc tenant
  { email: 'admin@globex.com', name: 'Globex Admin', role: 'TENANT_ADMIN', tenantId: 'globex' },
  { email: 'manager@globex.com', name: 'Globex Manager', role: 'MANAGER', tenantId: 'globex' },
  { email: 'staff@globex.com', name: 'Globex Staff', role: 'EMPLOYEE', tenantId: 'globex' },

  // Stark Industries tenant
  { email: 'admin@stark.com', name: 'Stark Admin', role: 'TENANT_ADMIN', tenantId: 'stark' },
  { email: 'staff@stark.com', name: 'Stark Staff', role: 'EMPLOYEE', tenantId: 'stark' },
]

const TENANTS = [
  { id: 'acme', name: 'Acme Corp', industry: 'Manufacturing', plan: 'pro', seats: 25 },
  { id: 'globex', name: 'Globex Inc', industry: 'Technology', plan: 'enterprise', seats: 100 },
  { id: 'stark', name: 'Stark Industries', industry: 'Defense', plan: 'starter', seats: 5 },
]

// Per-tenant data scale
const PRODUCTS_PER_TENANT = 12
const CUSTOMERS_PER_TENANT = 6
const ORDERS_PER_TENANT = 20
const SUPPLIERS_PER_TENANT = 4
const POS_PER_TENANT = 6
const EMPLOYEES_PER_TENANT = 10

const PRODUCT_CATALOG = [
  ['Laptop Pro 14"', 'Electronics', 1299, 890],
  ['Wireless Mouse', 'Electronics', 29, 12],
  ['Mechanical Keyboard', 'Electronics', 89, 42],
  ['4K Monitor 27"', 'Electronics', 449, 280],
  ['USB-C Hub', 'Electronics', 39, 18],
  ['Webcam HD', 'Electronics', 79, 35],
  ['Office Chair Ergo', 'Furniture', 329, 180],
  ['Standing Desk', 'Furniture', 599, 380],
  ['Bookshelf 5-Tier', 'Furniture', 149, 78],
  ['Filing Cabinet', 'Furniture', 199, 110],
  ['A4 Paper 500ct', 'Office Supplies', 8, 3],
  ['Ballpoint Pens 12pk', 'Office Supplies', 6, 2],
  ['Sticky Notes Pack', 'Office Supplies', 5, 1.5],
  ['Stapler Heavy Duty', 'Office Supplies', 24, 9],
  ['Printer Ink Black', 'Office Supplies', 32, 14],
  ['Team Chat License', 'Software', 12, 4],
  ['Antivirus 1Y', 'Software', 49, 18],
  ['Cloud Storage 1TB', 'Software', 99, 35],
  ['Design Suite Pro', 'Software', 599, 220],
  ['VPN Business', 'Software', 89, 28],
]

const CUSTOMER_POOL = [
  ['Northwind Traders', 'Lara Croft', 'lara@northwind.com', '+1 555-1101'],
  ['Contoso Ltd', 'Daniel Ocean', 'docean@contoso.com', '+1 555-1102'],
  ['Fabrikam Inc', 'Rebecca Stone', 'rstone@fabrikam.com', '+1 555-1103'],
  ['Adventure Works', 'Mike Dawson', 'mdawson@advworks.com', '+1 555-1104'],
  ['Tailspin Toys', 'Sophie Hart', 'shart@tailspin.com', '+1 555-1105'],
  ['Wide World Importers', 'Connor Bishop', 'cbishop@wwi.com', '+1 555-1106'],
  ['Coho Winery', 'Aria Sinclair', 'aria@coho.com', '+1 555-1107'],
  ['Proseware Inc', 'Marcus Black', 'mblack@proseware.com', '+1 555-1108'],
  ['Trey Research', 'Hannah Liu', 'hliu@trey.com', '+1 555-1109'],
  ['Woodgrove Bank', 'Victor Chen', 'vchen@woodgrove.com', '+1 555-1110'],
]

const SUPPLIER_POOL = [
  ['TechSource Ltd', 'Mike Chen', 'mike@techsource.com', '+1 555-2111', 'China'],
  ['OfficeGoods Co', 'Sara Park', 'sara@officegoods.com', '+1 555-2121', 'USA'],
  ['FurniturePlus', 'David Kim', 'david@furnitureplus.com', '+1 555-2131', 'Vietnam'],
  ['SoftWholesale', 'Emma Liu', 'emma@softwholesale.com', '+1 555-2141', 'India'],
  ['GlobalParts', 'Tom Reed', 'tom@globalparts.com', '+1 555-2151', 'Germany'],
  ['PrimeShipment', 'Naomi West', 'naomi@prime.com', '+1 555-2161', 'Singapore'],
]

const EMPLOYEE_POOL = [
  ['Sarah Johnson', 'sarah@corp.com', 'Executive', 'CEO', 250000],
  ['Michael Chen', 'mchen@corp.com', 'Finance', 'CFO', 210000],
  ['Jessica Park', 'jpark@corp.com', 'Sales', 'Sales Director', 145000],
  ['David Rodriguez', 'drod@corp.com', 'Operations', 'COO', 195000],
  ['Aisha Patel', 'apatel@corp.com', 'Engineering', 'CTO', 220000],
  ['Marcus Williams', 'mwill@corp.com', 'Sales', 'Account Executive', 95000],
  ['Lily Wang', 'lwang@corp.com', 'HR', 'HR Manager', 110000],
  ['Robert Kim', 'rkim@corp.com', 'Engineering', 'Senior Engineer', 165000],
  ['Maria Garcia', 'mgarcia@corp.com', 'Finance', 'Accountant', 85000],
  ['James Wilson', 'jwilson@corp.com', 'Operations', 'Logistics Lead', 92000],
  ['Emily Brown', 'ebrown@corp.com', 'Sales', 'Sales Rep', 72000],
  ['Kevin Martinez', 'kmartinez@corp.com', 'Engineering', 'Engineer', 125000],
  ['Sophia Lee', 'slee@corp.com', 'HR', 'Recruiter', 78000],
  ['Daniel Taylor', 'dtaylor@corp.com', 'Operations', 'Warehouse Manager', 88000],
  ['Olivia Davis', 'odavis@corp.com', 'Finance', 'Financial Analyst', 95000],
]

const WAREHOUSES = ['WH-North', 'WH-South', 'WH-Central']
const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Marketing', 'Supplies', 'Software', 'Travel', 'Equipment']

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function daysAgo(days: number) { return new Date(Date.now() - days * 86400 * 1000) }

async function seedTenant(tenantId: string) {
  const tenant = TENANTS.find(t => t.id === tenantId)!

  // Warehouses
  console.log(`  Creating warehouses for ${tenant.name}...`)
  const warehouses = await Promise.all([
    db.warehouse.create({ data: { tenantId, code: 'WH-NORTH', name: 'North Warehouse', address: '123 North St', isDefault: true } }),
    db.warehouse.create({ data: { tenantId, code: 'WH-SOUTH', name: 'South Warehouse', address: '456 South Ave' } }),
    db.warehouse.create({ data: { tenantId, code: 'WH-CENTRAL', name: 'Central Warehouse', address: '789 Central Blvd' } }),
  ])

  // Suppliers
  const suppliers = await Promise.all(
    SUPPLIER_POOL.slice(0, SUPPLIERS_PER_TENANT).map(([name, contactName, email, phone, country]) =>
      db.supplier.create({
        data: { tenantId, name, contactName, email, phone, country, rating: randInt(2, 5) },
      })
    )
  )

  // Products
  const products = await Promise.all(
    PRODUCT_CATALOG.slice(0, PRODUCTS_PER_TENANT).map(([name, category, price, cost], i) => {
      const wh = rand(warehouses)
      const stockQty = randInt(0, 120)
      return db.product.create({
        data: {
          tenantId,
          sku: `${tenantId.toUpperCase().slice(0, 3)}-${String(i + 1).padStart(4, '0')}`,
          name, category,
          price: price as number, cost: cost as number,
          stockQty,
          reorderLevel: randInt(10, 30),
          reorderQty: randInt(30, 80),
          warehouse: wh.code,
          warehouseId: wh.id,
          supplierId: rand(suppliers).id,
        },
      })
    })
  )

  // Log initial stock movements
  const allProducts = await db.product.findMany({ where: { tenantId } })
  for (const p of allProducts) {
    if (p.stockQty > 0) {
      await db.stockMovement.create({
        data: {
          tenantId,
          productId: p.id,
          warehouseId: p.warehouseId,
          type: 'in',
          quantity: p.stockQty,
          reason: 'initial',
          notes: 'Initial stock on tenant setup',
        },
      })
    }
  }

  // Customers
  const customers = await Promise.all(
    CUSTOMER_POOL.slice(0, CUSTOMERS_PER_TENANT).map(([company, name, email, phone]) =>
      db.customer.create({
        data: {
          tenantId,
          name, email, phone, company,
          status: rand(['lead', 'active', 'active', 'active', 'inactive']),
          totalSpent: 0,
        },
      })
    )
  )

  // Sales Orders
  let orderCounter = 1000
  for (let i = 0; i < ORDERS_PER_TENANT; i++) {
    const customer = rand(customers)
    const itemCount = randInt(1, 4)
    const items = []
    for (let j = 0; j < itemCount; j++) {
      const p = rand(products)
      items.push({ productId: p.id, qty: randInt(1, 8), unitPrice: p.price })
    }
    const total = items.reduce((s, it) => s + it.qty * it.unitPrice, 0)
    const status = i < 3 ? 'pending' : i < 7 ? 'processing' : i < 12 ? 'shipped' : i < 18 ? 'delivered' : 'cancelled'
    const createdAt = daysAgo(randInt(0, 45))
    const order = await db.salesOrder.create({
      data: {
        tenantId,
        orderNumber: `SO-${orderCounter++}`,
        customerId: customer.id,
        status, total, createdAt,
        items: { create: items },
      },
    })

    if (status === 'delivered' || status === 'shipped') {
      await db.customer.update({ where: { id: customer.id }, data: { totalSpent: { increment: total } } })
      await db.transaction.create({
        data: {
          tenantId,
          type: 'income',
          category: 'Product Sales',
          amount: total,
          description: `Sales Order ${order.orderNumber}`,
          date: createdAt,
          refType: 'sales_order',
          refId: order.id,
        },
      })
    }

    await db.activity.create({
      data: {
        tenantId,
        type: 'order',
        message: `${order.orderNumber} placed by ${customer.company} - $${total.toFixed(0)}`,
        createdAt,
      },
    })
  }

  // Purchase Orders
  let poCounter = 2000
  for (let i = 0; i < POS_PER_TENANT; i++) {
    const supplier = rand(suppliers)
    const itemCount = randInt(1, 3)
    const items = []
    for (let j = 0; j < itemCount; j++) {
      const p = rand(products)
      items.push({ productId: p.id, qty: randInt(20, 100), unitCost: p.cost })
    }
    const total = items.reduce((s, it) => s + it.qty * it.unitCost, 0)
    const status = i < 1 ? 'draft' : i < 4 ? 'sent' : 'received'
    const createdAt = daysAgo(randInt(0, 60))
    const po = await db.purchaseOrder.create({
      data: {
        tenantId,
        poNumber: `PO-${poCounter++}`,
        supplierId: supplier.id,
        status, total, createdAt,
        items: { create: items },
      },
    })

    if (status === 'received') {
      await db.transaction.create({
        data: {
          tenantId,
          type: 'expense',
          category: 'Supplies',
          amount: total,
          description: `Purchase Order ${po.poNumber}`,
          date: createdAt,
          refType: 'purchase_order',
          refId: po.id,
        },
      })
    }
  }

  // Employees
  await Promise.all(
    EMPLOYEE_POOL.slice(0, EMPLOYEES_PER_TENANT).map(([name, email, department, role, salary], i) =>
      db.employee.create({
        data: {
          tenantId,
          name, email, department, role,
          salary: salary as number,
          hireDate: daysAgo(randInt(60, 1800)),
          status: i === 6 ? 'on_leave' : 'active',
        },
      })
    )
  )

  // Payroll + misc expenses + subscription income
  for (let m = 0; m < 3; m++) {
    const totalPayroll = EMPLOYEE_POOL.slice(0, EMPLOYEES_PER_TENANT).reduce((s, [, , , , sal]) => s + (sal as number) / 12, 0)
    await db.transaction.create({
      data: { tenantId, type: 'expense', category: 'Payroll', amount: totalPayroll, description: 'Monthly Payroll', date: daysAgo(30 * m + 1), refType: 'payroll' },
    })
  }

  for (let i = 0; i < 10; i++) {
    const cat = rand(EXPENSE_CATEGORIES)
    await db.transaction.create({
      data: { tenantId, type: 'expense', category: cat, amount: randInt(500, 8000), description: `${cat} expense`, date: daysAgo(randInt(0, 90)), refType: 'other' },
    })
  }

  for (let i = 0; i < 5; i++) {
    await db.transaction.create({
      data: { tenantId, type: 'income', category: 'Subscriptions', amount: randInt(500, 3000), description: 'Monthly subscription revenue', date: daysAgo(randInt(0, 90)), refType: 'other' },
    })
  }

  // Inventory low-stock activity
  const lowStock = await db.product.findMany({ where: { tenantId, stockQty: { lte: 15 } }, take: 3 })
  for (const p of lowStock) {
    await db.activity.create({
      data: { tenantId, type: 'inventory', message: `Low stock: ${p.name} (${p.stockQty} left)`, createdAt: daysAgo(randInt(0, 5)) },
    })
  }
}

async function main() {
  console.log('Clearing DB...')
  await db.stockMovement.deleteMany()
  await db.warehouse.deleteMany()
  await db.activity.deleteMany()
  await db.transaction.deleteMany()
  await db.salesOrderItem.deleteMany()
  await db.salesOrder.deleteMany()
  await db.purchaseOrderItem.deleteMany()
  await db.purchaseOrder.deleteMany()
  await db.employee.deleteMany()
  await db.product.deleteMany()
  await db.customer.deleteMany()
  await db.supplier.deleteMany()
  await db.user.deleteMany()
  await db.tenant.deleteMany()

  // Tenants
  console.log('Seeding tenants...')
  for (const t of TENANTS) {
    await db.tenant.create({ data: t })
  }

  // Users
  console.log('Seeding users...')
  const hashedPassword = await bcrypt.hash('demo1234', 10)
  for (const u of USERS) {
    await db.user.create({
      data: {
        email: u.email,
        name: u.name,
        role: u.role,
        tenantId: u.tenantId,
        password: hashedPassword,
        status: 'active',
      },
    })
  }

  // Per-tenant data
  for (const t of TENANTS) {
    console.log(`Seeding data for tenant: ${t.name}...`)
    await seedTenant(t.id)
  }

  console.log('\n✅ Seed complete!')
  console.log({
    tenants: await db.tenant.count(),
    users: await db.user.count(),
    products: await db.product.count(),
    customers: await db.customer.count(),
    salesOrders: await db.salesOrder.count(),
    suppliers: await db.supplier.count(),
    purchaseOrders: await db.purchaseOrder.count(),
    employees: await db.employee.count(),
    transactions: await db.transaction.count(),
    activities: await db.activity.count(),
  })

  console.log('\n📋 Demo login credentials (password: demo1234):')
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(13)} ${u.email.padEnd(28)} ${u.tenantId || 'PLATFORM'}`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
