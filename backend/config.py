import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
CHANNEL_ID = os.getenv("CHANNEL_ID", "@avatarlar_uz").strip()
ADMIN_TELEGRAM_ID = os.getenv("ADMIN_TELEGRAM_ID", "").strip()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "").strip()
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY", "").strip()

PORT = int(os.getenv("PORT", "8000"))
MINI_APP_URL = os.getenv("MINI_APP_URL", f"http://localhost:{PORT}").strip()

# Default predefined categories
TARGET_CATEGORIES = [
    {
        "id": "cars",
        "name": "🏎 Avtomobillar",
        "keywords": ["Porsche 911 aesthetic", "BMW M5 dark aesthetic", "Mercedes AMG wallpaper", "Cadillac Escalade luxury", "Bentley Continental luxury car"]
    },
    {
        "id": "avatars_boys",
        "name": "👤 Yigitlar avatari",
        "keywords": ["handsome boy aesthetic avatar", "dark aesthetic boy pfp", "stylish male avatar profile"]
    },
    {
        "id": "avatars_girls",
        "name": "🌸 Qizlar avatari",
        "keywords": ["aesthetic girl avatar profile", "moody girl pfp", "korean aesthetic girl portrait"]
    },
    {
        "id": "couples",
        "name": "👩‍❤️‍👨 Juftliklar",
        "keywords": ["cute couple aesthetic wallpaper", "anime couple avatar matching", "moody couple love aesthetic"]
    },
    {
        "id": "nature",
        "name": "🌲 Tabiat & Shahar",
        "keywords": ["dark rainy aesthetic city street", "foggy forest mountain road", "night starry sky wallpaper"]
    },
    {
        "id": "movies_anime",
        "name": "🎬 Kino & Multik",
        "keywords": ["anime 4k aesthetic wallpaper", "Batman dark aesthetic", "Cyberpunk movie character portrait", "Spider-Man aesthetic art"]
    },
    {
        "id": "videos",
        "name": "🎥 Qisqa Videolar",
        "keywords": ["luxury car edit vertical", "aesthetic night rain 4k", "neon city vertical video"]
    }
]
