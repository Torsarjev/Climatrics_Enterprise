'use client';

import { useActionState } from 'react';
import { auditReviewAction } from '@/app/actions/audit';
import { btnClass } from './ui';

const field = 'mt-1 block w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm';

export function AuditReviewForm({ kind, target }: { kind: string; target: string }) {
  const [state, action, pending] = useActionState(auditReviewAction, null);
  const v = state && 'values' in state ? state.values : undefined;
  return (
    <details className="text-sm" open={!!v}>
      <summary className="cursor-pointer font-medium text-[#3a5a45] underline">Record audit review</summary>
      <form key={JSON.stringify(v ?? {})} action={action} className="mt-2 space-y-2 rounded-md border border-zinc-200 bg-zinc-50 p-3" data-audit-form={target}>
        <input type="hidden" name="kind" value={kind} /><input type="hidden" name="target" value={target} />
        <label className="block">Audit opinion
          <select name="opinion" className={field} defaultValue={v?.opinion ?? 'satisfactory'}>
            <option value="satisfactory">Satisfactory</option><option value="needs improvement">Needs improvement</option><option value="unsatisfactory">Unsatisfactory</option>
          </select>
        </label>
        <label className="block">Findings<textarea name="findings" defaultValue={v?.findings} maxLength={2000} rows={2} className={field} placeholder="Required unless satisfactory" /></label>
        <label className="block">Audit reference<input name="reference" defaultValue={v?.reference} maxLength={200} className={field} placeholder="e.g. IA/2026/CR-07" /></label>
        <button className={btnClass} disabled={pending}>{pending ? 'Recording…' : 'Record review'}</button>
        {state && 'error' in state && <p role="alert" className="text-red-600">{state.error}</p>}
        {state && 'ok' in state && <p className="text-emerald-700">Recorded ✓</p>}
      </form>
    </details>
  );
}
