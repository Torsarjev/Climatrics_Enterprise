import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SCENARIOS, ScenarioKey, scenarioOf } from '@/lib/params';
import { CALIBRATION_VERSION, REGRESSION_VERSION, DEFAULT_CALIBRATION, NGFS_REGION, NGFS_RELEASE, SSP_FOR, VARIABLES, activeCalibration, calibrationMethod, calibrationRows, evidence, hazardChange, wdiRegression, type Variable } from '@/lib/calibration';
import { GCB_PATHWAYS } from '@/lib/gcb-scenarios';
import { currentUser, db } from '@/lib/store';
import { CalibrationDecision, CalibrationForm } from '@/components/calibration-form';
import { ghs, when } from '@/lib/fmt';
import { CCKP } from '@/data/cckp';
import { WORLD_BANK } from '@/data/worldbank';
import { Badge, Card, PageHead, Table } from '@/components/ui';
import { CalibrationChart } from '@/components/calibration-chart';

export const dynamic = 'force-dynamic';

const fmt = (v: number, unit: string) => (unit.startsWith('US$') ? `$${v.toFixed(0)}` : unit.startsWith('×') ? `×${v.toFixed(2)}` : `${v > 0 ? '+' : ''}${v.toFixed(2)}${unit.startsWith('%') ? '%' : ' pp'}`);

export default async function CalibrationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, data, user] = await Promise.all([searchParams, db(), currentUser()]);
  const { scenario, run, version } = params;
  const saved = typeof run === 'string' ? data.runs.find((entry) => entry.id === run) : undefined;
  const active = activeCalibration(data.calibration);
  const id = saved ? saved.input.calibration?.id : typeof version === 'string' ? version : active.id;
  const execution = id ? data.calibrationExecutions?.find((entry) => entry.profile.id === id) : undefined;
  if ((run && !saved) || (version && !execution)) notFound();
  const key = saved?.input.scenario ?? (SCENARIOS.some((s) => s.key === scenario) ? scenario as ScenarioKey : 'delayed');
  const profile = saved ? saved.input.calibration : execution?.profile ?? active;
  const settings = profile?.settings ?? DEFAULT_CALIBRATION;
  const rows = execution ? execution.evidence.calibratedResults.filter((row) => row.scenarioKey === key) : calibrationRows(key, profile);
  const ev = [evidence('gdp', settings), evidence('inflation', settings)];
  const mayRun = user.can.includes('run' as never);
  const query = new URLSearchParams(saved ? { run: saved.id } : execution ? { version: execution.profile.id } : {});
  const path = (base: string, extra: Record<string, string>) => `${base}?${new URLSearchParams([...query, ...Object.entries(extra)])}`;
  const snapshot = execution?.evidence.diagnostics;
  const fits = snapshot && !Array.isArray(snapshot) ? snapshot : undefined;
  const isRegression = profile?.method === REGRESSION_VERSION;
  const regression = isRegression ? [
    ['GDP', fits?.gdp.fit ?? wdiRegression('gdp', settings.start, settings.end).fit],
    ['Inflation', fits?.inflation.fit ?? wdiRegression('inflation', settings.start, settings.end).fit],
    ['Long-term rate', execution?.rateEvidence?.fit],
  ] as const : undefined;
  return (
    <>
      <PageHead area="Engine III · Ghana scenario calibration" title="Ghana-calibrated NGFS scenarios" intro="Translate regional NGFS scenarios into Ghana stress inputs. Recalculate the local coefficients, review each reporting year and activate a calibration for top-down and bottom-up stress tests.">
        <a href={path('/api/calibration', { format: 'csv' })} className="rounded-md px-3 py-2 text-sm ring-1 ring-zinc-300">Download calibrated CSV</a>
        <a href={path('/api/calibration', { format: 'json' })} className="rounded-md px-3 py-2 text-sm ring-1 ring-zinc-300">Download source data &amp; evidence</a>
      </PageHead>

      <Card title={saved ? 'Calibration used in this run' : 'Configure Ghana calibration'} className="mb-6 border-lime-300">
        <p className="mb-4 text-sm text-zinc-700">Active in Scenario Analysis · {active.id} {active.activatedAt && `· ${active.activatedBy} · ${when(active.activatedAt)}`}</p>
        {saved ? (
          <p className="text-sm"><Link className="underline" href={`/runs/${saved.id}`}>{saved.id}</Link> used {profile?.id ?? CALIBRATION_VERSION} · Rate ×{settings.rate.toFixed(4)} · Carbon ×{settings.carbon}. <Link href="/calibration" className="underline">Open active calibration</Link></p>
        ) : mayRun && <CalibrationForm start={settings.start} end={settings.end} />}
        <Link href="/stress" className="mt-4 inline-block text-sm font-medium underline">Open Scenario Analysis</Link>
      </Card>

      {execution && <Card title="Calibration review" className="mb-6 border-lime-300" note={<Badge tone={execution.decision?.action === 'activate' ? 'green' : 'amber'}>{execution.decision?.action === 'activate' ? (active.id === execution.profile.id ? 'Active' : 'Previously activated') : execution.decision?.action === 'decline' ? 'Declined' : 'Awaiting decision'}</Badge>}>
        <p className="break-words text-sm">{execution.profile.id} · {execution.profile.method} · {execution.createdBy} · {when(execution.createdAt)}</p>
        <p className="mt-2 text-sm">{execution.dataset.name} · {execution.dataset.id} · {execution.dataset.facilities.toLocaleString()} facilities · compared with {execution.comparison.id}</p>
        {execution.decision && <p className="mt-2 text-sm">Decision by {execution.decision.by} on {when(execution.decision.at)}{execution.decision.note ? ` · ${execution.decision.note}` : ''}</p>}
        <a href={path('/api/calibration', { format: 'review' })} className="my-3 inline-block text-sm font-medium underline">Download review document</a>
        <Table head={['Pathway', 'Year', 'Approach', 'Unstressed ECL', 'Active stressed ECL', 'Candidate stressed ECL', 'Change vs active']}
          rows={execution.preview.filter((row) => row.scenario === key).map((row) => [scenarioOf(row.scenario).name, row.year, row.approach, ghs(row.baselineEcl), ghs(row.activeEcl), ghs(row.candidateEcl), ghs(row.candidateEcl - row.activeEcl)])} />
        <p className="mt-2 text-sm text-zinc-600">Both calibrations stress the same loan book independently in each reporting year. These previews are separate from scenario runs.</p>
        <details className="my-3 text-sm">
          <summary className="cursor-pointer font-medium">Compare scenario inputs with the active calibration at execution</summary>
          <Table head={['Year', 'Input', 'Active', 'Candidate']} rows={execution.preview.filter((row) => row.scenario === key && row.approach === 'top-down').flatMap((row) =>
            (['gdp', 'inflation', 'rate', 'carbon', 'flood', 'physical'] as const).map((v) =>
              [row.year, VARIABLES[v].label, fmt(row.activeShocks[v], VARIABLES[v].unit), fmt(row.candidateShocks[v], VARIABLES[v].unit)]))} />
        </details>
        {!saved && mayRun && !execution.decision && <CalibrationDecision id={execution.profile.id} stale={active.id !== execution.comparison.id || data.activeDataset !== execution.dataset.id} />}
      </Card>}

      {regression && <Card title="Regression coefficients" className="mb-6">
        <Table head={['Variable', 'Applied coefficient', 'OLS intercept (pp)', 'R²', 'Slope std. error', 'Annual changes']}
          rows={regression.map(([label, fit], index) => {
            const coefficient = profile!.coefficients[(['gdp', 'inflation', 'rate'] as const)[index]];
            return [label, fit ? coefficient.toFixed(4) : profile!.rateBasis === 'regional' ? '1.0000 · regional' : coefficient.toFixed(4),
              fit?.alpha.toFixed(4) ?? '—', fit?.r2?.toFixed(3) ?? '—', fit?.standardError.toFixed(4) ?? '—', fit?.n ?? '—'];
          })} />
        {execution?.rateEvidence && <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">View matched rate observations</summary>
          <p className="my-2">{execution.rateEvidence.source}</p>
          <Table head={['Year', 'Ghana (%)', 'Regional (%)']} rows={execution.rateEvidence.sample.map(({year, ghana, regional}) => [year, ghana, regional])} />
        </details>}
      </Card>}

      <Card title="Calibration history" className="mb-6">
        <Table head={['Version', 'Executed', 'Analyst', 'Loan book', 'Decision']} rows={(data.calibrationExecutions ?? []).map((entry) => [
          <Link key="version" href={`/calibration?version=${entry.profile.id}`} className="underline">{entry.profile.id}</Link>,
          when(entry.createdAt), entry.createdBy, entry.dataset.id, entry.decision?.action === 'activate' ? 'Activated' : entry.decision?.action === 'decline' ? 'Declined' : 'Awaiting decision',
        ])} />
        {!data.calibrationExecutions?.length && <p className="mt-2 text-sm text-zinc-600">Run a regression to create the first review record.</p>}
      </Card>

      <Card title="Method">
        <p className="rounded-md bg-zinc-50 px-3 py-2 font-mono text-sm">Calibrated Ghana shock = NGFS regional shock × Ghana sensitivity coefficient</p>
        <p className="mt-3 text-sm text-zinc-700">{isRegression ? <>For GDP and inflation, ordinary least squares estimates the slope of Ghana’s annual changes on Sub-Saharan Africa’s annual changes. A rate upload uses the same method on matched long-term yields. Only the fitted slope scales the NGFS shock, so a zero regional shock stays zero. The intercept, R² and standard error describe the historical fit. A signed slope can reverse a shock, so review the preview and fit before activating. Ghana’s historical co-movement is an empirical proxy for scenario transmission.</> : <>For GDP and inflation the coefficient is <b>σ(year-on-year change in Ghana) ÷ σ(year-on-year change in Sub-Saharan Africa)</b>, estimated on World Bank data for {ev[0].from}–{ev[0].to}. The ratio scales the magnitude of the regional shocks and preserves their sign. The regression slope and R² are diagnostics.</>} GDP uses the change in the interpolated deviation over up to five years, with 2025 as the earliest starting point. Other macro and carbon values use the selected reporting year.</p>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm md:grid-cols-3">
          <div><dt className="text-zinc-500">NGFS release</dt><dd>{NGFS_RELEASE}</dd></div>
          <div><dt className="text-zinc-500">Region</dt><dd>{NGFS_REGION}</dd></div>
          <div><dt className="text-zinc-500">Calibration version</dt><dd>{profile?.id ?? CALIBRATION_VERSION} · <Badge tone="amber">NGFS data · coefficients pending validation</Badge></dd></div>
        </dl>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {ev.map((e) => {
          const s = WORLD_BANK.series[e.key];
          const sample = s.years.flatMap((year, index) => year >= e.from && year <= e.to ? [[year, s.ghana[index], s.ssa[index]]] : []);
          return (
            <Card key={e.key} title={`Source data · ${e.key === 'gdp' ? 'GDP' : 'Inflation'}`} note={`World Bank ${e.indicator}`}>
              <CalibrationChart years={sample.map(([year]) => year)} ghana={sample.map(([, value]) => value)} ssa={sample.map(([, , value]) => value)} unit="%" />
              {!isRegression && <Table head={['Measure', 'Value']} align={['l', 'r']} rows={[
                ['σ of year-on-year change, Ghana', `${e.sdGhana.toFixed(2)} pp`],
                ['σ of year-on-year change, Sub-Saharan Africa', `${e.sdRegion.toFixed(2)} pp`],
                [<b key="c">Ghana sensitivity coefficient</b>, <b key="v">{e.coefficient.toFixed(2)}</b>],
                ['Cross-check: regression β (Ghana on region)', `${e.regression.beta.toFixed(2)} · R² ${e.regression.r2.toFixed(2)}`],
                ['Sample', `${e.from}–${e.to} · ${e.n} years`],
              ]} />}
              <details className="my-3 text-sm">
                <summary className="cursor-pointer font-medium">View annual WDI observations</summary>
                <Table head={['Year', 'Ghana (%)', 'Sub-Saharan Africa (%)']} rows={sample.map(([year, ghana, region]) => [year, ghana.toFixed(4), region.toFixed(4)])} />
              </details>
              <p className="mt-2 text-xs text-zinc-500"><a href={e.url} className="underline" target="_blank" rel="noreferrer">World Bank WDI API</a> · series updated {e.lastUpdated} · extracted {WORLD_BANK.retrieved}</p>
            </Card>
          );
        })}
      </div>

      <Card title="Calibration table" className="mt-6" note={`${scenarioOf(key).name} · ${scenarioOf(key).family}`}>
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          {!saved && GCB_PATHWAYS.map((s) => <Link key={s.key} href={path('/calibration', { scenario: s.key })} className={`rounded-md px-2.5 py-1 ring-1 ${s.key === key ? 'bg-[#1b2c3e] text-white ring-[#1b2c3e]' : 'ring-zinc-300 hover:bg-zinc-100'}`}>{s.name}</Link>)}
        </div>
        <Table head={['Year', 'Variable', 'NGFS / CCKP source value', 'Source shock or multiplier', 'Ghana coefficient', 'Calibrated Ghana shock', 'Validation status', 'Version']} align={['l', 'l', 'l', 'r', 'r', 'r', 'l', 'l']}
          rows={rows.map((r) => [r.year, r.variable, <span key="src" className="text-xs">{r.source}</span>, fmt(r.regional, r.unit), r.coefficient.toFixed(2), <b key="g">{fmt(r.ghana, r.unit)}</b>, <span key="s" className="text-xs">{r.status}</span>, r.version])} />
        <details className="my-4 text-sm">
          <summary className="cursor-pointer font-medium">View Ghana physical hazard calculations</summary>
          <Table head={['Reporting year', 'Ghana CCKP indicator', '2015–2024 mean', 'Horizon window', 'Horizon mean', 'Relative change']}
            rows={[...new Set(rows.map(({ year }) => year))].flatMap((year) =>
              (['rx5day', 'hd30', 'cdd'] as const).map((indicator) => {
                const { base, future, change } = hazardChange(indicator, SSP_FOR[key], year);
                const { label, unit } = CCKP.series[indicator];
                return [year, label, `${base.toFixed(2)} ${unit}`, `${year - 5}–${year + 4}`, `${future.toFixed(2)} ${unit}`, `${(change * 100).toFixed(2)}%`];
              }))} />
        </details>
        <Table head={['Variable', 'Methodology']} rows={(Object.keys(VARIABLES) as Variable[]).map((v) => [VARIABLES[v].label, <span key="m" className="text-xs">{calibrationMethod(v, profile)}</span>])} />
      </Card>

      <Card title="Sources and limitations" className="mt-6">
        <p className="text-sm text-zinc-700">The evidence download contains the annual Ghana and Sub-Saharan Africa WDI series, the NGFS observation grids, the Ghana CCKP projections, the underlying workbook names and fingerprints, settings, coefficient diagnostics and calibrated outputs.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
          <li>NiGEM Africa and GCAM Western Africa are regional pathways. Local GDP and inflation sensitivities depend on the chosen historical sample and can reflect shocks unrelated to climate. Interpolation smooths risks between NGFS observations. <a href="https://www.ngfs.net/ngfs-scenarios-portal/" className="underline">NGFS Scenarios Portal</a></li>
          <li>Rate regression depends on the supplied benchmark and yield comparability. Historical co-movement does not establish causality. Low fit, structural breaks and a short sample can make estimates unstable. A regional rate input without a fitted slope is provisional. The carbon price uses the regional scenario value in 2010 US dollars per tonne for new calibrations.</li>
          <li>Ghana CCKP uses national CMIP6 ensemble medians. Net Zero 2050 and Delayed Transition use SSP2-4.5, while Current Policies uses SSP5-8.5. These are modelling proxies. Physical multipliers compare the ten years centred on the reporting year with 2015–2024 in the same series. The composite equally weights relative changes in rainfall, hot days and dry spells. National projections can miss site-level extremes. <a href="https://climateknowledgeportal.worldbank.org/country/ghana" className="underline">World Bank Ghana climate data</a></li>
          <li>The stress engine also uses a separate modelled transition policy index, provided in the evidence download. Its assumptions, the calibration coefficients and their credit transmission require GCB validation. Results are conditional stress estimates for the selected loan book.</li>
        </ul>
      </Card>
    </>
  );
}
