import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { loadConfig, validateConfig, SCOPES } from '../src/config.js';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { encrypt, decrypt } from '../src/crypto.js';

const KEY = 'a'.repeat(64);
let google, googleUrl, server, base, db, cfg;
let nextUser = { sub: '1', email: 'men@gmail.com', email_verified: true, name: 'Men', picture: 'http://x/p.png' };
const revoked = [];
let lastTokenBody;

before(async () => {
  google = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.setHeader('content-type', 'application/json');
      if (req.url === '/token') {
        lastTokenBody = new URLSearchParams(body);
        return res.end(JSON.stringify({ access_token: 'AT', refresh_token: 'RT-secret', scope: SCOPES.join(' ') }));
      }
      if (req.url === '/userinfo') return res.end(JSON.stringify(nextUser));
      if (req.url === '/revoke') {
        revoked.push(new URLSearchParams(body).get('token'));
        return res.end('{}');
      }
      res.statusCode = 404;
      res.end('{}');
    });
  });
  await new Promise((r) => google.listen(0, r));
  googleUrl = `http://localhost:${google.address().port}`;

  const probe = http.createServer();
  await new Promise((r) => probe.listen(0, r));
  const port = probe.address().port;
  await new Promise((r) => probe.close(r));
  base = `http://localhost:${port}`;
  cfg = loadConfig({
    BASE_URL: base, GOOGLE_CLIENT_ID: 'cid', GOOGLE_CLIENT_SECRET: 'sec', ALLOWED_EMAILS: 'Men@Gmail.com',
    SESSION_SECRET: 's'.repeat(40), TOKEN_ENC_KEY: KEY,
    GOOGLE_AUTH_URL: `${googleUrl}/auth`, GOOGLE_TOKEN_URL: `${googleUrl}/token`,
    GOOGLE_USERINFO_URL: `${googleUrl}/userinfo`, GOOGLE_REVOKE_URL: `${googleUrl}/revoke`,
  });
  db = openDb(':memory:');
  const { app } = createApp(cfg, db);
  server = app.listen(port);
});

after(() => { server.close(); google.close(); });

// Cookie'larni qo'lda yuritadigan kichik mijoz
function client() {
  const jar = {};
  const f = async (path, opts = {}) => {
    const res = await fetch(base + path, {
      redirect: 'manual', ...opts,
      headers: { cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...opts.headers },
    });
    for (const sc of res.headers.getSetCookie()) {
      const [kv] = sc.split(';');
      const i = kv.indexOf('=');
      const v = kv.slice(i + 1);
      if (v === '' || /Expires=Thu, 01 Jan 1970/.test(sc)) delete jar[kv.slice(0, i)];
      else jar[kv.slice(0, i)] = v;
    }
    return res;
  };
  return f;
}

async function login(f) {
  const r1 = await f('/auth/google');
  assert.equal(r1.status, 302);
  const u = new URL(r1.headers.get('location'));
  const r2 = await f(`/auth/callback?code=abc&state=${u.searchParams.get('state')}`);
  return { u, r2 };
}

test('sozlama tekshiruvi bo\'sh qiymatlarni topadi', () => {
  assert.ok(validateConfig(loadConfig({})).length >= 4);
  assert.equal(validateConfig(cfg).length, 0);
});

test('shifrlash: aylanib qaytadi, noto\'g\'ri kalit bilan ochilmaydi', () => {
  const e = encrypt('refresh', KEY);
  assert.ok(!e.includes('refresh'));
  assert.equal(decrypt(e, KEY), 'refresh');
  assert.throws(() => decrypt(e, 'b'.repeat(64)));
});

test('ruxsat etilgan email kira oladi, refresh token shifrlangan saqlanadi', async () => {
  const f = await client();
  const { u, r2 } = await login(f);
  for (const s of SCOPES) assert.ok(u.searchParams.get('scope').includes(s), s);
  assert.equal(u.searchParams.get('access_type'), 'offline');
  assert.ok(u.searchParams.get('code_challenge'));
  assert.equal(r2.status, 302);
  assert.equal(r2.headers.get('location'), '/');
  assert.ok(lastTokenBody.get('code_verifier'));
  const sc = r2.headers.getSetCookie().find((c) => c.startsWith('sid='));
  assert.match(sc, /HttpOnly/i);
  assert.match(sc, /SameSite=Lax/i);

  const me = await (await f('/api/me')).json();
  assert.equal(me.email, 'men@gmail.com');
  assert.deepEqual(me.yetishmayotganRuxsatlar, []);
  assert.equal((await f('/')).status, 200);

  const row = db.prepare('SELECT refresh_token_enc FROM users').get();
  assert.ok(row.refresh_token_enc && !row.refresh_token_enc.includes('RT-secret'));
  assert.equal(decrypt(row.refresh_token_enc, KEY), 'RT-secret');
});

test('kirmagan foydalanuvchi ilovani ko\'ra olmaydi', async () => {
  const f = await client();
  assert.equal((await f('/')).headers.get('location'), '/login.html');
  assert.equal((await f('/api/me')).status, 401);
  assert.equal((await f('/app.js')).status, 401);
});

test('ruxsat etilmagan email "Ruxsat yo\'q" ga yuboriladi va token saqlanmaydi', async () => {
  nextUser = { sub: '2', email: 'begona@gmail.com', email_verified: true, name: 'B' };
  const f = await client();
  const { r2 } = await login(f);
  assert.equal(r2.headers.get('location'), '/denied.html');
  assert.equal((await f('/api/me')).status, 401);
  assert.equal(db.prepare("SELECT COUNT(*) c FROM users WHERE email='begona@gmail.com'").get().c, 0);
  assert.ok(revoked.includes('RT-secret'));
  nextUser = { sub: '1', email: 'men@gmail.com', email_verified: true, name: 'Men' };
});

test('noto\'g\'ri state rad etiladi', async () => {
  const f = await client();
  await f('/auth/google');
  const r = await f('/auth/callback?code=abc&state=YOLG\'ON');
  assert.match(r.headers.get('location'), /xato=holat/);
});

test('chiqish va ruxsatni bekor qilish', async () => {
  const f = await client();
  await login(f);
  assert.equal((await f('/auth/logout', { method: 'POST' })).status, 403); // CSRF himoyasi
  const H = { 'x-requested-with': 'office' };
  assert.equal((await f('/auth/logout', { method: 'POST', headers: H })).status, 200);
  assert.equal((await f('/api/me')).status, 401);

  await login(f);
  revoked.length = 0;
  assert.equal((await f('/auth/revoke', { method: 'POST', headers: H })).status, 200);
  assert.ok(revoked.includes('RT-secret'));
  assert.equal(db.prepare('SELECT refresh_token_enc FROM users').get().refresh_token_enc, null);
  assert.equal((await f('/api/me')).status, 401);
});
