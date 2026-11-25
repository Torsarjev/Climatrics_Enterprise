'use client';

import { useActionState, useState } from 'react';
import { projectIcaapAction, reviewIcaapAction } from '@/app/actions/icaap';
import { icaapBatchMismatch, type IcaapBatchBasis } from '@/lib/icaap';
import { btnClass } from './ui';

const field = 'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm';
const numbers = [
  ['cet1', 'Opening CET1 (GHS)', 1900000000], ['at1', 'Opening eligible AT1 (GHS)', 0],
  ['tier2', 'Opening eligible Tier 2 (GHS)', 400000000], ['reportedCapital', 'Reported eligible capital (GHS)', 2300000000],
  ['provisions', 'Opening impairment allowance (GHS)', 512000000], ['tax', 'Tax rate (%)', 0],
  ['cet1Min', 'CET1 requirement incl. buffer (%)', 8], ['tier1Min', 'Tier 1 requirement incl. buffer (%)', 10],
  ['totalMin', 'Total capital requirement incl. buffer (%)', 13],
] as const;

type SourceChoice = { key: string; name: string; years: number[]; batches: (IcaapBatchBasis & { id: string; label: string })[] };
export function IcaapForm({ choices }: { choices: SourceChoice[] }) {
  const [mode, setMode] = useState('demo');
  const [batchMode, setBatchMode] = useState('automatic');
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [state, action, pending] = useActionState(projectIcaapAction, null);
  const sources = choices.map((choice) => ({ name: choice.name, batch: choice.batches.find(({ id }) => id === selected[choice.key]) }));
  const anchor = sources.find(({ batch }) => batch);
  const conflicts = sources.flatMap(({ name, batch }) => {
    const differences = anchor?.batch && batch ? icaapBatchMismatch(anchor.batch, batch) : [];
    return differences.length ? [`${name} differs from ${anchor?.name} in ${differences.join(', ')}.`] : [];
  });
  const missing = sources.filter(({ batch }) => !batch).map(({ name }) => name);
  return <form action={action} className="space-y-4">
    <div className="space-y-3 rounded-lg border border-lime-300 bg-lime-50 p-4">
      <label className="block text-sm font-medium">Scenario batches
        <select name="batchMode" className={field} value={batchMode} onChange={(event) => setBatchMode(event.target.value)}>
          <option value="automatic">Automatically use compatible batches</option>
          <option value="manual">Choose saved batches manually</option>
        </select>
      </label>
      {batchMode === 'automatic' ? <>
        <p className="text-sm text-zinc-700">Running ICAAP reuses compatible Engine III batches and creates missing ones using the active loan book, model settings and calibration.</p>
        <label className="block text-sm font-medium">Credit approach
          <select name="approach" className={field} defaultValue="bottom-up">
            <option value="bottom-up">Bottom-up · borrower financials</option>
            <option value="top-down">Top-down · sector stress</option>
          </select>
        </label>
      </> : <>
        <div className="grid gap-3 md:grid-cols-3">
          {choices.map(({ key, name, years, batches }) => <label key={key} className="text-sm font-medium">
            {name} · {years.join(', ')}
            <select name={key} className={field} required value={selected[key] ?? ''} onChange={(event) => {
              const value = event.target.value;
              setSelected((current) => ({ ...current, [key]: value }));
            }}>
              <option value="">{batches.length ? 'Select Engine III batch' : 'No complete batch'}</option>
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.label}</option>)}
            </select>
          </label>)}
        </div>
        {conflicts.length > 0 && <p role="alert" className="text-sm text-red-700">{conflicts.join(' ')} Select matching batches or switch to automatic selection.</p>}
        {missing.length > 0 && <p className="text-sm text-amber-800">Select a complete batch for {missing.join(', ')} or switch to automatic selection.</p>}
      </>}
    </div>
    <label className="block text-sm font-medium">Finance inputs<select className={field} name="financeMode" value={mode} onChange={(event) => setMode(event.target.value)}>
      <option value="demo">Illustrative finance assumptions</option><option value="upload">GCB finance file</option>
    </select></label>
    <div key={mode} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <label className="text-sm font-medium">Legal entity<input className={field} name="entity" required maxLength={200} defaultValue={mode === 'demo' ? 'Demo Bank Ghana' : ''} /></label>
      <label className="text-sm font-medium">Portfolio reference<input className={field} name="portfolio" required maxLength={200} defaultValue={mode === 'demo' ? 'Full loan book' : ''} /></label>
      <label className="text-sm font-medium">Opening reporting date<input className={field} name="asOf" type="date" required defaultValue={mode === 'demo' ? '2026-09-30' : ''} /></label>
      {numbers.map(([name, label, value]) => <label key={name} className="text-sm font-medium">{label}
        <input className={field} type="number" min="0" step="any" name={name} required defaultValue={mode === 'demo' ? value : undefined} />
      </label>)}
    </div>
    {mode === 'upload' && <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">Finance return or approval reference<input className={field} name="source" required maxLength={200} /></label>
      <label className="text-sm font-medium">Scenario-period finance CSV (GHS)<input className={field} name="finance" type="file" accept=".csv,text/csv" required /></label>
    </div>}
    <div className="flex flex-wrap items-center gap-4">
      <button disabled={pending || (batchMode === 'manual' && (conflicts.length > 0 || missing.length > 0))} className={btnClass}>{pending ? 'Preparing scenarios and projecting capital…' : 'Run all three capital scenarios'}</button>
      <a href="/api/icaap?template=1" className="text-sm underline">Download finance CSV template</a>
    </div>
    {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
  </form>;
}

export function IcaapReview({ id, actions }: { id: string; actions: ('submit' | 'approve' | 'reject')[] }) {
  const [state, action, pending] = useActionState(reviewIcaapAction, null);
  return <form action={action} className="mt-4 space-y-2">
    <input type="hidden" name="id" value={id} />
    <label className="block text-sm font-medium">Review note<input className={field} name="note" maxLength={1000} /></label>
    {actions.length === 1
      ? <input type="hidden" name="action" value={actions[0]} />
      : <fieldset className="flex gap-4 text-sm">
          <legend className="mb-2 font-medium">Decision</legend>
          {actions.map((value) => <label key={value} className="flex gap-2"><input type="radio" name="action" value={value} required />{value === 'approve' ? 'Approve' : 'Reject'}</label>)}
        </fieldset>}
    <button className={btnClass} disabled={pending}>{actions.length === 1 ? 'Submit for review' : 'Record decision'}</button>
    {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
  </form>;
}
