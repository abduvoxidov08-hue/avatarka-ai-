import { AGENTS, byId } from './agents.js'
import { ask, isLive, modelName } from './llm.js'

const clients = new Set()
const history = []
const state = Object.fromEntries(
  AGENTS.map((a) => [a.id, { status: 'idle', activity: 'Dam olmoqda', location: 'free' }]),
)
let busy = false

function emit(event) {
  if (event.type === 'message') {
    history.push(event)
    if (history.length > 200) history.shift()
  }
  if (event.type === 'agent') Object.assign(state[event.id], event.patch)
  for (const res of clients) res.write(`data: ${JSON.stringify(event)}\n\n`)
}

export function subscribe(res) {
  clients.add(res)
  res.write(`data: ${JSON.stringify({ type: 'init', agents: AGENTS.map(({ system, ...a }) => a), state, history, live: isLive(), model: modelName() })}\n\n`)
  res.on('close', () => clients.delete(res))
}

const setAgent = (id, patch) => emit({ type: 'agent', id, patch })
const say = (from, to, text) => emit({ type: 'message', id: Date.now() + Math.random(), from, to, text, at: Date.now() })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function isBusy() {
  return busy
}

// Foydalanuvchi buyrug'i -> Jarvis -> mutaxassislar -> Jarvis yakuni
export async function runTask(topic) {
  if (busy) throw new Error('Jamoa band, avvalgi topshiriq tugashini kuting')
  busy = true
  say('user', 'jarvis', topic)
  const results = []
  try {
    setAgent('jarvis', { status: 'thinking', activity: "O'ylamoqda...", location: 'desk' })
    const plan = await ask(byId('jarvis'), `MAVZU: ${topic}\nVazifani jamoaga taqsimla.`)
    setAgent('jarvis', { status: 'busy', activity: 'Vazifa taqsimlamoqda', location: 'meeting' })
    say('jarvis', 'all', plan)
    await sleep(800)

    for (const id of ['music', 'visual', 'seo']) {
      const agent = byId(id)
      setAgent(id, { status: 'thinking', activity: "O'ylamoqda...", location: 'desk' })
      const context = results.map((r) => `${r.name}: ${r.text}`).join('\n')
      const text = await ask(agent, `MAVZU: ${topic}\n${context ? `Hamkasblar ishi:\n${context}\n` : ''}O'z qismingni bajar.`)
      setAgent(id, { status: 'busy', activity: 'Yozmoqda...' })
      await sleep(900)
      say(id, 'jarvis', text)
      results.push({ name: agent.name, text })
      setAgent(id, { status: 'idle', activity: 'Tugatdi', location: 'free' })
    }

    setAgent('jarvis', { status: 'thinking', activity: 'Yakunlamoqda...', location: 'desk' })
    const summary = await ask(byId('jarvis'), `YAKUN. MAVZU: ${topic}\n${results.map((r) => `${r.name}: ${r.text}`).join('\n')}`)
    say('jarvis', 'user', summary)
  } catch (err) {
    say('jarvis', 'user', `Xatolik: ${err.message}`)
  } finally {
    for (const a of AGENTS) setAgent(a.id, { status: 'idle', activity: 'Dam olmoqda', location: 'free' })
    busy = false
  }
}
