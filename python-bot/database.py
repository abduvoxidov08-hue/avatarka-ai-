"""SQLite: kanalga yuborilgan rasmlar bazasi (takrorlanishning oldini olish)."""
from __future__ import annotations

import asyncio
import logging
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

logger = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS sent_images (
    pin_id   TEXT PRIMARY KEY,
    url      TEXT NOT NULL,
    sha256   TEXT,
    sent_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sent_images_sha256 ON sent_images (sha256);
"""


@dataclass(frozen=True)
class SentRecord:
    pin_id: str
    url: str
    sha256: str


class Database:
    """Sinxron sqlite3 ustiga asyncio.to_thread qatlami."""

    def __init__(self, path: Path) -> None:
        self._path = str(path)
        self._lock = asyncio.Lock()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path, timeout=30)
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    # ---- sinxron ichki metodlar ----
    def _init(self) -> None:
        with closing(self._connect()) as conn, conn:
            conn.executescript(SCHEMA)

    def _filter_new(self, pin_ids: list[str]) -> set[str]:
        if not pin_ids:
            return set()
        known: set[str] = set()
        with closing(self._connect()) as conn:
            for i in range(0, len(pin_ids), 500):  # SQLite o'zgaruvchilar limiti uchun
                chunk = pin_ids[i : i + 500]
                marks = ",".join("?" * len(chunk))
                rows = conn.execute(
                    f"SELECT pin_id FROM sent_images WHERE pin_id IN ({marks})", chunk
                ).fetchall()
                known.update(r[0] for r in rows)
        return {p for p in pin_ids if p not in known}

    def _hash_sent(self, sha256: str) -> bool:
        with closing(self._connect()) as conn:
            row = conn.execute(
                "SELECT 1 FROM sent_images WHERE sha256 = ? LIMIT 1", (sha256,)
            ).fetchone()
        return row is not None

    def _mark_sent(self, records: list[SentRecord]) -> None:
        with closing(self._connect()) as conn, conn:
            conn.executemany(
                "INSERT OR IGNORE INTO sent_images (pin_id, url, sha256) VALUES (?, ?, ?)",
                [(r.pin_id, r.url, r.sha256) for r in records],
            )

    def _count(self) -> int:
        with closing(self._connect()) as conn:
            return conn.execute("SELECT COUNT(*) FROM sent_images").fetchone()[0]

    # ---- async API ----
    async def init(self) -> None:
        await asyncio.to_thread(self._init)
        logger.info("Baza tayyor: %s (yuborilgan rasmlar: %d)", self._path, await self.count())

    async def filter_new(self, pin_ids: Iterable[str]) -> set[str]:
        """Berilgan pin ID'lardan hali yuborilmaganlarini qaytaradi."""
        async with self._lock:
            return await asyncio.to_thread(self._filter_new, list(pin_ids))

    async def is_hash_sent(self, sha256: str) -> bool:
        """Boshqa pin ID bilan bo'lsa ham aynan shu rasm yuborilganmi."""
        async with self._lock:
            return await asyncio.to_thread(self._hash_sent, sha256)

    async def mark_sent(self, records: list[SentRecord]) -> None:
        async with self._lock:
            await asyncio.to_thread(self._mark_sent, records)

    async def count(self) -> int:
        return await asyncio.to_thread(self._count)
