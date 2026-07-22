import { createServer } from 'http'
import { Server } from 'socket.io'

// WebSocket server (port 3003 - accessed by frontend via Caddy gateway)
const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const tenantConnections = new Map<string, Set<string>>()

io.on('connection', (socket) => {
  console.log(`[Realtime] Client connected: ${socket.id}`)

  socket.on('join-tenant', (data: { tenantId: string }) => {
    if (data.tenantId) {
      socket.join(`tenant:${data.tenantId}`)
      if (!tenantConnections.has(data.tenantId)) {
        tenantConnections.set(data.tenantId, new Set())
      }
      tenantConnections.get(data.tenantId)!.add(socket.id)
      console.log(`[Realtime] ${socket.id} joined tenant:${data.tenantId}`)
    }
  })

  socket.on('leave-tenant', (data: { tenantId: string }) => {
    if (data.tenantId) {
      socket.leave(`tenant:${data.tenantId}`)
      tenantConnections.get(data.tenantId)?.delete(socket.id)
    }
  })

  socket.on('disconnect', () => {
    for (const [tenantId, sockets] of tenantConnections.entries()) {
      sockets.delete(socket.id)
    }
    console.log(`[Realtime] Client disconnected: ${socket.id}`)
  })
})

// Separate HTTP server for broadcast endpoint (port 3004 - internal only)
const broadcastServer = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/broadcast') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      try {
        const { tenantId, event, data } = JSON.parse(body)
        if (tenantId && event) {
          io.to(`tenant:${tenantId}`).emit(event, data || {})
          console.log(`[Realtime] Broadcast → tenant:${tenantId} event:${event}`)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: true }))
        } else {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'tenantId and event required' }))
        }
      } catch (e) {
        res.writeHead(400)
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
      }
    })
  } else if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', connections: io.engine.clientsCount }))
  } else {
    res.writeHead(404)
    res.end('Not Found')
  }
})

const WS_PORT = 3003
const HTTP_PORT = 3004

httpServer.listen(WS_PORT, () => {
  console.log(`[Realtime] WebSocket server on port ${WS_PORT}`)
})

broadcastServer.listen(HTTP_PORT, () => {
  console.log(`[Realtime] Broadcast API on port ${HTTP_PORT}`)
})

process.on('SIGTERM', () => { httpServer.close(); broadcastServer.close(); process.exit(0) })
process.on('SIGINT', () => { httpServer.close(); broadcastServer.close(); process.exit(0) })
