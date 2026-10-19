import os
import logging
from backend.config import CHANNEL_ID

logger = logging.getLogger(__name__)

def generate_hashtags(category: str, topic: str) -> str:
    """Generate relevant aesthetic hashtags for the post"""
    base_tags = ["#avatarlar_uz", "#profil_uchun_rasimlar", "#oboi", "#wallpaper"]
    
    clean_topic = topic.lower().replace("aesthetic", "").replace("luxury", "").replace("dark", "").strip()
    words = [w for w in clean_topic.split() if len(w) > 2]
    topic_tags = [f"#{w}" for w in words[:3]]
    
    category_map = {
        "cars": ["#avto", "#supercar", "#cars"],
        "avatars_boys": ["#boy", "#pfp", "#man_avatar"],
        "avatars_girls": ["#girl", "#aesthetic_girl", "#qizlar"],
        "couples": ["#couple", "#love", "#juftliklar"],
        "nature": ["#nature", "#aesthetic_nature", "#manzara"],
        "movies_anime": ["#anime", "#cinema", "#art"],
        "videos": ["#reels", "#video_oboi", "#live_wallpaper"]
    }
    
    specific_tags = category_map.get(category, [])
    all_tags = list(dict.fromkeys(topic_tags + specific_tags + base_tags))
    return " ".join(all_tags[:6])

async def generate_caption(category: str, topic: str, media_type: str = "photo") -> str:
    """
    Clean, minimalist caption without long philosophical quotes, as specifically requested by user.
    Includes only: Title ✨, Hashtags, and Channel tag.
    """
    hashtags = generate_hashtags(category, topic)
    channel_tag = CHANNEL_ID if CHANNEL_ID else "@avatarlar_uz"
    
    title = topic.title()
    if media_type == "photo":
        caption = f"{title} 🖼✨\n\n{hashtags}\n\nKanalimiz: {channel_tag}"
    else:
        caption = f"{title} 🎥✨\n\n{hashtags}\n\nKanalimiz: {channel_tag}"
        
    return caption
