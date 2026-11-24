import { getScreenRun, sessionUser } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const found = await getScreenRun((await params).id);
  return found ? Response.json(found) : Response.json({ error: 'Not found' }, { status: 404 });
}
