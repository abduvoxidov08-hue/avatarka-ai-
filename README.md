# 🌟 @avatarlar_uz — AI Agent & Telegram Mini App

Ushbu loyiha **[@avatarlar_uz](https://t.me/avatarlar_uz)** Telegram kanali uchun maxsus ishlab chiqilgan bo'lib, ijtimoiy tarmoqlardan (Pexels, Unsplash, ochiq platformalar) eng sara va sifatli HD/4K rasmlar hamda vertikal qisqa videolarni avtomatik qidiradi, ulardan **bir-biriga mos albomlar (to'plamlar)** tuzadi, **Google Gemini AI** orqali ma'noli estetik status/iqtiboslar yozadi va **Telegram Mini App** orqali bitta tugma bilan kanalga joylash imkonini beradi.

---

## ⚡️ Asosiy Imkoniyatlar

- 📸 **To'plam (Albom) shaklida saralash**: Rasmlar kanalga 2 tadan 4 tagacha bir-biriga mos HD formatdagi albom ko'rinishida chiqariladi.
- 🏎 **Keng qamrovli kategoriyalar**:
  - *Avtomobillar*: Porsche, BMW, Mercedes-Benz, Cadillac, Bentley, va boshqalar.
  - *Profil avatarlari*: Yigitlar, Qizlar va Juftliklar (Couples).
  - *Tabiat va shahar*: Sokin yomg'irli ko'chalar, tumanli o'rmonlar, tungi osmon.
  - *Kino & Anime*: 4K estetik illyustratsiyalar, qahramonlar.
  - *Videolar*: Qisqa estetik vertikal videolar va jonli oboylar.
- 🤖 **Gemini 2.5 AI Statuslar**: Har bir to'plamning kayfiyatiga mos o'zbekcha chuqur ma'noli status/iqtibos, estetik emojilar, hashtaglar va kanal havolasi (`@avatarlar_uz`).
- 🛡 **Toza tasvirlar (Watermarksiz)**: Rasm ustiga hech qanday yozuv tushirilmaydi, asl yuqori sifati saqlanadi.
- 📱 **Telegram Mini App (Netlify)**: Telegram ichida ochiladigan qulay ilova. Unda to'plamlarni ko'rish, matnini tahrirlash, 1 ta tugma bilan kanalga tasdiqlash (`Approve`) yoki rad etish (`Reject`) mumkin.
- 🚫 **Deduplikatsiya (Takrorlanmaslik)**: Avval kanalga chiqqan suratlar SQLite bazasida saqlanadi va qayta taklif qilinmaydi.
- ⏰ **Avtomatik reja (Scheduler)**: Har kuni 3 mahal (09:00, 14:00, 20:00) yangi to'plamlar tayyorlanib, adminga bot orqali xabarnoma boradi.

---

## 🚀 Ishga Tushirish Bo'yicha Qadamlar

### 1. Kutubxonalarni o'rnatish

Terminalda loyiha papkasiga kiring va quyidagi buyruqni bering:

```bash
pip install -r requirements.txt
```

---

### 2. `.env` faylini to'ldirish

Loyiha ildizidagi `.env` faylini oching va o'z ma'lumotlaringizni kiriting:

```env
# 1. Telegram Bot Token (@BotFather orqali olasiz)
TELEGRAM_BOT_TOKEN=123456789:ABCDefghIJKLmnOPQRstuvwxyz

# 2. Kanal nomi (botingiz kanalda ADMIN bo'lishi va xabar yozish huquqiga ega bo'lishi shart!)
CHANNEL_ID=@avatarlar_uz

# 3. O'zingizning Telegram ID raqamingiz (@userinfobot orqali bilish mumkin)
ADMIN_TELEGRAM_ID=123456789

# 4. Google Gemini API Kaliti (https://aistudio.google.com/ dan bepul olinadi)
GEMINI_API_KEY=AIzaSyD...

# 5. Media Qidiruv API Kalitlari (Ixtiyoriy, tavsiya etiladi)
# Pexels (4K rasmlar va vertikal videolar uchun: https://www.pexels.com/api/)
PEXELS_API_KEY=...

# Unsplash (Badiiy estetik suratlar uchun: https://unsplash.com/developers)
UNSPLASH_ACCESS_KEY=...

# 6. Mini App va Server Sozlamalari
PORT=8000
MINI_APP_URL=http://localhost:8000
```

---

### 3. Telegram Botni kanalga biriktirish

1. [@BotFather](https://t.me/BotFather) ga kirib `/newbot` buyrug'i orqali yangi bot yarating va tokenni oling.
2. O'zingizning **[@avatarlar_uz](https://t.me/avatarlar_uz)** kanalingizga kiring.
3. Kanal sozlamalari -> **Administratorlar (Administrators)** bo'limiga kiring va o'zingiz yaratgan botni **Admin** qilib qo'shing (*"Post messages / Xabarlar joylash"* huquqini bering).

---

### 4. Loyihani ishga tushirish

Terminalda:

```bash
python run.py
```

Ushbu buyruq quyidagilarni bir vaqtda ishga tushiradi:
- 🌐 **Web API & Mini App Server**: `http://localhost:8000`
- 🤖 **Telegram Bot**: Polling rejimida xabarlarni qabul qiladi
- ⏰ **Avtomatik Rejalashtiruvchi**: Doimiy orqa fonda yangi rasmlar qidiradi

---

### 5. Telegram Mini App'ni Netlify'ga joylash (1 daqiqada)

Frontend qismi statik HTML/JS/CSS dan iborat bo'lgani sababli Netlify'ga juda oson joylanadi:

1. [app.netlify.com](https://app.netlify.com) saytiga kiring.
2. Saytlar (Sites) bo'limidagi **"Deploy manually"** (yoki `Netlify Drop`) sahifasiga kiring.
3. Loyihangizdagi `frontend` papkasini sichqoncha bilan ushlab, to'g'ridan-to'g'ri Netlify oynasiga tashlang (Drag & Drop).
4. Bir necha soniyada sizga `https://sizning-saytingiz.netlify.app` ko'rinishidagi havola beriladi.
5. BotFather'ga kirib, botingizga Menu Button qilib ushbu Netlify havolasini ulab qo'yishingiz mumkin (`/setmenubutton`).

---

## 📱 Bot buyruqlari

- `/start` — Bosh menyu va Mini App'ni ochish tugmasi
- `/find Porsche 911` — Istalgan mavzuda darhol 2-4 ta rasm topib, AI status bilan albom tayyorlash
- `/stats` — Kanalga chiqqan va kutilayotgan postlar statistikasi

---

## 📂 Loyiha Tuzilishi

```
agent1/
├── .env                  # Maxfiy tokenlar va sozlamalar
├── .env.example          # Namuna sozlamalar fayli
├── requirements.txt      # Kerakli Python kutubxonalari
├── run.py                # Asosiy ishga tushiruvchi fayl (FastAPI + Bot)
├── README.md             # Qo'llanma
├── backend/
│   ├── config.py         # Sozlamalarni o'quvchi modul
│   ├── database.py       # SQLite baza va takrorlanishlarni tekshirish
│   ├── bot.py            # aiogram 3 Telegram bot
│   ├── server.py         # FastAPI REST API (Mini App uchun)
│   ├── scheduler.py      # Kunlik avto-saralash va xabarnomalar
│   └── services/
│       ├── gemini_ai.py       # Gemini 2.5-flash status/caption yozuvchi
│       ├── media_fetcher.py   # Pexels/Unsplash/Pinterest media qidiruvchi
│       └── post_publisher.py  # Kanalga albom joylovchi modul
└── frontend/             # Netlify Telegram Mini App
    ├── index.html        # Zamonaviy qorong'i dizayndagi interfeys
    ├── style.css         # Albomlar va kartalar uslubi
    ├── app.js            # WebApp mantiq va API integratsiyasi
    └── netlify.toml      # Netlify sozlamalari
```
