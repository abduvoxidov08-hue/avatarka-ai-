# AI Ofis — 3D virtual ofis va ko'p agentli YouTube musiqa tizimi

## Ishga tushirish
```bash
cd ai-office
npm install
cp .env.example .env      # ANTHROPIC_API_KEY ni kiriting (bo'sh bo'lsa DEMO rejim)
npm run dev               # server :3001, brauzer :5173
```
Brauzerda http://localhost:5173 ni oching va Jarvis'ga topshiriq yozing.
Production: `npm run build && npm start` (hammasi :3001 da).

## Arxitektura
```
server/
  index.js         Express: GET /api/events (SSE), POST /api/command
  orchestrator.js  Jarvis -> Melodi -> Pikselya -> Sevara -> Jarvis ish oqimi, holatlar, chat tarixi
  agents.js        Agentlar ta'rifi (ism, rol, rang, system prompt)
  llm.js           Anthropic SDK; kalit bo'lmasa DEMO javoblar
src/
  lib/useOffice.js SSE'ga ulanish (agentlar, holat, chat, pufakchalar)
  lib/layout.js    Stol/joy koordinatalari
  components/Office3D.jsx   Three.js sahna, izometrik kamera, fokus rejimi
  components/Character.jsx  Personaj, yurish animatsiyasi, ism/status/nutq pufagi
  components/Sidebar.jsx    Agentlar ro'yxati, umumiy chat, buyruq maydoni
```
Yangi agent: `server/agents.js` ga qo'shing, `src/lib/layout.js` `DESKS` ga stol joyini yozing,
`orchestrator.js` dagi ketma-ketlikka kiriting.
