import { getStore } from '@netlify/blobs';
import { onNetlify } from '@/lib/kv';

export const dynamic = 'force-dynamic';

export async function GET() {
  const t = Date.now();
  let storage = 'local';
  if (onNetlify) {
    try { await getStore({ name: 'climatrics-demo-v2', consistency: 'strong' }).getMetadata('store.json'); storage = 'ok'; }
    catch { storage = 'error'; }
  }
  return Response.json({ status: 'ok', storage, ms: Date.now() - t }, { headers: { 'Cache-Control': 'no-store' } });
}
