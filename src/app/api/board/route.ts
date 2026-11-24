import { activeLoans, screenRuns, sessionUser } from '@/lib/store';
import { boardView } from '@/lib/board';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const { dataset, loans } = await activeLoans();
  return Response.json(await boardView(loans, await screenRuns(), dataset.id));
}
