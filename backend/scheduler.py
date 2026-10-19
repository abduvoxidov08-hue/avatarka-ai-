import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from backend.services.media_fetcher import fetch_and_create_candidate
from backend.config import TARGET_CATEGORIES
from backend.bot import notify_admin_new_candidates

logger = logging.getLogger(__name__)

async def run_batch_generation():
    """Generate 2-3 candidate albums across target categories and notify admin"""
    logger.info("Avtomatik to'plam yig'ish boshlandi...")
    created_count = 0
    
    # Pick 2-3 random categories to generate fresh batches
    import random
    categories_to_run = random.sample(TARGET_CATEGORIES, min(3, len(TARGET_CATEGORIES)))
    
    for cat in categories_to_run:
        try:
            m_type = "video" if cat["id"] == "videos" else "photo"
            album_id = await fetch_and_create_candidate(category=cat["id"], media_type=m_type)
            if album_id:
                created_count += 1
        except Exception as e:
            logger.error(f"Kategoriya '{cat['id']}' uchun avto-yig'ishda xatolik: {e}")
            
    if created_count > 0:
        logger.info(f"{created_count} ta yangi to'plam tayyorlandi. Adminga xabarnoma yuborilmoqda.")
        await notify_admin_new_candidates(created_count)

def start_scheduler():
    scheduler = AsyncIOScheduler()
    
    # Schedule at 09:00, 14:00, and 20:00 every day
    scheduler.add_job(run_batch_generation, CronTrigger(hour=9, minute=0), name="Ertalabki to'plam")
    scheduler.add_job(run_batch_generation, CronTrigger(hour=14, minute=0), name="Tushlik to'plami")
    scheduler.add_job(run_batch_generation, CronTrigger(hour=20, minute=0), name="Kechki to'plam")
    
    scheduler.start()
    logger.info("Orqa fon rejalashtiruvchisi (Scheduler) 09:00, 14:00 va 20:00 vaqtlarga muvaffaqiyatli ishga tushirildi.")
    return scheduler
