import { Router } from 'express';
import { createHash } from 'node:crypto';
import { SCOPES } from './config.js';
import { decrypt, encrypt, randomToken, sha256, sign, verify } from './crypto.js';

const SESSION_COOKIE = 'sid';
const TX_COOKIE = 'oauth_tx';
const SESSION_DAYS = 14;

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createAuth(cfg, db) {
  const router = Router();
  const cookieOpts = (maxAgeMs) => ({
    httpOnly: true,
    secure: cfg.secureCookies,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  });

  // ---- Sessiya ----
  function createSession(res, userId) {
    const id = randomToken();
    const expires = Date.now() + SESSION_DAYS * 864e5;
    db.prepare('INSERT INTO sessions (id_hash, user_id, expires_at) VALUES (?,?,?)').run(sha256(id), userId, expires);
    res.cookie(SESSION_COOKIE, id, cookieOpts(SESSION_DAYS * 864e5));
  }

  function currentUser(req) {
    const id = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (!id) return null;
    const row = db
      .prepare(
        `SELECT u.id, u.email, u.name, u.picture, u.scopes, s.expires_at
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id_hash = ?`,
      )
      .get(sha256(id));
    if (!row) return null;
    if (row.expires_at < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(id));
      return null;
    }
    return row;
  }

  function destroySession(req, res) {
    const id = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (id) db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(id));
    res.clearCookie(SESSION_COOKIE, cookieOpts());
  }

  const requireUser = (req, res, next) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ xato: 'Kirish kerak' });
    req.user = user;
    next();
  };

  // Brauzer formasi/boshqa sayt orqali soxta so'rov (CSRF) yuborilmasligi uchun
  const requireSameOrigin = (req, res, next) => {
    const origin = req.headers.origin;
    if (req.headers['x-requested-with'] !== 'office' || (origin && origin !== cfg.baseUrl))
      return res.status(403).json({ xato: 'Ruxsat yo\'q' });
    next();
  };

  // ---- Google OAuth ----
  router.get('/auth/google', (req, res) => {
    const state = randomToken(16);
    const verifier = randomToken(48);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    res.cookie(
      TX_COOKIE,
      sign({ state, verifier, exp: Date.now() + 10 * 60e3 }, cfg.sessionSecret),
      cookieOpts(10 * 60e3),
    );
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: `${cfg.baseUrl}/auth/callback`,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline', // refresh token olish uchun
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
    res.redirect(`${cfg.google.authUrl}?${params}`);
  });

  router.get('/auth/callback', async (req, res) => {
    const tx = verify(parseCookies(req.headers.cookie)[TX_COOKIE], cfg.sessionSecret);
    res.clearCookie(TX_COOKIE, cookieOpts());
    if (req.query.error) return res.redirect('/login.html?xato=bekor');
    if (!tx || tx.exp < Date.now() || tx.state !== req.query.state || !req.query.code)
      return res.redirect('/login.html?xato=holat');

    try {
      const tokenRes = await fetch(cfg.google.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(req.query.code),
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: `${cfg.baseUrl}/auth/callback`,
          grant_type: 'authorization_code',
          code_verifier: tx.verifier,
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.access_token) throw new Error('token: ' + (tokens.error || tokenRes.status));

      const infoRes = await fetch(cfg.google.userinfoUrl, {
        headers: { authorization: `Bearer ${tokens.access_token}` },
      });
      const info = await infoRes.json();
      if (!infoRes.ok || !info.sub || !info.email) throw new Error('userinfo xatosi');

      const email = String(info.email).toLowerCase();
      if (!info.email_verified || !cfg.allowedEmails.includes(email)) {
        // Ruxsat yo'q: hech narsa saqlamaymiz, Google'dagi ruxsatni ham bekor qilamiz
        await revokeAtGoogle(tokens.refresh_token || tokens.access_token);
        return res.redirect('/denied.html');
      }

      const existing = db.prepare('SELECT refresh_token_enc FROM users WHERE google_sub = ?').get(info.sub);
      const refreshEnc = tokens.refresh_token
        ? encrypt(tokens.refresh_token, cfg.tokenEncKey)
        : existing?.refresh_token_enc ?? null;
      db.prepare(
        `INSERT INTO users (google_sub, email, name, picture, refresh_token_enc, scopes, last_login_at)
         VALUES (?,?,?,?,?,?, datetime('now'))
         ON CONFLICT(google_sub) DO UPDATE SET email=excluded.email, name=excluded.name,
           picture=excluded.picture, refresh_token_enc=excluded.refresh_token_enc,
           scopes=excluded.scopes, last_login_at=datetime('now')`,
      ).run(info.sub, email, info.name ?? null, info.picture ?? null, refreshEnc, tokens.scope ?? '');
      const user = db.prepare('SELECT id FROM users WHERE google_sub = ?').get(info.sub);
      createSession(res, user.id);
      res.redirect('/');
    } catch (e) {
      console.error('[auth] kirish xatosi:', e.message);
      res.redirect('/login.html?xato=server');
    }
  });

  async function revokeAtGoogle(token) {
    try {
      await fetch(cfg.google.revokeUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      });
    } catch (e) {
      console.error('[auth] revoke xatosi:', e.message);
    }
  }

  router.get('/api/me', requireUser, (req, res) => {
    const granted = new Set((req.user.scopes || '').split(' '));
    const missing = SCOPES.filter((s) => s.startsWith('https://') && !granted.has(s));
    res.json({
      email: req.user.email,
      name: req.user.name,
      picture: req.user.picture,
      yetishmayotganRuxsatlar: missing,
    });
  });

  router.post('/auth/logout', requireSameOrigin, (req, res) => {
    destroySession(req, res);
    res.json({ ok: true });
  });

  // Google'dagi ruxsatlarni bekor qiladi va serverdagi tokenni o'chiradi
  router.post('/auth/revoke', requireSameOrigin, requireUser, async (req, res) => {
    const row = db.prepare('SELECT refresh_token_enc FROM users WHERE id = ?').get(req.user.id);
    if (row?.refresh_token_enc) await revokeAtGoogle(decrypt(row.refresh_token_enc, cfg.tokenEncKey));
    db.prepare('UPDATE users SET refresh_token_enc = NULL, scopes = NULL WHERE id = ?').run(req.user.id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
    res.clearCookie(SESSION_COOKIE, cookieOpts());
    res.json({ ok: true });
  });

  // Keyingi bosqichlar uchun: agentlar YouTube API'ga murojaat qilishda shuni chaqiradi.
  async function getAccessToken(userId) {
    const row = db.prepare('SELECT refresh_token_enc FROM users WHERE id = ?').get(userId);
    if (!row?.refresh_token_enc) throw new Error('Google ruxsati yo\'q. Qayta kiring.');
    const r = await fetch(cfg.google.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: decrypt(row.refresh_token_enc, cfg.tokenEncKey),
        grant_type: 'refresh_token',
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error('Token yangilanmadi: ' + (j.error || r.status));
    return j.access_token;
  }

  return { router, currentUser, requireUser, getAccessToken };
}
