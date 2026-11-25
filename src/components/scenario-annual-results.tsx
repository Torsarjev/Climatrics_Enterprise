'use client';

import { useState } from 'react';
import { ghs, pct } from '@/lib/fmt';
import { Table } from './ui';

export interface AnnualCreditResult {
  year: number;
  portfolioEcl: number;
  borrowerEcl: number;
  pd: number;
  lgd: number;
  stage: number;
}

export function ScenarioAnnualResults({ pathways }: { pathways: { key: string; label: string; points: AnnualCreditResult[] }[] }) {
  const [selected, setSelected] = useState(pathways[0].key);
  const pathway = pathways.find((item) => item.key === selected)!;
  const max = Math.max(1, ...pathways.flatMap((item) => item.points.map((point) => point.portfolioEcl)));
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Annual ECL pathway">
        {pathways.map((item) => <button key={item.key} type="button" aria-pressed={selected === item.key}
          className="rounded-lg border border-lime-300 px-3 py-2 text-sm font-medium hover:bg-lime-50 aria-pressed:bg-lime-200"
          onClick={() => setSelected(item.key)}>{item.label}</button>)}
      </div>
      <div className="mb-3 grid h-28 grid-flow-col auto-cols-fr items-end gap-1 rounded-lg bg-lime-50 px-2 pt-2" aria-hidden="true">
        {pathway.points.map((point) => <div key={point.year} className="rounded-t bg-lime-600" style={{ height: pct(point.portfolioEcl / max, 2) }} />)}
      </div>
      <Table head={['Year', 'Portfolio ECL', 'Borrower ECL', 'Facility PD', 'Facility LGD', 'Facility stage']}
        rows={pathway.points.map((point) => [point.year, ghs(point.portfolioEcl), ghs(point.borrowerEcl), pct(point.pd, 2), pct(point.lgd, 2), point.stage])} />
      <p className="mt-3 text-sm text-zinc-600">Each year applies its own shocks to the saved loan-book snapshot. Columns show the selected reporting years on a common chart scale. ECL is calculated as of each projection year and the reporting years are shown individually.</p>
    </>
  );
}
