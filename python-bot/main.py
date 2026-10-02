"""Loyihani ishga tushiruvchi markaziy fayl.

Ishlatish:
    python main.py          # doimiy ishlaydi, 09:00 va 21:00 da post yuboradi
    python main.py --now    # darhol bitta post yuboradi va chiqadi (sinov uchun)
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import signal
import sys
from logging.handlers import RotatingFileHandler

from config import ConfigError, Settings, load_settings
from database import Database
from pinterest_service import PinterestService
from scheduler import PostScheduler
from telegram_service import TelegramService


def setup_logging(settings: Settings) -> None:
    fmt = logging.Formatter("%(asctime)s | %(levelname)-8s | %(name)s | %(message)s")
    root = logging.getLogger()
    root.setLevel(getattr(logging, settings.log_level, logging.INFO))
    root.handlers.clear()

    file_handler = RotatingFileHandler(settings.log_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
    file_handler.setFormatter(fmt)
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    root.addHandler(file_handler)
    root.addHandler(console)

    # Kutubxonalarning ortiqcha loglarini kamaytiramiz (token URL'da chiqib ketmasligi uchun ham muhim)
    for noisy in ("httpx", "httpcore", "apscheduler.scheduler", "apscheduler.executors.default"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


async def run(settings: Settings, post_now: bool) -> int:
    log = logging.getLogger("main")
    db = Database(settings.db_path)
    await db.init()

    pinterest = PinterestService(settings, db)
    telegram = TelegramService(settings)
    scheduler = PostScheduler(settings, db, pinterest, telegram)

    try:
        await telegram.start()
        await telegram.verify_channel()

        if post_now:
            ok = await scheduler.run_post_cycle()
            return 0 if ok else 1

        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, stop.set)
            except NotImplementedError:  # Windows
                signal.signal(sig, lambda *_: loop.call_soon_threadsafe(stop.set))

        scheduler.start()
        log.info("Bot ishga tushdi. To'xtatish uchun Ctrl+C.")
        await stop.wait()
        log.info("To'xtatish signali olindi...")
        return 0
    finally:
        scheduler.shutdown()
        await pinterest.close()
        try:
            await telegram.stop()
        except Exception:  # noqa: BLE001
            log.exception("Telegram'ni yopishda xato")


def main() -> None:
    parser = argparse.ArgumentParser(description="Pinterest -> Telegram avto-post boti")
    parser.add_argument("--now", action="store_true", help="darhol bitta post yuborib chiqish (sinov)")
    args = parser.parse_args()

    try:
        settings = load_settings()
    except ConfigError as exc:
        print(f"Sozlama xatosi: {exc}", file=sys.stderr)
        sys.exit(2)

    setup_logging(settings)
    try:
        code = asyncio.run(run(settings, args.now))
    except KeyboardInterrupt:
        code = 0
    except Exception:  # noqa: BLE001
        logging.getLogger("main").exception("Bot kutilmagan xato bilan to'xtadi")
        code = 1
    sys.exit(code)


if __name__ == "__main__":
    main()
