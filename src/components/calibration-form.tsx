'use client';

import { useActionState } from 'react';
import { decideCalibrationAction, executeCalibrationAction } from '@/app/actions';
import { btnClass } from './ui';

const field = 'mt-1 block w-full rounded-lg border border-lime-300 bg-white px-3 py-2';

export function CalibrationForm({ start, end }: { start: number; end: number }) {
  const [state, action, pending] = useActionState(executeCalibrationAction, null);
  return (
    <form action={action} className="space-y-4 rounded-xl bg-lime-50 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-medium">WDI sample start<input className={field} required type="number" name="start" min="2000" max="2016" defaultValue={start} /></label>
        <label className="text-sm font-medium">WDI sample end<input className={field} required type="number" name="end" min="2008" max="2024" defaultValue={end} /></label>
        <label className="text-sm font-medium">Matched long-term rates CSV (optional)<input className={field} type="file" name="rates" accept=".csv,text/csv" aria-describedby="rate-help" /></label>
      </div>
      <p id="rate-help" className="text-sm text-zinc-700">Use <code>year,ghana,regional</code> with rates in percent and at least nine consecutive matched years within the WDI window. Use comparable maturities and annual observation dates. With no upload, the preview uses the regional rate shock at ×1.</p>
      <label className="block text-sm font-medium">Rate sources and comparability
        <input className={field} name="rateSource" maxLength={1000} placeholder="Ghana series, comparable regional series, tenor, observation convention" />
      </label>
      <button className={btnClass} disabled={pending}>{pending ? 'Estimating coefficients and ECL…' : 'Run regression and save preview'}</button>
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function CalibrationDecision({ id, stale }: { id: string; stale: boolean }) {
  const [state, action, pending] = useActionState(decideCalibrationAction, null);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="version" value={id} />
      <label className="block text-sm font-medium">Decision note (optional)
        <input className={field} name="note" maxLength={1000} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button className={btnClass} disabled={pending || stale} name="decision" value="activate">Activate for new stress tests</button>
        <button className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium" disabled={pending} name="decision" value="decline">Decline activation</button>
      </div>
      {stale && <p className="text-sm text-amber-800">The active calibration or loan book has changed. Run a new preview before activating.</p>}
      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
