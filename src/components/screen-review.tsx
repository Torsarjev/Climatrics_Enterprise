'use client';

import { useActionState } from 'react';
import { evidenceAction, screenReviewAction } from '@/app/actions';
import { btnClass, btnGhost } from './ui';

function ReviewButton({ id, action, label, primary, withNote, evidence = [] }: { id: string; action: string; label: string; primary?: boolean; withNote?: boolean; evidence?: { id: string; label: string; ref?: string }[] }) {
  const [state, act, pending] = useActionState(screenReviewAction, null);
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      {evidence.length > 0 && <fieldset className="w-full space-y-1 rounded-md border border-zinc-200 p-3 text-sm">
        <legend className="px-1 font-medium">Select the evidence you verified</legend>
        {evidence.map((item) => <label key={item.id} className="flex items-start gap-2"><input className="mt-1" type="checkbox" name="verifiedEvidence" value={item.id} /><span>{item.label} · {item.ref}</span></label>)}
      </fieldset>}
      {withNote && <input name="note" placeholder="Reviewer note" className="rounded-md px-2 py-1.5 text-sm ring-1 ring-zinc-300" />}
      <button className={primary ? btnClass : btnGhost} disabled={pending} data-action={`screen-${action}`}>{label}</button>
      {state && 'error' in state && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}

export function ScreenReview({ id, status, canRun, canApprove, isMaker, provided }: { id: string; status: string; canRun: boolean; canApprove: boolean; isMaker: boolean; provided: { id: string; label: string; ref?: string }[] }) {
  const note = (t: string) => <p className="text-sm text-zinc-600">{t}</p>;
  if (status === 'approved') return note('Screening assessment approved. Review the decision guidance and verified evidence before progressing.');
  if (status === 'escalated') return note('Escalated for enhanced due diligence by the reviewer.');
  if (status === 'draft' || status === 'returned') return canRun ? <ReviewButton id={id} action="submit" label="Submit for review" primary /> : note('Draft: waiting for the analyst to submit it.');
  if (!canApprove) return note('Submitted: waiting for a reviewer (maker-checker).');
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ReviewButton id={id} action="approve" label="Approve screening assessment" evidence={provided} primary withNote />
        <ReviewButton id={id} action="escalate" label="Escalate (enhanced due diligence)" />
        <ReviewButton id={id} action="return" label="Return to analyst" />
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
      <input required name="ref" placeholder="document reference" className="w-40 rounded-md px-2 py-1 text-xs ring-1 ring-zinc-300" />
      <button className={btnGhost} disabled={pending} data-action={`attach-${evidence}`}>{pending ? 'Re-screening…' : 'Attach and re-screen'}</button>
      {state && 'error' in state && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
