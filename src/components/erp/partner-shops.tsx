'use client'

import * as React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Loader2, CheckCircle2, AlertCircle, Store, QrCode, Scan, Gift,
  ChevronRight, ArrowLeft, X, ShoppingBag, Coins, User, Clock,
} from 'lucide-react'
import { formatDate } from './lib'
import { QRScanner } from './qr-scanner'

type View = 'shops' | 'shop-items' | 'qr' | 'my-redemptions'

export function PartnerShops({ userPoints, pointsLabel, userTenantId }: { userPoints: number; pointsLabel: string; userTenantId?: string }) {
  const [view, setView] = React.useState<View>('shops')
  const [shops, setShops] = React.useState<any[]>([])
  const [selectedShop, setSelectedShop] = React.useState<any>(null)
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [redeemLoading, setRedeemLoading] = React.useState<string | null>(null)
  const [qrRedemption, setQrRedemption] = React.useState<any>(null)
  const [myRedemptions, setMyRedemptions] = React.useState<any[]>([])
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')
  const [feeConfig, setFeeConfig] = React.useState({ enabled: false, percent: 0 })

  // Poll for status updates when QR is showing (so the employee sees when the shop owner scans)
  const [polling, setPolling] = React.useState(false)

  React.useEffect(() => {
    loadShops()
    loadMyRedemptions()
    // Fetch platform fee config for cross-tenant display
    fetch('/api/platform/settings/fee').then(r => r.json()).then(d => {
      if (d.enabled) setFeeConfig({ enabled: true, percent: d.percent })
    }).catch(() => {})
  }, [])

  // Poll for status changes when QR code is displayed.
  // Uses a ref to avoid re-creating the interval on every status change.
  const redemptionIdRef = React.useRef<string | null>(null)
  redemptionIdRef.current = qrRedemption?.id || null

  React.useEffect(() => {
    if (view !== 'qr' || !qrRedemption) return
    const targetId = qrRedemption.id

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/erp/partner-shops/redeem?status=pending,scanned,confirmed,cancelled`)
        const d = await res.json()
        const found = d.redemptions?.find((r: any) => r.id === targetId)
        if (found) {
          // Update the redemption with fresh data from the server
          setQrRedemption((prev: any) => {
            if (!prev || prev.id !== targetId) return prev
            if (prev.status !== found.status) {
              if (found.status === 'scanned') {
                setSuccess('Shop owner scanned your code! Click "Confirm" to transfer points and unlock your reward.')
              }
              if (found.status === 'confirmed') {
                setSuccess('Redemption confirmed! Enjoy your reward.')
              }
              if (found.status === 'cancelled') {
                setError('This redemption was cancelled.')
              }
              return { ...prev, status: found.status }
            }
            return prev
          })
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [view, qrRedemption?.id])

  async function loadShops() {
    setLoading(true)
    try {
      const res = await fetch('/api/erp/partner-shops?withCatalog=true')
      const d = await res.json()
      setShops(d.shops || [])
    } catch { setError('Failed to load shops') }
    finally { setLoading(false) }
  }

  async function loadMyRedemptions() {
    try {
      const res = await fetch('/api/erp/partner-shops/redeem')
      const d = await res.json()
      setMyRedemptions(d.redemptions || [])
    } catch {}
  }

  async function selectShop(shop: any) {
    setSelectedShop(shop)
    setItems(shop.catalog || [])
    setView('shop-items')
  }

  async function redeem(itemId: string) {
    setRedeemLoading(itemId)
    setError(''); setSuccess('')
    try {
      const res = await fetch('/api/erp/partner-shops/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setQrRedemption(d.redemption)
      setView('qr')
      setSuccess('QR code generated! Show this to the shop owner to scan.')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRedeemLoading(null)
    }
  }

  async function confirmRedemption() {
    if (!qrRedemption) return
    setPolling(true)
    setError('')
    try {
      const res = await fetch('/api/erp/partner-shops/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redemptionId: qrRedemption.id }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess(`Confirmed! ${d.remainingPoints} ${pointsLabel} remaining. Enjoy your: ${d.reward?.itemName} from ${d.reward?.shopName}`)
      setQrRedemption({ ...qrRedemption, status: 'confirmed' })
      loadMyRedemptions()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPolling(false)
    }
  }

  async function cancelRedemption() {
    if (!qrRedemption) return
    if (!confirm('Cancel this redemption? No points will be deducted.')) return
    try {
      await fetch(`/api/erp/partner-shops/confirm?redemptionId=${qrRedemption.id}`, { method: 'DELETE' })
      setView('shops')
      setQrRedemption(null)
      loadMyRedemptions()
    } catch {}
  }

  if (loading) {
    return <div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/40" />)}</div>
  }

  return (
    <div className="space-y-4">
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      {/* Shops list */}
      {view === 'shops' && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Store className="h-4 w-4" /> Partner Shops</h3>
            <Button size="sm" variant="outline" onClick={() => { setView('my-redemptions'); loadMyRedemptions() }}>
              <Clock className="h-3.5 w-3.5 mr-1" /> My Redemptions ({myRedemptions.filter(r => r.status !== 'cancelled').length})
            </Button>
          </div>
          {shops.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No partner shops available</p>
              <p className="text-xs mt-1">Check back later for new partners!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shops.map(shop => (
                <Card key={shop.id} className="p-4 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all" onClick={() => selectShop(shop)}>
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2.5">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-semibold text-sm">{shop.name}</h4>
                        {shop.isGlobal && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">GLOBAL</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{shop.category}</p>
                      {shop.tenant?.name && (
                        <p className="text-[10px] text-muted-foreground">by {shop.tenant.name}</p>
                      )}
                      {shop.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{shop.description}</p>}
                      <p className="text-xs font-medium mt-2 text-primary">{shop.catalog?.length || 0} rewards available</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Shop items */}
      {view === 'shop-items' && selectedShop && (
        <>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setView('shops')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to shops
            </Button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-primary/10 p-2.5"><Store className="h-5 w-5 text-primary" /></div>
            <div>
              <h3 className="font-semibold">{selectedShop.name}</h3>
              <p className="text-xs text-muted-foreground">{selectedShop.description || selectedShop.category}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(item => {
              const canAfford = userPoints >= item.pointsCost
              const outOfStock = item.stock === 0
              return (
                <Card key={item.id} className="p-4 flex flex-col">
                  {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-32 object-cover rounded-lg mb-3" />}
                  <div className="flex items-center gap-1 mb-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      item.rewardType === 'freeGift' ? 'bg-emerald-100 text-emerald-700' :
                      item.rewardType === 'discount' ? 'bg-blue-100 text-blue-700' :
                      item.rewardType === 'service' ? 'bg-purple-100 text-purple-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {item.rewardType === 'freeGift' ? 'Free Gift' : item.rewardType === 'discount' ? 'Discount' : item.rewardType === 'service' ? 'Service' : 'Voucher'}
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm">{item.name}</h4>
                  {item.rewardDetails && <p className="text-xs font-medium text-muted-foreground mt-0.5">{item.rewardDetails}</p>}
                  {item.description && <p className="text-xs text-muted-foreground mt-1 flex-1">{item.description}</p>}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t">
                    <span className="flex items-center gap-1 text-amber-700 font-bold">
                      <Coins className="h-4 w-4" /> {item.pointsCost}
                    </span>
                    {item.stock > 0 && <span className="text-xs text-muted-foreground">{item.stock} left</span>}
                  </div>
                  <Button
                    size="sm"
                    className="mt-2 w-full"
                    disabled={!canAfford || outOfStock || redeemLoading === item.id}
                    onClick={() => redeem(item.id)}
                  >
                    {redeemLoading === item.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <QrCode className="h-4 w-4 mr-1" />}
                    {outOfStock ? 'Sold Out' : canAfford ? 'Redeem (Get QR)' : 'Not Enough Points'}
                  </Button>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* QR code view */}
      {view === 'qr' && qrRedemption && (
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant="ghost" onClick={() => { setView('shop-items'); setQrRedemption(null) }}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          </div>

          <Card className="p-6 text-center space-y-4">
            {/* Status badge */}
            <div className="inline-block">
              {qrRedemption.status === 'pending' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  ⏳ Waiting for shop owner to scan
                </span>
              )}
              {qrRedemption.status === 'scanned' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  ✅ Scanned! Ready to confirm
                </span>
              )}
              {qrRedemption.status === 'confirmed' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                  ✅ Confirmed! Enjoy your reward
                </span>
              )}
              {qrRedemption.status === 'cancelled' && (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700">
                  ❌ Cancelled
                </span>
              )}
            </div>

            {/* Shop + item info */}
            <div>
              <h3 className="font-semibold text-lg">{qrRedemption.item.name}</h3>
              <p className="text-sm text-muted-foreground">{qrRedemption.shop.name}</p>
              {qrRedemption.item.rewardDetails && (
                <p className="text-sm font-medium text-primary mt-1">{qrRedemption.item.rewardDetails}</p>
              )}
            </div>

            {/* QR code */}
            {qrRedemption.status !== 'confirmed' && qrRedemption.status !== 'cancelled' && (
              <div className="flex justify-center">
                <img src={qrRedemption.qrCodeDataUrl} alt="Redemption QR Code" className="rounded-lg border p-2" width={280} height={280} />
              </div>
            )}

            {/* Short code for manual entry */}
            {qrRedemption.status !== 'confirmed' && qrRedemption.status !== 'cancelled' && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Or enter code manually:</p>
                <p className="text-2xl font-bold font-mono tracking-widest text-primary">{qrRedemption.code}</p>
              </div>
            )}

            {/* Points cost + fee breakdown */}
            <div className="space-y-1">
              <div className="flex items-center justify-center gap-2 text-amber-700">
                <Coins className="h-5 w-5" />
                <span className="font-bold text-lg">{qrRedemption.pointsCost} {pointsLabel}</span>
              </div>
              {/* Cross-tenant fee breakdown */}
              {(() => {
                const shopTenantId = qrRedemption.shop?.tenantId || shops.find(s => s.id === qrRedemption.shop?.id)?.tenantId
                const isCrossTenant = userTenantId && shopTenantId && userTenantId !== shopTenantId
                if (!isCrossTenant || !feeConfig.enabled || feeConfig.percent === 0) return null
                const fee = Math.round(qrRedemption.pointsCost * feeConfig.percent / 100)
                const shopReceives = qrRedemption.pointsCost - fee
                return (
                  <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-2 space-y-0.5">
                    <div className="flex justify-between"><span>You pay:</span><span className="font-medium">{qrRedemption.pointsCost} {pointsLabel}</span></div>
                    <div className="flex justify-between text-rose-600"><span>Deflation fee ({feeConfig.percent}%):</span><span>-{fee}</span></div>
                    <div className="flex justify-between text-emerald-600"><span>Shop receives:</span><span>+{shopReceives}</span></div>
                    <p className="text-[10px] pt-1 border-t">The fee is burned (removed from circulation) to prevent point inflation across the circular economy.</p>
                  </div>
                )
              })()}
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              {qrRedemption.status === 'scanned' && (
                <Button className="w-full" size="lg" onClick={confirmRedemption} disabled={polling}>
                  {polling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Confirm — Transfer {qrRedemption.pointsCost} {pointsLabel}
                </Button>
              )}
              {qrRedemption.status === 'pending' && (
                <p className="text-xs text-muted-foreground py-2">
                  The shop owner needs to scan this QR code first. Once scanned, you'll see a "Confirm" button here.
                </p>
              )}
              {qrRedemption.status !== 'confirmed' && qrRedemption.status !== 'cancelled' && (
                <Button variant="outline" className="w-full" onClick={cancelRedemption}>
                  <X className="h-4 w-4 mr-1" /> Cancel Redemption
                </Button>
              )}
              {qrRedemption.status === 'confirmed' && (
                <Button className="w-full" onClick={() => { setView('shops'); setQrRedemption(null) }}>
                  Done — Back to Shops
                </Button>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* My redemptions history */}
      {view === 'my-redemptions' && (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant="ghost" onClick={() => setView('shops')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back to shops
            </Button>
          </div>
          <Card className="p-5">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><Clock className="h-4 w-4" /> My Redemption History</h4>
            {myRedemptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No redemptions yet</p>
            ) : (
              <div className="space-y-2">
                {myRedemptions.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{r.item?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{r.shop?.name} · {formatDate(r.createdAt)} · Code: {r.code}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-amber-700">{r.pointsCost}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        r.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                        r.status === 'scanned' ? 'bg-blue-100 text-blue-700' :
                        r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        'bg-rose-100 text-rose-700'
                      }`}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

// ============ Shop Owner: Scan & Manage ============
export function ShopOwnerPanel({ userRole, userId }: { userRole: string; userId: string }) {
  const [mode, setMode] = React.useState<'scan' | 'catalog' | 'history'>('scan')
  const [scanInput, setScanInput] = React.useState('')
  const [scanResult, setScanResult] = React.useState<any>(null)
  const [scanning, setScanning] = React.useState(false)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')
  const [myShops, setMyShops] = React.useState<any[]>([])
  const [catalog, setCatalog] = React.useState<any[]>([])
  const [redemptions, setRedemptions] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [showAddItem, setShowAddItem] = React.useState(false)

  React.useEffect(() => {
    loadShops()
  }, [])

  // Poll for confirmation when a scan result is showing (status: scanned)
  // so the shop owner sees when the employee confirms.
  React.useEffect(() => {
    if (!scanResult || scanResult.status !== 'scanned') return
    const targetId = scanResult.id
    const targetCode = scanResult.code

    const interval = setInterval(async () => {
      try {
        // Re-query the same redemption to check if status changed
        const res = await fetch('/api/erp/partner-shops/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: targetCode }),
        })
        const d = await res.json()
        if (d.redemption && d.redemption.status !== 'scanned') {
          setScanResult(d.redemption)
          if (d.redemption.status === 'confirmed') {
            setSuccess(`✅ Confirmed! Give the customer: ${d.redemption.item?.rewardDetails || d.redemption.item?.name}`)
          }
          if (d.redemption.status === 'cancelled') {
            setError('❌ The customer cancelled this redemption.')
          }
        }
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [scanResult?.id, scanResult?.status])

  async function loadShops() {
    setLoading(true)
    try {
      const res = await fetch('/api/erp/partner-shops')
      const d = await res.json()
      // Filter to shops this user owns (or all if admin)
      const owned = (d.shops || []).filter((s: any) => s.ownerUserId === userId || userRole === 'OWNER' || userRole === 'TENANT_ADMIN')
      setMyShops(owned)
      if (owned.length > 0) {
        loadCatalog(owned[0].id)
        loadRedemptions(owned[0].id)
      }
    } catch {}
    finally { setLoading(false) }
  }

  async function loadCatalog(shopId: string) {
    const res = await fetch(`/api/erp/partner-shops/${shopId}/catalog`)
    const d = await res.json()
    setCatalog(d.items || [])
  }

  async function loadRedemptions(shopId: string) {
    // Load all redemptions for this shop (we'll need a dedicated endpoint or filter)
    // For now, we can use the scan endpoint to get recent redemptions
    // This is a simplified approach — in production we'd have a dedicated endpoint
  }

  async function doScan() {
    if (!scanInput.trim()) return
    await doScanWithText(scanInput)
  }

  /** Scan with a decoded text — handles both QR token and manual short code */
  async function doScanWithText(text: string) {
    if (!text.trim()) return
    setScanning(true); setError(''); setSuccess(''); setScanResult(null)
    try {
      // The QR code may contain JSON with a token, or just a plain code
      let payload: any
      if (text.startsWith('{')) {
        // JSON from QR code — extract the token
        try {
          const parsed = JSON.parse(text)
          payload = { token: parsed.token || parsed.code }
        } catch {
          payload = { code: text }
        }
      } else if (text.includes('-')) {
        // Long token (from QR code) — contains dashes
        payload = { token: text }
      } else {
        // Short 6-digit code — manual entry
        payload = { code: text.toUpperCase().trim() }
      }

      const res = await fetch('/api/erp/partner-shops/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setScanResult(d.redemption)
      if (d.message) setSuccess(d.message)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setScanning(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading shop owner panel…</div>

  if (myShops.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        <Store className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium">You are not the owner of any partner shop</p>
        <p className="text-xs mt-1">Ask your admin to assign you as a shop owner.</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Shop selector */}
      {myShops.length > 1 && (
        <div className="flex gap-2">
          {myShops.map(s => (
            <Button key={s.id} size="sm" variant="outline" onClick={() => { loadCatalog(s.id); loadRedemptions(s.id) }}>
              {s.name}
            </Button>
          ))}
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-2 border-b">
        <button onClick={() => setMode('scan')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${mode === 'scan' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
          <Scan className="h-4 w-4" /> Scan QR
        </button>
        <button onClick={() => setMode('catalog')} className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${mode === 'catalog' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>
          <ShoppingBag className="h-4 w-4" /> My Catalog
        </button>
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      {/* Scan mode */}
      {mode === 'scan' && (
        <Card className="p-5 sm:p-6 space-y-4">
          <h4 className="font-semibold text-sm flex items-center gap-2"><Scan className="h-4 w-4" /> Scan Customer's QR Code</h4>
          <p className="text-xs text-muted-foreground">Point your camera at the customer's QR code, or switch to Manual to type the code.</p>
          
          {/* QR Scanner — camera + manual fallback */}
          {!scanResult && (
            <QRScanner onScan={(decodedText) => {
              // The QR code contains JSON with the token, or the user typed a short code
              setScanInput(decodedText)
              doScanWithText(decodedText)
            }} />
          )}

          {/* Scan result */}
          {scanResult && (
            <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
              <div className="flex items-center justify-between">
                <h5 className="font-semibold">Redemption Details</h5>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  scanResult.status === 'scanned' ? 'bg-blue-100 text-blue-700' :
                  scanResult.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{scanResult.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Customer</p>
                  <p className="font-medium">{scanResult.employee?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Item</p>
                  <p className="font-medium">{scanResult.item?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reward</p>
                  <p className="font-medium text-primary">{scanResult.item?.rewardDetails}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Points</p>
                  <p className="font-bold text-amber-700">{scanResult.pointsCost} pts</p>
                </div>
              </div>
              {scanResult.status === 'scanned' && (
                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-800">
                  ✅ Scanned! Ask the customer to confirm on their screen. Points will transfer automatically once they confirm.
                </div>
              )}
              {scanResult.status === 'confirmed' && (
                <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
                  ✅ This redemption is confirmed. Give the customer their reward: <strong>{scanResult.item?.rewardDetails}</strong>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Catalog mode */}
      {mode === 'catalog' && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> My Shop Catalog ({catalog.length})</h4>
            <Button size="sm" variant="outline" onClick={() => setShowAddItem(!showAddItem)}>
              {showAddItem ? 'Cancel' : '+ Add Item'}
            </Button>
          </div>
          {showAddItem && <AddItemForm shopId={myShops[0]?.id} onSaved={() => { loadCatalog(myShops[0]?.id); setShowAddItem(false) }} />}
          {catalog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No items yet. Add one to get started.</p>
          ) : (
            <div className="space-y-2">
              {catalog.map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{item.name} <span className="text-xs text-muted-foreground">({item.rewardType})</span></p>
                    <p className="text-xs text-muted-foreground">{item.rewardDetails} · {item.pointsCost} pts · {item.stock === -1 ? 'Unlimited' : `${item.stock} in stock`}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

function AddItemForm({ shopId, onSaved }: { shopId: string; onSaved: () => void }) {
  const [name, setName] = React.useState('')
  const [rewardType, setRewardType] = React.useState('voucher')
  const [rewardDetails, setRewardDetails] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [pointsCost, setPointsCost] = React.useState('50')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/erp/partner-shops/${shopId}/catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, rewardType, rewardDetails, description, pointsCost: parseInt(pointsCost), stock: -1 }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Item Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Free Coffee" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Reward Type</Label>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={rewardType} onChange={e => setRewardType(e.target.value)}>
            <option value="voucher">Voucher</option>
            <option value="discount">Discount</option>
            <option value="freeGift">Free Gift</option>
            <option value="service">Service</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Points Cost *</Label>
          <Input type="number" value={pointsCost} onChange={e => setPointsCost(e.target.value)} />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Reward Details</Label>
          <Input value={rewardDetails} onChange={e => setRewardDetails(e.target.value)} placeholder="e.g. RM10 off, Free coffee, 20% discount" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
        </div>
      </div>
      <Button size="sm" onClick={save} disabled={saving || !name}>
        {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
        Add Item
      </Button>
    </div>
  )
}
