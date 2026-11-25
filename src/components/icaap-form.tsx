'use client';

import { useActionState, useState } from 'react';
import { prepareIcaapAction, projectIcaapAction, reviewIcaapAction } from '@/app/actions/icaap';
import { btnClass } from './ui';

const field = 'mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm';
const numbers = [
  ['cet1', 'Opening CET1 (GHS)', 1900000000], ['at1', 'Opening eligible AT1 (GHS)', 0],
  ['tier2', 'Opening eligible Tier 2 (GHS)', 400000000], ['reportedCapital', 'Reported eligible capital (GHS)', 2300000000],
  ['provisions', 'Opening impairment allowance (GHS)', 512000000], ['tax', 'Tax rate (%)', 0],
  ['cet1Min', 'CET1 requirement incl. buffer (%)', 8], ['tier1Min', 'Tier 1 requirement incl. buffer (%)', 10],
  ['totalMin', 'Total capital requirement incl. buffer (%)', 13],
] as const;

type SourceChoice = { key: string; name: string; years: number[]; batches: { id: string; label: string }[] };
export function IcaapForm({ choices }: { choices: SourceChoice[] }) {
  const [mode, setMode] = useState('demo');
  const [state, action, pending] = useActionState(projectIcaapAction, null);
  const [prepared, prepare, preparing] = useActionState(prepareIcaapAction, null);
  const ready = prepared?.batches;
  const missing = choices.filter((item) => !item.batches.length && !ready?.[item.key]);
  return <>
    <form action={prepare} className="mb-5 rounded-lg border border-lime-300 bg-lime-50 p-4">
      <p className="text-sm text-zinc-700">Prepare all three pathways using the active loan book and calibration. Existing compatible batches are reused and missing batches are created.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Credit approach
          <select name="approach" className={field} defaultValue="bottom-up">
            <option value="bottom-up">Bottom-up · borrower financials</option>
            <option value="top-down">Top-down · sector stress</option>
          </select>
        </label>
        <button disabled={preparing || pending} className={btnClass}>{preparing ? 'Preparing scenario batches…' : 'Prepare and select scenario batches'}</button>
      </div>
      {ready && !preparing && <p role="status" className="mt-3 text-sm">Three compatible batches are selected. Review the finance inputs and run the capital assessment.</p>}
      {prepared?.error && <p role="alert" className="mt-3 text-sm text-red-700">{prepared.error}</p>}
    </form>
    <form action={action} className="space-y-4">
    <div className="grid gap-3 md:grid-cols-3">
      {choices.map(({ key, name, years, batches }) => {
        const selected = ready?.[key];
        const options = selected && !batches.some(({ id }) => id === selected.id) ? [selected, ...batches] : batches;
        return <label key={`${key}:${prepared?.selectionKey ?? ''}`} className="text-sm font-medium">
        {name} · {years.join(', ')}
        <select name={key} className={field} required defaultValue={prepared?.selectionKey ?? ''}>
          <option value="" disabled>{options.length ? 'Select Engine III batch' : 'No complete batch'}</option>
          {options.map((batch) => <option key={batch.id} value={batch.id}>{batch.label}</option>)}
        </select>
      </label>;
      })}
    </div>
    {missing.length > 0 && <p className="text-sm text-amber-800">Missing complete batches for {missing.map(({ name }) => name).join(', ')}. Use the preparation button above to continue.</p>}
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
      <button disabled={pending || preparing || missing.length > 0} className={btnClass}>{pending ? 'Reconciling ECL and projecting capital…' : 'Run all three capital scenarios'}</button>
      <a href="/api/icaap?template=1" className="text-sm underline">Download finance CSV template</a>
    </div>
    {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
  </form>
  </>;
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
