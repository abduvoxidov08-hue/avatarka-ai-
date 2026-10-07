# Google Cloud sozlash (qadamma-qadam)

Maqsad: ilovaga "Google bilan kirish" ulash. Hammasi **bepul**.

## 1. Loyiha yaratish
1. https://console.cloud.google.com ga o'zingizning Google hisobingiz bilan kiring.
2. Yuqoridagi loyiha tanlagich → **New project** → nom: `virtual-ofis` → **Create**.
3. Yaratilgach, shu loyiha tanlanganiga ishonch hosil qiling.

## 2. API'larni yoqish
**☰ menyu → APIs & Services → Library** da quyidagilarni qidirib, har biriga **Enable** bosing:
- **YouTube Data API v3**
- **YouTube Analytics API**

(Daromad ma'lumoti uchun alohida API yo'q — `yt-analytics-monetary.readonly` ruxsati Analytics API ichida ishlaydi.)

## 3. OAuth consent screen
**APIs & Services → OAuth consent screen** (yangi interfeysda: *Google Auth platform*):
1. User type: **External** → Create.
2. App name: `Virtual ofis`; User support email va Developer contact email: o'z emailingiz.
3. **Scopes** bo'limida **Add or remove scopes** → quyidagilarni qo'shing (qidiruvga yozing):
   `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`,
   `.../auth/youtube.readonly`, `.../auth/yt-analytics.readonly`,
   `.../auth/yt-analytics-monetary.readonly`, `.../auth/youtube.upload`
4. **Test users** → **Add users** → **o'z Gmail manzilingizni** qo'shing (MUHIM, aks holda kira olmaysiz).
5. Publishing status **Testing** holatida qoldiring.

> **Tekshiruv (verification) shart emas.** Shaxsiy foydalanish uchun "Testing" rejimi yetarli va bepul.
> Faqat ikki narsa bor: (a) faqat "Test users" ro'yxatidagilar kira oladi (100 tagacha);
> (b) Testing rejimida **refresh token 7 kunda eskiradi** — haftada bir marta qayta kirishingiz kerak
> bo'ladi. Bu normal. Ilova yuqorida "ruxsat yetishmayapti" yoki "Qayta kiring" deb aytadi.
> Qayta kirishni xohlamasangiz, "In production" ga o'tkazish mumkin, lekin Google tekshiruvi talab qilinadi.

## 4. OAuth Client ID yaratish
1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**; nom: `virtual-ofis-web`.
3. **Authorized redirect URIs** → **Add URI**:
   - `http://localhost:3000/auth/callback`
   - (keyin internetga chiqarsangiz: `https://sizning-domen.uz/auth/callback`)
4. **Create** → chiqqan **Client ID** va **Client secret** ni nusxalang.

## 5. .env ni to'ldirish
```bash
cd studio
cp .env.example .env
npm run kalit        # ikkita maxfiy kalit chiqaradi
```
`.env` ni oching (har qanday matn muharriri) va to'ldiring:
- `GOOGLE_CLIENT_ID` va `GOOGLE_CLIENT_SECRET` — 4-qadamdagilar
- `ALLOWED_EMAILS` — o'z Gmail manzilingiz
- `SESSION_SECRET` va `TOKEN_ENC_KEY` — `npm run kalit` chiqargan qiymatlar

## 6. Gemini API kaliti (2-bosqichda kerak)
https://aistudio.google.com/apikey → **Create API key** → `.env` dagi `GEMINI_API_KEY` ga yozing.
Bu kalit Google Cloud'dagi OAuth'dan alohida.

## Ko'p uchraydigan xatolar
| Xato | Sabab / yechim |
|---|---|
| `redirect_uri_mismatch` | 4-qadamdagi URI `.env` dagi `BASE_URL` + `/auth/callback` bilan aynan bir xil bo'lishi kerak |
| `access_denied` / "app not verified" | Emailingiz *Test users* ro'yxatida yo'q. 3-qadam, 4-band |
| "Ruxsat yo'q" sahifasi | Email `ALLOWED_EMAILS` da yo'q |
| Ilovada "ruxsat berilmagan" ogohlantirishi | Google oynasida barcha katakchalarni belgilamagansiz. Chiqib, qayta kiring |
