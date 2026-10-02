// Doimiy saqlash: Netlify Blobs (sozlamalar, yuborilgan rasmlar, loglar).
import { getStore } from "@netlify/blobs";

export function createStore() {
  const s = getStore({ name: "avatarka", consistency: "strong" });
  return {
    async get(key, fallback = null) {
      const v = await s.get(key, { type: "json" });
      return v ?? fallback;
    },
    async set(key, value) {
      await s.setJSON(key, value);
    },
    async del(key) {
      await s.delete(key);
    },
  };
}

// Sinov uchun xotiradagi saqlash
export function memoryStore() {
  const m = new Map();
  return {
    async get(key, fallback = null) {
      return m.has(key) ? structuredClone(m.get(key)) : fallback;
    },
    async set(key, value) {
      m.set(key, structuredClone(value));
    },
    async del(key) {
      m.delete(key);
    },
  };
}
