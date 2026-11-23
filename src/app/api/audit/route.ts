import { db, sessionUser } from '@/lib/store';

export async function GET() {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const d = await db();
  const esc = (v = '') => `"${v.replace(/"/g, '""')}"`;
  const csv = ['at,by,action,target,detail', ...d.audit.map((a) => [a.at, a.by, a.action, a.target, a.detail].map(esc).join(','))].join('\n');
  return new Response(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="audit-trail.csv"' } });
}
