'use client'

import * as React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Gift, Loader2, CheckCircle2, AlertCircle, Plus, Trash2, Pencil,
  Award, ShoppingBag, Clock, Coins, Settings, ToggleLeft, ToggleRight,
  Store, Scan,
} from 'lucide-react'
import { formatNumber, formatDate } from './lib'
import { PartnerShops, ShopOwnerPanel } from './partner-shops'

type Tab = 'shops' | 'history' | 'my-shop' | 'admin'

export function RewardsModule({ userRole = 'EMPLOYEE', userId = '' }: { userRole?: string; userId?: string }) {
  const [tab, setTab] = React.useState<Tab>('shops')
  const [balance, setBalance] = React.useState<any>(null)
  const [shopItems, setShopItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [redeemLoading, setRedeemLoading] = React.useState<string | null>(null)
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')
  const [ownedShops, setOwnedShops] = React.useState<any[]>([])

  const isAdmin = userRole === 'OWNER' || userRole === 'TENANT_ADMIN'

  function loadData() {
    Promise.all([
      fetch('/api/erp/rewards/balance').then(r => r.json()),
      fetch('/api/erp/rewards/shop').then(r => r.json()),
      fetch('/api/erp/partner-shops').then(r => r.json()).catch(() => ({ shops: [] })),
    ])
      .then(([b, s, ps]) => {
        setBalance(b)
        setShopItems(s.items || [])
        // Check if this user owns any shops (for "My Shop" tab visibility)
        const owned = (ps.shops || []).filter((shop: any) => shop.ownerUserId === userId)
        setOwnedShops(owned)
        // If rewards not enabled and admin, switch to admin tab
        if (!b.isEnabled && isAdmin) setTab('admin')
      })
      .catch(() => setError('Failed to load rewards'))
      .finally(() => setLoading(false))
  }

  React.useEffect(() => { loadData() }, [])

  async function redeem(itemId: string) {
    setRedeemLoading(itemId)
    setError(''); setSuccess('')
    try {
      const res = await fetch('/api/erp/rewards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setSuccess(`Redeemed successfully! ${d.remainingPoints} points remaining.`)
      loadData()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setRedeemLoading(null)
    }
  }

  if (loading) {
    return <div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <Card key={i} className="h-32 animate-pulse bg-muted/40" />)}</div>
  }

  const pointsLabel = balance?.pointsLabel || 'Points'
  const shopName = balance?.shopName || 'Rewards Shop'

  return (
    <div className="space-y-6">
      {/* Points balance header */}
      <Card className="p-6 bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-2xl bg-amber-500 p-3 text-white shadow-lg">
              <Coins className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xs text-amber-700 font-medium uppercase">{pointsLabel} Balance</p>
              <p className="text-4xl font-bold text-amber-900">{formatNumber(balance?.points || 0)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Earn {balance?.isEnabled ? `${balance?.transactions?.length || 0} transactions` : 'points by completing visits'}</p>
            <p className="text-xs text-muted-foreground">Spend in the {shopName}</p>
          </div>
        </div>
      </Card>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

      {/* Tabs — simplified: Shops (all spending), History, My Shop (owners only), Admin */}
      <div className="flex gap-2 border-b flex-wrap">
        <TabButton active={tab === 'shops'} onClick={() => setTab('shops')} icon={Store} label="Browse & Redeem" />
        <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={Clock} label="History" />
        {ownedShops.length > 0 && (
          <TabButton active={tab === 'my-shop'} onClick={() => setTab('my-shop')} icon={Scan} label="My Shop" />
        )}
        {isAdmin && <TabButton active={tab === 'admin'} onClick={() => setTab('admin')} icon={Settings} label="Admin" />}
      </div>

      {/* Shops tab — unified: internal rewards + partner shops (QR-based) */}
      {tab === 'shops' && (
        <div className="space-y-6">
          {/* Internal rewards (direct redeem, no QR) */}
          {balance?.isEnabled && shopItems.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Gift className="h-4 w-4" /> {shopName} (Direct Redeem)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {shopItems.map(item => {
                  const canAfford = (balance?.points || 0) >= item.pointsCost
                  const outOfStock = item.stock === 0
                  return (
                    <Card key={item.id} className="p-4 flex flex-col">
                      {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="w-full h-32 object-cover rounded-lg mb-3" />}
                      <h4 className="font-semibold text-sm">{item.name}</h4>
                      {item.description && <p className="text-xs text-muted-foreground mt-1 flex-1">{item.description}</p>}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <span className="flex items-center gap-1 text-amber-700 font-bold"><Coins className="h-4 w-4" /> {item.pointsCost}</span>
                        {item.stock > 0 && <span className="text-xs text-muted-foreground">{item.stock} left</span>}
                        {item.stock === -1 && <span className="text-xs text-muted-foreground">Unlimited</span>}
                      </div>
                      <Button size="sm" className="mt-2 w-full" disabled={!canAfford || outOfStock || redeemLoading === item.id} onClick={() => redeem(item.id)}>
                        {redeemLoading === item.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Gift className="h-4 w-4 mr-1" />}
                        {outOfStock ? 'Sold Out' : canAfford ? 'Redeem Now' : 'Not Enough Points'}
                      </Button>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* Partner shops (QR-based redeem at external/global shops) */}
          <div>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Store className="h-4 w-4" /> Partner Shops (QR Redeem)
            </h3>
            <p className="text-xs text-muted-foreground mb-3">Browse partner shops and redeem with a QR code. The shop owner scans your code to confirm.</p>
            <PartnerShops userPoints={balance?.points || 0} pointsLabel={pointsLabel} userTenantId={balance?.tenantId} />
          </div>
        </div>
      )}

      {/* My Shop tab — only shown if user owns a shop */}
      {tab === 'my-shop' && ownedShops.length > 0 && (
        <ShopOwnerPanel userRole={userRole} userId={userId} />
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="space-y-4">
          <Card className="p-5">
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><Clock className="h-4 w-4" /> Recent Transactions</h4>
            {(balance?.transactions || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {(balance?.transactions || []).map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                    <div>
                      <p className="font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(t.createdAt)} · {t.type}</p>
                    </div>
                    <span className={`font-bold tabular-nums ${t.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.amount > 0 ? '+' : ''}{t.amount}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {(balance?.redemptions || []).length > 0 && (
            <Card className="p-5">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2"><Gift className="h-4 w-4" /> Redemption History</h4>
              <div className="space-y-2">
                {balance.redemptions.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0 text-sm">
                    <div>
                      <p className="font-medium">{r.item?.name || 'Unknown item'}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)} · {r.status}</p>
                    </div>
                    <span className="font-bold text-rose-600 tabular-nums">-{r.pointsCost}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Admin tab */}
      {tab === 'admin' && isAdmin && <RewardsAdmin onChanged={loadData} />}
    </div>
  )
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  )
}

// ============ Admin Panel ============
function RewardsAdmin({ onChanged }: { onChanged: () => void }) {
  const [config, setConfig] = React.useState<any>(null)
  const [users, setUsers] = React.useState<any[]>([])
  const [items, setItems] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [showItemForm, setShowItemForm] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<any>(null)
  const [tasks, setTasks] = React.useState<any[]>([])
  const [showTaskForm, setShowTaskForm] = React.useState(false)
  const [adjustUser, setAdjustUser] = React.useState<any>(null)
  // Tenant's module label for "orders" — used to show "Visit" for medical,
  // "Sales Order" for trading, etc. instead of hardcoding "Visit".
  const [ordersLabel, setOrdersLabel] = React.useState('Sales Order')

  React.useEffect(() => {
    Promise.all([
      fetch('/api/erp/rewards/config').then(r => r.json()),
      fetch('/api/erp/rewards/items').then(r => r.json()),
      fetch('/api/erp/rewards/tasks').then(r => r.json()),
      fetch('/api/erp/module-labels').then(r => r.ok ? r.json() : { labels: [] }),
    ])
      .then(([c, i, t, ml]) => {
        setConfig(c.config)
        setUsers(c.users || [])
        setItems(i.items || [])
        setTasks(t.tasks || [])
        // Resolve the tenant's label for "orders" module
        const labelsArr = Array.isArray(ml) ? ml : (ml?.labels || [])
        const ordersLabelObj = labelsArr.find((l: any) => l.moduleKey === 'orders')
        if (ordersLabelObj?.label) setOrdersLabel(ordersLabelObj.label)
      })
      .finally(() => setLoading(false))
  }, [])

  async function saveConfig() {
    setSaving(true)
    try {
      await fetch('/api/erp/rewards/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading admin panel…</div>

  return (
    <div className="space-y-4">
      {/* Config */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2"><Settings className="h-4 w-4" /> Reward Configuration</h4>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm font-medium">{config?.isEnabled ? 'Enabled' : 'Disabled'}</span>
            {config?.isEnabled ? (
              <ToggleRight className="h-7 w-7 text-emerald-600" onClick={() => setConfig({ ...config, isEnabled: false })} />
            ) : (
              <ToggleLeft className="h-7 w-7 text-muted-foreground" onClick={() => setConfig({ ...config, isEnabled: true })} />
            )}
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Points per {ordersLabel}</Label>
            <Input type="number" value={config?.pointsPerVisit || 10} onChange={e => setConfig({ ...config, pointsPerVisit: parseInt(e.target.value) || 0 })} />
            <p className="text-[10px] text-muted-foreground">Points awarded when a {ordersLabel.toLowerCase()} is completed</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Points Label</Label>
            <Input value={config?.pointsLabel || 'Points'} onChange={e => setConfig({ ...config, pointsLabel: e.target.value })} placeholder="e.g. Care Points, Stars" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Shop Name</Label>
            <Input value={config?.shopName || 'Rewards Shop'} onChange={e => setConfig({ ...config, shopName: e.target.value })} />
          </div>
        </div>

        <Button onClick={saveConfig} disabled={saving} size="sm">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Configuration
        </Button>
      </Card>

      {/* Shop items management */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2"><ShoppingBag className="h-4 w-4" /> Shop Items ({items.length})</h4>
          <Button size="sm" variant="outline" onClick={() => { setEditingItem(null); setShowItemForm(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Add Item
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No items yet. Add one to get started.</p>
        ) : (
          <div className="space-y-2">
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{item.name} {!item.isActive && <span className="text-xs text-muted-foreground">(inactive)</span>}</p>
                  <p className="text-xs text-muted-foreground">{item.pointsCost} points · {item.stock === -1 ? 'Unlimited' : `${item.stock} in stock`} · {item._count?.redemptions || 0} redemptions</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingItem(item); setShowItemForm(true) }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {showItemForm && (
          <ItemForm
            item={editingItem}
            onClose={() => { setShowItemForm(false); setEditingItem(null) }}
            onSaved={() => {
              setShowItemForm(false)
              setEditingItem(null)
              // Reload items
              fetch('/api/erp/rewards/items').then(r => r.json()).then(d => setItems(d.items || []))
              onChanged()
            }}
          />
        )}
      </Card>

      {/* Reward Tasks management */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm flex items-center gap-2"><Award className="h-4 w-4" /> Reward Tasks ({tasks.length})</h4>
          <Button size="sm" variant="outline" onClick={() => setShowTaskForm(!showTaskForm)}>
            {showTaskForm ? 'Cancel' : '+ Add Task'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Define tasks that earn points. "{ordersLabel} Created" tasks auto-award when a {ordersLabel.toLowerCase()} is completed. Other tasks are manually awarded by admins.</p>
        {showTaskForm && <TaskForm ordersLabel={ordersLabel} onSaved={() => { fetch('/api/erp/rewards/tasks').then(r => r.json()).then(d => setTasks(d.tasks || [])); setShowTaskForm(false) }} />}
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">No tasks yet. Add one to configure point values.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                <div className="flex-1">
                  <p className="font-medium">{t.name} {!t.isActive && <span className="text-xs text-muted-foreground">(inactive)</span>}</p>
                  <p className="text-xs text-muted-foreground">{t.description || 'No description'} · <span className="font-mono">{t.triggerType}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-700">{t.points} pts</span>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => awardTaskToUser(t)}>
                    Award
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Users leaderboard with adjust buttons */}
      <Card className="p-5 space-y-3">
        <h4 className="font-semibold text-sm flex items-center gap-2"><Award className="h-4 w-4" /> Points Leaderboard</h4>
        <div className="space-y-1">
          {users.sort((a, b) => (b.points || 0) - (a.points || 0)).map((u, i) => (
            <div key={u.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5">#{i + 1}</span>
                <span className="font-medium">{u.name}</span>
                <span className="text-xs text-muted-foreground capitalize">· {u.role.replace(/_/g, ' ').toLowerCase()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-amber-700 tabular-nums">{u.points || 0}</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setAdjustUser(u)}>
                  Adjust
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Points adjustment dialog */}
      {adjustUser && (
        <AdjustPointsDialog
          user={adjustUser}
          tasks={tasks}
          onClose={() => setAdjustUser(null)}
          onAdjusted={() => {
            // Reload users
            fetch('/api/erp/rewards/config').then(r => r.json()).then(d => setUsers(d.users || []))
            setAdjustUser(null)
          }}
        />
      )}
    </div>
  )
}

/** Award a task's points to a specific user (quick action from the task list) */
function awardTaskToUser(task: any) {
  // This opens the adjust dialog with the task pre-selected
  // For simplicity, we'll use a prompt — in production this would be a proper user picker
  const userId = prompt(`Enter user ID or email to award "${task.name}" (${task.points} pts) to:`)
  if (!userId) return
  // The AdjustPointsDialog handles this better, but for quick awards:
  fetch('/api/erp/rewards/adjust', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount: task.points, reason: task.name, taskId: task.id }),
  }).then(r => r.json()).then(d => {
    if (d.error) alert(d.error)
    else alert(`Awarded ${task.points} points for "${task.name}"`)
  })
}

// ============ Task Form ============
function TaskForm({ onSaved, ordersLabel = 'Sales Order' }: { onSaved: () => void; ordersLabel?: string }) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [points, setPoints] = React.useState('10')
  const [triggerType, setTriggerType] = React.useState('manual')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/erp/rewards/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, points: parseInt(points), triggerType }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onSaved()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Task Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Patient Referral" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Points *</Label>
          <Input type="number" value={points} onChange={e => setPoints(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Trigger Type</Label>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={triggerType} onChange={e => setTriggerType(e.target.value)}>
            <option value="manual">Manual (admin awards)</option>
            <option value="visit_created">Auto: {ordersLabel} Created</option>
            <option value="monthly_bonus">Monthly Bonus</option>
            <option value="referral">Referral</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Description</Label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="What the task involves" />
        </div>
      </div>
      <Button size="sm" onClick={save} disabled={saving || !name}>
        {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
        Create Task
      </Button>
    </div>
  )
}

// ============ Adjust Points Dialog ============
function AdjustPointsDialog({ user, tasks, onClose, onAdjusted }: { user: any; tasks: any[]; onClose: () => void; onAdjusted: () => void }) {
  const [mode, setMode] = React.useState<'task' | 'custom'>('task')
  const [taskId, setTaskId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const body: any = { userId: user.id, reason }
      if (mode === 'task' && taskId) {
        body.taskId = taskId
      } else {
        body.amount = parseInt(amount)
        if (!body.amount || body.amount === 0) {
          throw new Error('Amount must be non-zero')
        }
      }
      const res = await fetch('/api/erp/rewards/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onAdjusted()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Adjust Points — {user.name}</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>✕</Button>
        </div>
        <p className="text-sm text-muted-foreground">Current points: <span className="font-bold text-amber-700">{user.points || 0}</span></p>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'task' ? 'default' : 'outline'} onClick={() => setMode('task')}>Award Task</Button>
            <Button size="sm" variant={mode === 'custom' ? 'default' : 'outline'} onClick={() => setMode('custom')}>Custom Amount</Button>
          </div>

          {mode === 'task' ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Select Task</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={taskId} onChange={e => setTaskId(e.target.value)}>
                <option value="">— Select a task —</option>
                {tasks.filter(t => t.isActive && t.triggerType !== 'visit_created').map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.points} pts)</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (positive = award, negative = deduct)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="e.g. 50 or -20" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Reason / Notes</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Employee of the Month — January" />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || (mode === 'task' ? !taskId : !amount)}>
            {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Apply Adjustment
          </Button>
        </div>
      </div>
    </div>
  )
}

function ItemForm({ item, onClose, onSaved }: { item: any; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = React.useState(item?.name || '')
  const [description, setDescription] = React.useState(item?.description || '')
  const [pointsCost, setPointsCost] = React.useState(item?.pointsCost || 50)
  const [stock, setStock] = React.useState(item?.stock ?? -1)
  const [imageUrl, setImageUrl] = React.useState(item?.imageUrl || '')
  const [isActive, setIsActive] = React.useState(item?.isActive ?? true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const body = { name, description, pointsCost: parseInt(pointsCost), stock: parseInt(stock), imageUrl, isActive }
      const url = item ? `/api/erp/rewards/items/${item.id}` : '/api/erp/rewards/items'
      const method = item ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      onSaved()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete "${name}"?`)) return
    setSaving(true)
    await fetch(`/api/erp/rewards/items/${item.id}`, { method: 'DELETE' })
    onSaved()
  }

  return (
    <div className="rounded-lg border p-4 space-y-3 bg-muted/20">
      <h5 className="font-semibold text-sm">{item ? 'Edit Item' : 'New Reward Item'}</h5>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. RM10 Gift Card" />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What the reward includes" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Points Cost *</Label>
          <Input type="number" value={pointsCost} onChange={e => setPointsCost(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stock (-1 = unlimited)</Label>
          <Input type="number" value={stock} onChange={e => setStock(e.target.value)} />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Image URL (optional)</Label>
          <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…" />
        </div>
        <label className="flex items-center gap-2 text-sm col-span-2">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="accent-primary" />
          Active (visible in shop)
        </label>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={saving || !name}>
          {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {item ? 'Save' : 'Create'}
        </Button>
        {item && (
          <Button size="sm" variant="destructive" onClick={remove} disabled={saving}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  )
}
