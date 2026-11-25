'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ghs, pct } from '@/lib/fmt';

export interface PhysicalPortfolioRow {
  id: string;
  borrowerId: string;
  borrower: string;
  region: string;
  sector: string;
  driver: string;
  ead: number;
  score: number;
  verified: boolean;
}

const BANDS = [
  { label: 'Low', limit: 2, color: '#a3e635', description: '1.00 to < 2.00' },
  { label: 'Moderate', limit: 3, color: '#84cc16', description: '2.00 to < 3.00' },
  { label: 'High', limit: 4, color: '#fbbf24', description: '3.00 to < 4.00' },
  { label: 'Very high', limit: Infinity, color: '#fb7185', description: '4.00 to 5.00' },
] as const;
type Band = typeof BANDS[number]['label'];
type Metric = 'score' | 'high' | 'verified' | 'concentration';
const PAGE_SIZE = 10;
const exact = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
type Dimension = 'region' | 'sector' | 'driver';
const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: 'region', label: 'Region' },
  { key: 'sector', label: 'Sector' },
  { key: 'driver', label: 'Dominant hazard' },
];
const bandOf = (score: number) => BANDS.find(({ limit }) => score < limit)!.label;
const sumEad = (rows: PhysicalPortfolioRow[]) => rows.reduce((sum, row) => sum + row.ead, 0);
const ratio = (numerator: number, denominator: number) => denominator ? numerator / denominator : 0;

export function PhysicalPortfolioDashboard({ rows }: { rows: PhysicalPortfolioRow[] }) {
  const [filters, setFilters] = useState<Partial<Record<Dimension, string>>>({});
  const [band, setBand] = useState<Band>();
  const [dimension, setDimension] = useState<Dimension>('region');
  const [metric, setMetric] = useState<Metric>();
  const [evidencePage, setEvidencePage] = useState(0);
  const evidenceHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (metric) evidenceHeading.current?.focus();
  }, [metric]);
  const options = useMemo(() => Object.fromEntries(DIMENSIONS.map(({ key }) => [
    key, [...new Set(rows.map((row) => row[key]))].sort((a, b) => a.localeCompare(b)),
  ])), [rows]);
  const filtered = rows.filter((row) =>
    DIMENSIONS.every(({ key }) => !filters[key] || row[key] === filters[key]) && (!band || bandOf(row.score) === band));
  const total = sumEad(filtered);
  const high = sumEad(filtered.filter((row) => row.score >= 3));
  const verified = sumEad(filtered.filter((row) => row.verified));
  const scoreTotal = filtered.reduce((sum, row) => sum + row.ead * row.score, 0);
  const weightedScore = total ? scoreTotal / total : null;
  const distribution = BANDS.map((item) => ({ ...item, value: sumEad(filtered.filter((row) => bandOf(row.score) === item.label)) }));
  const groups = new Map<string, { ead: number; high: number }>();
  for (const row of filtered) {
    const group = groups.get(row[dimension]) ?? { ead: 0, high: 0 };
    group.ead += row.ead;
    if (row.score >= 3) group.high += row.ead;
    groups.set(row[dimension], group);
  }
  const concentrations = [...groups].sort(([, a], [, b]) => b.high - a.high || b.ead - a.ead).slice(0, 6);
  const top = [...filtered].sort((a, b) => b.score - a.score || b.ead - a.ead).slice(0, 8);
  const hasFilters = DIMENSIONS.some(({ key }) => !!filters[key]) || !!band;
  const setFilter = (key: Dimension, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setEvidencePage(0);
  };
  const selectBand = (next?: Band) => {
    setBand(next);
    setEvidencePage(0);
  };

  const largest = concentrations[0]?.[1].high > 0 ? concentrations[0] : undefined;
  const dimensionLabel = DIMENSIONS.find(({ key }) => key === dimension)!.label;
  const cards = [
    { id: 'score', label: 'Portfolio physical score', value: weightedScore === null ? '—' : `${weightedScore.toFixed(2)} / 5`, detail: 'Outstanding exposure-weighted', color: 'text-lime-300' },
    { id: 'high', label: 'High-risk exposure', value: total ? pct(ratio(high, total)) : '—', detail: `${ghs(high)} at 3.00 or above`, color: 'text-amber-300' },
    { id: 'verified', label: 'Verified location coverage', value: total ? pct(ratio(verified, total)) : '—', detail: `${ghs(verified)} with all sites verified`, color: 'text-lime-200' },
    { id: 'concentration', label: 'Largest high-risk concentration', value: largest?.[0] ?? '—', detail: `${ghs(largest?.[1].high ?? 0)} · by ${dimensionLabel.toLowerCase()}`, color: 'text-white' },
  ] as const;
  const explanations: Record<Metric, string> = {
    score: `Sum of facility score × outstanding exposure (${exact(scoreTotal)} score·GHS) ÷ total outstanding exposure (GHS ${exact(total)}).`,
    high: `Outstanding exposure at score 3.00 or above (GHS ${exact(high)}) ÷ total outstanding exposure (GHS ${exact(total)}).`,
    verified: `Outstanding exposure where all sites are verified (GHS ${exact(verified)}) ÷ total outstanding exposure (GHS ${exact(total)}).`,
    concentration: `Group facilities scoring 3.00 or above by ${dimensionLabel.toLowerCase()} and sum their outstanding exposure. ${largest ? `${largest[0]} ranks first at GHS ${exact(largest[1].high)}.` : 'The current filters have no group with positive high-risk exposure.'}`,
  };
  const evidenceRows = metric === 'high' ? filtered.filter((row) => row.score >= 3)
    : metric === 'verified' ? filtered.filter((row) => row.verified)
    : metric === 'concentration' ? filtered.filter((row) => largest && row[dimension] === largest[0] && row.score >= 3)
    : filtered;
  const pageCount = Math.max(1, Math.ceil(evidenceRows.length / PAGE_SIZE));
  const page = Math.min(evidencePage, pageCount - 1);
  const start = page * PAGE_SIZE;

  return (
    <section id="portfolio-physical-risk" aria-labelledby="portfolio-physical-heading" className="scroll-mt-4 overflow-hidden rounded-2xl border border-slate-800 bg-[#101d25] text-slate-100 shadow-lg">
      <div className="border-b border-white/10 bg-gradient-to-br from-[#192b2d] via-[#101d25] to-[#101d25] p-5 sm:p-7">
        <p className="mb-2 text-sm font-semibold text-lime-300">Current Policies · 2050 · SSP5-8.5</p>
        <h2 id="portfolio-physical-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">Portfolio physical risk</h2>
        <p className="mt-2 max-w-2xl text-slate-300">Track the exposure-weighted score and see where high-risk lending is concentrated.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {DIMENSIONS.map(({ key, label }) => (
            <label key={key} className="min-w-0 text-sm font-medium text-slate-200">{label}
              <select value={filters[key] ?? ''} onChange={(event) => setFilter(key, event.target.value)}
                className="mt-1 block w-full min-w-0 truncate rounded-md border border-slate-500 bg-[#15232b] px-3 py-2 text-white focus-visible:outline-2 focus-visible:outline-lime-300">
                <option value="">All {key === 'driver' ? 'hazards' : key === 'region' ? 'regions' : 'sectors'}</option>
                {options[key].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
          <label className="text-sm font-medium text-slate-200">Risk band
            <select value={band ?? ''} onChange={(event) => selectBand(event.target.value as Band || undefined)}
              className="mt-1 block w-full rounded-md border border-slate-500 bg-[#15232b] px-3 py-2 text-white focus-visible:outline-2 focus-visible:outline-lime-300">
              <option value="">All risk bands</option>
              {BANDS.map(({ label }) => <option key={label}>{label}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-3 flex min-h-8 flex-wrap items-center justify-between gap-2 text-sm">
          <p role="status" className="text-slate-300">{filtered.length.toLocaleString('en-GB')} of {rows.length.toLocaleString('en-GB')} facilities · {ghs(total)} outstanding</p>
          {hasFilters && <button type="button" onClick={() => { setFilters({}); selectBand(); }}
            className="rounded px-2 py-1 font-medium text-lime-300 underline underline-offset-4 hover:text-lime-100">Clear filters</button>}
        </div>
      </div>

      <div className="grid gap-px bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ id, label, value, detail, color }) => (
          <button type="button" key={id} aria-expanded={metric === id} aria-controls="portfolio-card-evidence"
            onClick={() => { setMetric(metric === id ? undefined : id); setEvidencePage(0); }}
            className="min-w-0 bg-[#14232c] p-5 text-left hover:bg-[#203437] focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-lime-300 aria-expanded:bg-[#203437]">
            <span className="block text-sm text-slate-300">{label}</span>
            <span className={`my-2 block break-words text-2xl font-semibold tabular-nums tracking-tight ${color}`}>{value}</span>
            <span className="block text-sm text-slate-300">{detail}</span>
            <span className="mt-3 block text-sm font-medium text-lime-200 underline underline-offset-4">{metric === id ? 'Hide calculation' : 'View calculation and facilities'}</span>
          </button>
        ))}
      </div>

      <section id="portfolio-card-evidence" hidden={!metric} aria-labelledby="portfolio-card-evidence-title"
        className="border-b border-lime-300/30 bg-[#192b2d] p-5 sm:p-7">
        {metric && <>
          <h3 id="portfolio-card-evidence-title" ref={evidenceHeading} tabIndex={-1} className="scroll-mt-6 text-lg font-semibold focus-visible:outline-lime-300">{cards.find((card) => card.id === metric)?.label} calculation</h3>
          <p className="mt-2 text-sm text-slate-200">{explanations[metric]}</p>
          <p className="mt-2 text-sm text-slate-300">Based on the active loan book and the Current Policies 2050 facility scores in the current filters.</p>
          {evidenceRows.length ? <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[38rem] text-left text-sm">
                <caption className="sr-only">Facilities contributing to the selected measure</caption>
                <thead><tr className="border-b border-white/15 text-slate-300">
                  <th scope="col" className="p-2">Facility</th><th scope="col" className="p-2">Outstanding (GHS)</th>
                  <th scope="col" className="p-2">Physical score</th><th scope="col" className="p-2">{metric === 'score' ? 'Score × outstanding' : metric === 'verified' ? 'Site verification' : 'Dominant hazard'}</th>
                </tr></thead>
                <tbody>{evidenceRows.slice(start, start + PAGE_SIZE).map((row) => (
                  <tr key={row.id} className="border-b border-white/10 last:border-0">
                    <td className="p-2"><Link href={{ pathname: '/physical', query: { borrower: row.borrowerId }, hash: 'borrower-risk' }} className="font-medium text-lime-200 underline">{row.borrower}</Link><span className="block text-slate-300">{row.id} · {row.region}</span></td>
                    <td className="p-2 tabular-nums">{exact(row.ead)}</td><td className="p-2 tabular-nums">{row.score.toFixed(2)} / 5</td>
                    <td className="p-2">{metric === 'score' ? exact(row.ead * row.score) : metric === 'verified' ? 'All sites verified' : row.driver}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <p role="status" className="text-slate-300">{start + 1}–{Math.min(start + PAGE_SIZE, evidenceRows.length)} of {evidenceRows.length.toLocaleString('en-GB')} contributing facilities</p>
              {pageCount > 1 && <>
                <button type="button" onClick={() => setEvidencePage(page - 1)} disabled={page === 0} className="rounded-md border border-slate-500 px-3 py-1 enabled:hover:border-lime-300 disabled:opacity-40">Previous</button>
                <button type="button" onClick={() => setEvidencePage(page + 1)} disabled={page + 1 >= pageCount} className="rounded-md border border-slate-500 px-3 py-1 enabled:hover:border-lime-300 disabled:opacity-40">Next</button>
              </>}
            </div>
          </> : <p className="mt-4 text-sm text-slate-300">No contributing facilities match the current filters.</p>}
          <a href="#engine-ii-methodology" className="mt-4 inline-block text-sm font-medium text-lime-200 underline">See the facility scoring method</a>
        </>}
      </section>

      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-white/10 bg-[#14232c] p-4 sm:p-5" aria-labelledby="physical-risk-mix">
          <h3 id="physical-risk-mix" className="text-lg font-semibold">Risk distribution</h3>
          <p className="mt-1 text-sm text-slate-300">Share of outstanding exposure by physical risk band</p>
          <div aria-hidden="true" className="my-5 flex h-5 overflow-hidden rounded-full bg-slate-700">
            {distribution.map((item) => <div key={item.label} className="transition-[width] motion-reduce:transition-none"
              style={{ width: pct(ratio(item.value, total), 6), backgroundColor: item.color }} />)}
          </div>
          <ul className="space-y-2">
            {distribution.map((item) => (
              <li key={item.label}>
                <button type="button" aria-pressed={band === item.label} disabled={!item.value && band !== item.label}
                  onClick={() => selectBand(band === item.label ? undefined : item.label)}
                  className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-transparent px-2 py-1.5 text-left enabled:hover:bg-white/10 aria-pressed:border-lime-300">
                  <span className="flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-medium">{item.label}</span> <span className="text-slate-400">· {item.description}</span>
                  </span>
                  <span className="text-sm tabular-nums">{ghs(item.value)} <span className="text-slate-400">· {pct(ratio(item.value, total))}</span></span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="min-w-0 rounded-xl border border-white/10 bg-[#14232c] p-4 sm:p-5" aria-labelledby="physical-risk-concentrations">
          <h3 id="physical-risk-concentrations" className="text-lg font-semibold">Exposure concentrations</h3>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Group exposure by">
            {DIMENSIONS.map(({ key, label }) => (
              <button key={key} type="button" aria-pressed={dimension === key} onClick={() => { setDimension(key); setEvidencePage(0); }}
                className="rounded-md border border-slate-600 px-2.5 py-1 text-sm hover:border-lime-300 aria-pressed:border-lime-300 aria-pressed:bg-lime-300 aria-pressed:font-semibold aria-pressed:text-slate-950">{label}</button>
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-300">Top six by high-risk exposure. Amber shows high-risk exposure within each group’s total.</p>
          {!concentrations.length && <p className="mt-4 text-sm text-slate-300">No facilities match these filters.</p>}
          <div className="mt-3 space-y-3">
            {concentrations.map(([label, group]) => (
              <button key={label} type="button" aria-pressed={filters[dimension] === label}
                onClick={() => setFilter(dimension, filters[dimension] === label ? '' : label)}
                className="block w-full rounded-md px-1 text-left hover:bg-white/10 aria-pressed:ring-1 aria-pressed:ring-lime-300">
                <span className="flex flex-wrap justify-between gap-x-3 text-sm"><span className="font-medium">{label}</span><span className="tabular-nums">{ghs(group.high)} <span className="text-slate-400">/ {ghs(group.ead)}</span></span></span>
                <span aria-hidden="true" className="mt-1 block h-2 rounded-full bg-slate-700" style={{ width: pct(ratio(group.ead, total), 6) }}>
                  <span className="block h-full rounded-full bg-amber-300" style={{ width: pct(ratio(group.high, group.ead), 6) }} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-white/10 bg-[#14232c] p-4 sm:p-5 xl:col-span-2" aria-labelledby="physical-risk-facilities">
          <h3 id="physical-risk-facilities" className="text-lg font-semibold">Highest-scoring facilities</h3>
          {top.length ? <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead><tr className="border-b border-white/15 text-slate-300"><th scope="col" className="p-2 font-medium">Borrower</th><th scope="col" className="p-2 font-medium">Dominant hazard</th><th scope="col" className="p-2 text-right font-medium">Outstanding</th><th scope="col" className="p-2 text-right font-medium">Physical risk</th></tr></thead>
              <tbody>{top.map((row) => (
                <tr key={row.id} className="border-b border-white/10 last:border-0">
                  <td className="p-2"><Link href={{ pathname: '/physical', query: { borrower: row.borrowerId }, hash: 'borrower-risk' }} className="font-medium text-lime-200 underline underline-offset-4 hover:text-white">{row.borrower}</Link><span className="block text-slate-400">{row.id} · {row.region}</span></td>
                  <td className="p-2">{row.driver}</td><td className="p-2 text-right tabular-nums">{ghs(row.ead)}</td><td className="p-2 text-right font-semibold tabular-nums">{row.score.toFixed(2)} / 5</td>
                </tr>
              ))}</tbody>
            </table>
          </div> : <p className="mt-3 text-sm text-slate-300">No facilities match these filters.</p>}
        </section>
      </div>
      <p className="border-t border-white/10 px-5 py-4 text-sm text-slate-300 sm:px-7">Each facility contributes its outstanding exposure once. The highest-scoring site determines its score, region and dominant hazard. Scores include modelled regional hazards and legacy location proxies. <a href="#engine-ii-methodology" className="font-medium text-lime-200 underline underline-offset-4">How portfolio risk is calculated</a></p>
    </section>
  );
}
