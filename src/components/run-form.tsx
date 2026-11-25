'use client';

import { useActionState, useState } from 'react';
import { runAction } from '@/app/actions';
import type { GhanaShocks } from '@/lib/calibration';
import { btnClass, Table } from './ui';

interface Pathway {
  key: string; label: string; name: string;
  points: { year: number; shocks: GhanaShocks }[];
}

export function RunForm({ pathways, calibration }: { pathways: Pathway[]; calibration: string }) {
  const [state, action, pending] = useActionState(runAction, null);
  const [key, setKey] = useState('current');
  const pathway = pathways.find((item) => item.key === key)!;
  const [years, setYears] = useState(() => pathway.points.map((point) => point.year));
  const field = 'mt-1 block w-full rounded-md border border-lime-200 bg-white px-3 py-2 text-sm';
  const selected = pathway.points.filter((point) => years.includes(point.year));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="calibration" value={calibration} />
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <label className="min-w-0 text-sm font-medium">NGFS pathway
          <select name="scenario" value={key} className={field} disabled={pending} onChange={(event) => {
            const next = pathways.find((item) => item.key === event.target.value)!;
            setKey(next.key);
            setYears(next.points.map((point) => point.year));
          }}>
            {pathways.map((item) => <option key={item.key} value={item.key}>{item.key === 'current' ? item.name : `${item.label} · ${item.name}`}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Approach
          <select name="approach" defaultValue="bottom-up" className={field} disabled={pending}>
            <option value="bottom-up">Bottom-up · borrower financials</option>
            <option value="top-down">Top-down · sector stress</option>
          </select>
        </label>
      </div>
      <fieldset disabled={pending}>
        <legend className="text-sm font-semibold">Reporting years</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {pathway.points.map(({ year }) => <label key={year} className="flex items-center gap-2 rounded-lg border border-lime-300 bg-lime-50 px-3 py-2 text-sm font-medium">
            <input type="checkbox" name="horizon" value={year} checked={years.includes(year)} className="accent-lime-700"
              onChange={(event) => {
                const checked = event.target.checked;
                setYears((current) => checked ? [...current, year] : current.filter((value) => value !== year));
              }} />{year}
          </label>)}
          <button type="button" onClick={() => setYears(pathway.points.map((point) => point.year))} className="px-2 text-sm font-medium underline">Select all years</button>
        </div>
      </fieldset>
      {selected.length > 0 && <div className="rounded-lg bg-lime-50 p-3" aria-label="Scenario variables by year">
        <Table head={['Year', 'GDP', 'Inflation', 'Long-term rate', 'Carbon price', 'Extreme rainfall', 'Physical hazard']}
          rows={selected.map(({ year, shocks }) => [year, `${shocks.gdp.toFixed(2)}%`, `${shocks.inflation.toFixed(2)} pp`, `${shocks.rate.toFixed(2)} pp`,
            `$${shocks.carbon.toFixed(2)}/t`, `×${shocks.flood.toFixed(3)}`, `×${shocks.physical.toFixed(3)}`])} />
      </div>}
      <button className={btnClass} disabled={pending || !selected.length}>{pending ? 'Calculating reporting years…' : `Run ${selected.length} reporting ${selected.length === 1 ? 'year' : 'years'}`}</button>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
