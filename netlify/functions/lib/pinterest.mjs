// Pinterest: avval API v5 (token bo'lsa), bo'lmasa/xato bo'lsa veb-sayt qidiruvi (scraper).
const WEB = "https://www.pinterest.com";
const API = "https://api.pinterest.com/v5";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchJson(url, init, f, attempts = 3) {
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = await f(url, { ...init, signal: AbortSignal.timeout(12000) });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status}`);
        await sleep(1000 * i);
        continue;
      }
      if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { fatal: true });
      return await res.json();
    } catch (e) {
      if (e.fatal) throw e;
      lastErr = e;
      await sleep(1000 * i);
    }
  }
  throw lastErr;
}

export function buildPin(id, images) {
  if (!id || !images || typeof images !== "object") return null;
  const variants = Object.values(images)
    .filter((v) => v && v.url)
    .map((v) => ({ url: v.url, w: Number(v.width) || 0, h: Number(v.height) || 0 }))
    .sort((a, b) => b.w * b.h - a.w * a.h);
  return variants.length ? { id: String(id), variants } : null;
}

async function searchV5(query, bookmark, token, f) {
  const p = new URLSearchParams({ term: query, country_code: "US", limit: String(PAGE_SIZE) });
  if (bookmark) p.set("bookmark", bookmark);
  const data = await fetchJson(`${API}/search/partner/pins?${p}`, { headers: { Authorization: `Bearer ${token}` } }, f);
  const pins = (data.items || []).map((it) => buildPin(it.id, it.media && it.media.images)).filter(Boolean);
  return { pins, bookmark: data.bookmark || null };
}

async function searchWeb(query, bookmark, f) {
  const options = {
    query,
    scope: "pins",
    bookmarks: bookmark ? [bookmark] : [],
    page_size: PAGE_SIZE,
    no_fetch_context_on_resource: false,
  };
  const p = new URLSearchParams({
    source_url: `/search/pins/?q=${encodeURIComponent(query)}&rs=typed`,
    data: JSON.stringify({ options, context: {} }),
    _: String(Date.now()),
  });
  const data = await fetchJson(
    `${WEB}/resource/BaseSearchResource/get/?${p}`,
    {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        "X-Pinterest-AppState": "active",
        "X-Pinterest-PWS-Handler": "www/search/[scope].js",
        Referer: `${WEB}/search/pins/?q=${encodeURIComponent(query)}`,
      },
    },
    f,
  );
  const rr = data.resource_response || {};
  const results = (rr.data && rr.data.results) || [];
  const pins = results
    .filter((it) => it && typeof it === "object" && !it.is_promoted && !it.videos && (!it.type || it.type === "pin"))
    .map((it) => buildPin(it.id, it.images))
    .filter(Boolean);
  const marks = (data.resource && data.resource.options && data.resource.options.bookmarks) || [];
  return { pins, bookmark: rr.bookmark || marks[0] || null };
}

export async function searchPage(query, bookmark, { pinterestToken, fetchImpl, log }) {
  if (pinterestToken) {
    try {
      return await searchV5(query, bookmark, pinterestToken, fetchImpl);
    } catch (e) {
      log.warn(`Pinterest API v5 ishlamadi (${e.message}), veb-qidiruvga o'tildi`);
    }
  }
  return searchWeb(query, bookmark, fetchImpl);
}

// Telegram URL orqali rasm olishda: fayl <= 5MB va width+height <= 10000. Shuning uchun
// asl (orig) va o'rta (~736px) variantlar alohida saqlanadi.
function toChoice(pin, minW, minH) {
  const big = pin.variants.find((v) => v.w >= minW && v.h >= minH);
  if (!big) return null;
  const mid = pin.variants.find((v) => v.w >= minW && v.w <= 800 && v.h >= minH) || big;
  return { id: pin.id, orig: big, mid };
}

export async function collectPins({ queries, minWidth, minHeight, sent, count, deadline, pinterestToken, fetchImpl, log }) {
  const qs = shuffle([...queries]);
  const state = new Map(qs.map((q) => [q, { bookmark: null, pages: 0, done: false }]));
  const perTurn = Math.max(2, Math.ceil(count / qs.length));
  const chosen = [];
  const seen = new Set();

  while (chosen.length < count && Date.now() < deadline && [...state.values()].some((s) => !s.done)) {
    for (const q of qs) {
      const st = state.get(q);
      if (st.done || chosen.length >= count || Date.now() >= deadline) continue;
      let res;
      try {
        res = await searchPage(q, st.bookmark, { pinterestToken, fetchImpl, log });
      } catch (e) {
        log.warn(`'${q}' qidiruvi muvaffaqiyatsiz: ${e.message}`);
        st.done = true;
        continue;
      }
      st.pages++;
      st.bookmark = res.bookmark;
      if (!res.bookmark || res.bookmark === "-end-" || st.pages >= MAX_PAGES) st.done = true;

      const fresh = shuffle(res.pins.filter((p) => !seen.has(p.id) && !sent.has(p.id)));
      let taken = 0;
      for (const pin of fresh) {
        if (taken >= perTurn || chosen.length >= count) break;
        const c = toChoice(pin, minWidth, minHeight);
        if (!c) continue;
        seen.add(pin.id);
        chosen.push(c);
        taken++;
      }
      log.info(`'${q}': ${st.pages}-sahifa, ${res.pins.length} pin, ${taken} ta olindi (jami ${chosen.length}/${count})`);
      await sleep(300 + Math.random() * 500);
    }
  }
  return chosen;
}
