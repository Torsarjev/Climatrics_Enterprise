import { db, sessionUser } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const d = await db();
  return Response.json(d.runs.map(({ id, createdAt, by, input, datasetId, datasetHash, modelVersion, hazardVersion, paramsHash, outputHash, seed, status, reviewedBy, headline }) =>
    ({ id, createdAt, by, scenario: input.scenario, horizon: input.horizon, datasetId, datasetHash, modelVersion, hazardVersion, paramsHash, outputHash, seed, status, reviewedBy, headline })));
}
