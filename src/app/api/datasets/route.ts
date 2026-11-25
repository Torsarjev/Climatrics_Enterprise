import { revalidatePath } from 'next/cache';
import { db, ingest, sessionUser } from '@/lib/store';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5_000_000;
const summary = ({ id, name, hash, uploadedAt, by, control, rejected, warnings }: Awaited<ReturnType<typeof db>>['datasets'][number]) =>
  ({ id, name, sha256: hash, uploadedAt, by, control, rejected, warnings });

export async function GET() {
  if (!(await sessionUser())) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  const d = await db();
  return Response.json({ active: d.activeDataset, datasets: d.datasets.map(summary) });
}

export async function POST(req: Request) {
  const user = await sessionUser();
  if (!user) return Response.json({ error: 'Unauthorised' }, { status: 401 });
  if (!user.can.includes('ingest' as never)) return Response.json({ error: 'Your role cannot load data' }, { status: 403 });
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('text/csv')) return Response.json({ error: 'Send the extract as Content-Type: text/csv' }, { status: 415 });
  const csv = await req.text();
  if (!csv.trim()) return Response.json({ error: 'Empty extract' }, { status: 400 });
  if (csv.length > MAX_BYTES) return Response.json({ error: 'Extract larger than 5 MB' }, { status: 413 });
  const source = (req.headers.get('x-source-system') ?? 'API client').replace(/[^\w .\-/·()]/g, '').slice(0, 80) || 'API client';
  try {
    const id = await ingest(`${source} · API load`, csv);
    revalidatePath('/', 'layout');
    const d = await db();
    return Response.json(summary(d.datasets.find((x) => x.id === id)!), { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 422 });
  }
}
