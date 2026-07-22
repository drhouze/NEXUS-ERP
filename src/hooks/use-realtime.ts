'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

export function useRealtime(tenantId: string | null) {
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<{ event: string; data: any } | null>(null)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!tenantId) return

    // Try WebSocket connection via Caddy gateway
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      timeout: 5000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join-tenant', { tenantId })
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
    })

    // Listen for all events
    const eventTypes = [
      'order.created', 'order.status_changed', 'order.paid',
      'po.created', 'po.received', 'product.created',
      'stock.low', 'customer.created', 'payment.received',
      'notification', 'dashboard.refresh',
    ]

    for (const eventType of eventTypes) {
      socket.on(eventType, (data: any) => {
        setLastEvent({ event: eventType, data })
      })
    }

    // Fallback: poll every 15 seconds if WebSocket isn't connected
    const pollInterval = setInterval(() => {
      if (!socket.connected) {
        setLastEvent({ event: 'poll.refresh', data: { timestamp: Date.now() } })
      }
    }, 15000)

    return () => {
      clearInterval(pollInterval)
      socket.emit('leave-tenant', { tenantId })
      socket.disconnect()
    }
  }, [tenantId])

  const refresh = useCallback(() => {
    setLastEvent({ event: 'manual.refresh', data: { timestamp: Date.now() } })
  }, [])

  return { isConnected, lastEvent, refresh }
}
