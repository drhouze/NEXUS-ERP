'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Smartphone, Copy, CheckCircle2, AlertCircle, QrCode, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/components/erp/lib'

export default function TngPaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const [orderId, setOrderId] = useState('')
  const [order, setOrder] = useState<any>(null)
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [paymentLink, setPaymentLink] = useState('')
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<any>(null)

  useEffect(() => {
    params.then(p => setOrderId(p.orderId))
  }, [params])

  useEffect(() => {
    if (!orderId) return
    fetch(`/api/erp/payments/tng/${orderId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setOrder(d.order)
        setQrCodeUrl(d.qrCodeUrl)
        setPaymentLink(d.paymentLink)
        setLoading(false)
        // Start polling
        pollRef.current = setInterval(async () => {
          const res = await fetch(`/api/erp/payments/tng/${orderId}/status`)
          const pd = await res.json()
          if (pd.status === 'paid') {
            setStatus('paid')
            if (pollRef.current) clearInterval(pollRef.current)
          }
        }, 5000)
      })
      .catch(() => { setError('Failed to load payment'); setLoading(false) })
  }, [orderId])

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  function copyLink() {
    navigator.clipboard.writeText(paymentLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100 p-6">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
            <p className="font-medium text-rose-600">{error}</p>
            <Link href="/customer-portal" className="mt-4 inline-block">
              <Button variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back to Portal</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const balance = order.total - (order.paidAmount || 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 text-white mb-3">
            <Smartphone className="h-5 w-5" />
            <span className="font-bold">Touch 'n Go eWallet</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pay Your Invoice</h1>
        </div>

        <Card className="overflow-hidden">
          {status === 'paid' ? (
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-emerald-700">Payment Successful!</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                Your payment of <strong>{formatCurrency(balance)}</strong> for <strong>{order.orderNumber}</strong> has been received.
              </p>
              <Link href="/customer-portal">
                <Button className="w-full">Back to Portal</Button>
              </Link>
            </CardContent>
          ) : (
            <>
              <div className="bg-emerald-600 text-white p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-90">Order</span>
                  <span className="font-mono font-semibold">{order.orderNumber}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="opacity-90 text-sm">Amount Due</span>
                  <span className="text-2xl font-bold">{formatCurrency(balance)}</span>
                </div>
              </div>

              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  <div className="inline-block p-4 bg-white rounded-xl border-2 border-emerald-200 shadow-sm">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="TNG Payment QR Code" className="w-48 h-48" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-muted rounded">
                        <QrCode className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700 mt-3">Scan with Touch 'n Go eWallet to pay</p>
                </div>

                <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 space-y-1">
                  <p><strong>How to pay:</strong></p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Open Touch 'n Go eWallet app</li>
                    <li>Tap "Scan" icon</li>
                    <li>Point camera at the QR code above</li>
                    <li>Confirm payment amount: <strong>{formatCurrency(balance)}</strong></li>
                    <li>Enter your TNG PIN to complete</li>
                  </ol>
                </div>

                {paymentLink && (
                  <div>
                    <Label className="text-xs">Or share this payment link:</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={paymentLink} readOnly className="text-xs font-mono" />
                      <Button size="sm" variant="outline" onClick={copyLink}>
                        {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                  <span className="text-sm text-muted-foreground">Waiting for payment confirmation...</span>
                </div>

                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-xs">
                    <strong>Demo mode:</strong> In production, TNG sends a webhook callback when payment is received. Click below to simulate.
                  </AlertDescription>
                </Alert>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={async () => {
                    const res = await fetch(`/api/erp/payments/tng/${orderId}/confirm`, { method: 'POST' })
                    if (res.ok) { setStatus('paid'); clearInterval(pollRef.current) }
                  }}
                >
                  <Smartphone className="h-4 w-4 mr-2" /> Simulate TNG Payment
                </Button>
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Secured by Touch 'n Go eWallet · {order.customer?.company || ''}
        </p>
      </div>
    </div>
  )
}
