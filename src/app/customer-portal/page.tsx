'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { User, ShoppingCart, FileText, Loader2, QrCode } from 'lucide-react'
import { formatCurrency, formatDate } from '@/components/erp/lib'

export default function CustomerPortalPage() {
  const [email, setEmail] = useState('')
  const [loggedIn, setLoggedIn] = useState(false)
  const [customer, setCustomer] = useState<any>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function login() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/portal/customer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setCustomer(d.customer)
      setOrders(d.orders || [])
      setLoggedIn(true)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><User className="h-6 w-6" /></div>
              <div><CardTitle>Customer Portal</CardTitle><p className="text-sm text-muted-foreground">View your orders, invoices, and payment history</p></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <div>
              <label className="text-xs font-medium">Email Address</label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="mt-1" />
            </div>
            <Button className="w-full" onClick={login} disabled={loading || !email}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}Access Portal
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const balance = orders.reduce((s, o) => s + (o.total - (o.paidAmount || 0)), 0)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center"><User className="h-5 w-5" /></div>
            <div>
              <h1 className="text-xl font-bold">{customer.company}</h1>
              <p className="text-sm text-muted-foreground">{customer.name} · Customer Portal</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLoggedIn(false)}>Logout</Button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="p-4"><ShoppingCart className="h-5 w-5 text-blue-500 mb-1" /><p className="text-xs text-muted-foreground">Total Orders</p><p className="text-xl font-bold">{orders.length}</p></Card>
          <Card className="p-4"><FileText className="h-5 w-5 text-emerald-500 mb-1" /><p className="text-xs text-muted-foreground">Total Spent</p><p className="text-xl font-bold">{formatCurrency(customer.totalSpent)}</p></Card>
          <Card className="p-4"><div className="h-5 w-5 mb-1" /><p className="text-xs text-muted-foreground">Outstanding Balance</p><p className={`text-xl font-bold ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(balance)}</p></Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Your Orders</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="pb-2 pr-4">Order #</th><th className="pb-2 pr-4">Date</th><th className="pb-2 pr-4">Status</th><th className="pb-2 pr-4">Payment</th><th className="pb-2 pr-4 text-right">Total</th><th className="pb-2 pr-4 text-right">Balance</th><th className="pb-2"></th>
                </tr></thead>
                <tbody>
                  {orders.map(o => {
                    const bal = o.total - (o.paidAmount || 0)
                    return (
                      <tr key={o.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="py-3 pr-4 font-mono text-xs">{o.orderNumber}</td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs">{formatDate(o.createdAt)}</td>
                        <td className="py-3 pr-4"><Badge className={o.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : o.status === 'cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}>{o.status}</Badge></td>
                        <td className="py-3 pr-4"><Badge variant="outline" className={bal <= 0 ? 'text-emerald-700' : 'text-rose-700'}>{bal <= 0 ? 'Paid' : (o.paidAmount || 0) > 0 ? 'Partial' : 'Unpaid'}</Badge></td>
                        <td className="py-3 pr-4 text-right tabular-nums font-medium">{formatCurrency(o.total)}</td>
                        <td className="py-3 pr-4 text-right tabular-nums text-rose-600">{bal > 0 ? formatCurrency(bal) : '—'}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1">
                            <a href={`/docs/invoice/${o.id}`} target="_blank"><Button size="sm" variant="ghost"><FileText className="h-3 w-3" /></Button></a>
                            {bal > 0 && o.status !== 'cancelled' && (
                              <a href={`/pay/duitnow/${o.id}`} target="_blank">
                                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700">
                                  <QrCode className="h-3 w-3 mr-1" />Pay with DuitNow
                                </Button>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {orders.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No orders yet</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
