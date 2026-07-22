'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Copy, CheckCircle2, AlertCircle, ArrowLeft, QrCode, Smartphone } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/components/erp/lib'

export default function DuitNowPaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const [orderId, setOrderId] = useState('')
  const [data, setData] = useState<any>(null)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [selectedWallet, setSelectedWallet] = useState('')
  const pollRef = useRef<any>(null)

  useEffect(() => { params.then(p => setOrderId(p.orderId)) }, [params])

  useEffect(() => {
    if (!orderId) return
    fetch(`/api/erp/duitnow/${orderId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        setData(d)
        setLoading(false)
        pollRef.current = setInterval(async () => {
          const res = await fetch(`/api/erp/duitnow/${orderId}/status`)
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
    if (data?.paymentLink) {
      navigator.clipboard.writeText(data.paymentLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function simulatePayment() {
    const wallet = selectedWallet || 'DuitNow QR'
    const res = await fetch(`/api/erp/duitnow/${orderId}/confirm`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet }),
    })
    if (res.ok) {
      setStatus('paid')
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
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

  const balance = data.order.balance

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6 flex items-center justify-center">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600 text-white mb-3">
            <QrCode className="h-5 w-5" />
            <span className="font-bold">DuitNow QR</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{data.merchantName}</h1>
          <p className="text-sm text-muted-foreground mt-1">Scan to pay with any Malaysian e-wallet or bank app</p>
        </div>

        <Card className="overflow-hidden">
          {status === 'paid' ? (
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-emerald-700">Payment Successful!</h2>
              <p className="text-sm text-muted-foreground mt-2 mb-4">
                Your payment of <strong>{formatCurrency(balance)}</strong> for <strong>{data.order.orderNumber}</strong> has been received.
              </p>
              <p className="text-xs text-muted-foreground mb-4">A receipt has been generated. Thank you for your payment!</p>
              <Link href="/customer-portal">
                <Button className="w-full">Back to Portal</Button>
              </Link>
            </CardContent>
          ) : (
            <>
              {/* Order summary */}
              <div className="bg-blue-600 text-white p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="opacity-90">Order</span>
                  <span className="font-mono font-semibold">{data.order.orderNumber}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="opacity-90">Merchant</span>
                  <span className="font-medium">{data.order.tenant.name}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="opacity-90 text-sm">Amount Due</span>
                  <span className="text-2xl font-bold">RM {balance.toFixed(2)}</span>
                </div>
              </div>

              <CardContent className="pt-6 space-y-4">
                {/* QR Code */}
                <div className="text-center">
                  <div className="inline-block p-4 bg-white rounded-xl border-2 border-blue-200 shadow-sm">
                    {data.qrCodeUrl ? (
                      <img src={data.qrCodeUrl} alt="DuitNow QR Code" className="w-48 h-48" />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center bg-muted rounded">
                        <QrCode className="h-16 w-16 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-700 mt-3">Scan with any supported app to pay</p>
                </div>

                {/* Supported wallets */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Supported Payment Apps:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {data.supportedWallets.map((w: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => setSelectedWallet(w.name)}
                        className={`flex flex-col items-center p-2 rounded-lg border text-center transition-colors ${selectedWallet === w.name ? 'border-blue-500 bg-blue-50' : 'border-border hover:bg-muted/50'}`}
                        title={w.name}
                      >
                        <span className="text-lg">{w.icon}</span>
                        <span className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{w.name}</span>
                      </button>
                    ))}
                  </div>
                  {selectedWallet && (
                    <p className="text-xs text-blue-600 mt-1 text-center">Selected: {selectedWallet}</p>
                  )}
                </div>

                {/* Instructions */}
                <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800 space-y-1">
                  <p><strong>How to pay:</strong></p>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Open your e-wallet or banking app</li>
                    <li>Tap "Scan" or "Scan & Pay"</li>
                    <li>Point camera at the QR code above</li>
                    <li>Confirm amount: <strong>RM {balance.toFixed(2)}</strong></li>
                    <li>Enter PIN to complete payment</li>
                  </ol>
                </div>

                {/* Payment link */}
                {data.paymentLink && (
                  <div>
                    <Label className="text-xs">Or share this payment link:</Label>
                    <div className="flex gap-2 mt-1">
                      <Input value={data.paymentLink} readOnly className="text-xs font-mono" />
                      <Button size="sm" variant="outline" onClick={copyLink}>
                        {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm text-muted-foreground">Waiting for payment...</span>
                </div>

                {/* Demo simulate */}
                {!data.isLive && (
                  <>
                    <Alert className="border-amber-200 bg-amber-50">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-800 text-xs">
                        <strong>Demo mode:</strong> No merchant credentials configured. Click below to simulate payment. Add your DuitNow merchant credentials in Settings to go live.
                      </AlertDescription>
                    </Alert>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={simulatePayment}>
                      <Smartphone className="h-4 w-4 mr-2" /> {selectedWallet ? `Simulate ${selectedWallet} Payment` : 'Simulate Payment'}
                    </Button>
                  </>
                )}
              </CardContent>
            </>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Secured by DuitNow (PayNet Malaysia) · {data.order.tenant.name}
        </p>
      </div>
    </div>
  )
}
