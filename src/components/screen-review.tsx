'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { evidenceAction, screenReviewAction } from '@/app/actions';
import { btnClass, btnGhost } from './ui';

type EvidenceItem = { id: string; label: string; ref?: string };

export function ScreenReview({ id, status, canRun, canApprove, isMaker, provided, approvalBlock, rulesWarning }: {
  id: string; status: string; canRun: boolean; canApprove: boolean; isMaker: boolean; provided: EvidenceItem[]; approvalBlock?: string; rulesWarning?: string;
}) {
  const [state, act, pending] = useActionState(screenReviewAction, null);
  const message = (text: string) => <p className="text-sm text-zinc-600">{text}</p>;
  if (status === 'approved') return message('Screening assessment approved. Any ESMS conditions still apply to the credit process.');
  if (status === 'escalated') return message('The reviewer escalated this assessment for enhanced due diligence.');
  if (status === 'draft' || status === 'returned') {
    return <div className="space-y-3">
      {message(status === 'returned' ? 'Returned to the analyst. Review the note below and address the requested changes before resubmitting.' : 'Draft awaiting analyst submission.')}
      {canRun && <form action={act}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="action" value="submit" />
        <button className={btnClass} disabled={pending} data-action="screen-submit">{pending ? 'Submitting…' : status === 'returned' ? 'Resubmit for review' : 'Submit for review'}</button>
        {state && 'error' in state && <p role="alert" className="mt-2 text-sm text-red-600">{state.error}</p>}
      </form>}
    </div>;
  }
  if (isMaker && canApprove) return message('An independent approver must review this assessment.');
  if (!canApprove) return <p className="text-sm text-zinc-600">
    {canRun ? 'Next in the demo, sign out and sign in as Ama Owusu (Head of Credit Risk). ' : 'An independent approver records the decision. '}
    <Link href="/screening/review" className="font-medium underline">Find {id} in the screening review queue</Link>.
  </p>;

  return (
    <form action={act} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-zinc-600">Review the <a href="#management-actions" className="underline">management actions</a> and <a href="#evidence" className="underline">evidence record</a>, then record your decision on the assessment.</p>
      {approvalBlock && <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">{approvalBlock}</p>}
      {rulesWarning && !approvalBlock && <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">{rulesWarning}</p>}
      {provided.length > 0 && !approvalBlock && <fieldset className="space-y-1 rounded-md border border-zinc-200 p-3 text-sm">
        <legend className="px-1 font-medium">Select evidence verified for approval</legend>
        {provided.map((item) => <label key={item.id} className="flex items-start gap-2"><input className="mt-1" type="checkbox" name="verifiedEvidence" value={item.id} /><span>{item.label} · {item.ref}</span></label>)}
      </fieldset>}
      {provided.length === 0 && message('This submission has no attached evidence to verify.')}
      <label className="block text-sm font-medium">Reviewer note
        <textarea name="note" rows={2} className="mt-1 block w-full max-w-xl rounded-md px-2 py-1.5 ring-1 ring-zinc-300" placeholder="Record your rationale, conditions or requested changes" />
      </label>
      <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <legend className="mb-2 font-medium">Review decision</legend>
        <label className="flex items-center gap-2"><input type="radio" name="action" value="approve" required disabled={!!approvalBlock} />Approve screening assessment</label>
        <label className="flex items-center gap-2"><input type="radio" name="action" value="return" required />Return to analyst</label>
        <label className="flex items-center gap-2"><input type="radio" name="action" value="escalate" required />Escalate for due diligence</label>
      </fieldset>
      <button className={btnClass} disabled={pending} data-action="screen-record">Record decision</button>
      {pending && <p role="status" className="text-sm text-zinc-600">Recording decision…</p>}
      {state && 'error' in state && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </form>
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
