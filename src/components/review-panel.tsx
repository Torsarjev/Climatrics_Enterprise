'use client';

import { useActionState } from 'react';
import { reproduceAction, reviewAction } from '@/app/actions';
import { btnClass, btnGhost } from './ui';

function ActionForm({ id, action, label, primary, disabled, withNote }: { id: string; action: string; label: string; primary?: boolean; disabled?: boolean; withNote?: boolean }) {
  const [state, act, pending] = useActionState(reviewAction, null);
  return (
    <form action={act} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      {withNote && <input name="note" placeholder="Reviewer note" className="rounded-md px-2 py-1.5 text-sm ring-1 ring-zinc-300" />}
      <button className={primary ? btnClass : btnGhost} disabled={pending || disabled} data-action={action}>{label}</button>
      {state && 'error' in state && <span className="text-sm text-red-600">{state.error}</span>}
    </form>
  );
}

export function ReviewPanel({ id, status, canApprove, canSubmit, isMaker }: { id: string; status: string; canApprove: boolean; canSubmit: boolean; isMaker: boolean }) {
  const note = (t: string) => <p className="text-sm text-zinc-600">{t}</p>;
  if (status === 'draft') return canSubmit ? <ActionForm id={id} action="submit" label="Submit for approval" primary /> : note('Draft: waiting for the analyst to submit it for approval.');
  if (status === 'approved') return note('✓ Approved. This run can be used in the regulatory pack.');
  if (status === 'rejected') return note('Sent back to the analyst with the reviewer’s note.');
  if (!canApprove) return note(canSubmit ? 'Submitted: waiting for an approver (maker-checker).' : 'Submitted: awaiting approval.');
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionForm id={id} action="approve" label="Approve" primary withNote />
      <ActionForm id={id} action="reject" label="Reject" />
      {isMaker && <span className="text-xs text-amber-700">You created this run, so approval will be refused.</span>}
    </div>
  );
}

export function ReproduceButton({ id, expected }: { id: string; expected: string }) {
  const [state, act, pending] = useActionState(reproduceAction, null);
  return (
    <form action={act} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="id" value={id} />
      <button className={btnGhost} disabled={pending} data-action="reproduce">{pending ? 'Re-running…' : 'Re-run and verify'}</button>
      {state && (state.ok
        ? <span className="text-sm text-emerald-700">✓ Reproduced exactly · output {state.outputHash.slice(0, 12)}… = {expected.slice(0, 12)}…</span>
        : <span className="text-sm text-red-600">✕ Mismatch · inputs or parameters changed since this run</span>)}
    </form>
  );
}
