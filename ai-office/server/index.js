import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { subscribe, runTask, isBusy } from './orchestrator.js'

const app = express()
app.use(express.json())

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders()
  subscribe(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 25000)
  res.on('close', () => clearInterval(ping))
})

app.post('/api/command', (req, res) => {
  const text = String(req.body?.text || '').trim()
  if (!text) return res.status(400).json({ error: "Bo'sh buyruq" })
  if (isBusy()) return res.status(409).json({ error: 'Jamoa band' })
  runTask(text) // fon rejimida; natijalar SSE orqali keladi
  res.json({ ok: true })
})

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../dist')
app.use(express.static(dist))

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`AI Ofis serveri: http://localhost:${port}`))
