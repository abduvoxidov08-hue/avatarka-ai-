import asyncio
import logging
import uvicorn
from aiogram import Bot
from backend.config import TELEGRAM_BOT_TOKEN, PORT
from backend.database import init_db, get_candidates
from backend.bot import dp
from backend.server import app
from backend.scheduler import start_scheduler
from backend.services.media_fetcher import fetch_and_create_candidate

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("MAIN")

async def run_fastapi():
    """Run FastAPI ASGI server"""
    config = uvicorn.Config(
        app=app,
        host="0.0.0.0",
        port=PORT,
        log_level="info",
        access_log=False
    )
    server = uvicorn.Server(config)
    await server.serve()

async def run_bot():
    """Run Telegram Bot polling if token is provided"""
    if not TELEGRAM_BOT_TOKEN:
        logger.warning(
            "⚠️ TELEGRAM_BOT_TOKEN topilmadi! .env faylida bot tokenini kiritishingiz kerak. "
            "Hozircha faqat Web API va Mini App ishlab turadi."
        )
        # Keep task alive
        while True:
            await asyncio.sleep(3600)

    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    logger.info("🤖 Telegram Bot muvaffaqiyatli ishga tushdi va xabarlarni kutmoqda...")
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

async def ensure_initial_data():
    """If database is empty, automatically create initial candidate albums so Mini App is ready to demo"""
    candidates = get_candidates(status="pending")
    if not candidates:
        logger.info("📦 Ma'lumotlar bazasida to'plamlar yo'q. Dastlabki namunaviy to'plamlar tayyorlanmoqda...")
        await fetch_and_create_candidate(category="cars", custom_query="Porsche 911 GT3")
        await fetch_and_create_candidate(category="cars", custom_query="BMW M5 dark aesthetic")
        await fetch_and_create_candidate(category="couples", custom_query="cute couple aesthetic")
        await fetch_and_create_candidate(category="nature", custom_query="foggy forest mountain road")

async def main():
    logger.info("🚀 @avatarlar_uz AI Agent tizimi ishga tushirilmoqda...")
    
    # 1. Initialize SQLite Database
    init_db()
    
    # 2. Ensure initial candidates exist
    await ensure_initial_data()
    
    # 3. Start background scheduler
    start_scheduler()
    
    logger.info(f"🌐 Mini App & API server manzili: http://localhost:{PORT}")
    logger.info(f"📱 Telegram ichida ko'rish uchun Botga /start yuboring.")
    
    # 4. Run both Web Server and Telegram Bot concurrently
    await asyncio.gather(
        run_fastapi(),
        run_bot()
    )

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Dastur to'xtatildi.")
