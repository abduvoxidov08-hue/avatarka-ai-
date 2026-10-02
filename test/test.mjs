import assert from "node:assert/strict";
import { memoryStore } from "../netlify/functions/lib/store.mjs";
import { runPost } from "../netlify/functions/lib/poster.mjs";
import { validateInput, loadSettings } from "../netlify/functions/lib/settings.mjs";

const store = memoryStore();
await store.set("settings", { botToken: "123456:" + "A".repeat(35), channelId: "@testchan" });

let counter = 0;
const albums = [];
const fakeFetch = async (url, init = {}) => {
  url = String(url);
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s });
  if (url.includes("BaseSearchResource")) {
    const results = Array.from({ length: 50 }, () => {
      const id = ++counter;
      return { id: String(id), type: "pin", images: {
        "236x": { url: `https://i.pinimg.com/236x/${id}.jpg`, width: 236, height: 400 },
        "736x": { url: `https://i.pinimg.com/736x/${id}.jpg`, width: 736, height: 1200 },
        orig: { url: `https://i.pinimg.com/originals/${id}.jpg`, width: 1440, height: 2560 } } };
    });
    results.push({ id: "ad", is_promoted: true, images: {} }, { id: "vid", videos: {}, images: {} });
    return J({ resource_response: { data: { results }, bookmark: "bm" } });
  }
  if (init.method === "HEAD") return new Response(null, { status: 200, headers: { "content-length": "1000000" } });
  if (url.includes("sendMediaGroup")) {
    const body = JSON.parse(init.body); albums.push(body.media);
    return J({ ok: true, result: body.media.map((_, i) => ({ message_id: 100 + i })) });
  }
  throw new Error("kutilmagan so'rov " + url);
};

assert.equal((await runPost({ store, fetchImpl: fakeFetch })).ok, true);
assert.equal((await runPost({ store, fetchImpl: fakeFetch })).ok, true);
assert.equal(albums[0].length, 10);
assert.ok(albums[0][0].caption.includes("Profilingiz uchun") && !albums[0][1].caption);
assert.ok(albums[0][0].media.includes("originals"));
const ids = albums.flat().map((m) => m.media);
assert.equal(new Set(ids).size, 20, "takrorlanish bo'lmasligi kerak");
assert.equal((await store.get("sent")).length, 20);
assert.ok((await store.get("logs")).length > 0);
assert.equal(await store.get("lock"), null);

// scheduled + o'chirilgan
await store.set("settings", { botToken: "123456:" + "A".repeat(35), channelId: "@testchan", enabled: false });
assert.equal((await runPost({ store, fetchImpl: fakeFetch, source: "scheduled" })).reason, "disabled");

// FloodWait: 429 keyin muvaffaqiyat
await store.set("settings", { botToken: "123456:" + "A".repeat(35), channelId: "@testchan" });
let first = true;
const flood = async (url, init) => {
  if (String(url).includes("sendMediaGroup") && first) { first = false;
    return new Response(JSON.stringify({ ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 1 } }), { status: 429 }); }
  return fakeFetch(url, init);
};
assert.equal((await runPost({ store, fetchImpl: flood })).ok, true);

// Pinterest ishlamasa - xatosiz tugaydi
const dead = async () => new Response("x", { status: 403 });
assert.equal((await runPost({ store, fetchImpl: dead })).reason, "no-images");

// validatsiya
assert.ok(validateInput({ botToken: "123456789:AAxxxxxxxxxxxx" }, {}).errors.length);
assert.ok(validateInput({ channelId: "kanal" }, {}).errors.length);
assert.equal(validateInput({ channelId: "@kanal_username", queries: "a\nb" }, {}).merged.queries.length, 2);
console.log("OK: barcha testlar o'tdi");
