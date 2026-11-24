import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const envFile = new URL('../.env.local', import.meta.url);
const env = [
  'DEMO_PASSWORD_KEY=' + randomBytes(18).toString('base64url'),
  'SESSION_SECRET_KEY=' + randomBytes(32).toString('hex'),
  'MFA_MODE=off',
  '',
].join('\n');

try {
  writeFileSync(envFile, env, { flag: 'wx', mode: 0o600 });
  console.log('Created .env.local with a shared demo password and password-only sign-in for private rehearsal.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('Using the existing .env.local.');
}
