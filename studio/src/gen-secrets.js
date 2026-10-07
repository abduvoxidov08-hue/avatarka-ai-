// Ikki tasodifiy maxfiy kalit yaratadi. Natijani .env ga ko'chiring.
import { randomBytes } from 'node:crypto';

console.log('SESSION_SECRET=' + randomBytes(32).toString('hex'));
console.log('TOKEN_ENC_KEY=' + randomBytes(32).toString('hex'));
