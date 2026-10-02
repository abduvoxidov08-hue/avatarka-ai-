import { createHash, timingSafeEqual } from "node:crypto";

const sha = (s) => createHash("sha256").update(String(s)).digest();

// ADMIN_PASSWORD (Netlify muhit o'zgaruvchisi) bilan solishtiradi.
export function checkAdmin(req, env = process.env) {
  const expected = env.ADMIN_PASSWORD;
  if (!expected) return { ok: false, status: 503, message: "ADMIN_PASSWORD Netlify'da o'rnatilmagan (README'ga qarang)." };
  const given = req.headers.get("x-admin-password") || "";
  return timingSafeEqual(sha(given), sha(expected))
    ? { ok: true }
    : { ok: false, status: 401, message: "Parol noto'g'ri" };
}
