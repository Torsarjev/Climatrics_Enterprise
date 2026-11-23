import 'server-only';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const SESSION_COOKIE = 'clima_session';
const SESSION_HOURS = 8;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export const ACCOUNTS = [
  { id: 'kofi', email: 'kofi.mensah@climatrics.demo' },
  { id: 'ama', email: 'ama.owusu@climatrics.demo' },
  { id: 'yaw', email: 'yaw.boateng@climatrics.demo' },
] as const;

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Climatrics#2026';

const dir = path.join(process.cwd(), '.data');
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const f = path.join(dir, 'session.key');
  if (!fs.existsSync(f)) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 }); }
  return fs.readFileSync(f, 'utf8');
}

const salt = crypto.randomBytes(16);
const hashes = new Map(ACCOUNTS.map((a) => [a.email, crypto.scryptSync(DEMO_PASSWORD, salt, 32)]));

export function checkPassword(email: string, password: string) {
  const account = ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
  const given = crypto.scryptSync(password, salt, 32);
  const ok = !!account && crypto.timingSafeEqual(given, hashes.get(account.email)!);
  return ok ? account : null;
}

const fails = new Map<string, { n: number; until?: number }>();
export function lockedFor(email: string) {
  const f = fails.get(email.toLowerCase());
  return f?.until && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 60000) : 0;
}
export function recordFail(email: string) {
  const k = email.toLowerCase(), f = fails.get(k) ?? { n: 0 };
  f.n += 1;
  if (f.n >= MAX_FAILS) { f.until = Date.now() + LOCK_MINUTES * 60000; f.n = 0; }
  fails.set(k, f);
  return MAX_FAILS - f.n;
}
export const clearFails = (email: string) => fails.delete(email.toLowerCase());

const sign = (data: string) => crypto.createHmac('sha256', secret()).update(data).digest('base64url');

export function createSession(userId: string) {
  const exp = Date.now() + SESSION_HOURS * 3600000;
  const data = `${userId}.${exp}`;
  return { token: `${data}.${sign(data)}`, maxAge: SESSION_HOURS * 3600 };
}

export function readSession(token?: string) {
  if (!token) return null;
  const [id, exp, mac] = token.split('.');
  if (!id || !exp || !mac) return null;
  const good = sign(`${id}.${exp}`);
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  if (Number(exp) < Date.now()) return null;
  return id;
}
