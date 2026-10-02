// Telegram Bot API (fetch orqali, qo'shimcha kutubxonasiz).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function tg(token, method, body, f = fetch) {
  const res = await f(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(60000),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = { ok: false, description: `HTTP ${res.status}` };
  }
  return data;
}

// Albom yuboradi. FloodWait (429) da kutib qayta urinadi.
export async function sendAlbum({ token, channelId, urls, caption, f = fetch, log, maxAttempts = 4 }) {
  const media = urls.slice(0, 10).map((url, i) => ({
    type: "photo",
    media: url,
    ...(i === 0 ? { caption } : {}),
  }));
  let last = { ok: false, description: "noma'lum xato" };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      last = await tg(token, "sendMediaGroup", { chat_id: channelId, media }, f);
    } catch (e) {
      last = { ok: false, description: `Tarmoq xatosi: ${e.message}` };
      log.warn(`${last.description} (urinish ${attempt}/${maxAttempts})`);
      await sleep(2000 * attempt);
      continue;
    }
    if (last.ok) return { ok: true, messageId: last.result && last.result[0] && last.result[0].message_id };
    if (last.error_code === 429) {
      const wait = (last.parameters && last.parameters.retry_after) || 5;
      if (wait > 120) return { ok: false, error: `FloodWait juda uzun: ${wait}s`, retryable: false };
      log.warn(`FloodWait: ${wait}s kutilmoqda (urinish ${attempt}/${maxAttempts})`);
      await sleep((wait + 1) * 1000);
      continue;
    }
    // 4xx (429 dan tashqari) - qayta urinish befoyda, chaqiruvchi o'zi hal qiladi
    if (last.error_code && last.error_code < 500) {
      return { ok: false, error: last.description, retryable: false };
    }
    log.warn(`Telegram xatosi: ${last.description} (urinish ${attempt}/${maxAttempts})`);
    await sleep(2000 * attempt);
  }
  return { ok: false, error: last.description, retryable: true };
}

export async function verifyBot({ token, channelId, f = fetch }) {
  const me = await tg(token, "getMe", {}, f);
  if (!me.ok) return { ok: false, message: `Token noto'g'ri: ${me.description}` };
  const chat = await tg(token, "getChat", { chat_id: channelId }, f);
  if (!chat.ok) return { ok: false, message: `Kanal topilmadi: ${chat.description}. Bot kanalga qo'shilganmi?` };
  const member = await tg(token, "getChatMember", { chat_id: chat.result.id, user_id: me.result.id }, f);
  const role = member.ok ? member.result.status : "noma'lum";
  if (role !== "administrator" && role !== "creator") {
    return { ok: false, message: `Bot @${me.result.username} kanalda admin emas (holati: ${role}). Admin qilib, "Xabar yuborish" huquqini bering.` };
  }
  return { ok: true, message: `Hammasi joyida: @${me.result.username} → ${chat.result.title || channelId} (${role})` };
}
