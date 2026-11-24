import { sessionUser } from '@/lib/store';
import { currentPortfolioScreening, getPortfolioScreening } from '@/lib/esg/portfolio';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const id = new URL(req.url).searchParams.get('run_id');
  if (!id) return Response.json(await currentPortfolioScreening());
  const snapshot = await getPortfolioScreening(id);
  return snapshot ? Response.json(snapshot) : Response.json({ error: 'Portfolio screening not found' }, { status: 404 });
}
