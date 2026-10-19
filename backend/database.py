import sqlite3
import json
import hashlib
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "agent.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Albums / Candidates table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        media_urls TEXT NOT NULL,       -- JSON array of URLs (2-4 images or 1 video)
        media_type TEXT NOT NULL DEFAULT 'photo', -- 'photo' or 'video'
        caption TEXT NOT NULL,          -- AI generated aesthetic caption
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'published', 'failed'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        published_at TIMESTAMP,
        error_message TEXT
    )
    """)
    
    # 2. Seen Media (prevents duplicate images from ever being suggested)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS seen_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url_hash TEXT UNIQUE NOT NULL,
        source TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # 3. Settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )
    """)
    
    conn.commit()
    conn.close()

def hash_url(url: str) -> str:
    return hashlib.sha256(url.encode('utf-8')).hexdigest()

def is_media_seen(url: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    h = hash_url(url)
    cursor.execute("SELECT 1 FROM seen_media WHERE url_hash = ?", (h,))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def mark_media_seen(url: str, source: str = "web"):
    conn = get_connection()
    cursor = conn.cursor()
    h = hash_url(url)
    try:
        cursor.execute("INSERT OR IGNORE INTO seen_media (url_hash, source) VALUES (?, ?)", (h, source))
        conn.commit()
    finally:
        conn.close()

def save_album(category: str, title: str, media_urls: list[str], caption: str, media_type: str = "photo", status: str = "pending") -> int:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO albums (category, title, media_urls, media_type, caption, status)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (category, title, json.dumps(media_urls), media_type, caption, status))
    album_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    # Mark all URLs as seen
    for url in media_urls:
        mark_media_seen(url, category)
        
    return album_id

def get_candidates(status: str = "pending", category: str = None) -> list[dict]:
    conn = get_connection()
    cursor = conn.cursor()
    if category and category != "all":
        cursor.execute("""
        SELECT * FROM albums 
        WHERE status = ? AND category = ? 
        ORDER BY id DESC
        """, (status, category))
    else:
        cursor.execute("""
        SELECT * FROM albums 
        WHERE status = ? 
        ORDER BY id DESC
        """, (status,))
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "category": r["category"],
            "title": r["title"],
            "media_urls": json.loads(r["media_urls"]),
            "media_type": r["media_type"],
            "caption": r["caption"],
            "status": r["status"],
            "created_at": r["created_at"],
            "published_at": r["published_at"]
        })
    return results

def get_album(album_id: int) -> dict | None:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM albums WHERE id = ?", (album_id,))
    r = cursor.fetchone()
    conn.close()
    if not r:
        return None
    return {
        "id": r["id"],
        "category": r["category"],
        "title": r["title"],
        "media_urls": json.loads(r["media_urls"]),
        "media_type": r["media_type"],
        "caption": r["caption"],
        "status": r["status"],
        "created_at": r["created_at"],
        "published_at": r["published_at"],
        "error_message": r["error_message"]
    }

def update_album_status(album_id: int, status: str, error_message: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    published_at = datetime.now().isoformat() if status == "published" else None
    cursor.execute("""
    UPDATE albums 
    SET status = ?, published_at = COALESCE(?, published_at), error_message = ? 
    WHERE id = ?
    """, (status, published_at, error_message, album_id))
    conn.commit()
    conn.close()

def update_album_caption(album_id: int, new_caption: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE albums SET caption = ? WHERE id = ?", (new_caption, album_id))
    conn.commit()
    conn.close()

def get_stats() -> dict:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status, COUNT(*) as count FROM albums GROUP BY status")
    rows = cursor.fetchall()
    conn.close()
    
    stats = {"pending": 0, "published": 0, "rejected": 0, "failed": 0, "total": 0}
    for r in rows:
        stats[r["status"]] = r["count"]
        stats["total"] += r["count"]
    return stats
