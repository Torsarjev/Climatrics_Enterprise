'use client';

import { useActionState, useState } from 'react';
import { runAction } from '@/app/actions';
import type { GhanaShocks } from '@/lib/calibration';
import { btnClass } from './ui';

interface Pathway {
  key: string; label: string; name: string;
  points: { year: number; shocks: GhanaShocks }[];
}

export function RunForm({ pathways }: { pathways: Pathway[] }) {
  const [state, action, pending] = useActionState(runAction, null);
  const [key, setKey] = useState('current');
  const [year, setYear] = useState(2050);
  const pathway = pathways.find((item) => item.key === key)!;
  const { shocks } = pathway.points.find((point) => point.year === year)!;
  const field = 'mt-1 block w-full rounded-md border border-lime-200 bg-white px-3 py-2 text-sm';

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_2fr]">
        <label className="min-w-0 text-sm font-medium">NGFS pathway
          <select name="scenario" value={key} className={field} onChange={(event) => {
            const next = pathways.find((item) => item.key === event.target.value)!;
            setKey(next.key);
            setYear(next.points.at(-1)!.year);
          }}>
            {pathways.map((item) => <option key={item.key} value={item.key}>{item.label} · {item.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Projection year
          <select name="horizon" value={year} className={field} onChange={(event) => setYear(Number(event.target.value))}>
            {pathway.points.map((point) => <option key={point.year}>{point.year}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium">Approach
          <select name="approach" defaultValue="bottom-up" className={field}>
            <option value="bottom-up">Bottom-up · borrower financials</option>
            <option value="top-down">Top-down · sector stress</option>
          </select>
        </label>
      </div>
      <dl className="grid gap-2 rounded-lg bg-lime-50 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Scenario variables">
        {[
          ['GDP', `${shocks.gdp.toFixed(2)}%`], ['Inflation', `${shocks.inflation.toFixed(2)} pp`],
          ['Long-term rate', `${shocks.rate.toFixed(2)} pp`], ['Carbon price', `$${shocks.carbon.toFixed(2)}/t`],
          ['Extreme rainfall', `×${shocks.flood.toFixed(3)}`], ['Physical hazard', `×${shocks.physical.toFixed(3)}`],
        ].map(([label, value]) => <div key={label}><dt className="text-sm text-zinc-600">{label}</dt><dd className="font-semibold tabular-nums">{value}</dd></div>)}
      </dl>
      <button className={btnClass} disabled={pending}>{pending ? 'Calculating…' : 'Run climate scenario'}</button>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
