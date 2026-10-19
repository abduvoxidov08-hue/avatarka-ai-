import os
import random
import logging
from backend.config import GEMINI_API_KEY, CHANNEL_ID

logger = logging.getLogger(__name__)

# Fallback aesthetic quotes in Uzbek if Gemini API key is not yet provided
FALLBACK_QUOTES = {
    "cars": [
        "Tezlik — bu shunchaki harakat emas, bu o'z erkinligingni his qilish san'ati... 🖤\nO'z orzularing sari to'xtamasdan intil! 🏎✨",
        "Sokin tun, bo'sh ko'chalar va haqiqiy qudrat... 🔥\nSifat va salobat har bir detalda aks etadi. 💎",
        "Katta maqsadlar jimjitlikda shakllanadi va shovqinli natijalar bilan gapiradi... 🖤⚡️",
        "Orzular ushalishi uchun ularga intilish kerak, shunchaki kutish emas... 🚀✨"
    ],
    "avatars_boys": [
        "O'z yo'lingni tanla va har qanday sharoitda o'zingga sodiq qol... 🖤\nKuchli xarakter — eng qadrli fazilat. ⚡️",
        "Jimjitlik ortida ulkan sabr va metin iroda yashiringan... ♟\nProfil uchun estetik suratlar to'plami. ✨",
        "O'tmish tajriba, bugun imkoniyat, kelajak esa seniki... 🐺🖤"
    ],
    "avatars_girls": [
        "Nafosat va go'zallik — bu har bir lahzada o'zligingni saqlay bilishdir... 🌸✨\nProfilingiz uchun eng sara va jozibali suratlar to'plami. 💖",
        "Ko'zlarda orzular, qalbda esa cheksiz osoyishtalik... 🤍🌿\nO'zgacha estetika va samimiyat. ✨",
        "Eng chiroyli narsa — bu sen o'zing yaratgan ichki dunyongdir... 🌙💫"
    ],
    "couples": [
        "Bir-birini so'zsiz tushunish — bu dunyodagi eng katta baxt... 🤍🕊\nBirga kechirilgan har bir soniya bebaho. ✨",
        "Qalb yaqin bo'lsa, masofalar o'z ma'nosini yo'qotadi... 🌙🤍\nJuftliklar uchun eng estetik avatarlar to'plami. 💑",
        "Sen bilan dunyo yanada go'zalroq va sokinroq... 💫❤️"
    ],
    "nature": [
        "Tabiatning osoyishtaligi — charchagan ruh uchun eng yaxshi malham... 🌲🌧\nSokinlik va estetik manzaralar uyg'unligi. 🍃",
        "Yomg'irdan keyin ochilgan quyosh kabi, har qiyinchilik ortida bir yorug'lik bor... 🌈✨\nEkraningiz uchun eng sara oboylar. 🖼",
        "Shahar chiroqlari va tungi sokinlik... Go'zallik har qadamda mavjud. 🌃🖤"
    ],
    "movies_anime": [
        "Qahramonlar yengilmas bo'lgani uchun emas, yiqilsa ham qayta tura olgani uchun buyukdir... ⚡️🔥\nKino va san'at olamidagi eng sara lahzalar. 🎬",
        "Har bir afsonaning o'z boshlanishi bor... Qorong'ilik ortidan nur izla! 🌌⚔️",
        "Orzularing qanchalik fantastik bo'lmasin, ularga ishonishdan to'xtama! 🔮✨"
    ],
    "videos": [
        "Atigi bir necha soniyada butun kayfiyatingizni o'zgartiradigan atmosfera... 🎥✨\nJonli va sifatli video lavha. 🖤",
        "Harakat, ritm va estetik tuyg'u... Tomosha qiling va his eting! ⚡️🔥"
    ]
}

def generate_hashtags(category: str, topic: str) -> str:
    """Generate relevant hashtags for the post"""
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
    return " ".join(all_tags[:7])

async def generate_caption(category: str, topic: str, media_type: str = "photo") -> str:
    """
    Generate aesthetic Uzbek caption with quote, emojis, hashtags and channel link.
    Uses Gemini API if key is present, otherwise falls back to curated aesthetic quotes.
    """
    hashtags = generate_hashtags(category, topic)
    channel_tag = CHANNEL_ID if CHANNEL_ID else "@avatarlar_uz"
    
    if GEMINI_API_KEY:
        try:
            from google import genai
            client = genai.Client(api_key=GEMINI_API_KEY)
            
            prompt = f"""
            Siz mashhur estetik Telegram kanali (@avatarlar_uz) uchun post matnlari yozuvchi ijodiy yordamchisiz.
            
            Mavzu: {topic}
            Kategoriya: {category}
            Format: {media_type} to'plami (albom)
            
            Vazifa:
            1. Ushbu mavzuga mos 1-2 jumlali chuqur ma'noli, chiroyli va ta'sirchan O'ZBEKCHA status/iqtibos yozing (motivatsion, romantik, sokin yoki estetik kayfiyatda).
            2. Matnga juda mos 2-3 ta chiroyli emoji qo'shing.
            3. Faqat status matnini qaytaring, ortiqcha izoh, sarlavha yoki 'Status:' kabi so'zlar yozmang!
            """
            
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            
            if response and response.text:
                quote = response.text.strip()
                caption = f"{quote}\n\n{hashtags}\n\nKanalimiz: {channel_tag}"
                return caption
        except Exception as e:
            logger.warning(f"Gemini API chaqiruvida xatolik: {e}. Fallback iqtibos ishlatiladi.")
            
    # Fallback quote
    quotes_list = FALLBACK_QUOTES.get(category, FALLBACK_QUOTES["nature"])
    selected_quote = random.choice(quotes_list)
    return f"{selected_quote}\n\n{hashtags}\n\nKanalimiz: {channel_tag}"
