"""Kuniga ikki marta (09:00 va 21:00, Asia/Tashkent) post yuboruvchi rejalashtiruvchi."""
from __future__ import annotations

import asyncio
import logging

from apscheduler.events import EVENT_JOB_ERROR, EVENT_JOB_MISSED, JobExecutionEvent
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from config import Settings
from database import Database, SentRecord
from pinterest_service import PinterestService
from telegram_service import TelegramService

logger = logging.getLogger(__name__)

COLLECT_ROUNDS = 3  # rasm yetmasa, shuncha marta qayta yig'amiz
MIN_ALBUM_SIZE = 2


class PostScheduler:
    def __init__(
        self, settings: Settings, db: Database, pinterest: PinterestService, telegram: TelegramService
    ) -> None:
        self._s = settings
        self._db = db
        self._pinterest = pinterest
        self._telegram = telegram
        self._lock = asyncio.Lock()
        self._scheduler = AsyncIOScheduler(timezone=settings.timezone)

    def start(self) -> None:
        for t in self._s.post_times:
            self._scheduler.add_job(
                self.run_post_cycle,
                CronTrigger(hour=t.hour, minute=t.minute, timezone=self._s.timezone),
                id=f"post_{t.hour:02d}{t.minute:02d}",
                name=f"Post {t:%H:%M}",
                max_instances=1,
                coalesce=True,
                misfire_grace_time=3600,  # bot qisqa vaqt o'chib qolsa, 1 soat ichida postni bajaradi
                replace_existing=True,
            )
        self._scheduler.add_listener(self._on_event, EVENT_JOB_ERROR | EVENT_JOB_MISSED)
        self._scheduler.start()
        for job in self._scheduler.get_jobs():
            logger.info("Reja: '%s' -> keyingi ishga tushish %s", job.name, job.next_run_time)

    def shutdown(self) -> None:
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)

    @staticmethod
    def _on_event(event: JobExecutionEvent) -> None:
        if event.exception:
            logger.error("Job '%s' xato bilan tugadi: %r", event.job_id, event.exception)
        else:
            logger.warning("Job '%s' o'z vaqtida bajarilmadi (missed)", event.job_id)

    async def run_post_cycle(self) -> bool:
        """Rasm yig'ib, albom yuboradi va bazaga yozadi. Hech qachon istisno ko'tarmaydi."""
        if self._lock.locked():
            logger.warning("Oldingi post hali tugamagan - bu urinish o'tkazib yuborildi")
            return False
        async with self._lock:
            try:
                return await self._cycle()
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001 - scheduler to'xtamasligi uchun
                logger.exception("Post siklida kutilmagan xato")
                return False

    async def _cycle(self) -> bool:
        target = self._s.images_per_post
        logger.info("=== Post sikli boshlandi (maqsad: %d rasm) ===", target)

        images = []
        for round_no in range(1, COLLECT_ROUNDS + 1):
            need = target - len(images)
            if need <= 0:
                break
            batch = await self._pinterest.collect_images(need)
            known = {i.sha256 for i in images}
            images.extend(i for i in batch if i.sha256 not in known)
            if len(images) < target:
                logger.warning("%d-urinish: %d/%d rasm", round_no, len(images), target)
                await asyncio.sleep(30 * round_no)

        if len(images) < MIN_ALBUM_SIZE:
            logger.error("Yetarli rasm topilmadi (%d). Post keyingi rejaga qoldirildi.", len(images))
            return False
        if len(images) < target:
            logger.warning("Faqat %d ta rasm topildi, albom shu miqdorda yuboriladi", len(images))

        if not await self._telegram.send_album(images):
            logger.error("Albom yuborilmadi; rasmlar bazaga yozilmadi (keyingi safar qayta ishlatiladi)")
            return False

        await self._db.mark_sent([SentRecord(i.pin_id, i.url, i.sha256) for i in images])
        logger.info("=== Post sikli tugadi. Bazada jami: %d rasm ===", await self._db.count())
        return True
