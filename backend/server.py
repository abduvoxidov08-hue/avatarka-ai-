import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from backend.config import TARGET_CATEGORIES
from backend.database import (
    get_candidates,
    get_album,
    update_album_status,
    update_album_caption,
    get_stats
)
from backend.services.media_fetcher import fetch_and_create_candidate
from backend.services.post_publisher import publish_album_to_channel

logger = logging.getLogger(__name__)

app = FastAPI(title="@avatarlar_uz AI Agent API", version="1.0.0")

# Enable CORS for Telegram Mini App and Netlify frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchRequest(BaseModel):
    category: str = "cars"
    query: str = ""
    media_type: str = "photo"

class CaptionUpdateRequest(BaseModel):
    caption: str

@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "@avatarlar_uz AI Agent"}

@app.get("/api/categories")
async def get_categories():
    return {"categories": TARGET_CATEGORIES}

@app.get("/api/candidates")
async def list_candidates(status: str = "pending", category: str = "all"):
    candidates = get_candidates(status=status, category=category)
    return {"candidates": candidates}

@app.get("/api/candidates/{album_id}")
async def get_candidate_details(album_id: int):
    album = get_album(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Albom topilmadi")
    return {"album": album}

@app.post("/api/approve/{album_id}")
async def approve_and_publish(album_id: int):
    album = get_album(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Albom topilmadi")
    
    success, message = await publish_album_to_channel(album_id)
    if not success:
        raise HTTPException(status_code=500, detail=message)
    return {"success": True, "message": message}

@app.post("/api/reject/{album_id}")
async def reject_candidate(album_id: int):
    album = get_album(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Albom topilmadi")
    update_album_status(album_id, "rejected")
    return {"success": True, "message": "Albom rad etildi"}

@app.put("/api/caption/{album_id}")
async def update_caption(album_id: int, req: CaptionUpdateRequest):
    album = get_album(album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Albom topilmadi")
    update_album_caption(album_id, req.caption)
    return {"success": True, "message": "Matn yangilandi"}

@app.post("/api/search")
async def search_and_create(req: SearchRequest):
    album_id = await fetch_and_create_candidate(
        category=req.category,
        custom_query=req.query if req.query else None,
        media_type=req.media_type
    )
    if not album_id:
        raise HTTPException(status_code=404, detail="Mos rasmlar topilmadi")
    
    album = get_album(album_id)
    return {"success": True, "album": album}

@app.get("/api/stats")
async def stats():
    return get_stats()

# Mount frontend directory for local preview
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
