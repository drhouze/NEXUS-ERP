'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, User, Mail, Lock, CheckCircle2, AlertCircle, Gift, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)
  const [profile, setProfile] = React.useState<any>(null)
  const [email, setEmail] = React.useState('')
  const [currentPassword, setCurrentPassword] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [error, setError] = React.useState('')
  const [success, setSuccess] = React.useState('')

  React.useEffect(() => {
    if (open) {
      fetch('/api/erp/profile')
        .then(r => r.json())
        .then(d => {
          if (d.user) {
            setProfile(d.user)
            setEmail(d.user.email || '')
          }
        })
        .catch(() => {})
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError('')
      setSuccess('')
    }
  }, [open])

  async function save() {
    setLoading(true)
    setError('')
    setSuccess('')

    if (newPassword && newPassword !== confirmPassword) {
      setError('New password and confirmation do not match')
      setLoading(false)
      return
    }

    try {
      const body: any = {}
      if (email && email !== profile?.email) body.email = email
      if (newPassword) {
        body.currentPassword = currentPassword
        body.newPassword = newPassword
      }

      if (Object.keys(body).length === 0) {
        setError('No changes to save')
        setLoading(false)
        return
      }

      const res = await fetch('/api/erp/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Failed to save')

      setSuccess('Profile updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      if (d.user?.email) setEmail(d.user.email)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> My Profile
          </DialogTitle>
          <DialogDescription>Manage your email and password</DialogDescription>
        </DialogHeader>

        {profile && (
          <div className="space-y-4">
            {/* Read-only info */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium">{profile.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="font-medium capitalize">{profile.role.replace(/_/g, ' ').toLowerCase()}</p>
              </div>
              {profile.points != null && profile.points > 0 && (
                <div className="col-span-2 flex items-center gap-2 text-amber-700 bg-amber-50 rounded-md px-2 py-1.5">
                  <Gift className="h-4 w-4" />
                  <span className="font-semibold">{profile.points} points</span>
                  <span className="text-xs text-muted-foreground">earned from completing visits</span>
                </div>
              )}
            </div>

            {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
            {success && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><AlertDescription className="text-emerald-800">{success}</AlertDescription></Alert>}

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} type="email" />
            </div>

            {/* Password change */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Change Password</Label>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1"><Lock className="h-3 w-3" /> Current Password</Label>
                <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Required to change password" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New Password</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 6 characters" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          <Button
            variant="ghost"
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            onClick={() => {
              onOpenChange(false)
              fetch('/api/auth/logout', { method: 'POST' }).then(() => router.push('/login'))
            }}
          >
            <LogOut className="h-4 w-4 mr-2" /> Sign Out
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
