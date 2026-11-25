import Link from 'next/link';
import type { RunRecord } from '@/lib/store';
import { when } from '@/lib/fmt';

const STATE: Record<RunRecord['status'], string> = { draft: 'a draft that has not been submitted', submitted: 'submitted and awaiting an independent approver', approved: 'approved', rejected: 'rejected by the approver' };

export function RunApproval({ rec, figures }: { rec: RunRecord; figures: string }) {
  if (rec.status === 'approved') return (
    <p className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800" data-approval="approved">
      ✓ Approved · {rec.id} approved by {rec.reviewedBy}{rec.reviewedAt ? ` on ${when(rec.reviewedAt)}` : ''} (maker-checker: prepared by {rec.submittedBy ?? rec.by}). These {figures} figures may be used for reporting.
    </p>
  );
  return (
    <p className="mb-6 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700" data-approval="draft">
      DRAFT · {rec.id} is {STATE[rec.status]}. These {figures} figures are not approved and not for submission.{' '}
      <Link href={`/runs/${rec.id}`} className="underline">{rec.status === 'rejected' ? 'Open the run' : 'Open the run to submit or approve it'}</Link>.
    </p>
  );
}
