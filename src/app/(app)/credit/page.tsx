import { redirect } from 'next/navigation';
import { db } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function CreditPage() {
  const d = await db();
  const run = d.runs.find((r) => r.status === 'approved') ?? d.runs[0];
  redirect(run ? `/runs/${run.id}` : '/stress');
}
