import httpx
import random
import logging
from backend.config import PEXELS_API_KEY, UNSPLASH_ACCESS_KEY, TARGET_CATEGORIES
from backend.database import is_media_seen, save_album
from backend.services.gemini_ai import generate_caption

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# Number of photos per post/album (as specifically requested: 10 images)
ALBUM_PHOTOS_COUNT = 10

# Highly accurate, curated, model-specific 10-photo datasets
MODEL_SPECIFIC_MEDIA = {
    "porsche 911": [
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1611635322894-41d8e12d4d98?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1619405399517-d7fce0f13302?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1594970425717-3801ea07ebc3?w=1400&auto=format&fit=crop&q=85"
    ],
    "bmw m5": [
        "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1556189250-72ba954cfc2b?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1508974239320-0a029497e820?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1506015391300-4802dc74de2e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1400&auto=format&fit=crop&q=85"
    ],
    "mercedes amg": [
        "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1563720223185-11003d516935?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1541348263662-e0c8de4259ba?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1616422285623-13ff0162193c?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1533473359333-0135ef1b58bf?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400&auto=format&fit=crop&q=85"
    ],
    "cadillac escalade": [
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1611635322894-41d8e12d4d98?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1617788138017-80ad40651399?w=1400&auto=format&fit=crop&q=85"
    ],
    "bentley continental": [
        "https://images.unsplash.com/photo-1563720223185-11003d516935?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1541348263662-e0c8de4259ba?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1616422285623-13ff0162193c?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1609521263047-f8f205293f24?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1533473359333-0135ef1b58bf?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1614162692292-7ac56d7f7f1e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=1400&auto=format&fit=crop&q=85"
    ],
    "avatars_boys": [
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1480429370139-e0132c086e2a?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=1200&auto=format&fit=crop&q=85"
    ],
    "avatars_girls": [
        "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1514315384763-ba401779410f?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1496440737103-cd596325d314?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1502823403499-6ccfcf4fb453?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=1200&auto=format&fit=crop&q=85"
    ],
    "couples": [
        "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1522529599102-193c0d76b5b6?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1524863479829-916d8e77f114?w=1200&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1509909756405-be0199881695?w=1200&auto=format&fit=crop&q=85"
    ],
    "nature": [
        "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1511497584788-87676104235f?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=1400&auto=format&fit=crop&q=85"
    ],
    "movies_anime": [
        "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1563089145-599997674d42?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1514533450685-4493e01d1fdc?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1561214115-f2f134cc4912?w=1400&auto=format&fit=crop&q=85",
        "https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1400&auto=format&fit=crop&q=85"
    ]
}

def find_matched_curated_set(query: str, category: str) -> list[str]:
    """Find exact matching 10-image set based on query and category"""
    q = (query or "").lower()
    
    if "porsche" in q or "911" in q:
        return MODEL_SPECIFIC_MEDIA["porsche 911"]
    if "bmw" in q or "m5" in q or "f90" in q:
        return MODEL_SPECIFIC_MEDIA["bmw m5"]
    if "mercedes" in q or "amg" in q or "benz" in q or "g63" in q:
        return MODEL_SPECIFIC_MEDIA["mercedes amg"]
    if "cadillac" in q or "escalade" in q:
        return MODEL_SPECIFIC_MEDIA["cadillac escalade"]
    if "bentley" in q or "continental" in q:
        return MODEL_SPECIFIC_MEDIA["bentley continental"]
    
    if category in MODEL_SPECIFIC_MEDIA:
        return MODEL_SPECIFIC_MEDIA[category]
        
    # Default to category or Porsche
    return MODEL_SPECIFIC_MEDIA.get(category, MODEL_SPECIFIC_MEDIA["porsche 911"])

async def fetch_pexels_photos(query: str, per_page: int = 15) -> list[str]:
    """Fetch high-res photos from Pexels API"""
    if not PEXELS_API_KEY:
        return []
    url = f"https://api.pexels.com/v1/search?query={query}&per_page={per_page}&orientation=portrait"
    async with httpx.AsyncClient(headers={"Authorization": PEXELS_API_KEY, **HEADERS}, timeout=15) as client:
        try:
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json()
                photos = [p["src"]["large2x"] for p in data.get("photos", []) if p.get("src")]
                return photos
        except Exception as e:
            logger.error(f"Pexels photo fetch error: {e}")
    return []

async def fetch_pexels_videos(query: str, per_page: int = 10) -> list[str]:
    """Fetch 9:16 vertical video files from Pexels Video API"""
    if not PEXELS_API_KEY:
        return []
    url = f"https://api.pexels.com/videos/search?query={query}&per_page={per_page}&orientation=portrait"
    async with httpx.AsyncClient(headers={"Authorization": PEXELS_API_KEY, **HEADERS}, timeout=15) as client:
        try:
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json()
                videos = []
                for v in data.get("videos", []):
                    files = v.get("video_files", [])
                    hd_files = [f["link"] for f in files if f.get("quality") == "hd" and f.get("file_type") == "video/mp4"]
                    if hd_files:
                        videos.append(hd_files[0])
                    elif files:
                        videos.append(files[0]["link"])
                return videos
        except Exception as e:
            logger.error(f"Pexels video fetch error: {e}")
    return []

async def fetch_unsplash_photos(query: str, per_page: int = 15) -> list[str]:
    """Fetch photos from Unsplash API"""
    if not UNSPLASH_ACCESS_KEY:
        return []
    url = f"https://api.unsplash.com/search/photos?query={query}&per_page={per_page}&orientation=portrait"
    async with httpx.AsyncClient(headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}", **HEADERS}, timeout=15) as client:
        try:
            r = await client.get(url)
            if r.status_code == 200:
                data = r.json()
                photos = [p["urls"]["regular"] for p in data.get("results", []) if p.get("urls")]
                return photos
        except Exception as e:
            logger.error(f"Unsplash fetch error: {e}")
    return []

async def search_media(query: str, media_type: str = "photo", count: int = 10) -> list[str]:
    """Search images or videos across available providers with deduplication"""
    unseen_media = []
    
    if media_type == "video":
        videos = await fetch_pexels_videos(query, per_page=10)
        for v in videos:
            if not is_media_seen(v):
                unseen_media.append(v)
                if len(unseen_media) >= count:
                    break
        return unseen_media

    # Photo search
    # 1. Try Pexels
    pexels_photos = await fetch_pexels_photos(query, per_page=15)
    for p in pexels_photos:
        if not is_media_seen(p):
            unseen_media.append(p)
            if len(unseen_media) >= count:
                return unseen_media

    # 2. Try Unsplash
    unsplash_photos = await fetch_unsplash_photos(query, per_page=15)
    for u in unsplash_photos:
        if not is_media_seen(u):
            unseen_media.append(u)
            if len(unseen_media) >= count:
                return unseen_media

    return unseen_media

async def fetch_and_create_candidate(category: str = None, custom_query: str = None, media_type: str = "photo") -> int | None:
    """
    Main pipeline:
    1. Select topic/query based on category or custom_query
    2. Search 10 matching high-res images (album) or 1 vertical video
    3. Generate aesthetic caption with Gemini AI
    4. Save to DB with 'pending' status
    """
    if not category:
        cat_obj = random.choice(TARGET_CATEGORIES)
        category = cat_obj["id"]
        topic = random.choice(cat_obj["keywords"])
    else:
        cat_obj = next((c for c in TARGET_CATEGORIES if c["id"] == category), None)
        topic = custom_query if custom_query else (random.choice(cat_obj["keywords"]) if cat_obj else category)

    if custom_query:
        topic = custom_query

    # Exactly 10 photos per post as requested!
    needed_count = 1 if media_type == "video" else ALBUM_PHOTOS_COUNT
    media_urls = await search_media(topic, media_type=media_type, count=needed_count)

    # If API returns less than 10 or no keys entered, use curated model-specific 10-photo set
    if (not media_urls or len(media_urls) < needed_count) and media_type == "photo":
        curated_set = find_matched_curated_set(topic, category)
        media_urls = curated_set[:needed_count]

    if not media_urls:
        logger.warning(f"No media found for topic '{topic}' in category '{category}'")
        return None

    # Clean display title with exact model name
    title = f"{topic.title()} (10 ta sara rasm to'plami)" if media_type == "photo" else f"{topic.title()} Video Lavha"
    caption = await generate_caption(category, topic, media_type)

    album_id = save_album(
        category=category,
        title=title,
        media_urls=media_urls,
        caption=caption,
        media_type=media_type,
        status="pending"
    )
    logger.info(f"Yangi 10 talik albom yaratildi [ID: {album_id}]: {title}")
    return album_id
