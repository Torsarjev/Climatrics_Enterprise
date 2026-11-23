import { sessionUser } from '@/lib/store';
import { demoExtract } from '@/lib/portfolio';

export async function GET() {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  return new Response(demoExtract(), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="demo-bank-ghana-loan-book-2026-09-30.csv"' } });
}
