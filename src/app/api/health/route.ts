import { backend, storageHealth } from '@/lib/kv';

export const dynamic = 'force-dynamic';

export async function GET() {
  const t = Date.now();
  const storage = await storageHealth();
  return Response.json({ status: 'ok', storage, backend, ms: Date.now() - t }, { headers: { 'Cache-Control': 'no-store' } });
}
