'use client';

import { useMemo, useState } from 'react';
import { ghs, pct, to5 } from '@/lib/fmt';
import { transitionScoreFromInputs, type TransitionScoreInputs } from '@/lib/transition-model';
import type { Horizon, Scenario } from '@/lib/params';

interface Facility {
  id: string;
  borrowerId: string;
  borrower: string;
  sector: string;
  region: string;
  ead: number;
  emissionsIntensity: number;
  plan: boolean;
  inputs: TransitionScoreInputs;
}
interface Selection { scenario: Scenario['key']; horizon: Horizon }

const TABS = ['Run scenario', 'Portfolio review', 'Borrower scores', 'Methodology & data'] as const;
const BANDS = [
  { label: 'Low', max: 2, color: 'bg-lime-400', range: '1.00 to < 2.00' },
  { label: 'Moderate', max: 3, color: 'bg-teal-400', range: '2.00 to < 3.00' },
  { label: 'High', max: 4, color: 'bg-amber-400', range: '3.00 to < 4.00' },
  { label: 'Very high', max: Infinity, color: 'bg-rose-400', range: '4.00 to 5.00' },
] as const;
const HIGH_RISK = 3;
const PAGE_SIZE = 20;
const SELECT = 'mt-1 block w-full min-w-0 rounded-lg border border-slate-500 bg-[#14242a] px-3 py-2 text-white focus-visible:outline-2 focus-visible:outline-lime-300';
const ACTION = 'rounded-lg bg-lime-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-lime-200 disabled:opacity-50';
const SECONDARY = 'rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium hover:border-lime-300 disabled:opacity-40';
const PANEL = 'min-w-0 rounded-xl border border-white/10 bg-[#14242a] p-4 sm:p-5';
const bandOf = (score: number) => BANDS.find((band) => score < band.max)!;
const scoreText = (score: number) => `${score.toFixed(2)} / 5`;
const share = (exposure: number, total: number) => total ? exposure / total : 0;

function runTransition(facilities: Facility[], shock: number) {
  const rows = facilities.map((facility) => ({ ...facility, score: to5(transitionScoreFromInputs(facility.inputs, shock)) }));
  const borrowers = new Map<string, { id: string; name: string; ead: number; score: number; facilities: typeof rows }>();
  const sectors = new Map<string, { ead: number; weighted: number; high: number }>();
  let total = 0, weighted = 0, high = 0, planCoverage = 0, planGap = 0;
  for (const facility of rows) {
    const { ead, score, plan, sector, borrowerId, borrower } = facility;
    total += ead;
    weighted += ead * score;
    high += score >= HIGH_RISK ? ead : 0;
    planCoverage += plan ? ead : 0;
    planGap += !plan && facility.inputs.sensitivity >= 0.5 ? ead : 0;
    const group = borrowers.get(borrowerId) ?? { id: borrowerId, name: borrower, ead: 0, score: 0, facilities: [] };
    group.ead += ead;
    group.score = Math.max(group.score, score);
    group.facilities.push(facility);
    borrowers.set(borrowerId, group);
    const bucket = sectors.get(sector) ?? { ead: 0, weighted: 0, high: 0 };
    bucket.ead += ead;
    bucket.weighted += score * ead;
    bucket.high += score >= HIGH_RISK ? ead : 0;
    sectors.set(sector, bucket);
  }
  return {
    total, score: total ? weighted / total : null, high, planCoverage, planGap,
    bands: BANDS.map((band) => ({ ...band, ead: rows.filter((row) => bandOf(row.score).label === band.label).reduce((sum, row) => sum + row.ead, 0) })),
    sectors: [...sectors].sort(([, a], [, b]) => b.high - a.high || b.ead - a.ead),
    borrowers: [...borrowers.values()].sort((a, b) => b.score - a.score || b.ead - a.ead),
  };
}

export function TransitionWorkspace({ dataset, facilities, scenarios, horizons, planRelief }: {
  dataset: { name: string; id: string }; facilities: Facility[]; scenarios: Scenario[]; horizons: readonly Horizon[]; planRelief: number;
}) {
  const [tab, setTab] = useState<typeof TABS[number]>('Run scenario');
  const [draft, setDraft] = useState<Selection>({ scenario: 'delayed', horizon: 2050 });
  const [active, setActive] = useState<Selection | null>(null);
  const [query, setQuery] = useState('');
  const [band, setBand] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string>();
  const selected = scenarios.find((item) => item.key === draft.scenario)!;
  const scenario = active ? scenarios.find((item) => item.key === active.scenario)! : null;
  const shock = active && scenario ? scenario.transitionShock[active.horizon] : null;
  const result = useMemo(() => shock === null ? null : runTransition(facilities, shock), [facilities, shock]);
  const totalEad = useMemo(() => facilities.reduce((sum, item) => sum + item.ead, 0), [facilities]);
  const term = query.trim().toLowerCase();
  const filtered = result?.borrowers.filter((item) =>
    (!band || bandOf(item.score).label === band) &&
    (!sectorFilter || item.facilities.some(({ sector }) => sector === sectorFilter)) &&
    (!term || item.name.toLowerCase().includes(term) || item.facilities.some(({ id, sector, region }) =>
      [id, sector, region].some((value) => value.toLowerCase().includes(term))))) ?? [];
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const run = () => {
    setActive(draft);
    setExpanded(undefined);
    setPage(0);
    setTab('Portfolio review');
  };
  const openBorrowers = (sector: string) => {
    setBand('');
    setSectorFilter(sector);
    setQuery('');
    setPage(0);
    setTab('Borrower scores');
  };

  return (
    <section aria-label="Transition analysis" className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0c1920] text-slate-100 shadow-lg">
      <header className="border-b border-white/10 bg-gradient-to-br from-[#223b32] via-[#14272a] to-[#0c1920] p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-lime-300">{facilities.length.toLocaleString('en-GB')} facilities · {ghs(totalEad)} outstanding</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{dataset.name}</h2>
          </div>
          {active && scenario && <p role="status" className="rounded-lg border border-lime-400/40 bg-lime-300/10 px-3 py-2 text-sm text-lime-200">{scenario.name} · {active.horizon} · shock {shock?.toFixed(2)}</p>}
        </div>
      </header>
      <nav aria-label="Transition workspace views" className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3 sm:px-7">
        {TABS.map((label) => <button key={label} type="button" aria-pressed={tab === label} onClick={() => setTab(label)}
          className="rounded-lg border border-transparent px-3 py-2 text-sm font-medium hover:border-slate-500 aria-pressed:bg-lime-300 aria-pressed:text-slate-950">{label}</button>)}
      </nav>

      <div className="p-4 sm:p-7">
        {tab === 'Run scenario' && <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <form className={PANEL} onSubmit={(event) => { event.preventDefault(); run(); }}>
            <h3 className="text-xl font-semibold">Run portfolio transition risk</h3>
            <p className="mt-1 text-sm text-slate-300">Choose a pathway and horizon to score every facility in the active loan book.</p>
            <div className="my-5 grid gap-3 sm:grid-cols-[2fr_1fr]">
              <label className="min-w-0 text-sm">Scenario<select className={SELECT} value={draft.scenario}
                onChange={(event) => setDraft({ ...draft, scenario: event.target.value as Selection['scenario'] })}>
                {scenarios.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
              </select></label>
              <label className="text-sm">Horizon<select className={SELECT} value={draft.horizon}
                onChange={(event) => setDraft({ ...draft, horizon: Number(event.target.value) as Horizon })}>
                {horizons.map((year) => <option key={year}>{year}</option>)}
              </select></label>
            </div>
            <button className={ACTION} disabled={!facilities.length}>Run transition analysis</button>
          </form>
          <section className={PANEL}>
            <h3 className="text-lg font-semibold">Selected scenario assumptions</h3>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-lime-300">{selected.transitionShock[draft.horizon].toFixed(2)}</p>
            <p className="text-sm text-slate-300">Transition shock multiplier · {selected.family}</p>
            <p className="mt-4 text-sm text-slate-300">The multiplier is an illustrative model parameter for this pathway and horizon. Results reflect the loan book currently loaded.</p>
          </section>
        </div>}

        {(tab === 'Portfolio review' || tab === 'Borrower scores') && !result && (
          <div className={PANEL}><h3 className="text-lg font-semibold">Run a scenario to see results</h3>
            <button type="button" className={`mt-3 ${ACTION}`} onClick={() => setTab('Run scenario')}>Choose a scenario</button>
          </div>
        )}

        {tab === 'Portfolio review' && result && <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Portfolio score', result.score === null ? '—' : scoreText(result.score), 'Outstanding exposure-weighted'],
              ['High-risk exposure', ghs(result.high), `${pct(share(result.high, result.total))} of EAD · score ≥ 3.00`],
              ['Exposure with a transition plan', pct(share(result.planCoverage, result.total)), `${ghs(result.planCoverage)} flagged in loan data`],
              ['Readiness gap', ghs(result.planGap), 'Sensitive sectors · no plan recorded'],
            ].map(([label, value, detail]) => <div key={label} className={PANEL}>
              <p className="text-sm text-slate-300">{label}</p>
              <p className="my-2 text-2xl font-semibold tabular-nums text-lime-300">{value}</p>
              <p className="text-sm text-slate-300">{detail}</p>
            </div>)}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className={PANEL}>
              <h3 className="text-lg font-semibold">Exposure by facility risk band</h3>
              <div className="my-4 flex h-4 overflow-hidden rounded-full bg-slate-700" aria-hidden="true">
                {result.bands.map((bucket) => <div key={bucket.label} className={bucket.color} style={{ width: pct(share(bucket.ead, result.total), 6) }} />)}
              </div>
              <ul className="space-y-1">
                {result.bands.map((bucket) => <li key={bucket.label} className="flex flex-wrap justify-between gap-x-3 py-1.5 text-sm">
                  <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${bucket.color}`} />{bucket.label} <span className="text-slate-400">{bucket.range}</span></span>
                  <span className="tabular-nums">{ghs(bucket.ead)} · {pct(share(bucket.ead, result.total))}</span>
                </li>)}
              </ul>
              <button type="button" className={`mt-4 ${SECONDARY}`} onClick={() => openBorrowers('')}>Review borrower scores</button>
            </section>
            <section className={PANEL}>
              <h3 className="text-lg font-semibold">Sector concentrations</h3>
              <p className="mt-1 text-sm text-slate-300">Ranked by high-risk exposure, then total outstanding.</p>
              <div className="mt-3 max-h-72 overflow-y-auto pr-1">
                {result.sectors.map(([sector, group]) => <button key={sector} type="button"
                  onClick={() => openBorrowers(sector)}
                  className="block w-full rounded-md px-1 py-2 text-left hover:bg-white/10">
                  <span className="flex flex-wrap justify-between gap-x-2 text-sm"><span className="font-medium text-lime-200">{sector}</span>
                    <span className="tabular-nums">{ghs(group.high)} high-risk · {scoreText(group.weighted / group.ead)}</span></span>
                  <span className="mt-1 block h-1.5 rounded-full bg-slate-700" aria-hidden="true"><span className="block h-full rounded-full bg-amber-300" style={{ width: pct(share(group.high, group.ead), 6) }} /></span>
                  <span className="mt-1 block text-xs text-slate-400">{ghs(group.ead)} outstanding</span>
                </button>)}
              </div>
            </section>
          </div>
        </>}

        {tab === 'Borrower scores' && result && <section className={PANEL}>
          <h3 className="text-xl font-semibold">Borrower transition scores</h3>
          <p className="mt-1 text-sm text-slate-300">Open a borrower to see the inputs and calculation for each facility.</p>
          <div className="my-4 grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
            <label className="text-sm">Search borrowers, facilities, sectors or regions
              <input type="search" className={SELECT} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
            </label>
            <label className="min-w-0 text-sm">Facility sector
              <select className={SELECT} value={sectorFilter} onChange={(event) => { setSectorFilter(event.target.value); setPage(0); }}>
                <option value="">All sectors</option>{[...result.sectors].sort(([a], [b]) => a.localeCompare(b)).map(([sector]) => <option key={sector}>{sector}</option>)}
              </select>
            </label>
            <label className="text-sm">Borrower risk band
              <select className={SELECT} value={band} onChange={(event) => { setBand(event.target.value); setPage(0); }}>
                <option value="">All risk bands</option>{BANDS.map((item) => <option key={item.label}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <p role="status" className="mb-3 text-sm text-slate-300">{filtered.length.toLocaleString('en-GB')} of {result.borrowers.length.toLocaleString('en-GB')} borrower profiles</p>
          {!filtered.length && <p className="text-sm text-slate-300">No borrower profiles match the current filters.</p>}
          <div className="divide-y divide-white/10">
            {filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item) => <div key={item.id}>
              <button type="button" aria-expanded={expanded === item.id} onClick={() => setExpanded(expanded === item.id ? undefined : item.id)}
                className="flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md px-2 py-3 text-left hover:bg-white/10">
                <span><span className="block font-semibold text-lime-200">{item.name}</span>
                  <span className="text-sm text-slate-400">{item.facilities.map(({ id }) => id).join(', ')} · {ghs(item.ead)}</span></span>
                <span className="text-sm font-semibold tabular-nums">{scoreText(item.score)} · {bandOf(item.score).label}</span>
              </button>
              {expanded === item.id && <div className="mb-4 space-y-3">
                {item.facilities.map((facility) => <section key={facility.id} className="rounded-lg border border-white/10 bg-[#0e1c23] p-4">
                  <h4 className="font-semibold">{facility.id} · {facility.sector} · {facility.region}</h4>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Outstanding exposure', ghs(facility.ead)], ['Sector sensitivity', facility.inputs.sensitivity.toFixed(3)],
                      ['Borrower emissions intensity', facility.emissionsIntensity.toLocaleString('en-GB')], ['Sector emissions benchmark', facility.inputs.sectorBenchmark.toLocaleString('en-GB')],
                      ['Normalized intensity', facility.inputs.intensity.toFixed(3)], ['Transition plan', facility.plan ? 'Recorded' : 'None recorded'],
                      ['Plan relief', pct(facility.inputs.relief, 0)], ['Scenario shock', shock?.toFixed(2)],
                    ].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}
                  </dl>
                  <p className="mt-3 break-words text-sm text-lime-200">1 + 4 × clamp({facility.inputs.sensitivity.toFixed(3)} × {shock?.toFixed(2)} × (0.6 + 0.4 × {facility.inputs.intensity.toFixed(3)}) × (1 − {facility.inputs.relief.toFixed(2)})) ≈ {scoreText(facility.score)}</p>
                </section>)}
              </div>}
            </div>)}
          </div>
          {pageCount > 1 && <nav aria-label="Borrower pages" className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <button type="button" className={SECONDARY} disabled={page === 0} onClick={() => { setPage(page - 1); setExpanded(undefined); }}>Previous</button>
            <span>Page {page + 1} of {pageCount}</span>
            <button type="button" className={SECONDARY} disabled={page + 1 >= pageCount} onClick={() => { setPage(page + 1); setExpanded(undefined); }}>Next</button>
          </nav>}
        </section>}

        {tab === 'Methodology & data' && <div className="grid gap-4 lg:grid-cols-2">
          <section className={PANEL}>
            <h3 className="text-lg font-semibold">How scores are calculated</h3>
            <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm text-slate-200">
              <li>Normalized intensity = borrower emissions intensity ÷ (1.4 × sector benchmark), limited to 0–1.</li>
              <li>Raw facility score = sector sensitivity × scenario shock × (0.6 + 0.4 × normalized intensity) × (1 − plan relief). A recorded plan applies {pct(planRelief, 0)} relief and all other facilities receive zero relief.</li>
              <li>Facility score = 1 + 4 × raw score limited to 0–1. Calculations use full precision before display rounding.</li>
              <li>Borrower score = highest facility score for that borrower ID. Facilities without an ID appear as separate profiles to avoid grouping different borrowers by name.</li>
              <li>Portfolio score = sum of facility score × facility outstanding exposure ÷ total outstanding exposure. Each facility contributes once. Exposure bands use facility scores.</li>
            </ol>
          </section>
          <section className={PANEL}>
            <h3 className="text-lg font-semibold">Data and assumptions</h3>
            <dl className="mt-3 space-y-3 text-sm text-slate-200">
              <div><dt className="font-semibold text-lime-200">Active loan extract · {dataset.id}</dt><dd>Borrower and facility IDs, sector, region, outstanding exposure, emissions intensity and transition-plan flag. The supplied demo extract is synthetic.</dd></div>
              <div><dt className="font-semibold text-lime-200">Model sector parameters</dt><dd>Illustrative sensitivity and emissions benchmarks. Both emissions intensity inputs are in tonnes of CO₂e per GHS million of revenue. The plan flag drives model relief.</dd></div>
              <div><dt className="font-semibold text-lime-200">Scenario parameters</dt><dd>The application assigns illustrative transition shocks by NGFS pathway and horizon. Scenario names identify the pathway. The shock is an internal coefficient. <a className="underline" href="/calibration">Ghana calibration</a></dd></div>
              <div><dt className="font-semibold text-lime-200">Result scope</dt><dd>The workspace calculates scenario scores from the active extract. Approved Engine I assessments can be reviewed separately in the borrower’s climate risk profile. Run results are kept for this page session.</dd></div>
            </dl>
          </section>
        </div>}
      </div>
    </section>
  );
}
