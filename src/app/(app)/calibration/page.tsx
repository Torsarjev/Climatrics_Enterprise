import Link from 'next/link';
import { SCENARIOS, ScenarioKey, scenarioOf } from '@/lib/params';
import { CALIBRATION_VERSION, NGFS_REGION, NGFS_RELEASE, calibrationRows, evidence } from '@/lib/calibration';
import { WORLD_BANK } from '@/data/worldbank';
import { Badge, Card, Illustrative, PageHead, Table } from '@/components/ui';
import { CalibrationChart } from '@/components/calibration-chart';

export const dynamic = 'force-dynamic';

const fmt = (v: number, unit: string) => (unit.startsWith('USD') ? `$${v.toFixed(0)}` : unit.startsWith('×') ? `×${v.toFixed(2)}` : `${v > 0 ? '+' : ''}${v.toFixed(2)}${unit.startsWith('%') ? '%' : ' pp'}`);

export default async function CalibrationPage({ searchParams }: { searchParams: Promise<{ scenario?: string }> }) {
  const { scenario } = await searchParams;
  const key = (SCENARIOS.some((s) => s.key === scenario) ? scenario : 'delayed') as ScenarioKey;
  const rows = calibrationRows(key);
  const ev = [evidence('gdp'), evidence('inflation')];

  return (
    <>
      <PageHead area="Engine III · Ghana scenario calibration" title="Ghana-calibrated NGFS scenarios" intro="NGFS publishes scenario paths for model regions, not for Ghana. Each regional shock is translated into a Ghana shock with a documented, data-driven coefficient. Both the top-down and bottom-up stress tests read these calibrated values." >
        <a href="/api/calibration" className="rounded-md px-3 py-1.5 text-sm text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100">Download full table (CSV)</a>
      </PageHead>

      <Card title="Method">
        <p className="rounded-md bg-zinc-50 px-3 py-2 font-mono text-sm">Calibrated Ghana shock = NGFS regional shock × Ghana sensitivity coefficient</p>
        <p className="mt-3 text-sm text-zinc-700">For GDP and inflation the coefficient is <b>σ(year-on-year change in Ghana) ÷ σ(year-on-year change in Sub-Saharan Africa)</b>, estimated on World Bank data for {ev[0].from}–{ev[0].to}. It measures how much harder Ghana moves than the region. A regression of Ghana on the region is shown as a cross-check: its low R² is why the volatility ratio is used, since a regression on weakly related series understates the size of Ghana’s shocks.</p>
        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm md:grid-cols-3">
          <div><dt className="text-zinc-500">NGFS release</dt><dd>{NGFS_RELEASE}</dd></div>
          <div><dt className="text-zinc-500">Region</dt><dd>{NGFS_REGION}</dd></div>
          <div><dt className="text-zinc-500">Calibration version</dt><dd>{CALIBRATION_VERSION} · <Badge tone="amber">illustrative, pending validation</Badge></dd></div>
        </dl>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {ev.map((e) => {
          const s = WORLD_BANK.series[e.key];
          return (
            <Card key={e.key} title={`Evidence: ${e.key === 'gdp' ? 'GDP' : 'Inflation'} coefficient ${e.coefficient.toFixed(2)}`} note={`World Bank ${e.indicator}`}>
              <CalibrationChart years={s.years} ghana={s.ghana} ssa={s.ssa} unit="%" />
              <Table head={['Measure', 'Value']} align={['l', 'r']} rows={[
                ['σ of year-on-year change, Ghana', `${e.sdGhana.toFixed(2)} pp`],
                ['σ of year-on-year change, Sub-Saharan Africa', `${e.sdRegion.toFixed(2)} pp`],
                [<b key="c">Ghana sensitivity coefficient</b>, <b key="v">{e.coefficient.toFixed(2)}</b>],
                ['Cross-check: regression β (Ghana on region)', `${e.regression.beta.toFixed(2)} · R² ${e.regression.r2.toFixed(2)}`],
                ['Sample', `${e.from}–${e.to} · ${e.n} years`],
              ]} />
              <p className="mt-2 text-xs text-zinc-500">Source: <a href={e.url} className="underline" target="_blank" rel="noreferrer">World Bank WDI API</a> · series updated {e.lastUpdated} · extracted {WORLD_BANK.retrieved}</p>
            </Card>
          );
        })}
      </div>

      <Card title="Calibration table" className="mt-6" note={`${scenarioOf(key).name} · ${scenarioOf(key).family}`}>
        <div className="mb-3 flex flex-wrap gap-2 text-sm">
          {SCENARIOS.map((s) => <Link key={s.key} href={`/calibration?scenario=${s.key}`} className={`rounded-md px-2.5 py-1 ring-1 ${s.key === key ? 'bg-[#1b2c3e] text-white ring-[#1b2c3e]' : 'ring-zinc-300 hover:bg-zinc-100'}`}>{s.name}</Link>)}
        </div>
        <Table head={['Year', 'Variable', 'Regional shock', 'Ghana coefficient', 'Calibrated Ghana shock', 'Methodology', 'Validation status', 'Version']} align={['l', 'l', 'r', 'r', 'r', 'l', 'l', 'l']}
          rows={rows.map((r) => [r.year, r.variable, fmt(r.regional, r.unit), r.coefficient.toFixed(2), <b key="g">{fmt(r.ghana, r.unit)}</b>, <span key="m" className="text-xs">{r.method}</span>, <span key="s" className="text-xs">{r.status}</span>, r.version])} />
        <Illustrative>Regional NGFS values are placeholders until the official release is loaded from the IIASA NGFS Scenario Explorer. Coefficients are computed from real World Bank data; the long-term rate coefficient is expert judgement. All values await GCB methodology sign-off.</Illustrative>
      </Card>
    </>
  );
}
