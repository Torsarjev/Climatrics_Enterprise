import Link from 'next/link';
import { notFound } from 'next/navigation';
import { activeCalibration, CALIBRATION_VERSION } from '@/lib/calibration';
import { activeLoans, db, getRun } from '@/lib/store';
import { ScenarioKey, scenarioOf } from '@/lib/params';
import { GCB_PATHWAYS } from '@/lib/gcb-scenarios';
import { STAGED_ECL_MODEL } from '@/lib/staged-ecl';
import { runCredit } from '@/lib/engine';
import { Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { delta, ghs, pct } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const FLOWS = [
  { title: 'Top-down approach', sub: 'Portfolio-level assessment', steps: ['NGFS scenario', 'Ghana macroeconomic shocks', 'Sector-level sensitivities', 'Sector PD and LGD stress', 'Staged ECL', 'Portfolio aggregation'] },
  { title: 'Bottom-up approach', sub: 'Individual borrower assessment', steps: ['NGFS scenario', 'Borrower-specific climate shocks', 'Revenue, costs and collateral', 'Stressed CFADS and DSCR', 'Borrower PD, LGD and ECL', 'Aggregate portfolio impact'] },
];

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ scenario?: string; horizon?: string; run?: string }> }) {
  const q = await searchParams;
  const saved = q.run ? await getRun(q.run, true) : null;
  if (q.run && !saved) notFound();
  const scenario = saved?.rec.input.scenario ?? q.scenario;
  const pathway = GCB_PATHWAYS.find((item) => item.key === scenario) ?? GCB_PATHWAYS[2];
  const key = saved?.rec.input.scenario ?? pathway.key;
  const horizon = saved?.rec.input.horizon ?? (pathway.years.includes(Number(q.horizon)) ? Number(q.horizon) : pathway.years.at(-1)!);
  const loans = saved?.loans ?? (await activeLoans()).loans;
  const calibration = saved ? saved.rec.input.calibration : activeCalibration((await db()).calibration);
  const input = saved?.rec.input ?? { scenario: key, horizon, eclModel: STAGED_ECL_MODEL, calibration };
  const td = runCredit(loans, { ...input, approach: 'top-down' });
  const bu = runCredit(loans, { ...input, approach: 'bottom-up' });
  const G = bu.shocks;
  const rows = td.summary.bySector.map((t, i) => {
    const b = bu.summary.bySector[i];
    const gap = b.eclStressed - t.eclStressed;
    const xs = bu.results.filter((r) => r.sector === t.key);
    const flooded = xs.filter((r) => (r.trace?.floodDamage ?? 0) > 0).reduce((a, r) => a + r.ead, 0) / (t.ead || 1);
    const why = Math.abs(gap) < 0.1 * Math.max(t.eclStressed, 1) ? 'Close agreement'
      : gap > 0 ? (flooded >= 0.15 ? `Bottom-up sees flood events at ${pct(flooded, 0)} of sector exposure and damaged collateral` : 'Thin borrower margins: cash flow falls faster than the sector average')
      : 'Sector sensitivity exceeds what borrower cash flows show';
    return { name: t.name, ead: t.ead, tdPd: t.pdStressed, buPd: b.pdStressed, tdEcl: t.eclStressed, buEcl: b.eclStressed, gap, why };
  });
  const link = (k: ScenarioKey, h: number) => `/compare?scenario=${k}&horizon=${h}`;

  return (
    <>
      <PageHead area="Engine III · Scenario analysis" title="Top-down versus bottom-up" intro="Both approaches read the same Ghana-calibrated NGFS shocks. The difference is the level at which climate shocks become financial risk: sector averages (top-down) or each borrower’s cash flows and collateral (bottom-up)." />

      <Card title={saved ? `Saved inputs · ${saved.rec.id}` : `Active Ghana calibration · ${calibration?.id ?? CALIBRATION_VERSION}`}>
        {saved ? <Link href={link(key, horizon)} className="text-sm underline">Explore with active inputs</Link> : <div className="flex flex-wrap items-center gap-2 text-sm">
          {GCB_PATHWAYS.map((s) => <Link key={s.key} href={link(s.key, s.key === key ? horizon : s.years.at(-1)!)} className={`rounded-md px-2.5 py-1 ring-1 ${s.key === key ? 'bg-[#1b2c3e] text-white ring-[#1b2c3e]' : 'ring-zinc-300 hover:bg-zinc-100'}`}>{s.name}</Link>)}
          <span className="mx-2 text-zinc-300">|</span>
          {pathway.years.map((h) => <Link key={h} href={link(key, h)} className={`rounded-md px-2.5 py-1 ring-1 ${h === horizon ? 'bg-[#1b2c3e] text-white ring-[#1b2c3e]' : 'ring-zinc-300 hover:bg-zinc-100'}`}>{h}</Link>)}
        </div>}
        <p className="mt-3 text-sm text-zinc-600">Ghana shocks for {scenarioOf(key).name} {horizon}: GDP {G.gdp.toFixed(1)}% · inflation {G.inflation >= 0 ? '+' : ''}{G.inflation.toFixed(1)} pp · long rate {G.rate >= 0 ? '+' : ''}{G.rate.toFixed(1)} pp · energy {G.energy ? `${G.energy.ghana.toFixed(1)}%` : 'unavailable'} · carbon ${G.carbon.toFixed(0)}/t · extreme rain ×{G.flood.toFixed(2)} · <Link href={`/calibration?scenario=${key}${saved ? `&run=${saved.rec.id}` : ''}`} className="underline">how these were calibrated</Link></p>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {FLOWS.map((f, i) => {
          const r = i === 0 ? td : bu;
          return (
            <section key={f.title} className="rounded-xl border border-zinc-200 bg-white p-5">
              <h2 className="text-lg font-semibold">{f.title}</h2>
              <p className="text-sm text-zinc-500">{f.sub}</p>
              <ol className="mt-4 space-y-1 text-center text-sm">
                {f.steps.map((s, j) => (
                  <li key={s}>
                    <div className="rounded-md bg-zinc-50 px-3 py-2">{s}</div>
                    {j < f.steps.length - 1 && <div className="text-zinc-400">↓</div>}
                  </li>
                ))}
              </ol>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Staged ECL" value={`${ghs(r.summary.ecl)} → ${ghs(r.summary.eclStressed)}`} sub={delta(r.summary.ecl, r.summary.eclStressed)} tone="bad" />
                <Stat label="Weighted stressed LGD" value={pct(r.summary.lgdStressed, 2)} />
              </div>
            </section>
          );
        })}
      </div>

      <Card title="Reconciliation by sector" className="mt-6" note="stressed values; positive gap = bottom-up higher">
        <Table head={['Sector', 'EAD', 'PD top-down', 'PD bottom-up', 'ECL top-down', 'ECL bottom-up', 'Gap', 'Main reason']} align={['l', 'r', 'r', 'r', 'r', 'r', 'r', 'l']}
          rows={rows.map((r) => [r.name, ghs(r.ead), pct(r.tdPd, 2), pct(r.buPd, 2), ghs(r.tdEcl), ghs(r.buEcl), <span key="g" className={r.gap > 0 ? 'text-red-600' : 'text-emerald-700'}>{r.gap > 0 ? '+' : ''}{ghs(r.gap)}</span>, <span key="w" className="text-xs">{r.why}</span>])} />
        <p className="mt-3 text-xs text-zinc-500">The two approaches are run separately on the same data and the same calibrated shocks; their losses are compared, never added, so nothing is counted twice. Top-down gives a fast first view from sector exposures alone; bottom-up needs borrower financials and collateral locations and captures concentrations that sector averages hide.</p>
        <Illustrative>Sector sensitivities, DSCR bands and damage curves are illustrative pending methodology sign-off.</Illustrative>
      </Card>
    </>
  );
}
