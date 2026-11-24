import { activeLoans, screenRuns, sessionUser } from '@/lib/store';
import { portfolioScreening } from '@/lib/esg/portfolio';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const { dataset, loans } = await activeLoans();
  return Response.json(await portfolioScreening(loans, await screenRuns(), dataset.id));
}
