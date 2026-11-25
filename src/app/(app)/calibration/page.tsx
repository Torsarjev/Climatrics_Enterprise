import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SCENARIOS, ScenarioKey, scenarioOf } from '@/lib/params';
import { CALIBRATION_VERSION, DEFAULT_CALIBRATION, NGFS_REGION, NGFS_RELEASE, SSP_FOR, VARIABLES, calibrationCoefficients, calibrationMethod, calibrationRows, evidence, hazardChange, readCalibration, type CalibrationProfile, type Variable } from '@/lib/calibration';
import { GCB_PATHWAYS } from '@/lib/gcb-scenarios';
import { currentUser, db } from '@/lib/store';
import { ActivateCalibration } from '@/components/activate-calibration';
import { when } from '@/lib/fmt';
import { CCKP } from '@/data/cckp';
import { WORLD_BANK } from '@/data/worldbank';
import { Badge, Card, PageHead, Table, btnClass } from '@/components/ui';
import { CalibrationChart } from '@/components/calibration-chart';

export const dynamic = 'force-dynamic';

const fmt = (v: number, unit: string) => (unit.startsWith('US$') ? `$${v.toFixed(0)}` : unit.startsWith('×') ? `×${v.toFixed(2)}` : `${v > 0 ? '+' : ''}${v.toFixed(2)}${unit.startsWith('%') ? '%' : ' pp'}`);

export default async function CalibrationPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, data, user] = await Promise.all([searchParams, db(), currentUser()]);
  const { scenario, run, preview } = params;
  const saved = typeof run === 'string' ? data.runs.find((entry) => entry.id === run) : undefined;
  if (run && !saved) notFound();
  const key = saved?.input.scenario ?? (SCENARIOS.some((s) => s.key === scenario) ? scenario as ScenarioKey : 'delayed');
  const active = data.calibration;
  let settings = (saved ? saved.input.calibration : active)?.settings ?? DEFAULT_CALIBRATION;
  let candidate: CalibrationProfile | undefined;
  let error: string | undefined;
  if (preview === '1' && !saved) {
    try {
      settings = readCalibration((name) => params[name]);
      candidate = { id: 'Preview', settings, coefficients: calibrationCoefficients(settings), activatedBy: '', activatedAt: '' };
    } catch (cause) {
      error = (cause as Error).message;
    }
  }
  const profile = saved ? saved.input.calibration : candidate ?? active;
  const rows = calibrationRows(key, profile);
  const ev = [evidence('gdp', profile?.settings), evidence('inflation', profile?.settings)];
  const query = new URLSearchParams(saved ? { run: saved.id } : candidate ? {
    preview: '1', ...Object.fromEntries(Object.entries(settings).map(([name, value]) => [name, String(value)])),
  } : {});
  const path = (base: string, extra: Record<string, string>) => `${base}?${new URLSearchParams([...query, ...Object.entries(extra)])}`;
  const field = 'mt-1 block w-full rounded-lg border border-lime-300 bg-white px-3 py-2';
  return (
    <>
      <PageHead area="Engine III · Ghana scenario calibration" title="Ghana-calibrated NGFS scenarios" intro="Translate regional NGFS scenarios into Ghana stress inputs. Recalculate the local coefficients, review each reporting year and activate a calibration for top-down and bottom-up stress tests.">
        <a href={path('/api/calibration', { format: 'csv' })} className="rounded-md px-3 py-2 text-sm ring-1 ring-zinc-300">Download calibrated CSV</a>
        <a href={path('/api/calibration', { format: 'json' })} className="rounded-md px-3 py-2 text-sm ring-1 ring-zinc-300">Download source data &amp; evidence</a>
      </PageHead>

      <Card title={saved ? 'Calibration used in this run' : 'Configure Ghana calibration'} className="mb-6 border-lime-300" note={<Badge tone={candidate ? 'amber' : 'green'}>{candidate ? 'Preview' : profile?.id ?? CALIBRATION_VERSION}</Badge>}>
        {saved ? (
          <p className="text-sm">Source for <Link className="underline" href={`/runs/${saved.id}`}>{saved.id}</Link> · WDI sample {settings.start}–{settings.end} · Rate ×{settings.rate} · Carbon ×{settings.carbon}. <Link href="/calibration" className="underline">Open active calibration</Link></p>
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-700">Active in Scenario Analysis · {active ? `${active.id} · activated by ${active.activatedBy} on ${when(active.activatedAt)}` : `Bundled calibration ${CALIBRATION_VERSION}`}</p>
            <form action="/calibration" method="get" className="grid items-end gap-3 rounded-xl bg-lime-50 p-4 sm:grid-cols-2 xl:grid-cols-5">
              <input type="hidden" name="scenario" value={key} />
              <input type="hidden" name="preview" value="1" />
              <label className="text-sm font-medium">WDI sample start<input className={field} required type="number" name="start" min="2000" max="2020" defaultValue={settings.start} /></label>
              <label className="text-sm font-medium">WDI sample end<input className={field} required type="number" name="end" min="2004" max="2024" defaultValue={settings.end} /></label>
              <label className="text-sm font-medium">Rate multiplier<input className={field} required type="number" name="rate" min="0" max="10" step="any" defaultValue={settings.rate} /></label>
              <label className="text-sm font-medium">Carbon multiplier<input className={field} required type="number" name="carbon" min="0" max="10" step="any" defaultValue={settings.carbon} /></label>
              <button className={btnClass}>Calculate preview</button>
            </form>
            {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {candidate && user.can.includes('run' as never) && <ActivateCalibration settings={settings} />}
              <Link href="/stress" className="text-sm font-medium underline">Open Scenario Analysis</Link>
              {candidate && <Link href="/calibration" className="text-sm underline">Return to active calibration</Link>}
            </div>
          </>
        )}
      </Card>

      <Card title="Method">
        <p className="rounded-md bg-zinc-50 px-3 py-2 font-mono text-sm">Calibrated Ghana shock = NGFS regional shock × Ghana sensitivity coefficient</p>
        <p className="mt-3 text-sm text-zinc-700">For GDP and inflation the coefficient is <b>σ(year-on-year change in Ghana) ÷ σ(year-on-year change in Sub-Saharan Africa)</b>, estimated on World Bank data for {ev[0].from}–{ev[0].to}. The ratio scales the magnitude of the regional shocks and preserves their sign. The regression slope and R² are diagnostics. GDP uses the change in the interpolated deviation over up to five years, with 2025 as the earliest starting point. Other macro and carbon values use the selected reporting year.</p>
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
            <Card key={e.key} title={`Evidence: ${e.key === 'gdp' ? 'GDP' : 'Inflation'} coefficient ${e.coefficient.toFixed(2)}`} note={`World Bank ${e.indicator}`}>
              <CalibrationChart years={sample.map(([year]) => year)} ghana={sample.map(([, value]) => value)} ssa={sample.map(([, , value]) => value)} unit="%" />
              <Table head={['Measure', 'Value']} align={['l', 'r']} rows={[
                ['σ of year-on-year change, Ghana', `${e.sdGhana.toFixed(2)} pp`],
                ['σ of year-on-year change, Sub-Saharan Africa', `${e.sdRegion.toFixed(2)} pp`],
                [<b key="c">Ghana sensitivity coefficient</b>, <b key="v">{e.coefficient.toFixed(2)}</b>],
                ['Cross-check: regression β (Ghana on region)', `${e.regression.beta.toFixed(2)} · R² ${e.regression.r2.toFixed(2)}`],
                ['Sample', `${e.from}–${e.to} · ${e.n} years`],
              ]} />
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
          <li>The interest-rate multiplier is a judgemental sensitivity. The carbon multiplier scales a regional scenario price in 2010 US dollars per tonne. Ghana borrowing rates, local carbon pricing and FX shocks require separate evidence.</li>
          <li>Ghana CCKP uses national CMIP6 ensemble medians. Net Zero 2050 and Delayed Transition use SSP2-4.5, while Current Policies uses SSP5-8.5. These are modelling proxies. Physical multipliers compare the ten years centred on the reporting year with 2015–2024 in the same series. The composite equally weights relative changes in rainfall, hot days and dry spells. National projections can miss site-level extremes. <a href="https://climateknowledgeportal.worldbank.org/country/ghana" className="underline">World Bank Ghana climate data</a></li>
          <li>The stress engine also uses a separate modelled transition policy index, provided in the evidence download. Its assumptions, the calibration coefficients and their credit transmission require GCB validation. Results are conditional stress estimates for the selected loan book.</li>
        </ul>
      </Card>
    </>
  );
}
