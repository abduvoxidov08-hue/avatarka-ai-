// Asosiy mantiq: rasm yig'ish -> albom yuborish -> bazaga yozish.
import { collectPins } from "./pinterest.mjs";
import { loadSettings } from "./settings.mjs";
import { sendAlbum } from "./telegram.mjs";

const LOCK_TTL_MS = 10 * 60 * 1000;
const MAX_SENT = 100000;
const MAX_LOGS = 200;
const TG_URL_MAX_BYTES = 4.5 * 1024 * 1024; // Telegram URL orqali rasm olishda limit 5MB

export function makeLogger(store) {
  const buf = [];
  const push = (level, msg) => {
    console.log(`[${level}] ${msg}`);
    buf.push({ t: new Date().toISOString(), level, msg });
  };
  return {
    info: (m) => push("info", m),
    warn: (m) => push("warn", m),
    error: (m) => push("error", m),
    async flush() {
      if (!buf.length) return;
      try {
        const old = await store.get("logs", []);
        await store.set("logs", [...old, ...buf].slice(-MAX_LOGS));
        buf.length = 0;
      } catch (e) {
        console.error("Loglarni saqlab bo'lmadi", e);
      }
    },
  };
}

// Asl (orig) rasm Telegram limitiga sig'adimi? Sig'masa o'rta o'lchamdagisini ishlatamiz.
async function pickUrl(choice, f) {
  const { orig, mid } = choice;
  if (orig.url === mid.url) return orig.url;
  if (orig.w + orig.h > 9500) return mid.url;
  try {
    const res = await f(orig.url, { method: "HEAD", signal: AbortSignal.timeout(6000) });
    const len = Number(res.headers.get("content-length") || 0);
    if (res.ok && len > 0 && len <= TG_URL_MAX_BYTES) return orig.url;
  } catch {
    /* HEAD o'xshamasa, xavfsiz variantga o'tamiz */
  }
  return mid.url;
}

export async function runPost({ store, fetchImpl = fetch, source = "manual", collectBudgetMs = 4 * 60 * 1000 }) {
  const log = makeLogger(store);
  try {
    const lock = await store.get("lock", null);
    if (lock && Date.now() - lock.t < LOCK_TTL_MS) {
      log.warn("Oldingi post hali tugamagan - bu urinish o'tkazib yuborildi");
      return { ok: false, reason: "locked" };
    }
    await store.set("lock", { t: Date.now() });

    try {
      const s = await loadSettings(store);
      if (source === "scheduled" && !s.enabled) {
        log.info("Avto-post o'chirilgan (sozlamalarda) - o'tkazib yuborildi");
        return { ok: false, reason: "disabled" };
      }
      if (!s.botToken || !s.channelId) {
        log.error("Bot tokeni yoki kanal kiritilmagan. Saytning 'Sozlamalar' bo'limini to'ldiring.");
        return { ok: false, reason: "no-settings" };
      }

      log.info(`=== Post boshlandi (${source}) ===`);
      const sentArr = await store.get("sent", []);
      const sent = new Set(sentArr);

      const chosen = await collectPins({
        queries: s.queries,
        minWidth: s.minWidth,
        minHeight: s.minHeight,
        sent,
        count: s.perPost,
        deadline: Date.now() + collectBudgetMs,
        pinterestToken: s.pinterestToken,
        fetchImpl,
        log,
      });
      if (chosen.length < 2) {
        log.error(`Yetarli rasm topilmadi (${chosen.length}). Pinterest javob bermayotgan bo'lishi mumkin; keyingi rejada qayta uriniladi.`);
        return { ok: false, reason: "no-images" };
      }
      if (chosen.length < s.perPost) log.warn(`Faqat ${chosen.length} ta rasm topildi, albom shu miqdorda yuboriladi`);

      const urls = await Promise.all(chosen.map((c) => pickUrl(c, fetchImpl)));
      const base = { token: s.botToken, channelId: s.channelId, caption: s.caption, f: fetchImpl, log };
      let res = await sendAlbum({ ...base, urls });
      if (!res.ok && !res.retryable) {
        log.warn(`Albom rad etildi (${res.error}); o'rta o'lchamdagi rasmlar bilan qayta uriniladi`);
        res = await sendAlbum({ ...base, urls: chosen.map((c) => c.mid.url) });
      }
      if (!res.ok) {
        log.error(`Albom yuborilmadi: ${res.error}`);
        return { ok: false, reason: "send-failed", error: res.error };
      }

      for (const c of chosen) sent.add(c.id);
      await store.set("sent", [...sent].slice(-MAX_SENT));
      await store.set("lastPost", { t: new Date().toISOString(), count: chosen.length, source });
      log.info(`=== Albom yuborildi: ${chosen.length} ta rasm. Bazada jami: ${sent.size} ===`);
      return { ok: true, count: chosen.length };
    } finally {
      await store.del("lock");
    }
  } catch (e) {
    log.error(`Kutilmagan xato: ${e && e.stack ? e.stack : e}`);
    return { ok: false, reason: "exception" };
  } finally {
    await log.flush();
  }
}
