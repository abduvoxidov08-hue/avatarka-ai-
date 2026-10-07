import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createAuth } from './auth.js';

const here = dirname(fileURLToPath(import.meta.url));

export function createApp(cfg, db) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' https://*.googleusercontent.com data:; style-src 'self' 'unsafe-inline'; script-src 'self'",
    });
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  const auth = createAuth(cfg, db);
  app.use(auth.router);

  // Ochiq sahifalar (kirishdan oldin)
  app.use(express.static(join(here, '..', 'public')));

  // Asosiy ilova faqat kirgan foydalanuvchiga
  app.get('/', (req, res) => {
    if (!auth.currentUser(req)) return res.redirect('/login.html');
    res.sendFile(join(here, '..', 'private', 'app.html'));
  });
  app.get('/app.js', (req, res) => {
    if (!auth.currentUser(req)) return res.status(401).end();
    res.sendFile(join(here, '..', 'private', 'app.js'));
  });

  return { app, auth };
}
