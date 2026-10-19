import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import CommandStart, Command
from aiogram.utils.keyboard import InlineKeyboardBuilder, ReplyKeyboardBuilder
from backend.config import TELEGRAM_BOT_TOKEN, ADMIN_TELEGRAM_ID, MINI_APP_URL, CHANNEL_ID
from backend.database import get_stats, get_album, update_album_status
from backend.services.media_fetcher import fetch_and_create_candidate
from backend.services.post_publisher import publish_album_to_channel

logger = logging.getLogger(__name__)

dp = Dispatcher()

def get_admin_main_kb():
    builder = ReplyKeyboardBuilder()
    # WebApp button to open the Telegram Mini App directly inside Telegram
    builder.button(
        text="🚀 Mini Appni Ochish",
        web_app=types.WebAppInfo(url=MINI_APP_URL)
    )
    builder.button(text="🔍 Yangi albom qidirish")
    builder.button(text="📊 Statistika")
    builder.adjust(1, 2)
    return builder.as_markup(resize_keyboard=True)

@dp.message(CommandStart())
async def handle_start(message: types.Message):
    user_id = str(message.from_user.id)
    first_name = message.from_user.first_name
    
    stats = get_stats()
    
    welcome_text = (
        f"Assalomu alaykum, <b>{first_name}</b>! 👋\n\n"
        f"Bu <b>{CHANNEL_ID}</b> kanali uchun maxsus <b>AI Agent & Mini App</b> boshqaruv boti.\n\n"
        f"📌 <b>Imkoniyatlar:</b>\n"
        f"• Pinterest va Pexels orqali HD/4K sifatli rasmlarni topish\n"
        f"• Bir-biriga mos rasmlardan chiroyli <b>albomlar</b> yig'ish\n"
        f"• Gemini AI orqali ma'noli o'zbekcha statuslar, emojilar va hashtaglar yaratish\n"
        f"• Telegram Mini App orqali bitta tugma bilan kanalga joylash\n\n"
        f"📊 <b>Hozirgi holat:</b>\n"
        f"• Kutilmoqda: <b>{stats['pending']} ta</b>\n"
        f"• Kanalga joylangan: <b>{stats['published']} ta</b>\n\n"
        f"👇 Boshqaruv panelini ochish uchun pastdagi tugmani bosing:"
    )
    
    inline_kb = InlineKeyboardBuilder()
    inline_kb.button(
        text="📱 Mini App Boshqaruv Paneli",
        web_app=types.WebAppInfo(url=MINI_APP_URL)
    )
    
    await message.answer(welcome_text, parse_mode="HTML", reply_markup=get_admin_main_kb())

@dp.message(F.text == "📊 Statistika")
@dp.message(Command("stats"))
async def handle_stats(message: types.Message):
    stats = get_stats()
    text = (
        f"📊 <b>Kanal va Agent Statistikasi:</b>\n\n"
        f"• ⏳ Kutilayotgan to'plamlar: <b>{stats['pending']}</b> ta\n"
        f"• ✅ Kanalga joylangan: <b>{stats['published']}</b> ta\n"
        f"• ❌ Rad etilgan: <b>{stats['rejected']}</b> ta\n"
        f"• 📦 Jami yig'ilgan to'plamlar: <b>{stats['total']}</b> ta\n\n"
        f"Barcha to'plamlarni Mini App'da ko'rishingiz mumkin."
    )
    await message.answer(text, parse_mode="HTML")

@dp.message(F.text == "🔍 Yangi albom qidirish")
async def handle_search_button(message: types.Message):
    text = (
        "🔍 Yangi albom qidirish uchun buyruqdan foydalaning:\n\n"
        "Masalan:\n"
        "• <code>/find Porsche 911 GT3</code>\n"
        "• <code>/find BMW M5 dark</code>\n"
        "• <code>/find aesthetic couple</code>\n"
        "• <code>/find anime avatar 4k</code>\n"
        "• <code>/video car edit luxury</code>\n\n"
        "Yoki Mini App'ning qidiruv bo'limidan foydalaning."
    )
    await message.answer(text, parse_mode="HTML")

@dp.message(Command("find"))
async def handle_find_command(message: types.Message):
    args = message.text.replace("/find", "").strip()
    if not args:
        await message.answer("Iltimos, qidirish uchun mavzu kiriting!\nMasalan: <code>/find BMW M5</code>", parse_mode="HTML")
        return
        
    status_msg = await message.answer(f"⏳ <b>'{args}'</b> bo'yicha rasmlar qidirilmoqda va AI matn yozmoqda...", parse_mode="HTML")
    
    album_id = await fetch_and_create_candidate(category="cars", custom_query=args, media_type="photo")
    if not album_id:
        await status_msg.edit_text("❌ Afsuski, bu mavzuda mos rasmlar topilmadi yoki barchasi avval ishlatilgan.")
        return
        
    album = get_album(album_id)
    
    inline_kb = InlineKeyboardBuilder()
    inline_kb.button(text="✅ Kanalga joylash", callback_data=f"pub:{album_id}")
    inline_kb.button(text="❌ Rad etish", callback_data=f"rej:{album_id}")
    inline_kb.button(text="📱 Mini App'da ko'rish", web_app=types.WebAppInfo(url=MINI_APP_URL))
    inline_kb.adjust(2, 1)
    
    await status_msg.delete()
    
    # Send preview
    preview_text = f"✨ <b>Yangi to'plam tayyor: {album['title']}</b>\n\n{album['caption']}"
    if album["media_urls"]:
        await message.answer_photo(
            photo=album["media_urls"][0],
            caption=preview_text,
            parse_mode="HTML",
            reply_markup=inline_kb.as_markup()
        )
    else:
        await message.answer(preview_text, parse_mode="HTML", reply_markup=inline_kb.as_markup())

@dp.callback_query(F.data.startswith("pub:"))
async def handle_pub_callback(call: types.CallbackQuery):
    album_id = int(call.data.split(":")[1])
    await call.answer("Kanalga yuborilmoqda...")
    success, msg = await publish_album_to_channel(album_id)
    if success:
        await call.message.edit_reply_markup(reply_markup=None)
        await call.message.reply(f"✅ {msg}")
    else:
        await call.message.reply(f"❌ {msg}")

@dp.callback_query(F.data.startswith("rej:"))
async def handle_rej_callback(call: types.CallbackQuery):
    album_id = int(call.data.split(":")[1])
    update_album_status(album_id, "rejected")
    await call.answer("Albom rad etildi.")
    await call.message.edit_reply_markup(reply_markup=None)
    await call.message.reply("🗑 To'plam rad etildi.")

async def notify_admin_new_candidates(count: int):
    """Notify the admin when the scheduler creates new candidate batches"""
    if not TELEGRAM_BOT_TOKEN or not ADMIN_TELEGRAM_ID:
        return
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    try:
        inline_kb = InlineKeyboardBuilder()
        inline_kb.button(text="🚀 Mini App'ni Ochish", web_app=types.WebAppInfo(url=MINI_APP_URL))
        
        await bot.send_message(
            chat_id=ADMIN_TELEGRAM_ID,
            text=f"🔔 <b>Yangi to'plamlar tayyor!</b>\n\nAI Agent siz uchun <b>{count} ta yangi albom</b> tayyorlab qo'ydi. Tasdiqlash uchun Mini App'ga kiring:",
            parse_mode="HTML",
            reply_markup=inline_kb.as_markup()
        )
    except Exception as e:
        logger.error(f"Adminga xabarnoma yuborishda xatolik: {e}")
    finally:
        await bot.session.close()
