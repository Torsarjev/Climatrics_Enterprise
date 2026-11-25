'use client';

import { useActionState, useState } from 'react';
import { decideCalibrationAction, executeCalibrationAction } from '@/app/actions';
import { BENCHMARKS, type Benchmark } from '@/lib/regression-models';
import { btnClass } from './ui';

const field = 'mt-1 block w-full rounded-lg border border-lime-300 bg-white px-3 py-2';

export function CalibrationForm({ start, end, benchmarks }: { start: number; end: number; benchmarks?: Record<'gdp' | 'inflation', Benchmark> }) {
  const [state, action, pending] = useActionState(executeCalibrationAction, null);
  const [fitRate, setFitRate] = useState(false);
  const [fitEnergy, setFitEnergy] = useState(false);
  return (
    <form action={action} className="space-y-4 rounded-xl bg-lime-50 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm font-medium">WDI sample start<input className={field} required type="number" name="start" min="2000" max="2016" defaultValue={start} /></label>
        <label className="text-sm font-medium">WDI sample end<input className={field} required type="number" name="end" min="2008" max="2024" defaultValue={end} /></label>
        <label className="text-sm font-medium">Long-term interest rate model
          <select className={field} name="rateModel" value={fitRate ? 'matched' : 'regional'} onChange={(event) => setFitRate(event.target.value === 'matched')}>
            <option value="regional">Regional NGFS shock ×1</option>
            <option value="matched">Fit against uploaded sovereign yields</option>
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(['gdp', 'inflation'] as const).map((key) => <label key={key} className="text-sm font-medium">
          {key === 'gdp' ? 'Ghana real GDP growth benchmark (X)' : 'Ghana CPI inflation benchmark (X)'}
          <select name={`${key}Benchmark`} defaultValue={benchmarks?.[key] ?? 'SSF'} className={field}>
            {Object.entries(BENCHMARKS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
        </label>)}
      </div>
      <p className="text-sm text-zinc-700">Ghana is the dependent series (Y). The benchmark is the independent series (X). A peer-country benchmark is a proxy for the NGFS regional shock.</p>
      <p id="rate-help" className="text-sm text-zinc-700">Use <code>year,ghana,regional</code> with rates in percent and at least nine consecutive matched years within the WDI window. Pair the same year, maturity, instrument and observation convention. For example, use Ghana and comparable regional 10-year local-currency sovereign yields, both measured as annual averages. Enter 12.5 for a 12.5% yield. The bundled WDI data supplies GDP growth and CPI inflation. WDI lending rates are a different instrument from long-term sovereign yields and the checked Ghana WDI lending series has no observations in this window. With no upload, the preview uses the regional rate shock at ×1.</p>
      {fitRate && <div className="grid gap-3 md:grid-cols-2">
      <label className="text-sm font-medium">Ghana and benchmark long-term yields CSV<input className={field} type="file" name="rates" accept=".csv,text/csv" aria-describedby="rate-help" /></label>
      <label className="block text-sm font-medium">Rate sources and comparability
        <input className={field} name="rateSource" maxLength={1000} placeholder="Ghana series, comparable regional series, tenor, observation convention" />
      </label>
      </div>}
      <label className="block text-sm font-medium">Energy price model
        <select className={field} name="energyModel" value={fitEnergy ? 'matched' : 'excluded'} onChange={(event) => setFitEnergy(event.target.value === 'matched')}>
          <option value="excluded">No separate energy shock</option>
          <option value="matched">Fit against uploaded energy prices</option>
        </select>
      </label>
      {fitEnergy && <fieldset className="space-y-3 rounded-lg border border-lime-300 p-3">
        <legend className="px-1 text-sm font-semibold">Energy price calibration</legend>
        <p className="text-sm text-zinc-700">Provide two CSVs to include energy in the stress test. For historical prices use <code>year,ghana,regional</code> with positive annual index values for the same product and price basis. For the NGFS path use <code>scenario,year,shock_pct</code> with percentage deviations from baseline and keys <code>nz2050</code>, <code>delayed</code> and <code>current</code>. The supplied path must cover or bracket every GCB reporting year.</p>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium">Matched historical energy prices<input className={field} type="file" required name="energyHistory" accept=".csv,text/csv" /></label>
          <label className="text-sm font-medium">NGFS regional energy shock path<input className={field} type="file" required name="energyPath" accept=".csv,text/csv" /></label>
          <label className="text-sm font-medium">Historical energy sources and comparability<input className={field} required name="energySource" maxLength={1000} placeholder="Product, price basis, Ghana and regional sources" /></label>
          <label className="text-sm font-medium">NGFS energy series and baseline<input className={field} required name="energyPathSource" maxLength={1000} placeholder="Release, model, region, product and reference baseline" /></label>
          <label className="text-sm font-medium">Energy-exposed operating cost share (%)<input className={field} type="number" required name="energyShare" min="0" max="100" step="any" /></label>
        </div>
        <p className="text-sm text-zinc-700">Use an energy series that excludes separately modelled carbon charges. The operating cost share is a portfolio-wide modelling input. With no energy upload, the preview omits the separate energy channel.</p>
      </fieldset>}
      <div className="flex flex-wrap gap-3">
        <button className={btnClass} disabled={pending}>{pending ? 'Estimating coefficients and ECL…' : 'Run regression and save preview'}</button>
        {fitRate && <button type="submit" name="runWithoutYields" value="yes" disabled={pending}
          className="rounded-md border border-lime-700 bg-white px-3 py-2 text-sm font-medium text-lime-900 hover:bg-lime-100 disabled:opacity-50">
          Run without a yield file
        </button>}
      </div>
      {fitRate && <p className="text-sm text-zinc-700">Running without a yield file fits GDP and inflation and uses the regional NGFS rate shock at ×1. The preview labels the rate shock uncalibrated.</p>}
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
