import logging
from aiogram import Bot
from aiogram.utils.media_group import MediaGroupBuilder
from backend.config import TELEGRAM_BOT_TOKEN, CHANNEL_ID
from backend.database import get_album, update_album_status

logger = logging.getLogger(__name__)

async def publish_album_to_channel(album_id: int) -> tuple[bool, str]:
    """
    Publishes an approved album or video to the target Telegram channel (@avatarlar_uz)
    Returns: (success: bool, message: str)
    """
    if not TELEGRAM_BOT_TOKEN:
        return False, "TELEGRAM_BOT_TOKEN belgilanmagan! Iltimos .env faylini to'ldiring."
    
    if not CHANNEL_ID:
        return False, "CHANNEL_ID belgilanmagan! Iltimos .env faylida kanal nomini ko'rsating."
        
    album = get_album(album_id)
    if not album:
        return False, f"Albom topilmadi (ID: {album_id})"

    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    try:
        media_urls = album["media_urls"]
        caption = album["caption"]
        media_type = album["media_type"]

        if media_type == "video" and media_urls:
            # Single video post
            await bot.send_video(
                chat_id=CHANNEL_ID,
                video=media_urls[0],
                caption=caption
            )
        else:
            # Photo album (MediaGroup of 2 to 4 photos)
            builder = MediaGroupBuilder(caption=caption)
            for url in media_urls:
                builder.add_photo(media=url)
            
            await bot.send_media_group(
                chat_id=CHANNEL_ID,
                media=builder.build()
            )

        update_album_status(album_id, "published")
        logger.info(f"Albom kanalga muvaffaqiyatli joylandi! ID: {album_id}")
        return True, "Kanalga muvaffaqiyatli joylandi!"

    except Exception as e:
        err_msg = str(e)
        logger.error(f"Kanalga post qilishda xatolik yuz berdi: {err_msg}")
        update_album_status(album_id, "failed", error_message=err_msg)
        return False, f"Post qilishda xatolik: {err_msg}"
    finally:
        await bot.session.close()
