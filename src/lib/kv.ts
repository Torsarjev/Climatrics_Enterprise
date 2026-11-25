import 'server-only';
import fs from 'fs';
import path from 'path';
import { getStore } from '@netlify/blobs';

export const onNetlify = !!(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY);

// Netlify Blobs stays the default; DATA_BACKEND=supabase switches storage without changing the data.
export const backend: 'supabase' | 'blobs' | 'file' = process.env.DATA_BACKEND === 'supabase' ? 'supabase' : onNetlify ? 'blobs' : 'file';
export const remoteStore = backend !== 'file';

const dir = path.join(process.cwd(), '.data');
const blobs = () => getStore({ name: 'climatrics-demo-v2', consistency: 'strong' });

const timed = async <T,>(label: string, f: () => Promise<T>) => {
  const t = Date.now();
  try { return await f(); } finally { console.log(`[kv:${backend}] ${label} ${Date.now() - t}ms`); }
};

function supabase() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('DATA_BACKEND=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const call = async (p: string, init?: RequestInit) => {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/${p}`, {
      ...init, cache: 'no-store',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init?.headers },
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.json();
  };
  return {
    get: async (k: string) => ((await call(`app_kv?key=eq.${encodeURIComponent(k)}&select=value,version`)) as { value: string; version: number }[])[0] ?? null,
    put: (k: string, v: string) => call('rpc/kv_put', { method: 'POST', body: JSON.stringify({ p_key: k, p_value: v }) }),
    cas: async (k: string, v: string, version: number) => (await call('rpc/kv_cas', { method: 'POST', body: JSON.stringify({ p_key: k, p_value: v, p_version: version }) })) === true,
  };
}

export async function readText(key: string): Promise<string | null> {
  if (backend === 'supabase') return timed(`get ${key}`, async () => (await supabase().get(key))?.value ?? null);
  if (backend === 'blobs') return timed(`get ${key}`, async () => {
    const store = blobs();
    // get() on a missing key hangs in this runtime; getMetadata() answers null straight away
    if (!(await store.getMetadata(key))) return null;
    return (await store.get(key, { type: 'text' })) ?? null;
  });
  const f = path.join(dir, key);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
}

export async function writeText(key: string, value: string) {
  if (backend === 'supabase') return void (await timed(`set ${key}`, () => supabase().put(key, value)));
  if (backend === 'blobs') return void (await timed(`set ${key}`, () => blobs().set(key, value)));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, key), value);
}

export async function updateExistingBlob(key: string, update: (text: string) => string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (backend === 'supabase') {
      const db = supabase(), row = await db.get(key);
      if (!row) throw new Error('Cannot identify the current scenario register');
      if (await db.cas(key, update(row.value), row.version)) return;
      continue;
    }
    const store = blobs();
    const entry = await store.getWithMetadata(key);
    if (!entry?.etag) throw new Error('Cannot identify the current scenario register');
    const result = await store.set(key, update(entry.data), { onlyIfMatch: entry.etag });
    if (result.modified) return;
  }
  throw new Error('The scenario register changed during this assessment. Run it again.');
}

export async function storageHealth(): Promise<'ok' | 'error' | 'local'> {
  try {
    if (backend === 'supabase') { await supabase().get('store.json'); return 'ok'; }
    if (backend === 'blobs') { await blobs().getMetadata('store.json'); return 'ok'; }
    return 'local';
  } catch { return 'error'; }
}
