'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Lock, Mail, Loader2, AlertCircle } from 'lucide-react'

const DEMO_ACCOUNTS = [
  { role: 'Platform Owner', email: 'owner@nexus.com', tenant: 'Platform-wide' },
  { role: 'Tenant Admin', email: 'admin@acme.com', tenant: 'Acme Corp' },
  { role: 'Manager', email: 'manager@acme.com', tenant: 'Acme Corp' },
  { role: 'Employee', email: 'staff@acme.com', tenant: 'Acme Corp' },
  { role: 'Tenant Admin', email: 'admin@globex.com', tenant: 'Globex Inc' },
  { role: 'Employee', email: 'staff@stark.com', tenant: 'Stark Industries' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function doLogin(emailToUse: string, passwordToUse: string) {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToUse, password: passwordToUse }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Login failed')
        setLoading(false)
        return
      }
      router.push('/')
      router.refresh()
    } catch (e) {
      setError('Network error')
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await doLogin(email, password)
  }

  async function quickLogin(demoEmail: string) {
    setEmail(demoEmail)
    setPassword('demo1234')
    await doLogin(demoEmail, 'demo1234')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-12 flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 70% 80%, white 1px, transparent 1px)', backgroundSize: '50px 50px' }} />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/15 backdrop-blur font-bold text-lg">N</div>
            <div>
              <h1 className="font-semibold text-xl leading-tight">Nexus ERP</h1>
              <p className="text-indigo-200 text-sm">Multi-Tenant Enterprise Suite</p>
            </div>
          </div>
        </div>
        <div className="relative space-y-6">
          <h2 className="text-4xl font-bold leading-tight">One platform.<br />Many corporations.<br />Total control.</h2>
          <p className="text-indigo-100 text-lg leading-relaxed max-w-md">
            Run your SaaS ERP business with full tenant isolation, role-based access, and granular permissions across 8 enterprise modules.
          </p>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {[
              ['3', 'Tenants seeded'],
              ['9', 'Demo users'],
              ['8', 'ERP modules'],
              ['4', 'Role levels'],
            ].map(([num, label]) => (
              <div key={label} className="rounded-xl bg-white/10 backdrop-blur p-4 border border-white/10">
                <p className="text-2xl font-bold">{num}</p>
                <p className="text-xs text-indigo-200">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-indigo-300">© 2026 Nexus ERP. All data is synthetic demo content.</p>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md space-y-6">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold">N</div>
            <div>
              <h1 className="font-semibold text-lg leading-tight">Nexus ERP</h1>
              <p className="text-xs text-muted-foreground">Multi-Tenant Suite</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold">Welcome back</h2>
            <p className="text-muted-foreground mt-1">Sign in to access your ERP workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="/reset-password" className="text-xs text-primary hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</> : 'Sign in'}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Quick demo login</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                onClick={() => quickLogin(acc.email)}
                disabled={loading}
                className="text-left rounded-lg border border-border p-3 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <p className="text-xs font-semibold">{acc.role}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{acc.email}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">{acc.tenant}</p>
              </button>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">All demo passwords: <code className="bg-muted px-1.5 py-0.5 rounded">demo1234</code></p>
        </div>
      </div>
    </div>
  )
}
