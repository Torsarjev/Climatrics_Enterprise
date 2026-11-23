'use client';

import { useActionState } from 'react';
import { runAction } from '@/app/actions';
import { btnClass } from './ui';

export function RunForm({ scenarios, horizons, canRun }: { scenarios: { key: string; name: string; family: string }[]; horizons: readonly number[]; canRun: boolean }) {
  const [state, action, pending] = useActionState(runAction, null);
  const sel = 'mt-1 w-full rounded-md bg-white px-2 py-1.5 text-sm ring-1 ring-zinc-300';
  return (
    <form action={action} className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
      <label className="text-xs text-zinc-600">NGFS scenario
        <select name="scenario" defaultValue="current" className={sel}>
          {scenarios.map((s) => <option key={s.key} value={s.key}>{s.name} ({s.family})</option>)}
        </select>
      </label>
      <label className="text-xs text-zinc-600">Horizon
        <select name="horizon" defaultValue="2050" className={sel}>{horizons.map((h) => <option key={h}>{h}</option>)}</select>
      </label>
      <label className="text-xs text-zinc-600">Approach
        <select name="approach" defaultValue="bottom-up" className={sel}>
          <option value="bottom-up">Bottom-up (each counterparty)</option>
          <option value="top-down">Top-down (sector averages)</option>
        </select>
      </label>
      <button className={btnClass} disabled={pending || !canRun}>{pending ? 'Running…' : 'Run stress test'}</button>
      {!canRun && <p className="text-xs text-amber-700 md:col-span-4">Your role cannot run stress tests.</p>}
      {state?.error && <p className="text-sm text-red-600 md:col-span-4">{state.error}</p>}
    </form>
  );
}
