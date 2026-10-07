
const GOOGLE = {
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userinfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
  revokeUrl: 'https://oauth2.googleapis.com/revoke',
};

export const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
  'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
  'https://www.googleapis.com/auth/youtube.upload',
];

export function loadConfig(env = process.env) {
  const baseUrl = (env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
  return {
    port: Number(env.PORT || 3000),
    baseUrl,
    secureCookies: baseUrl.startsWith('https://'),
    clientId: env.GOOGLE_CLIENT_ID || '',
    clientSecret: env.GOOGLE_CLIENT_SECRET || '',
    allowedEmails: (env.ALLOWED_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
    sessionSecret: env.SESSION_SECRET || '',
    tokenEncKey: env.TOKEN_ENC_KEY || '',
    geminiApiKey: env.GEMINI_API_KEY || '',
    dbPath: env.DB_PATH || './data/office.db',
    google: {
      authUrl: env.GOOGLE_AUTH_URL || GOOGLE.authUrl,
      tokenUrl: env.GOOGLE_TOKEN_URL || GOOGLE.tokenUrl,
      userinfoUrl: env.GOOGLE_USERINFO_URL || GOOGLE.userinfoUrl,
      revokeUrl: env.GOOGLE_REVOKE_URL || GOOGLE.revokeUrl,
    },
  };
}

// Server ishga tushishidan oldin kerakli sozlamalar borligini tekshiradi.
// O'zbekcha, tushunarli xabarlar qaytaradi.
export function validateConfig(cfg) {
  const errs = [];
  if (!cfg.clientId || !cfg.clientSecret)
    errs.push('GOOGLE_CLIENT_ID va GOOGLE_CLIENT_SECRET .env da yo\'q (docs/GOOGLE_SOZLASH.md ga qarang).');
  if (cfg.allowedEmails.length === 0)
    errs.push('ALLOWED_EMAILS bo\'sh. O\'z Gmail manzilingizni yozing.');
  if (cfg.sessionSecret.length < 32)
    errs.push('SESSION_SECRET yo\'q yoki qisqa. `npm run kalit` ni ishga tushiring.');
  if (!/^[0-9a-f]{64}$/i.test(cfg.tokenEncKey))
    errs.push('TOKEN_ENC_KEY 64 ta hex belgi bo\'lishi kerak. `npm run kalit` ni ishga tushiring.');
  return errs;
}

