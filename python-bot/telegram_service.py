"""Telegram kanaliga albom (media group) yuborish."""
from __future__ import annotations

import asyncio
import logging

from telegram import Bot, InputMediaPhoto
from telegram.error import BadRequest, Forbidden, NetworkError, RetryAfter, TelegramError, TimedOut
from telegram.request import HTTPXRequest

from config import Settings
from pinterest_service import DownloadedImage

logger = logging.getLogger(__name__)

MAX_SEND_ATTEMPTS = 6
MAX_FLOOD_WAIT = 15 * 60  # soniya; undan uzun kutish talab qilinsa, urinishni to'xtatamiz


class TelegramService:
    def __init__(self, settings: Settings) -> None:
        self._s = settings
        request = HTTPXRequest(
            connection_pool_size=8,
            connect_timeout=20,
            read_timeout=120,
            write_timeout=120,  # 10 ta rasm yuklanadi - katta timeout kerak
            pool_timeout=30,
            proxy=settings.proxy_url,
        )
        self.bot = Bot(token=settings.bot_token, request=request)

    async def start(self) -> None:
        await self.bot.initialize()
        me = await self.bot.get_me()
        logger.info("Bot ulandi: @%s", me.username)

    async def stop(self) -> None:
        await self.bot.shutdown()

    async def verify_channel(self) -> None:
        """Kanal mavjudligi va botning admin ekanligini tekshiradi (xato bo'lsa ogohlantiradi)."""
        try:
            chat = await self.bot.get_chat(self._s.channel_id)
            member = await self.bot.get_chat_member(chat.id, self.bot.id)
            logger.info("Kanal: %s (id=%s), botning roli: %s", chat.title, chat.id, member.status)
            if member.status not in ("administrator", "creator"):
                logger.warning("Bot kanalda admin emas - post yuborib bo'lmaydi!")
        except TelegramError as exc:
            logger.error("Kanalni tekshirib bo'lmadi (%s). TELEGRAM_CHANNEL_ID va bot huquqlarini tekshiring.", exc)

    def _build_media(self, images: list[DownloadedImage]) -> list[InputMediaPhoto]:
        # Caption faqat birinchi rasmga beriladi - Telegram albomning sarlavhasi shunday ko'rinadi.
        return [
            InputMediaPhoto(media=img.data, caption=self._s.caption if i == 0 else None)
            for i, img in enumerate(images)
        ]

    async def send_album(self, images: list[DownloadedImage]) -> bool:
        """Albomni yuboradi. FloodWait va tarmoq xatolarida qayta urinadi. Muvaffaqiyatda True."""
        if len(images) < 2:
            logger.error("Albom uchun kamida 2 ta rasm kerak, berilgan: %d", len(images))
            return False
        images = images[:10]  # Telegram limiti

        for attempt in range(1, MAX_SEND_ATTEMPTS + 1):
            try:
                messages = await self.bot.send_media_group(
                    chat_id=self._s.channel_id,
                    media=self._build_media(images),
                    read_timeout=120,
                    write_timeout=120,
                    connect_timeout=20,
                )
                logger.info("Albom yuborildi: %d ta rasm (message_id=%s)", len(messages), messages[0].message_id)
                return True
            except RetryAfter as exc:
                wait = float(exc.retry_after.total_seconds() if hasattr(exc.retry_after, "total_seconds") else exc.retry_after)
                if wait > MAX_FLOOD_WAIT:
                    logger.error("FloodWait juda uzun (%.0fs) - urinish bekor qilindi", wait)
                    return False
                logger.warning("FloodWait: %.0fs kutilmoqda (urinish %d/%d)", wait, attempt, MAX_SEND_ATTEMPTS)
                await asyncio.sleep(wait + 1)
            except (TimedOut, NetworkError) as exc:
                # Diqqat: TimedOut holatida Telegram albomni qabul qilgan bo'lishi mumkin (kam uchraydi).
                delay = min(2**attempt, 60)
                logger.warning(
                    "Tarmoq xatosi: %s. %ds dan keyin qayta urinish (%d/%d)", exc, delay, attempt, MAX_SEND_ATTEMPTS
                )
                await asyncio.sleep(delay)
            except Forbidden as exc:
                logger.error("Ruxsat yo'q (bot kanalda admin emasmi?): %s", exc)
                return False
            except BadRequest as exc:
                logger.error("Telegram so'rovni rad etdi (BadRequest): %s", exc)
                return False
            except TelegramError as exc:
                logger.error("Kutilmagan Telegram xatosi: %s", exc)
                await asyncio.sleep(min(2**attempt, 60))

        logger.error("Albom %d urinishdan keyin ham yuborilmadi", MAX_SEND_ATTEMPTS)
        return False
