'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Truck, Package, Clock, CheckCircle, Loader2 } from 'lucide-react'
import { formatCurrency, formatDate } from '@/components/erp/lib'

export default function SupplierPortalPage() {
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [supplier, setSupplier] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function login() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/portal/supplier', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setToken(d.token)
      setSupplier(d.supplier)
      setOrders(d.orders || [])
      setLoggedIn(true)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center"><Truck className="h-6 w-6" /></div>
              <div><CardTitle>Supplier Portal</CardTitle><p className="text-sm text-muted-foreground">View your purchase orders + update shipping status</p></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div>
              <label className="text-xs font-medium">Email Address</label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="supplier@company.com" className="mt-1" />
            </div>
            <Button className="w-full" onClick={login} disabled={loading || !email}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Access Portal
            </Button>
            <p className="text-xs text-center text-muted-foreground">Demo: try mike@techsource.com, sara@officegoods.com, david@furnitureplus.com</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center"><Truck className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-bold">{supplier.name}</h1>
              <p className="text-sm text-muted-foreground">Supplier Portal · {supplier.contactName}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLoggedIn(false)}>Logout</Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-4"><div className="flex items-center gap-3"><Clock className="h-5 w-5 text-amber-500" /><div><p className="text-xs text-muted-foreground">Pending POs</p><p className="text-xl font-bold">{orders.filter(o => o.status === 'sent').length}</p></div></div></Card>
          <Card className="p-4"><div className="flex items-center gap-3"><Package className="h-5 w-5 text-blue-500" /><div><p className="text-xs text-muted-foreground">Total POs</p><p className="text-xl font-bold">{orders.length}</p></div></div></Card>
          <Card className="p-4"><div className="flex items-center gap-3"><CheckCircle className="h-5 w-5 text-emerald-500" /><div><p className="text-xs text-muted-foreground">Completed</p><p className="text-xl font-bold">{orders.filter(o => o.status === 'received').length}</p></div></div></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Purchase Orders</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="pb-2 pr-4">PO #</th><th className="pb-2 pr-4">Date</th><th className="pb-2 pr-4">Items</th><th className="pb-2 pr-4">Status</th><th className="pb-2 pr-4 text-right">Total</th>
                </tr></thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 pr-4 font-mono text-xs">{o.poNumber}</td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs">{formatDate(o.createdAt)}</td>
                      <td className="py-3 pr-4">{o.items?.length || 0} items</td>
                      <td className="py-3 pr-4"><Badge className={o.status === 'received' ? 'bg-emerald-100 text-emerald-700' : o.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100'}>{o.status}</Badge></td>
                      <td className="py-3 pr-4 text-right tabular-nums font-medium">{formatCurrency(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No purchase orders yet</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
