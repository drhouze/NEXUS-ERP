// Safe upsert script: ensure demo tenants & users exist with password 'demo1234'
// Run with: npx tsx scripts/upsert-demo-users.ts

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const USERS = [
  { email: 'owner@nexus.com', name: 'Platform Owner', role: 'OWNER', tenantId: null },
  { email: 'admin@acme.com', name: 'Acme Admin', role: 'TENANT_ADMIN', tenantId: 'acme' },
  { email: 'manager@acme.com', name: 'Acme Manager', role: 'MANAGER', tenantId: 'acme' },
  { email: 'staff@acme.com', name: 'Acme Staff', role: 'EMPLOYEE', tenantId: 'acme' },
  { email: 'admin@globex.com', name: 'Globex Admin', role: 'TENANT_ADMIN', tenantId: 'globex' },
  { email: 'manager@globex.com', name: 'Globex Manager', role: 'MANAGER', tenantId: 'globex' },
  { email: 'staff@globex.com', name: 'Globex Staff', role: 'EMPLOYEE', tenantId: 'globex' },
  { email: 'admin@stark.com', name: 'Stark Admin', role: 'TENANT_ADMIN', tenantId: 'stark' },
  { email: 'staff@stark.com', name: 'Stark Staff', role: 'EMPLOYEE', tenantId: 'stark' },
]

const TENANTS = [
  { id: 'acme', name: 'Acme Corp', industry: 'Manufacturing', plan: 'pro', seats: 25 },
  { id: 'globex', name: 'Globex Inc', industry: 'Technology', plan: 'enterprise', seats: 100 },
  { id: 'stark', name: 'Stark Industries', industry: 'Defense', plan: 'starter', seats: 5 },
]

async function main() {
  const password = process.env.DEMO_PASSWORD || 'demo1234'
  const hashed = await bcrypt.hash(password, 10)

  console.log('Upserting tenants...')
  for (const t of TENANTS) {
    await db.tenant.upsert({
      where: { id: t.id },
      update: { name: t.name, industry: t.industry, plan: t.plan, seats: t.seats },
      create: { id: t.id, name: t.name, industry: t.industry, plan: t.plan, seats: t.seats },
    })
    console.log(`  ensured tenant: ${t.id}`)
  }

  console.log('\nUpserting users (password: ' + password + ')...')
  for (const u of USERS) {
    const email = u.email.toLowerCase()
    const data = {
      email,
      name: u.name,
      role: u.role as any,
      tenantId: u.tenantId as string | null,
      password: hashed,
      status: 'active',
    }

    await db.user.upsert({
      where: { email },
      update: { ...data },
      create: { ...data },
    })
    console.log(`  ensured user: ${email} (${u.role}) tenant=${u.tenantId || 'PLATFORM'}`)
  }

  console.log('\nDone. Demo users are ready.');
  console.log('\nYou can now login with the following credentials:')
  for (const u of USERS) console.log(`  ${u.email}  password: ${password}`)
}

main()
  .catch((e) => { console.error('Failed:', e); process.exit(1) })
  .finally(() => db.$disconnect())
