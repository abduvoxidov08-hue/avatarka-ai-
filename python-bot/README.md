# Pinterest → Telegram avto-post boti

Pinterest'dan sifatli oboy/profil rasmlarini topib, Telegram kanalga **har kuni 09:00 va 21:00 (Asia/Tashkent)** da
10 ta rasmdan iborat **bitta albom** qilib yuboradi. Avval yuborilgan rasmlar SQLite bazasi orqali takrorlanmaydi
(pin ID va rasm hash'i bo'yicha).

## Fayllar

| Fayl | Vazifasi |
|---|---|
| `config.py` | `.env` ni o'qish va sozlamalar |
| `database.py` | Yuborilgan rasmlar bazasi (SQLite) |
| `pinterest_service.py` | Qidirish (API v5 + scraper), HD filtri, yuklab olish |
| `telegram_service.py` | Albom yuborish, FloodWait/tarmoq xatolarida qayta urinish |
| `scheduler.py` | APScheduler: 09:00 va 21:00 |
| `main.py` | Ishga tushirish, loglash, to'xtatish |

## O'rnatish

1. **Bot yaratish:** Telegram'da [@BotFather](https://t.me/BotFather) → `/newbot` → token oling.
2. **Botni kanalga admin qiling** ("Post messages" huquqi bilan).
3. Python 3.10+ kerak:

```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # Windows: copy .env.example .env
```

4. `.env` ni to'ldiring: kamida `TELEGRAM_BOT_TOKEN` va `TELEGRAM_CHANNEL_ID` (`@kanal_nomi` yoki `-100...`).

## Ishga tushirish

```bash
python main.py --now   # sinov: darhol bitta post yuboradi va chiqadi
python main.py         # doimiy rejim: 09:00 va 21:00 da post qiladi
```

Loglar konsolga va `bot.log` fayliga (aylanuvchi, 5 MB × 3) yoziladi.

### Serverda doimiy ishlatish (systemd)

`/etc/systemd/system/pinterest-bot.service`:

```ini
[Unit]
Description=Pinterest Telegram bot
After=network-online.target

[Service]
WorkingDirectory=/opt/pinterest-bot
ExecStart=/opt/pinterest-bot/.venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now pinterest-bot
journalctl -u pinterest-bot -f
```

## Pinterest haqida muhim eslatmalar

- **Pinterest API v5** da ixtiyoriy kalit so'z bo'yicha ommaviy pin qidirish (`search/partner/pins`) faqat
  tasdiqlangan akkauntlarga ochiq. Shu sabab `PINTEREST_ACCESS_TOKEN` ixtiyoriy: bo'lmasa yoki xato bersa,
  bot avtomatik ravishda Pinterest veb-saytining qidiruv endpoint'iga (scraper) o'tadi.
- Scraper rasmiy API emas: Pinterest uni o'zgartirishi yoki cheklashi (429/403) mumkin va ularning foydalanish
  shartlariga to'g'ri kelmasligi mumkin. Bunday holatda bot xatoni logga yozadi va to'xtamaydi, keyingi rejada qayta urinadi.
  Datacenter IP'lar ko'pincha bloklanadi — kerak bo'lsa `PROXY_URL` orqali proxy ishlating.
- Pinterest rasmlari mualliflik huquqi bilan himoyalangan bo'lishi mumkin; kanalda foydalanish mas'uliyati sizda.
- Eslatma: ushbu kod Pinterest'ga jonli ulanib sinab ko'rilmagan (ishlab chiqish muhitida Pinterest yopiq edi);
  baza, rejalashtiruvchi, rasm tayyorlash va yig'ish mantiqi soxta ma'lumotlar bilan tekshirilgan. Birinchi marta
  `python main.py --now` bilan sinab ko'ring.

## Xatoliklar bilan ishlash

- **FloodWait (`RetryAfter`)**: Telegram aytgan vaqt kutiladi, so'ng qayta yuboriladi (15 daqiqagacha).
- **Tarmoq/timeout**: exponential backoff bilan 6 martagacha qayta urinish.
- **Pinterest bermasa/uzilsa**: so'rovlar 4 martagacha qayta uriniladi; rasm yetmasa 3 raund yig'iladi, kamida 2 ta
  bo'lsa albom shu miqdorda yuboriladi, aks holda keyingi rejaga qoldiriladi. Jarayon hech qachon to'xtamaydi.
- Rasm bazaga **faqat albom muvaffaqiyatli yuborilgach** yoziladi.
- Bot o'chiq turgan bo'lsa, 1 soatgacha o'tkazib yuborilgan post qaytib ishga tushganda bajariladi.

## Sozlamalar (`.env`)

`.env.example` faylida barcha o'zgaruvchilar izohlangan: qidiruv so'zlari (`PINTEREST_QUERIES`), minimal o'lcham,
vaqtlar (`POST_TIMES`), rasm soni (`IMAGES_PER_POST`, 2–10) va h.k.
