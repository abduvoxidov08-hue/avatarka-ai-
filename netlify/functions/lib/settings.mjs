// Sozlamalar: saytdan kiritilganlari (Blobs) + muhit o'zgaruvchilari (zaxira).
export const DEFAULT_QUERIES = [
  "aesthetic wallpaper",
  "profile pictures",
  "phone aesthetic background",
  "minimalist wallpapers",
];

export const DEFAULT_CAPTION =
  "Profilingiz uchun eng sara va sifatli rasmlar to'plami. ✨\nBiz bilan profilingiz o'zgacha ko'rinadi! 🎨";

export const TOKEN_RE = /^\d{5,}:[A-Za-z0-9_-]{30,}$/;
export const CHANNEL_RE = /^(@[A-Za-z0-9_]{4,}|-?\d{5,})$/;

export async function loadSettings(store, env = process.env) {
  const saved = (await store.get("settings", {})) || {};
  const queries =
    Array.isArray(saved.queries) && saved.queries.length
      ? saved.queries
      : (env.PINTEREST_QUERIES || "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    botToken: saved.botToken || env.TELEGRAM_BOT_TOKEN || "",
    channelId: saved.channelId || env.TELEGRAM_CHANNEL_ID || "",
    pinterestToken: saved.pinterestToken || env.PINTEREST_ACCESS_TOKEN || "",
    queries: queries.length ? queries : DEFAULT_QUERIES,
    minWidth: saved.minWidth || 720,
    minHeight: saved.minHeight || 720,
    caption: saved.caption || DEFAULT_CAPTION,
    perPost: 10,
    enabled: saved.enabled !== false,
  };
}

// Brauzerga qaytariladigan variant: tokenlar hech qachon ochiq yuborilmaydi.
export function publicSettings(s) {
  const mask = (t) => (t ? `${t.slice(0, 4)}…${t.slice(-4)}` : "");
  return {
    hasBotToken: !!s.botToken,
    botTokenMasked: mask(s.botToken),
    channelId: s.channelId,
    hasPinterestToken: !!s.pinterestToken,
    queries: s.queries,
    minWidth: s.minWidth,
    minHeight: s.minHeight,
    caption: s.caption,
    enabled: s.enabled,
  };
}

// Foydalanuvchi kiritgan ma'lumotni tekshirib, saqlanadigan ko'rinishga keltiradi.
export function validateInput(input, current) {
  const out = {};
  const errors = [];
  if (typeof input.botToken === "string" && input.botToken.trim()) {
    if (!TOKEN_RE.test(input.botToken.trim())) errors.push("Bot tokeni noto'g'ri formatda (BotFather bergan to'liq token kerak).");
    else out.botToken = input.botToken.trim();
  }
  if (typeof input.channelId === "string") {
    const c = input.channelId.trim();
    if (!CHANNEL_RE.test(c)) errors.push("Kanal @username yoki -100... ID ko'rinishida bo'lishi kerak.");
    else out.channelId = c;
  }
  if (typeof input.pinterestToken === "string" && input.pinterestToken.trim()) {
    out.pinterestToken = input.pinterestToken.trim().slice(0, 500);
  }
  if (input.clearPinterestToken === true) out.pinterestToken = "";
  if (input.queries !== undefined) {
    const list = (Array.isArray(input.queries) ? input.queries : String(input.queries).split(/[\n,]/))
      .map((q) => String(q).trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 20);
    if (!list.length) errors.push("Kamida bitta qidiruv so'zi kerak.");
    else out.queries = list;
  }
  for (const k of ["minWidth", "minHeight"]) {
    if (input[k] !== undefined) {
      const n = parseInt(input[k], 10);
      if (!Number.isFinite(n) || n < 200 || n > 5000) errors.push(`${k} 200 dan 5000 gacha bo'lishi kerak.`);
      else out[k] = n;
    }
  }
  if (input.caption !== undefined) {
    const cap = String(input.caption).trim();
    if (!cap || cap.length > 1000) errors.push("Matn 1 dan 1000 belgigacha bo'lishi kerak.");
    else out.caption = cap;
  }
  if (typeof input.enabled === "boolean") out.enabled = input.enabled;
  return { errors, merged: { ...current, ...out } };
}
