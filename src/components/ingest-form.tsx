'use client';

import { useActionState } from 'react';
import { ingestAction } from '@/app/actions';
import { btnClass } from './ui';

export function IngestForm({ canIngest }: { canIngest: boolean }) {
  const [state, action, pending] = useActionState(ingestAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="file" name="file" accept=".csv" className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm" />
      <button className={btnClass} disabled={pending || !canIngest}>{pending ? 'Validating…' : 'Load and validate'}</button>
      <a href="/api/sample" className="text-sm text-zinc-600 underline">Download sample extract (CSV)</a>
      {!canIngest && <span className="text-xs text-amber-700">Your role cannot load data</span>}
      {state && 'error' in state && <span className="text-sm text-red-600">{state.error}</span>}
      {state && 'ok' in state && <span className="text-sm text-emerald-700">Loaded ✓</span>}
    </form>
  );
}
