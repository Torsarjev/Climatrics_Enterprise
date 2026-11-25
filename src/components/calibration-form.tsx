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
        <label className="text-sm font-medium">Ghana and regional long-term yields (optional CSV)<input className={field} type="file" name="rates" accept=".csv,text/csv" aria-describedby="rate-help" /></label>
      </div>
      <p id="rate-help" className="text-sm text-zinc-700">Use <code>year,ghana,regional</code> with rates in percent and at least nine consecutive matched years within the WDI window. Pair the same year, maturity, instrument and observation convention. For example, use Ghana and comparable regional 10-year local-currency sovereign yields, both measured as annual averages. Enter 12.5 for a 12.5% yield. With no upload, the preview uses the regional rate shock at ×1.</p>
      <label className="block text-sm font-medium">Rate sources and comparability
        <input className={field} name="rateSource" maxLength={1000} placeholder="Ghana series, comparable regional series, tenor, observation convention" />
      </label>
      <fieldset className="space-y-3 rounded-lg border border-lime-300 p-3">
        <legend className="px-1 text-sm font-semibold">Energy price calibration</legend>
        <p className="text-sm text-zinc-700">Provide two CSVs to include energy in the stress test. For historical prices use <code>year,ghana,regional</code> with positive annual index values for the same product and price basis. For the NGFS path use <code>scenario,year,shock_pct</code> with percentage deviations from baseline and keys <code>nz2050</code>, <code>delayed</code> and <code>current</code>. The supplied path must cover or bracket every GCB reporting year.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium">Matched historical energy prices<input className={field} type="file" name="energyHistory" accept=".csv,text/csv" /></label>
          <label className="text-sm font-medium">NGFS regional energy shock path<input className={field} type="file" name="energyPath" accept=".csv,text/csv" /></label>
          <label className="text-sm font-medium">Historical energy sources and comparability<input className={field} name="energySource" maxLength={1000} placeholder="Product, price basis, Ghana and regional sources" /></label>
          <label className="text-sm font-medium">NGFS energy series and baseline<input className={field} name="energyPathSource" maxLength={1000} placeholder="Release, model, region, product and reference baseline" /></label>
          <label className="text-sm font-medium">Energy-exposed operating cost share (%)<input className={field} type="number" name="energyShare" min="0" max="100" step="any" /></label>
        </div>
        <p className="text-sm text-zinc-700">Use an energy series that excludes separately modelled carbon charges. The operating cost share is a portfolio-wide modelling input. With no energy upload, the preview omits the separate energy channel.</p>
      </fieldset>
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
