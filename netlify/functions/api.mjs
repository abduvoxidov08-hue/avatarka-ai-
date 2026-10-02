// Boshqaruv paneli uchun API. Barcha so'rovlar (ping'dan tashqari) parol bilan himoyalangan.
import { checkAdmin } from "./lib/auth.mjs";
import { loadSettings, publicSettings, validateInput } from "./lib/settings.mjs";
import { createStore } from "./lib/store.mjs";
import { verifyBot } from "./lib/telegram.mjs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  const route = new URL(req.url).pathname.replace(/^\/api\/?/, "");

  if (route === "ping") return json({ adminConfigured: !!process.env.ADMIN_PASSWORD });

  const auth = checkAdmin(req);
  if (!auth.ok) return json({ error: auth.message }, auth.status);

  const store = createStore();
  try {
    if (route === "status" && req.method === "GET") {
      const s = await loadSettings(store);
      return json({
        settings: publicSettings(s),
        sentCount: (await store.get("sent", [])).length,
        lastPost: await store.get("lastPost", null),
        running: !!(await store.get("lock", null)),
        logs: (await store.get("logs", [])).slice(-60),
      });
    }

    if (route === "settings" && req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const current = (await store.get("settings", {})) || {};
      const { errors, merged } = validateInput(body, current);
      if (errors.length) return json({ error: errors.join(" ") }, 400);
      await store.set("settings", merged);
      return json({ ok: true, settings: publicSettings(await loadSettings(store)) });
    }

    if (route === "test" && req.method === "POST") {
      const s = await loadSettings(store);
      if (!s.botToken || !s.channelId) return json({ ok: false, message: "Avval bot tokeni va kanalni saqlang." });
      return json(await verifyBot({ token: s.botToken, channelId: s.channelId }));
    }

    if (route === "post-now" && req.method === "POST") {
      if (await store.get("lock", null)) return json({ ok: false, message: "Post allaqachon ishlayapti." }, 409);
      const origin = new URL(req.url).origin;
      const res = await fetch(`${origin}/.netlify/functions/post-background`, {
        method: "POST",
        headers: { "x-admin-password": req.headers.get("x-admin-password") },
      });
      return json({ ok: res.status === 202 || res.ok, message: "Post jarayoni boshlandi. Loglarni kuzating." }, res.ok ? 202 : 502);
    }

    if (route === "reset-sent" && req.method === "POST") {
      await store.set("sent", []);
      return json({ ok: true });
    }

    return json({ error: "Topilmadi" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: `Server xatosi: ${e.message}` }, 500);
  }
};

export const config = { path: "/api/*" };
