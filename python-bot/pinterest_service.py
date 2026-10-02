"""Pinterest'dan rasmlarni qidirish va yuklab olish.

Ikki manba qo'llab-quvvatlanadi:
1. Pinterest API v5 (``PINTEREST_ACCESS_TOKEN`` berilsa; partner/trial ruxsat kerak).
2. Veb-saytning ommaviy qidiruv endpoint'i (scraper) - token talab qilmaydi.
Biri ishlamasa tizim ikkinchisiga o'tadi va hech qachon to'xtab qolmaydi.
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import logging
import random
import time
from dataclasses import dataclass
from typing import Any, AsyncIterator
from urllib.parse import quote

import httpx
from PIL import Image, UnidentifiedImageError

from config import Settings
from database import Database

logger = logging.getLogger(__name__)

PINTEREST_WEB = "https://www.pinterest.com"
PINTEREST_API = "https://api.pinterest.com/v5"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# Telegram cheklovlari (sendPhoto): fayl <= 10 MB, width + height <= 10000, nisbat <= 20
TG_MAX_BYTES = 9 * 1024 * 1024
TG_MAX_DIM_SUM = 10_000
TG_MAX_RATIO = 20
DOWNLOAD_HARD_LIMIT = 40 * 1024 * 1024
PAGE_SIZE = 50
REQUEST_ATTEMPTS = 4


@dataclass(frozen=True)
class Variant:
    url: str
    width: int
    height: int


@dataclass(frozen=True)
class Pin:
    pin_id: str
    variants: tuple[Variant, ...]  # eng kattasidan boshlab


@dataclass(frozen=True)
class DownloadedImage:
    pin_id: str
    url: str
    data: bytes
    sha256: str


class PinterestService:
    def __init__(self, settings: Settings, db: Database) -> None:
        self._s = settings
        self._db = db
        self._client = httpx.AsyncClient(
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
            timeout=httpx.Timeout(30.0, connect=15.0),
            follow_redirects=True,
            proxy=settings.proxy_url,
        )

    async def close(self) -> None:
        await self._client.aclose()

    # ------------------------------------------------------------------ HTTP
    async def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        """Qayta urinishlar (exponential backoff) bilan so'rov. Muvaffaqiyatsiz bo'lsa xato ko'taradi."""
        last_exc: Exception | None = None
        for attempt in range(1, REQUEST_ATTEMPTS + 1):
            try:
                resp = await self._client.request(method, url, **kwargs)
                if resp.status_code == 429 or resp.status_code >= 500:
                    retry_after = resp.headers.get("Retry-After", "")
                    delay = float(retry_after) if retry_after.isdigit() else 2**attempt
                    last_exc = httpx.HTTPStatusError(
                        f"HTTP {resp.status_code}", request=resp.request, response=resp
                    )
                    logger.warning(
                        "%s -> HTTP %s, %.0fs dan keyin qayta urinish (%d/%d)",
                        url[:90], resp.status_code, delay, attempt, REQUEST_ATTEMPTS,
                    )
                    await asyncio.sleep(min(delay, 60) + random.random())
                    continue
                resp.raise_for_status()
                return resp
            except httpx.HTTPStatusError:
                raise  # 4xx - qayta urinish befoyda
            except httpx.HTTPError as exc:
                last_exc = exc
                delay = 2**attempt + random.random()
                logger.warning(
                    "Tarmoq xatosi (%s): %s, %.1fs dan keyin qayta urinish (%d/%d)",
                    url[:90], exc.__class__.__name__, delay, attempt, REQUEST_ATTEMPTS,
                )
                await asyncio.sleep(delay)
        raise last_exc or RuntimeError("so'rov bajarilmadi")

    # ---------------------------------------------------------------- Qidiruv
    async def _search_v5(self, query: str, bookmark: str | None) -> tuple[list[Pin], str | None]:
        params: dict[str, Any] = {"term": query, "country_code": "US", "limit": PAGE_SIZE}
        if bookmark:
            params["bookmark"] = bookmark
        resp = await self._request(
            "GET",
            f"{PINTEREST_API}/search/partner/pins",
            params=params,
            headers={"Authorization": f"Bearer {self._s.pinterest_token}"},
        )
        payload = resp.json()
        pins: list[Pin] = []
        for item in payload.get("items", []):
            images = (item.get("media") or {}).get("images") or {}
            pin = self._build_pin(item.get("id"), images)
            if pin:
                pins.append(pin)
        return pins, payload.get("bookmark") or None

    async def _search_web(self, query: str, bookmark: str | None) -> tuple[list[Pin], str | None]:
        options: dict[str, Any] = {
            "query": query,
            "scope": "pins",
            "bookmarks": [bookmark] if bookmark else [],
            "page_size": PAGE_SIZE,
            "no_fetch_context_on_resource": False,
        }
        params = {
            "source_url": f"/search/pins/?q={quote(query)}&rs=typed",
            "data": json.dumps({"options": options, "context": {}}, separators=(",", ":")),
            "_": str(int(time.time() * 1000)),
        }
        headers = {
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "X-Pinterest-AppState": "active",
            "X-Pinterest-PWS-Handler": "www/search/[scope].js",
            "Referer": f"{PINTEREST_WEB}/search/pins/?q={quote(query)}",
        }
        resp = await self._request(
            "GET", f"{PINTEREST_WEB}/resource/BaseSearchResource/get/", params=params, headers=headers
        )
        payload = resp.json()
        rr = payload.get("resource_response") or {}
        results = (rr.get("data") or {}).get("results") or []
        pins: list[Pin] = []
        for item in results:
            if not isinstance(item, dict) or item.get("is_promoted") or item.get("videos"):
                continue  # reklama va videolarni o'tkazib yuboramiz
            if item.get("type") not in (None, "pin"):
                continue
            pin = self._build_pin(item.get("id"), item.get("images") or {})
            if pin:
                pins.append(pin)
        next_bookmark = rr.get("bookmark")
        if not next_bookmark:
            marks = ((payload.get("resource") or {}).get("options") or {}).get("bookmarks") or []
            next_bookmark = marks[0] if marks else None
        return pins, next_bookmark

    @staticmethod
    def _build_pin(pin_id: Any, images: dict[str, Any]) -> Pin | None:
        if not pin_id or not isinstance(images, dict):
            return None
        variants: list[Variant] = []
        for info in images.values():
            if not isinstance(info, dict) or not info.get("url"):
                continue
            try:
                variants.append(Variant(info["url"], int(info.get("width") or 0), int(info.get("height") or 0)))
            except (TypeError, ValueError):
                continue
        if not variants:
            return None
        variants.sort(key=lambda v: v.width * v.height, reverse=True)
        return Pin(str(pin_id), tuple(variants))

    async def _search_page(self, query: str, bookmark: str | None) -> tuple[list[Pin], str | None]:
        if self._s.pinterest_token:
            try:
                return await self._search_v5(query, bookmark)
            except Exception as exc:  # noqa: BLE001 - fallback uchun hamma xatoni ushlaymiz
                logger.warning("Pinterest API v5 ishlamadi (%s), scraper'ga o'tilmoqda", exc)
        return await self._search_web(query, bookmark)

    async def _iter_pages(self, query: str) -> AsyncIterator[list[Pin]]:
        bookmark: str | None = None
        for page in range(1, self._s.max_pages_per_query + 1):
            try:
                pins, bookmark = await self._search_page(query, bookmark)
            except Exception as exc:  # noqa: BLE001
                logger.error("'%s' bo'yicha qidiruv %d-sahifada muvaffaqiyatsiz: %s", query, page, exc)
                return
            logger.info("'%s': %d-sahifa, %d ta pin", query, page, len(pins))
            if pins:
                yield pins
            if not bookmark or bookmark == "-end-":
                return
            if not pins and page > 1:
                return
            await asyncio.sleep(random.uniform(0.5, 1.5))  # Pinterest'ni ortiqcha yuklamaslik

    # ------------------------------------------------------------- Yuklab olish
    def _good_size(self, v: Variant) -> bool:
        return v.width >= self._s.min_width and v.height >= self._s.min_height

    async def _download(self, pin: Pin) -> DownloadedImage | None:
        candidates = [v for v in pin.variants if self._good_size(v)][:3]
        for variant in candidates:
            try:
                resp = await self._request("GET", variant.url)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Rasm yuklanmadi (%s): %s", variant.url, exc)
                continue
            raw = resp.content
            if not raw or len(raw) > DOWNLOAD_HARD_LIMIT:
                continue
            data = await asyncio.to_thread(self._prepare_for_telegram, raw)
            if data is None:
                continue
            return DownloadedImage(pin.pin_id, variant.url, data, hashlib.sha256(data).hexdigest())
        return None

    def _prepare_for_telegram(self, raw: bytes) -> bytes | None:
        """Rasmni tekshiradi va kerak bo'lsa Telegram limitlariga moslab qayta kodlaydi."""
        try:
            with Image.open(io.BytesIO(raw)) as img:
                img.load()
                fmt = (img.format or "").upper()
                width, height = img.size
                if width < self._s.min_width or height < self._s.min_height:
                    return None
                if max(width, height) / max(1, min(width, height)) > TG_MAX_RATIO:
                    return None
                needs_resize = width + height > TG_MAX_DIM_SUM
                if fmt in {"JPEG", "PNG"} and not needs_resize and len(raw) <= TG_MAX_BYTES:
                    return raw
                work = img.convert("RGB")
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
            logger.warning("Yaroqsiz rasm fayli: %s", exc)
            return None

        if needs_resize:
            scale = (TG_MAX_DIM_SUM - 100) / (width + height)
            work = work.resize((int(width * scale), int(height * scale)), Image.LANCZOS)
        for quality in (92, 85, 75, 65):
            buf = io.BytesIO()
            work.save(buf, format="JPEG", quality=quality, optimize=True)
            if buf.tell() <= TG_MAX_BYTES:
                return buf.getvalue()
        return None

    # ------------------------------------------------------------------ Asosiy
    async def collect_images(self, count: int) -> list[DownloadedImage]:
        """``count`` ta yangi (avval yuborilmagan, noyob) HD rasm yig'adi.

        Qidiruv so'zlari bo'yicha navbatma-navbat olinadi, shuning uchun albomda
        turli mavzudagi rasmlar aralashadi. Yetarli rasm topilmasa, topilganini qaytaradi.
        """
        queries = list(self._s.queries)
        random.shuffle(queries)
        generators = {q: self._iter_pages(q) for q in queries}
        per_turn = max(2, -(-count // len(queries)))  # har navbatda bitta so'zdan olinadigan maksimal soni

        chosen: list[DownloadedImage] = []
        seen_pins: set[str] = set()
        seen_hashes: set[str] = set()

        try:
            while generators and len(chosen) < count:
                for query in list(generators):
                    if len(chosen) >= count:
                        break
                    try:
                        pins = await generators[query].__anext__()
                    except StopAsyncIteration:
                        generators.pop(query)
                        logger.info("'%s' bo'yicha natijalar tugadi", query)
                        continue

                    fresh = [p for p in pins if p.pin_id not in seen_pins and any(self._good_size(v) for v in p.variants)]
                    new_ids = await self._db.filter_new(p.pin_id for p in fresh)
                    fresh = [p for p in fresh if p.pin_id in new_ids]
                    random.shuffle(fresh)
                    logger.info("'%s': %d ta yangi nomzod", query, len(fresh))

                    taken = 0
                    for pin in fresh:
                        if taken >= per_turn or len(chosen) >= count:
                            break
                        seen_pins.add(pin.pin_id)
                        img = await self._download(pin)
                        if img is None:
                            continue
                        if img.sha256 in seen_hashes or await self._db.is_hash_sent(img.sha256):
                            logger.info("Takroriy rasm (hash) o'tkazib yuborildi: %s", pin.pin_id)
                            continue
                        seen_hashes.add(img.sha256)
                        chosen.append(img)
                        taken += 1
        finally:
            for gen in generators.values():
                await gen.aclose()

        logger.info("Jami yig'ildi: %d/%d rasm", len(chosen), count)
        return chosen
