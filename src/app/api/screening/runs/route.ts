import { createScreenRun, screenRuns, sessionUser } from '@/lib/store';
import type { ScreenInput } from '@/lib/esg/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const runs = await screenRuns();
  return Response.json(runs.map(({ id, createdAt, by, facilityId, borrower, status, parent, rulesHash }) => ({ id, createdAt, by, facilityId, borrower, status, parent, rulesHash })));
}

export async function POST(req: Request) {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  try {
    const id = await createScreenRun((await req.json()) as ScreenInput);
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
