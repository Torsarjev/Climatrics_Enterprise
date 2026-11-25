// Copies every document from Netlify Blobs (or a local .data folder) into Supabase app_kv.
// Dry run by default; pass --apply to write. Re-running is safe: existing keys are overwritten.
//
//   NETLIFY_SITE_ID=... NETLIFY_AUTH_TOKEN=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/copy-to-supabase.mjs [--apply] [--from-dir=.data]
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getStore } from '@netlify/blobs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const need = (k) => process.env[k] || (console.error(`Missing ${k}`), process.exit(1));
const url = need('SUPABASE_URL').replace(/\/$/, ''), key = need('SUPABASE_SERVICE_ROLE_KEY');
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

async function source() {
  if (args['from-dir']) {
    const dir = path.resolve(args['from-dir']);
    return fs.readdirSync(dir).filter((f) => !f.endsWith('.key')).map((k) => ({ key: k, read: async () => fs.readFileSync(path.join(dir, k), 'utf8') }));
  }
  const store = getStore({ name: 'climatrics-demo-v2', siteID: need('NETLIFY_SITE_ID'), token: need('NETLIFY_AUTH_TOKEN'), consistency: 'strong' });
  const { blobs } = await store.list();
  return blobs.map((b) => ({ key: b.key, read: async () => store.get(b.key, { type: 'text' }) }));
}

async function rest(p, init) {
  const res = await fetch(`${url}/rest/v1/${p}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

const items = await source();
console.log(`${items.length} documents found${args.apply ? '' : ' (dry run: nothing will be written; add --apply)'}`);
let bytes = 0;
for (const it of items) {
  const text = await it.read();
  bytes += text.length;
  if (args.apply) {
    await rest('rpc/kv_put', { method: 'POST', body: JSON.stringify({ p_key: it.key, p_value: text }) });
    const [back] = await rest(`app_kv?key=eq.${encodeURIComponent(it.key)}&select=value`);
    if (back?.value !== text) throw new Error(`Verification failed for ${it.key}`);
  }
  console.log(`${args.apply ? 'copied+verified' : 'would copy'}  ${it.key}  ${text.length} bytes  sha ${sha(text)}`);
}
console.log(`${(bytes / 1024).toFixed(1)} KB total`);
