import 'server-only';
import fs from 'fs';
import path from 'path';
import { getStore } from '@netlify/blobs';

export const onNetlify = !!(process.env.NETLIFY_BLOBS_CONTEXT || process.env.NETLIFY);

const dir = path.join(process.cwd(), '.data');
const blobs = () => getStore({ name: 'climatrics-demo', consistency: 'strong' });

const timed = async <T,>(label: string, f: () => Promise<T>) => {
  const t = Date.now();
  try { return await f(); } finally { console.log(`[kv] ${label} ${Date.now() - t}ms`); }
};

export async function readText(key: string): Promise<string | null> {
  if (onNetlify) return timed(`get ${key}`, async () => {
    const store = blobs();
    // get() on a missing key hangs in this runtime; getMetadata() answers null straight away
    if (!(await store.getMetadata(key))) return null;
    return (await store.get(key, { type: 'text' })) ?? null;
  });
  const f = path.join(dir, key);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
}

export async function writeText(key: string, value: string) {
  if (onNetlify) return void (await timed(`set ${key}`, () => blobs().set(key, value)));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, key), value);
}
