'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Camera, Keyboard, X, ScanLine } from 'lucide-react'

interface QRScannerProps {
  onScan: (decodedText: string) => void
  onClose?: () => void
}

/**
 * Camera-based QR code scanner using html5-qrcode.
 * Falls back to manual code entry if camera is not available.
 *
 * Usage:
 *   <QRScanner onScan={(text) => console.log('Scanned:', text)} />
 *
 * The `onScan` callback receives either:
 *   - A full JSON token (from QR code) — pass to the scan API as { token }
 *   - Or a short code (if user typed it manually) — pass as { code }
 */
export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [mode, setMode] = React.useState<'camera' | 'manual'>('camera')
  const [scanning, setScanning] = React.useState(false)
  const [error, setError] = React.useState('')
  const [manualCode, setManualCode] = React.useState('')
  const scannerRef = React.useRef<any>(null)
  const containerId = 'qr-scanner-container'

  // Start camera scanning
  React.useEffect(() => {
    if (mode !== 'camera') return

    let active = true
    setScanning(true)
    setError('')

    // Dynamic import — only loads the library when camera mode is active
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!active) return

      const scanner = new Html5Qrcode(containerId, {
        verbose: false,
      })
      scannerRef.current = scanner

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      }

      scanner.start(
        { facingMode: 'environment' }, // back camera
        config,
        (decodedText: string) => {
          // Success — stop scanner and call onScan
          scanner.stop().then(() => {
            scanner.clear()
            setScanning(false)
            onScan(decodedText)
          }).catch(() => {
            setScanning(false)
            onScan(decodedText)
          })
        },
        () => {
          // Ignore per-frame errors — only show error if camera fails to start
        },
      ).catch((err: any) => {
        console.error('Camera start error:', err)
        setError('Unable to access camera. Please use manual entry instead.')
        setScanning(false)
        setMode('manual')
      })
    }).catch((err) => {
      console.error('Failed to load scanner library:', err)
      setError('Scanner library failed to load. Please use manual entry.')
      setScanning(false)
      setMode('manual')
    })

    // Cleanup on unmount or mode change
    return () => {
      active = false
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().then(() => {
            scannerRef.current.clear()
          }).catch(() => {})
        } catch {}
      }
    }
  }, [mode])

  function handleManualSubmit() {
    if (!manualCode.trim()) return
    onScan(manualCode.trim().toUpperCase())
  }

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === 'camera' ? 'default' : 'outline'}
          onClick={() => setMode('camera')}
        >
          <Camera className="h-4 w-4 mr-1" /> Camera
        </Button>
        <Button
          size="sm"
          variant={mode === 'manual' ? 'default' : 'outline'}
          onClick={() => setMode('manual')}
        >
          <Keyboard className="h-4 w-4 mr-1" /> Manual
        </Button>
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-md p-2">{error}</p>
      )}

      {/* Camera mode */}
      {mode === 'camera' && (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-square max-w-sm mx-auto">
            <div id={containerId} className="w-full h-full" />
            {/* Overlay frame */}
            {scanning && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="border-2 border-white/70 rounded-xl w-48 h-48 relative">
                  <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
              </div>
            )}
            {scanning && (
              <div className="absolute bottom-3 left-0 right-0 text-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs">
                  <ScanLine className="h-3.5 w-3.5 animate-pulse" />
                  Point camera at QR code
                </span>
              </div>
            )}
          </div>
          {scanning && (
            <p className="text-xs text-muted-foreground text-center">
              Position the customer's QR code within the frame
            </p>
          )}
        </div>
      )}

      {/* Manual mode */}
      {mode === 'manual' && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Enter the 6-digit code from the customer's screen
            </label>
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value.toUpperCase())}
              placeholder="e.g. AB3XYZ"
              maxLength={50}
              className="w-full rounded-md border border-input bg-background px-4 py-3 text-xl font-mono text-center tracking-widest"
              onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
              autoFocus
            />
          </div>
          <Button onClick={handleManualSubmit} disabled={!manualCode.trim()} size="lg" className="w-full h-12">
            <ScanLine className="h-5 w-5 mr-2" /> Submit Code
          </Button>
        </div>
      )}
    </div>
  )
}
