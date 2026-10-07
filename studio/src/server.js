import { loadConfig, validateConfig } from './config.js';
import { openDb } from './db.js';
import { createApp } from './app.js';

let envFound = true;
try {
  process.loadEnvFile('.env');
} catch {
  envFound = false;
}

const cfg = loadConfig();
const errs = validateConfig(cfg);
if (errs.length) {
  if (!envFound) console.error('\n.env fayli topilmadi. Avval:  cp .env.example .env  va uni to\'ldiring.');
  console.error('\nSozlamalarda muammo bor:\n - ' + errs.join('\n - ') + '\n');
  process.exit(1);
}

const db = openDb(cfg.dbPath);
const { app } = createApp(cfg, db);
app.listen(cfg.port, () => {
  console.log(`Virtual ofis ishga tushdi: ${cfg.baseUrl}`);
  console.log(`Google redirect URI: ${cfg.baseUrl}/auth/callback`);
});
