'use client';

import { useActionState, useState } from 'react';
import { projectIlaapAction, reviewIlaapAction } from '@/app/actions/ilaap';
import { ILAAP_BUCKETS } from '@/lib/ilaap';
import { btnClass } from './ui';

const field = 'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm';
const amounts = [
  ['funding', 'Contingency funding (GHS)', 0, undefined],
  ['fundingFeePct', 'Funding fee (% of amount)', 1, 100],
  ['salePct', 'Available bonds to sell (%)', 0, 100],
  ['saleDiscountPct', 'Sale discount to stressed value (%)', 5, 100],
  ['additionalOutflow', 'Second-round outflow at sale bucket (GHS)', 0, undefined],
] as const;
const timings = [
  ['fundingDay', 'Raise funding by', 7], ['repaymentDay', 'Repay funding by', 90], ['saleDay', 'Liquidate bonds by', 30],
] as const;

export function IlaapForm({ pathways }: { pathways: { key: string; name: string; years: number[] }[] }) {
  const [mode, setMode] = useState('demo');
  const [state, action, pending] = useActionState(projectIlaapAction, null);
  return <form action={action} className="space-y-5">
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">NGFS pathways</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {pathways.map(({ key, name, years }) => <label key={key} className="flex items-start gap-2 rounded-lg border border-lime-300 bg-lime-50 p-3 text-sm">
          <input type="checkbox" name="scenario" value={key} defaultChecked className="mt-1 accent-lime-800" /><span>{name}<span className="block text-zinc-600">{years.join(' · ')}</span></span>
        </label>)}
      </div>
    </fieldset>
    <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">Treasury / ALM data
        <select name="mode" value={mode} onChange={(event) => setMode(event.target.value)} className={field}>
          <option value="demo">Illustrative GHS Treasury snapshot</option><option value="upload">Upload reconciled GHS Treasury data</option>
        </select>
      </label>
      {mode === 'upload' && <label className="text-sm font-medium">Treasury JSON<input type="file" name="treasury" accept=".json,application/json" required className={field} /></label>}
    </div>
    <a href="/api/ilaap?template=1" className="inline-block text-sm underline">Download Treasury data template with example values</a>
    <details>
      <summary className="cursor-pointer text-sm font-medium">Contingency funding and asset sales</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {amounts.map(([name, label, value, max]) => <label key={name} className="text-sm font-medium">{label}
          <input type="number" name={name} defaultValue={value} min={0} max={max} step="any" required className={field} />
        </label>)}
        {timings.map(([name, label, value]) => <label key={name} className="text-sm font-medium">{label}
          <select name={name} defaultValue={value} className={field}>{ILAAP_BUCKETS.map((day) => <option key={day} value={day}>Day {day}</option>)}</select>
        </label>)}
      </div>
    </details>
    <button className={btnClass} disabled={pending}>{pending ? 'Reconciling and projecting liquidity…' : 'Run climate liquidity stress test'}</button>
    {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
  </form>;
}

export function IlaapReview({ id, checker, illustrative }: { id: string; checker: boolean; illustrative: boolean }) {
  const [state, action, pending] = useActionState(reviewIlaapAction, null);
  return <form action={action} className="mt-3 space-y-2">
    <input type="hidden" name="id" value={id} />
    {checker ? <>
      <label className="block text-sm">Decision<select name="decision" className={field} defaultValue="approve">
        <option value="approve">Approve</option><option value="reject">Reject</option>
      </select></label>
      {illustrative && <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">This assessment uses illustrative Treasury data. You can approve it; the approval is recorded as made on illustrative data.</p>}
      <label className="block text-sm">Treasury / ALCO sign-off reference<input name="reference" maxLength={200} className={field} /></label>
    </> : <input type="hidden" name="decision" value="submit" />}
    <label className="block text-sm">Review note<input name="note" maxLength={1000} className={field} /></label>
    <button className={btnClass} disabled={pending}>{checker ? 'Record decision' : 'Submit for review'}</button>
    {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
  </form>;
}
