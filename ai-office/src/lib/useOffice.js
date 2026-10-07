import { useEffect, useState, useCallback } from 'react'

export function useOffice() {
  const [agents, setAgents] = useState([])
  const [state, setState] = useState({})
  const [messages, setMessages] = useState([])
  const [bubbles, setBubbles] = useState({}) // id -> oxirgi gap
  const [meta, setMeta] = useState({ live: false, model: '' })
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data)
      if (ev.type === 'init') {
        setAgents(ev.agents)
        setState(ev.state)
        setMessages(ev.history)
        setMeta({ live: ev.live, model: ev.model })
      } else if (ev.type === 'agent') {
        setState((s) => ({ ...s, [ev.id]: { ...s[ev.id], ...ev.patch } }))
      } else if (ev.type === 'message') {
        setMessages((m) => [...m, ev])
        if (ev.from !== 'user') {
          setBubbles((b) => ({ ...b, [ev.from]: ev.text }))
          setTimeout(() => setBubbles((b) => (b[ev.from] === ev.text ? { ...b, [ev.from]: null } : b)), 7000)
        }
      }
    }
    return () => es.close()
  }, [])

  const send = useCallback(async (text) => {
    const r = await fetch('/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!r.ok) throw new Error((await r.json()).error || 'Xatolik')
  }, [])

  return { agents, state, messages, bubbles, meta, connected, send }
}
