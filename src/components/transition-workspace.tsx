'use client';

import { useMemo, useState } from 'react';
import { ghs, pct, to5 } from '@/lib/fmt';
import { normalizeTransitionIntensity, transitionScoreFromInputs, type TransitionScoreInputs } from '@/lib/transition-model';

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
interface SectorInputs { name: string; sensitivity: number; benchmark: number }
type ScoredFacility = Facility & { score: number };

const TABS = ['Assess borrower', 'Assess portfolio', 'Portfolio review', 'Borrower scores', 'Methodology & data'] as const;
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

function runTransition(facilities: Facility[]) {
  const rows = facilities.map((facility) => ({ ...facility, score: to5(transitionScoreFromInputs(facility.inputs, 1)) }));
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

export function TransitionWorkspace({ dataset, facilities, sectorInputs, planRelief }: {
  dataset: { name: string; id: string }; facilities: Facility[]; sectorInputs: SectorInputs[]; planRelief: number;
}) {
  const [tab, setTab] = useState<typeof TABS[number]>('Assess borrower');
  const [portfolio, setPortfolio] = useState<ReturnType<typeof runTransition> | null>(null);
  const [query, setQuery] = useState('');
  const [band, setBand] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<string>();
  const result = useMemo(() => runTransition(facilities), [facilities]);
  const totalEad = result.total;
  const term = query.trim().toLowerCase();
  const filtered = result.borrowers.filter((item) =>
    (!band || bandOf(item.score).label === band) &&
    (!sectorFilter || item.facilities.some(({ sector }) => sector === sectorFilter)) &&
    (!term || item.name.toLowerCase().includes(term) || item.facilities.some(({ id, sector, region }) =>
      [id, sector, region].some((value) => value.toLowerCase().includes(term)))));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const run = () => {
    setPortfolio(runTransition(facilities));
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
          {portfolio && <p role="status" className="rounded-lg border border-lime-400/40 bg-lime-300/10 px-3 py-2 text-sm text-lime-200">Portfolio assessed · {dataset.id}</p>}
        </div>
      </header>
      <nav aria-label="Transition workspace views" className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3 sm:px-7">
        {TABS.map((label) => <button key={label} type="button" aria-pressed={tab === label} onClick={() => setTab(label)}
          className="rounded-lg border border-transparent px-3 py-2 text-sm font-medium hover:border-slate-500 aria-pressed:bg-lime-300 aria-pressed:text-slate-950">{label}</button>)}
      </nav>

      <div className="p-4 sm:p-7">
        <div hidden={tab !== 'Assess borrower'}>
          <BorrowerAssessment borrowers={result.borrowers} sectorInputs={sectorInputs} planRelief={planRelief} />
        </div>

        {tab === 'Assess portfolio' && <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <form className={PANEL} onSubmit={(event) => { event.preventDefault(); run(); }}>
            <h3 className="text-xl font-semibold">Assess the entire loan portfolio</h3>
            <p className="mt-2 text-sm text-slate-300">Apply the same transition model to every facility in the active loan extract.</p>
            <p className="my-5 text-sm text-slate-200">{facilities.length.toLocaleString('en-GB')} facilities · {result.borrowers.length.toLocaleString('en-GB')} borrower profiles · {ghs(totalEad)} outstanding</p>
            <button className={ACTION} disabled={!facilities.length}>Calculate portfolio risk</button>
          </form>
          <section className={PANEL}>
            <h3 className="text-lg font-semibold">Portfolio scoring basis</h3>
            <p className="mt-3 text-sm text-slate-300">Each facility is scored using the recorded sector, emissions intensity and transition-plan status. The portfolio score weights those scores by outstanding exposure.</p>
          </section>
        </div>}

        {tab === 'Portfolio review' && !portfolio && (
          <div className={PANEL}><h3 className="text-lg font-semibold">Run a portfolio assessment to see results</h3>
            <button type="button" className={`mt-3 ${ACTION}`} onClick={() => setTab('Assess portfolio')}>Open portfolio assessment</button>
          </div>
        )}

        {tab === 'Portfolio review' && portfolio && <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ['Portfolio score', portfolio.score === null ? '—' : scoreText(portfolio.score), 'Outstanding exposure-weighted'],
              ['High-risk exposure', ghs(portfolio.high), `${pct(share(portfolio.high, portfolio.total))} of EAD · score ≥ 3.00`],
              ['Exposure with a transition plan', pct(share(portfolio.planCoverage, portfolio.total)), `${ghs(portfolio.planCoverage)} flagged in loan data`],
              ['Readiness gap', ghs(portfolio.planGap), 'Sensitive sectors · no plan recorded'],
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
                {portfolio.bands.map((bucket) => <div key={bucket.label} className={bucket.color} style={{ width: pct(share(bucket.ead, portfolio.total), 6) }} />)}
              </div>
              <ul className="space-y-1">
                {portfolio.bands.map((bucket) => <li key={bucket.label} className="flex flex-wrap justify-between gap-x-3 py-1.5 text-sm">
                  <span className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${bucket.color}`} />{bucket.label} <span className="text-slate-400">{bucket.range}</span></span>
                  <span className="tabular-nums">{ghs(bucket.ead)} · {pct(share(bucket.ead, portfolio.total))}</span>
                </li>)}
              </ul>
              <button type="button" className={`mt-4 ${SECONDARY}`} onClick={() => openBorrowers('')}>Review borrower scores</button>
            </section>
            <section className={PANEL}>
              <h3 className="text-lg font-semibold">Sector concentrations</h3>
              <p className="mt-1 text-sm text-slate-300">Ranked by high-risk exposure, then total outstanding.</p>
              <div className="mt-3 max-h-72 overflow-y-auto pr-1">
                {portfolio.sectors.map(([sector, group]) => <button key={sector} type="button"
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

        {tab === 'Borrower scores' && <section className={PANEL}>
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
                {item.facilities.map((facility) => <FacilityCalculation key={facility.id} facility={facility} />)}
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
              <li>Raw facility score = sector sensitivity × (0.6 + 0.4 × normalized intensity) × (1 − plan relief). A recorded plan applies {pct(planRelief, 0)} relief and all other facilities receive zero relief.</li>
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
              <div><dt className="font-semibold text-lime-200">New borrower inputs</dt><dd>Use the borrower’s annual emissions divided by annual revenue in GHS millions, on a consistent reporting basis. Record the source and reporting period where available. A recorded plan applies the illustrative relief.</dd></div>
              <div><dt className="font-semibold text-lime-200">Result scope</dt><dd>These indicative assessments use the disclosed inputs and model parameters. New borrower inputs and results stay in this page session. The portfolio assessment covers facilities in the active extract.</dd></div>
            </dl>
          </section>
        </div>}
      </div>
    </section>
  );
}


function FacilityCalculation({ facility, prospective }: { facility: ScoredFacility; prospective?: boolean }) {
  const { inputs } = facility;
  return (
    <section className="rounded-lg border border-white/10 bg-[#0e1c23] p-4">
      <h4 className="font-semibold">{prospective ? facility.sector : `${facility.id} · ${facility.sector} · ${facility.region}`}</h4>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
        {[
          ...(!prospective ? [['Outstanding exposure', ghs(facility.ead)]] : []),
          ['Sector sensitivity', inputs.sensitivity.toFixed(3)],
          ['Borrower emissions intensity', facility.emissionsIntensity.toLocaleString('en-GB')],
          ['Sector emissions benchmark', inputs.sectorBenchmark.toLocaleString('en-GB')],
          ['Normalized intensity', inputs.intensity.toFixed(3)],
          ['Transition plan', facility.plan ? 'Recorded' : 'None recorded'],
          ['Plan relief', pct(inputs.relief, 0)],
        ].map(([label, value]) => <div key={label}><dt className="text-slate-400">{label}</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}
      </dl>
      <p className="mt-3 break-words text-sm text-lime-200">1 + 4 × clamp({inputs.sensitivity.toFixed(3)} × (0.6 + 0.4 × {inputs.intensity.toFixed(3)}) × (1 − {inputs.relief.toFixed(2)})) ≈ {scoreText(facility.score)}</p>
      <p className="mt-1 text-xs text-slate-400">Emissions intensity and benchmark in tCO₂e per GHS million of revenue.</p>
    </section>
  );
}

function BorrowerAssessment({ borrowers, sectorInputs, planRelief }: {
  borrowers: ReturnType<typeof runTransition>['borrowers']; sectorInputs: SectorInputs[]; planRelief: number;
}) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [existing, setExisting] = useState('');
  const [search, setSearch] = useState('');
  const [assessedExisting, setAssessedExisting] = useState('');
  const [assessment, setAssessment] = useState<{ facility: ScoredFacility; source: string }>();
  const existingResult = borrowers.find((item) => item.id === assessedExisting);
  const visibleBorrowers = borrowers.filter((item) => {
    const term = search.trim().toLowerCase();
    return !term || item.name.toLowerCase().includes(term) || item.facilities.some((facility) => facility.id.toLowerCase().includes(term));
  }).sort((a, b) => a.name.localeCompare(b.name));

  return <div className="space-y-4">
    <section className={PANEL}>
      <h3 className="text-xl font-semibold">Borrower transition assessment</h3>
      <div className="my-4 flex flex-wrap gap-2" role="group" aria-label="Borrower type">
        {(['existing', 'new'] as const).map((item) => <button key={item} type="button"
          className={`${SECONDARY} aria-pressed:border-lime-300 aria-pressed:text-lime-200`}
          aria-pressed={mode === item} onClick={() => setMode(item)}>{item === 'existing' ? 'Existing borrower' : 'New borrower'}</button>)}
      </div>
      <form hidden={mode !== 'existing'} onSubmit={(event) => { event.preventDefault(); setAssessedExisting(existing); }}>
          <p className="mb-3 text-sm text-slate-300">Search the active loan extract. The assessment scores each of the borrower’s facilities.</p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-sm">Find by borrower name or facility ID
              <input className={SELECT} type="search" value={search} onChange={(event) => { setSearch(event.target.value); setExisting(''); setAssessedExisting(''); }} />
            </label>
            <label className="min-w-0 text-sm">Borrower profile
              <select className={SELECT} required value={existing} onChange={(event) => { setExisting(event.target.value); setAssessedExisting(''); }}>
                <option value="">Select a profile</option>
                {visibleBorrowers.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.facilities[0].id}</option>)}
              </select>
            </label>
          </div>
          {!visibleBorrowers.length && <p className="mb-3 text-sm text-slate-300">No profiles match your search.</p>}
          <button className={ACTION} disabled={!existing}>Calculate existing borrower score</button>
        </form>
        <form hidden={mode !== 'new'} onChange={() => setAssessment(undefined)} onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const sector = sectorInputs.find((item) => item.name === form.get('sector'));
          const borrower = String(form.get('borrower') ?? '').trim();
          const rawIntensity = String(form.get('intensity') ?? '');
          const emissionsIntensity = Number(rawIntensity);
          if (!sector || !borrower || !rawIntensity || !Number.isFinite(emissionsIntensity) || emissionsIntensity < 0) return;
          const plan = form.get('plan') === 'yes';
          const inputs = {
            sensitivity: sector.sensitivity, sectorBenchmark: sector.benchmark,
            intensity: normalizeTransitionIntensity(emissionsIntensity, sector.benchmark), relief: plan ? planRelief : 0,
          };
          const facility = {
            id: 'prospective', borrowerId: 'prospective', borrower, sector: sector.name, region: '', ead: 0, emissionsIntensity, plan, inputs,
            score: to5(transitionScoreFromInputs(inputs, 1)),
          };
          setAssessment({ facility, source: String(form.get('source') ?? '').trim() });
        }}>
          <p className="mb-3 text-sm text-slate-300">Enter the borrower’s information to assess a prospective facility. The result stays in this session.</p>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-sm">Borrower name<input className={SELECT} name="borrower" required pattern=".*\S.*" /></label>
            <label className="min-w-0 text-sm">Sector<select className={SELECT} name="sector" required defaultValue=""><option value="">Select a sector</option>{sectorInputs.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
            <label className="min-w-0 text-sm">Emissions intensity (tCO₂e per GHS million of revenue)<input className={SELECT} name="intensity" type="number" min="0" step="any" required /></label>
            <label className="min-w-0 text-sm">Transition plan<select className={SELECT} name="plan" required defaultValue=""><option value="">Select plan status</option><option value="yes">Recorded</option><option value="no">None recorded</option></select></label>
            <label className="min-w-0 text-sm sm:col-span-2">Emissions evidence and reporting period (optional)<input className={SELECT} name="source" /></label>
          </div>
          <button className={ACTION}>Calculate new borrower score</button>
        </form>
    </section>
    {mode === 'existing' && existingResult && <section className={PANEL} aria-live="polite">
      <h3 className="text-lg font-semibold">{existingResult.name}</h3>
      <p className="my-2 text-2xl font-semibold text-lime-300">{scoreText(existingResult.score)} · {bandOf(existingResult.score).label}</p>
      <p className="mb-4 text-sm text-slate-300">Highest facility score · active loan extract</p>
      <div className="space-y-3">{existingResult.facilities.map((facility) => <FacilityCalculation key={facility.id} facility={facility} />)}</div>
    </section>}
    {mode === 'new' && assessment && <section className={PANEL} aria-live="polite">
      <h3 className="text-lg font-semibold">{assessment.facility.borrower}</h3>
      <p className="my-2 text-2xl font-semibold text-lime-300">{scoreText(assessment.facility.score)} · {bandOf(assessment.facility.score).label}</p>
      <p className="mb-4 text-sm text-slate-300">User-entered inputs · {assessment.source || 'Evidence reference not supplied'}</p>
      <FacilityCalculation facility={assessment.facility} prospective />
    </section>}
  </div>;
}
