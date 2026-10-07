import Anthropic from '@anthropic-ai/sdk'

const key = process.env.ANTHROPIC_API_KEY
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
const client = key ? new Anthropic({ apiKey: key }) : null

export const isLive = () => Boolean(client)
export const modelName = () => (client ? MODEL : 'demo')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Agent nomidan Claude'ga so'rov. Kalit bo'lmasa — DEMO javob qaytaradi.
export async function ask(agent, userPrompt) {
  if (!client) {
    await sleep(1500 + Math.random() * 1500)
    return demoReply(agent.id, userPrompt)
  }
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: agent.system,
    messages: [{ role: 'user', content: userPrompt }],
  })
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
}

function demoReply(id, prompt) {
  const topic = (prompt.match(/MAVZU: (.*)/)?.[1] || 'lo-fi musiqa').slice(0, 80)
  const replies = {
    jarvis: `Topshiriq qabul qilindi: "${topic}". Melodi musiqa promtini, Pikselya 9:16 fonni, Sevara esa SEO matnini tayyorlasin. Boshladik!`,
    music: `Flow Music promti: "Dreamy lo-fi hip hop, 78 BPM, warm vinyl crackle, soft Rhodes piano, mellow bass, gentle rain, theme: ${topic}. Instrumental, 60 sec loop."`,
    visual: `Fon promti (9:16): "Cozy neon-lit room at night, rainy window, glowing lamp, ${topic}, soft purple and teal palette, cinematic, vertical 9:16". Kompozitsiya: markazda oyna, pastda bo'sh joy sarlavha uchun.`,
    seo: `Sarlavha: "${topic} 🎧 Study & Chill Beats #shorts". Heshteglar: #lofi #chill #studymusic #shorts #relaxing #beats. Tavsif: Diqqat va dam olish uchun yumshoq musiqa. Obuna bo'ling!`,
  }
  if (id === 'jarvis' && prompt.includes('YAKUN')) {
    return `Jamoa ishi tugadi: musiqa promti, 9:16 fon va SEO matn tayyor. Flow Music'ga promtni yuklab, rasmni generatsiya qiling va YouTube'ga joylang. Yaxshi ish, jamoa!`
  }
  return replies[id]
}
