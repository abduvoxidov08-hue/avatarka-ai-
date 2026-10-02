"""Muhit o'zgaruvchilari va sozlamalar."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import time as dtime
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DEFAULT_QUERIES = [
    "aesthetic wallpaper",
    "profile pictures",
    "phone aesthetic background",
    "minimalist wallpapers",
]

CAPTION = (
    "Profilingiz uchun eng sara va sifatli rasmlar to'plami. ✨\n"
    "Biz bilan profilingiz o'zgacha ko'rinadi! 🎨"
)


class ConfigError(RuntimeError):
    """Sozlamalar noto'g'ri yoki yetishmayotgan bo'lsa ko'tariladi."""


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _env_int(name: str, default: int) -> int:
    raw = _env(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ConfigError(f"{name} butun son bo'lishi kerak, berilgan: {raw!r}") from exc


def _parse_times(raw: str) -> list[dtime]:
    result: list[dtime] = []
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        try:
            hh, mm = chunk.split(":")
            result.append(dtime(int(hh), int(mm)))
        except ValueError as exc:
            raise ConfigError(f"POST_TIMES noto'g'ri format (HH:MM kerak): {chunk!r}") from exc
    if not result:
        raise ConfigError("POST_TIMES bo'sh bo'lmasligi kerak")
    return result


@dataclass(frozen=True)
class Settings:
    bot_token: str
    channel_id: str
    pinterest_token: str
    queries: list[str]
    min_width: int
    min_height: int
    max_pages_per_query: int
    proxy_url: str | None
    timezone: str
    post_times: list[dtime]
    images_per_post: int
    db_path: Path
    log_file: Path
    log_level: str
    caption: str = field(default=CAPTION)


def load_settings() -> Settings:
    token = _env("TELEGRAM_BOT_TOKEN")
    channel = _env("TELEGRAM_CHANNEL_ID")
    if not token:
        raise ConfigError("TELEGRAM_BOT_TOKEN .env faylida ko'rsatilmagan")
    if not channel:
        raise ConfigError("TELEGRAM_CHANNEL_ID .env faylida ko'rsatilmagan")

    queries = [q.strip() for q in _env("PINTEREST_QUERIES").split(",") if q.strip()]
    per_post = _env_int("IMAGES_PER_POST", 10)
    if not 2 <= per_post <= 10:
        raise ConfigError("IMAGES_PER_POST 2 dan 10 gacha bo'lishi kerak (Telegram albom limiti)")

    def _path(name: str, default: str) -> Path:
        p = Path(_env(name, default))
        return p if p.is_absolute() else BASE_DIR / p

    return Settings(
        bot_token=token,
        channel_id=channel,
        pinterest_token=_env("PINTEREST_ACCESS_TOKEN"),
        queries=queries or list(DEFAULT_QUERIES),
        min_width=_env_int("MIN_IMAGE_WIDTH", 720),
        min_height=_env_int("MIN_IMAGE_HEIGHT", 720),
        max_pages_per_query=max(1, _env_int("MAX_PAGES_PER_QUERY", 15)),
        proxy_url=_env("PROXY_URL") or None,
        timezone=_env("TIMEZONE", "Asia/Tashkent"),
        post_times=_parse_times(_env("POST_TIMES", "09:00,21:00")),
        images_per_post=per_post,
        db_path=_path("DB_PATH", "bot.db"),
        log_file=_path("LOG_FILE", "bot.log"),
        log_level=_env("LOG_LEVEL", "INFO").upper(),
    )
