import { DEMO_TREASURY } from '@/lib/ilaap';
import { db, sessionUser } from '@/lib/store';

export async function GET(request: Request) {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const params = new URL(request.url).searchParams;
  const download = (body: string, filename: string, contentType: string) => new Response(body, { headers: {
    'Content-Type': contentType, 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="${filename}"`,
  } });
  if (params.get('template') === '1') return download(JSON.stringify(DEMO_TREASURY, null, 2), 'ilaap-treasury-template.json', 'application/json');
  const data = await db();
  const item = data.ilaap?.find(({ id }) => id === params.get('id'));
  if (!item) return new Response('ILAAP assessment unavailable', { status: 404 });
  if (params.get('format') === 'csv') {
    const header = 'assessment,review_status,illustrative,scenario,year,horizon,path,day,opening_hqla,inflow,outflow,gap,buffer,headroom,proxy_lcr_pct';
    const rows = item.rows.flatMap((row) => (['baseline', 'stressed', 'mitigated'] as const).flatMap((key) =>
      row[key].rows.map((bucket) => [item.id, item.status, item.illustrative, row.macro.scenario, row.macro.year, row.macro.horizon, key,
        bucket.day, row[key].opening, bucket.inflow, bucket.outflow, bucket.gap, bucket.buffer, bucket.headroom,
        key === 'mitigated' || row[key].lcr === null ? '' : row[key].lcr * 100].join(','))));
    return download([header, ...rows].join('\r\n'), `${item.id}.csv`, 'text/csv');
  }
  return download(JSON.stringify({ assessment: item, audit: data.audit.filter(({ target }) => target === item.id) }, null, 2), `${item.id}.json`, 'application/json');
}
