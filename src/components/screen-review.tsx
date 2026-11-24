'use client';

import { useActionState } from 'react';
import { evidenceAction, screenReviewAction } from '@/app/actions';
import { btnClass, btnGhost } from './ui';

function ReviewButton({ id, action, label, primary, withNote }: { id: string; action: string; label: string; primary?: boolean; withNote?: boolean }) {
  const [state, act, pending] = useActionState(screenReviewAction, null);
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      {withNote && <input name="note" placeholder={action === "approve" ? "Approval note" : action === "return" ? "What should the analyst fix?" : "Reason for escalation"} className="rounded-md px-2 py-1.5 text-sm ring-1 ring-zinc-300" />}
      <button className={primary ? btnClass : btnGhost} disabled={pending} data-action={`screen-${action}`}>{label}</button>
      {state && 'error' in state && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}

export function ScreenReview({ id, status, canRun, canApprove, isMaker, hasProvided, reviewedBy, note: reviewNote }: { id: string; status: string; canRun: boolean; canApprove: boolean; isMaker: boolean; hasProvided: boolean; reviewedBy?: string; note?: string }) {
  const note = (t: string) => <p className="text-sm text-zinc-600">{t}</p>;
  if (status === 'approved') return note('✓ Approved. Provided evidence was verified by the reviewer; aligned exposure from this run now counts in the portfolio.');
  if (status === 'escalated') return note('Escalated for enhanced due diligence by the reviewer.');
  if (status === 'returned') {
    const why = `Returned to the analyst by ${reviewedBy ?? 'the reviewer'}${reviewNote ? `: “${reviewNote}”` : ''}.`;
    return canRun
      ? <div className="space-y-2"><p className="text-sm text-amber-800">{why} Fix what is needed (or attach evidence, which creates a new run), then resubmit.</p><ReviewButton id={id} action="submit" label="Resubmit for review" primary /></div>
      : <p className="text-sm text-amber-800">{why} Waiting for the analyst to resubmit.</p>;
  }
  if (status === 'draft') return canRun ? <ReviewButton id={id} action="submit" label="Submit for review" primary /> : note('Draft: waiting for the analyst to submit it.');
  if (!canApprove) return note('Submitted: waiting for a reviewer (maker-checker).');
  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <ReviewButton id={id} action="approve" label={hasProvided ? 'Verify evidence and approve' : 'Approve'} primary withNote />
        <ReviewButton id={id} action="escalate" label="Escalate (enhanced due diligence)" withNote />
        <ReviewButton id={id} action="return" label="Return to analyst" withNote />
      </div>
      {isMaker && <p className="text-xs text-amber-700">You created or submitted this screening, so the review will be refused.</p>}
    </div>
  );
}

export function AttachEvidence({ id, evidence }: { id: string; evidence: string }) {
  const [state, act, pending] = useActionState(evidenceAction, null);
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="evidence" value={evidence} />
      <input name="ref" placeholder="document reference" className="w-40 rounded-md px-2 py-1 text-xs ring-1 ring-zinc-300" />
      <button className={btnGhost} disabled={pending} data-action={`attach-${evidence}`}>{pending ? 'Re-screening…' : 'Attach and re-screen'}</button>
      {state && 'error' in state && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
