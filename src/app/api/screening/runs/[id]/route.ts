import { getPortfolioScreening } from '@/lib/esg/portfolio';
import { getScreenRun, sessionUser } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const { id } = await params;
  const found = id.startsWith('PS-') ? await getPortfolioScreening(id) : await getScreenRun(id);
  return found ? Response.json(found) : Response.json({ error: 'Not found' }, { status: 404 });
}
