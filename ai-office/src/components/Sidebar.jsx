import { useEffect, useRef, useState } from 'react'

const STATUS = {
  idle: ['bg-slate-500', 'Idle'],
  busy: ['bg-amber-400', 'Busy'],
  thinking: ['bg-sky-400', 'Busy'],
}

export default function Sidebar({ agents, state, messages, meta, connected, send, focusId, setFocusId }) {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const listRef = useRef(null)
  const nameOf = (id) => (id === 'user' ? 'Siz' : id === 'all' ? 'Hamma' : agents.find((a) => a.id === id)?.name ?? id)
  const colorOf = (id) => agents.find((a) => a.id === id)?.color ?? '#94a3b8'

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      setError('')
      await send(text.trim())
      setText('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <aside className="flex w-96 flex-col border-l border-slate-800 bg-slate-900">
      <header className="border-b border-slate-800 p-4">
        <h1 className="text-lg font-semibold">🏢 AI Ofis</h1>
        <p className="text-xs text-slate-400">
          {connected ? '● Ulangan' : '○ Ulanmagan'} · {meta.live ? `Claude (${meta.model})` : 'DEMO rejim (API kalit yo\'q)'}
        </p>
      </header>

      <section className="border-b border-slate-800 p-3">
        <h2 className="mb-2 text-xs uppercase tracking-wide text-slate-500">Agentlar</h2>
        <ul className="space-y-1">
          {agents.map((a) => {
            const s = state[a.id] ?? { status: 'idle', activity: '' }
            const [dot, label] = STATUS[s.status] ?? STATUS.idle
            return (
              <li key={a.id}>
                <button
                  onClick={() => setFocusId(focusId === a.id ? null : a.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-slate-800 ${focusId === a.id ? 'bg-slate-800' : ''}`}
                >
                  <span className="h-8 w-8 shrink-0 rounded-full" style={{ background: a.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{a.name}</span>
                    <span className="block truncate text-xs text-slate-400">{a.role} · {s.activity}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    {label}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">Jarvis'ga topshiriq yozing, masalan: «Yomg'irli kecha uchun lo-fi Shorts».</p>
        )}
        {messages.map((m) => (
          <div key={m.id}>
            <div className="text-xs" style={{ color: colorOf(m.from) }}>
              {nameOf(m.from)} → {nameOf(m.to)}
            </div>
            <div className="whitespace-pre-wrap rounded-lg bg-slate-800 px-3 py-2 text-sm">{m.text}</div>
          </div>
        ))}
      </section>

      <form onSubmit={submit} className="border-t border-slate-800 p-3">
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Jarvis'ga topshiriq..."
            className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-sm outline-none ring-sky-500 focus:ring-2"
          />
          <button className="rounded-lg bg-sky-600 px-4 text-sm font-medium hover:bg-sky-500">Yuborish</button>
        </div>
      </form>
    </aside>
  )
}
