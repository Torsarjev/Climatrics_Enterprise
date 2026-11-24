import 'server-only';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { onNetlify } from './kv';

export const SESSION_COOKIE = 'clima_session';
const SESSION_HOURS = 8;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export const ACCOUNTS = [
  { id: 'kofi', email: 'kofi.mensah@climatrics.demo' },
  { id: 'ama', email: 'ama.owusu@climatrics.demo' },
  { id: 'yaw', email: 'yaw.boateng@climatrics.demo' },
] as const;

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD_KEY ?? '';
export const authConfigured = DEMO_PASSWORD.length >= 8;

const dir = path.join(process.cwd(), '.data');
function secret() {
  if (process.env.SESSION_SECRET_KEY) return process.env.SESSION_SECRET_KEY;
  if (onNetlify) throw new Error('SESSION_SECRET_KEY is not set');
  const f = path.join(dir, 'session.key');
  if (!fs.existsSync(f)) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 }); }
  return fs.readFileSync(f, 'utf8');
}

const salt = crypto.randomBytes(16);
const hashes = new Map(ACCOUNTS.map((a) => [a.email, crypto.scryptSync(DEMO_PASSWORD, salt, 32)]));

export function checkPassword(email: string, password: string) {
  const account = ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
  const given = crypto.scryptSync(password, salt, 32);
  const ok = authConfigured && !!account && crypto.timingSafeEqual(given, hashes.get(account.email)!);
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
  fails.set(k, f);
  if (f.n < MAX_FAILS) return MAX_FAILS - f.n;
  f.until = Date.now() + LOCK_MINUTES * 60000; f.n = 0;
  return 0;
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

export const MFA_COOKIE = 'clima_mfa';
export const mfaRequired = process.env.MFA_MODE !== 'off';
const MFA_MINUTES = 5;
const ISSUER = 'ClimaTRICs';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buf: Buffer) {
  let bits = '', out = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

// Derived from the session secret so every server instance agrees without storing secrets.
const totpKey = (userId: string) => crypto.createHmac('sha256', secret()).update(`totp:${userId}`).digest().subarray(0, 20);
export const totpSecret = (userId: string) => base32(totpKey(userId));
export const otpauthUri = (userId: string, email: string) =>
  `otpauth://totp/${encodeURIComponent(`${ISSUER}:${email}`)}?secret=${totpSecret(userId)}&issuer=${ISSUER}&algorithm=SHA1&digits=6&period=30`;

function hotp(key: Buffer, counter: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', key).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}

const lastStep = new Map<string, number>();
export function verifyTotp(userId: string, code: string) {
  const c = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  const key = totpKey(userId), now = Math.floor(Date.now() / 30000);
  for (const step of [now, now - 1, now + 1]) {
    const good = hotp(key, step);
    if (crypto.timingSafeEqual(Buffer.from(c), Buffer.from(good))) {
      if (step <= (lastStep.get(userId) ?? -1)) return false;
      lastStep.set(userId, step);
      return true;
    }
  }
  return false;
}

export function createMfaPending(userId: string) {
  const data = `mfa:${userId}.${Date.now() + MFA_MINUTES * 60000}`;
  return { token: `${data}.${sign(data)}`, maxAge: MFA_MINUTES * 60 };
}
export function readMfaPending(token?: string) {
  if (!token) return null;
  const [pre, exp, mac] = token.split('.');
  if (!pre?.startsWith('mfa:') || !exp || !mac) return null;
  const good = sign(`${pre}.${exp}`);
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  if (Number(exp) < Date.now()) return null;
  return pre.slice(4);
}
