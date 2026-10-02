# Avatarka Bot — Pinterest → Telegram (Netlify)

Netlify'da 24/7 ishlaydigan sayt + avto-post. Har kuni **09:00 va 21:00 (Toshkent)** da kanalga 10 ta rasmdan iborat
bitta albom yuboradi. Sozlamalar (bot tokeni, kanal) saytning o'zidan kiritiladi.

> Python variant (kompyuter/VPS uchun) `python-bot/` papkasida.

## Netlify'ga joylash

1. Netlify → **Add new site → Import from Git** → shu repozitoriyni tanlang (sozlamalar `netlify.toml` da, hech narsa o'zgartirmang).
2. **Site configuration → Environment variables** da bitta o'zgaruvchi qo'shing:
   - `ADMIN_PASSWORD` = o'zingiz o'ylab topgan kuchli parol (panelga kirish uchun).
3. **Deploys → Trigger deploy** (o'zgaruvchi qo'shilgach qayta deploy qiling).
4. Saytni oching → parolni kiriting → **Sozlamalar**:
   - Bot tokeni (@BotFather), kanal (`@kanal_username`) → **Saqlash** → **Botni tekshirish**.
   - Botni kanalga **admin** qiling.
5. **Hozir post yuborish** tugmasi bilan sinab ko'ring. Loglar sahifada ko'rinadi.

Avto-post Netlify Scheduled Function orqali ishlaydi (faqat **production deploy** da). Sayt ochiq turishi shart emas.

## Pinterest qanday ishlaydi

- Standart: Pinterest veb-saytining qidiruv endpoint'i (scraper). Token kerak emas.
- Ixtiyoriy: Pinterest API v5 tokeni kiritilsa avval u ishlatiladi (qidiruv endpoint'i hamma akkauntga ochiq emas), xato bersa veb-qidiruvga o'tadi.
- Pinterest Netlify (AWS) IP'larini bloklashi mumkin. Shunda loglarda "Yetarli rasm topilmadi" chiqadi va keyingi rejada qayta uriniladi. Bu holatda Python variantni VPS'da/uyda ishlating.
- Kod Pinterest/Telegram'ga jonli ulanmasdan, soxta javoblar bilan sinalgan (`npm test`). Birinchi marta "Hozir post yuborish" bilan tekshiring.

## Xavfsizlik

- Bot tokeni Netlify Blobs'da saqlanadi, brauzerga hech qachon qaytarilmaydi (faqat maska ko'rsatiladi).
- Barcha API so'rovlari `ADMIN_PASSWORD` bilan himoyalangan. Parolni hech kimga bermang.
- Token chatga/GitHub'ga tushib qolgan bo'lsa, @BotFather → `/revoke` bilan yangilang.

## Eslatmalar

- Takrorlanmaslik: Pinterest pin ID'lari Blobs'da saqlanadi; albom muvaffaqiyatli yuborilgandan keyingina yoziladi.
- Rasm Telegram'ga URL orqali beriladi: 4.5 MB dan katta originallar o'rniga ~736px variant ishlatiladi.
- Vaqtlar `netlify/functions/scheduled-post.mjs` dagi cron (`0 4,16 * * *`, UTC) bilan belgilanadi.
