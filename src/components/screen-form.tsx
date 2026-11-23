'use client';

import { useActionState } from 'react';
import { screenAction } from '@/app/actions';
import { btnClass } from './ui';

export function ScreenForm({ sectors, regions, exclusions, flags }: { sectors: { key: string; name: string }[]; regions: string[]; exclusions: readonly (readonly [string, string])[]; flags: readonly (readonly [string, string])[] }) {
  const [state, action, pending] = useActionState(screenAction, null);
  const field = 'mt-1 w-full rounded-md bg-white px-2 py-1.5 text-sm ring-1 ring-zinc-300';
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs text-zinc-600">Borrower<input name="borrower" defaultValue="Sefwi Gold Resources Ltd" className={field} /></label>
        <label className="text-xs text-zinc-600">Sector
          <select name="sector" defaultValue="mining" className={field}>{sectors.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}</select>
        </label>
        <label className="text-xs text-zinc-600">Region
          <select name="region" defaultValue="Western North" className={field}>{regions.map((r) => <option key={r}>{r}</option>)}</select>
        </label>
        <label className="text-xs text-zinc-600">Amount (GHS m)<input name="amount" type="number" min="0" step="0.1" defaultValue="85" className={field} /></label>
        <label className="text-xs text-zinc-600 md:col-span-2">Purpose<input name="purpose" defaultValue="Open-pit expansion and processing plant" className={field} /></label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="rounded-md border border-zinc-200 p-3">
          <legend className="px-1 text-xs font-semibold text-zinc-700">Exclusion list</legend>
          {exclusions.map(([k, t]) => <label key={k} className="flex items-start gap-2 py-0.5 text-sm"><input type="checkbox" name="exclusion" value={k} className="mt-1" />{t}</label>)}
        </fieldset>
        <fieldset className="rounded-md border border-zinc-200 p-3">
          <legend className="px-1 text-xs font-semibold text-zinc-700">E&amp;S questionnaire</legend>
          {flags.map(([k, t]) => <label key={k} className="flex items-start gap-2 py-0.5 text-sm"><input type="checkbox" name="flag" value={k} defaultChecked={k === 'hazardous' || k === 'labour'} className="mt-1" />{t}</label>)}
          <label className="mt-2 flex items-start gap-2 border-t border-zinc-100 pt-2 text-sm"><input type="checkbox" name="plan" className="mt-1" />Borrower has a credible transition plan</label>
        </fieldset>
      </div>
      <div className="flex items-center gap-3">
        <button className={btnClass} disabled={pending} data-action="screen">{pending ? 'Screening…' : 'Screen and record decision'}</button>
        {state && 'error' in state && <span className="text-sm text-red-600">{state.error}</span>}
        {state && 'id' in state && <span className="text-sm text-emerald-700">✓ Recorded as {state.id}: see the result below</span>}
      </div>
    </form>
  );
}
