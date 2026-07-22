'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui/card'
import { KpiCard, SectionCard, StatusBadge } from './shared'
import { formatCurrency, formatNumber, formatDate } from './lib'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Users, UserCheck, DollarSign, Building, Search, Mail, Calendar, Plus } from 'lucide-react'
import { EmployeeForm } from './forms'
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Pie, PieChart, Cell, Legend
} from 'recharts'

interface HRData {
  employees: any[]
  departments: { department: string; _count: number; _sum: { salary: number | null } }[]
  summary: {
    total: number; active: number; onLeave: number; terminated: number;
    totalPayroll: number; avgSalary: number; departmentCount: number;
  }
}

const DEPT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#a855f7', '#3b82f6', '#ec4899', '#ef4444']

export function HRModule({ userRole = 'TENANT_ADMIN' }: { userRole?: string }) {
  const [data, setData] = useState<HRData | null>(null)
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('all')
  const [showForm, setShowForm] = useState(false)

  // Only TENANT_ADMIN can add employees (MANAGER has view-only HR)
  const canAdd = userRole === 'OWNER' || userRole === 'TENANT_ADMIN'

  const loadData = () => fetch('/api/erp/employees').then(r => r.json()).then(setData)
  useEffect(() => { loadData() }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.employees.filter(e =>
      (e.name.toLowerCase().includes(search.toLowerCase()) ||
       e.email.toLowerCase().includes(search.toLowerCase()) ||
       e.role.toLowerCase().includes(search.toLowerCase())) &&
      (dept === 'all' || e.department === dept)
    )
  }, [data, search, dept])

  if (!data) return <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/40" />)}</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Employees" value={formatNumber(data.summary.total)} icon={Users} accent="indigo" />
        <KpiCard label="Active" value={formatNumber(data.summary.active)} icon={UserCheck} accent="emerald" />
        <KpiCard label="Annual Payroll" value={formatCurrency(data.summary.totalPayroll, { compact: true })} icon={DollarSign} accent="purple" />
        <KpiCard label="Departments" value={formatNumber(data.summary.departmentCount)} icon={Building} accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold">Headcount & Payroll by Department</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Total annual salary cost</p>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.departments.map(d => ({
                name: d.department,
                headcount: d._count,
                payroll: d._sum.salary || 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(value: any, name: any) => name === 'payroll' ? [formatCurrency(value), 'Payroll'] : [value, 'Headcount']}
                />
                <Bar yAxisId="left" dataKey="headcount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-border/60">
            <h3 className="font-semibold">Department Distribution</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Headcount share</p>
          </div>
          <div className="p-4 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.departments.map(d => ({ name: d.department, value: d._count }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {data.departments.map((_, i) => (
                    <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <SectionCard
        title="Employee Directory"
        subtitle={`${filtered.length} of ${data.employees.length} employees`}
        action={canAdd && <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-2" /> Add Employee</Button>}
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {data.departments.map(d => (
                <SelectItem key={d.department} value={d.department}>{d.department}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((e) => (
            <Card key={e.id} className="p-4 gap-0 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-indigo-100 text-indigo-700 font-semibold">
                    {e.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{e.name}</h4>
                      <p className="text-xs text-muted-foreground">{e.role}</p>
                    </div>
                    <StatusBadge status={e.status} />
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Building className="h-3 w-3" />
                    <span>{e.department}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-border/60 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{e.email}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Hired {formatDate(e.hireDate, { year: 'numeric' })}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Annual salary</span>
                <span className="font-semibold tabular-nums">{formatCurrency(e.salary, { compact: true })}</span>
              </div>
            </Card>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">No employees match your filters</div>
        )}
      </SectionCard>

      {canAdd && <EmployeeForm open={showForm} onClose={() => setShowForm(false)} onCreated={loadData} />}
    </div>
  )
}
