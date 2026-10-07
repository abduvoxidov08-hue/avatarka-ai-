import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Refresh token AES-256-GCM bilan shifrlanadi: "iv.tag.shifrmatn" (base64url)
export function encrypt(plain, keyHex) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(blob, keyHex) {
  const [iv, tag, data] = blob.split('.').map((s) => Buffer.from(s, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const randomToken = (n = 32) => randomBytes(n).toString('base64url');

// Imzolangan qisqa muddatli qiymat (OAuth jarayon cookie'si uchun)
export function sign(obj, secret) {
  const body = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const mac = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function verify(str, secret) {
  if (typeof str !== 'string') return null;
  const [body, mac] = str.split('.');
  if (!body || !mac) return null;
  const good = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(good);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
