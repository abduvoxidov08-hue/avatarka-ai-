# Virtual ofis (YouTube AI studiya)

14 ta AI-xodim boshqariladigan 3D virtual ofis. **Hozir: 1-bosqich** (Google bilan kirish, baza, sozlamalar).

## Ishga tushirish
```bash
cd studio
npm install
cp .env.example .env     # keyin .env ni to'ldiring: docs/GOOGLE_SOZLASH.md
npm run kalit            # maxfiy kalitlar yaratadi
npm start                # http://localhost:3000
npm test                 # avtomatik testlar
```
Talab: Node.js 22.5 yoki yangiroq.

## Tuzilma
- `src/` — server (config, db, crypto, auth, app)
- `public/` — kirishdan oldingi sahifalar (login, ruxsat yo'q)
- `private/` — faqat kirgan foydalanuvchiga beriladigan ilova
- `docs/GOOGLE_SOZLASH.md` — Google Cloud qo'llanmasi
