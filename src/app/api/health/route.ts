import { getStore } from '@netlify/blobs';
import { onNetlify } from '@/lib/kv';
import { activeLoans, db } from '@/lib/store';
import { dashboard } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

const within = <T,>(ms: number, p: Promise<T>) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms}ms`)), ms))]);

async function probe(consistency: 'strong' | 'eventual') {
  const t = Date.now();
  try {
    const s = getStore({ name: 'climatrics-health', consistency });
    await within(4000, s.set('ping', String(t)));
    const v = await within(4000, s.get('ping', { type: 'text' }));
    return { ok: v === String(t), ms: Date.now() - t };
  } catch (e) {
    return { ok: false, ms: Date.now() - t, error: (e as Error).message.slice(0, 200) };
  }
}

async function step<T,>(name: string, f: () => Promise<T>, out: Record<string, unknown>) {
  const t = Date.now();
  try { const v = await within(20000, f()); out[name] = { ms: Date.now() - t }; return v; }
  catch (e) { out[name] = { ms: Date.now() - t, error: (e as Error).message.slice(0, 200) }; return null; }
}

export async function GET(req: Request) {
  if (new URL(req.url).searchParams.has('deep')) {
    const out: Record<string, unknown> = {};
    await step('db', () => db(), out);
    const a = await step('activeLoans', () => activeLoans(), out);
    if (a) await step('dashboard', async () => dashboard(a.dataset.id, a.loans), out);
    return Response.json(out, { headers: { 'Cache-Control': 'no-store' } });
  }
  const env = { NETLIFY: !!process.env.NETLIFY, NETLIFY_BLOBS_CONTEXT: !!process.env.NETLIFY_BLOBS_CONTEXT, SITE_ID: !!process.env.SITE_ID, SESSION_SECRET_KEY: !!process.env.SESSION_SECRET_KEY, DEMO_PASSWORD_KEY: !!process.env.DEMO_PASSWORD_KEY };
  const body = { onNetlify, env, strong: await probe('strong'), eventual: await probe('eventual') };
  return Response.json(body, { headers: { 'Cache-Control': 'no-store' } });
}
