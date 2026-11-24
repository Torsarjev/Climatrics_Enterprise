import Link from 'next/link';
import { activeLoans, currentUser, db } from '@/lib/store';
import { MyWork } from '@/components/my-work';
import { scenarioOf } from '@/lib/params';
import { Badge, Card, Table } from '@/components/ui';
import { ghs, pct, when } from '@/lib/fmt';
import { dashboard, Level } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

const HEAT: Record<Level, string> = { High: 'bg-[#ebb5ae] text-[#5b1f17]', Med: 'bg-[#f7dfa0] text-[#5a4300]', Low: 'bg-[#dce9d5] text-[#24421b]' };
const Kpi = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div className="rounded-xl border border-zinc-200 bg-white p-5">
    <p className="text-[15px] text-zinc-500">{label}</p>
    <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900">{value}</p>
    <p className="mt-1 text-xs text-zinc-500">{sub}</p>
  </div>
);

const ENGINES: [string, string, string[][]][] = [
  ['I', 'ESMS & SDG screening', [['/screening', 'Screening'], ['/alignment', 'SDG & taxonomy']]],
  ['II', 'Geospatial physical risk', [['/physical', 'Physical risk']]],
  ['III', 'NGFS scenarios, ECL, ICAAP & ILAAP', [['/stress', 'Stress test'], ['/capital', 'ICAAP & ILAAP']]],
  ['IV', 'IFRS S1/S2 & Bank of Ghana evidence', [['/disclosure', 'Disclosure'], ['/reports', 'Reports']]],
  ['V', 'Financed emissions (PCAF)', [['/emissions', 'Emissions'], ['/transition', 'Transition risk']]],
  ['VI', 'Governance', [['/governance', 'Governance'], ['/data', 'Data lineage']]],
];

export default async function Overview() {
  const d = await db();
  const user = await currentUser();
  const { dataset, loans } = await activeLoans();
  const ead = loans.reduce((a, l) => a + l.ead, 0);
  const latest = d.runs[0];

  const D = dashboard(dataset.id, loans);
  const carMax = Math.max(0.25, ...D.car.map((c) => c.value)) * 1.05;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Climate risk overview</h1>
        <p className="mt-1 text-zinc-500">Demo Bank Ghana · synthetic portfolio as at 30 September 2026</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Kpi label="Portfolio exposure" value={ghs(ead)} sub={`${loans.length} facilities · ${dataset.id}`} />
        <Kpi label="High-risk exposure" value={pct(D.highRisk / ead)} sub={`${ghs(D.highRisk)} · physical score ≥ 3.0 of 5, or high-transition sector without a plan`} />
        <Kpi label="Baseline ECL" value={ghs(D.eclBase)} sub="IFRS 9 provisions before climate stress" />
        <Kpi label="Stressed ECL" value={ghs(D.eclStressed)} sub={`most severe: ${D.worstLabel}`} />
      </div>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-2xl font-semibold tracking-tight">Sector climate risk heatmap</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] border-separate border-spacing-x-2 border-spacing-y-1.5 text-[15px]">
            <thead><tr className="text-left">{['Sector', 'Physical', 'Transition', 'Overall'].map((h) => <th key={h} className="px-2 pb-1 font-semibold">{h}</th>)}<th className="px-2 pb-1 text-right font-semibold">EAD</th></tr></thead>
            <tbody>
              {D.sectors.map((s) => (
                <tr key={s.name}>
                  <td className="px-2">{s.name}</td>
                  {[s.physical, s.transition, s.overall].map((l, i) => <td key={i} className={`rounded-md px-2 py-2 text-center ${HEAT[l]}`}>{l}</td>)}
                  <td className="px-2 text-right tabular-nums text-zinc-500">{ghs(s.ead)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Physical: EAD-weighted hazard × vulnerability score today (High ≥ 2.5 of 5). Transition: sector sensitivity to carbon price and policy. Overall: the higher of the two.</p>

        <hr className="my-6 border-zinc-200" />

        <h2 className="text-2xl font-semibold tracking-tight">Capital adequacy under climate stress</h2>
        <div className="mt-5 space-y-4">
          {D.car.map((c) => (
            <div key={c.label} className="grid grid-cols-[7.5rem_1fr_4rem] items-center gap-4">
              <div><p className="text-[15px]">{c.label}</p><p className="text-xs text-zinc-500">{c.note}</p></div>
              <div className="relative h-3 rounded-full bg-zinc-100">
                <div className={`h-3 rounded-full ${c.value < D.minimum ? 'bg-[#d9534f]' : 'bg-[#5a8a3c]'}`} style={{ width: `${Math.max(0, c.value) / carMax * 100}%` }} />
                <div className="absolute -top-1 h-5 w-0.5 bg-zinc-700" style={{ left: `${D.minimum / carMax * 100}%` }} title="minimum" />
              </div>
              <p className={`text-right text-[15px] tabular-nums ${c.value < D.minimum ? 'font-semibold text-red-600' : ''}`}>{pct(c.value)}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-500">Total capital ratio at 2050, bottom-up. The black line marks the {pct(D.minimum, 0)} minimum (configurable). Red means below the minimum.</p>
      </section>

      <div className="mt-6"><MyWork user={user} runs={d.runs} audit={d.audit} /></div>

      <Card title="The six engines" className="mt-6" note="from the technical proposal">
        <ul className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {ENGINES.map(([n, t, links]) => (
            <li key={n} className="rounded-md border border-zinc-200 p-3">
              <p className="font-semibold"><span className="text-emerald-700">{n}</span> · {t}</p>
              <p className="mt-1 space-x-3 text-xs">{links.map(([h, l]) => <Link key={h} href={h} className="underline">{l}</Link>)}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Recent stress runs" className="mt-6" note={latest ? `latest ${when(latest.createdAt)}` : undefined}>
        {d.runs.length === 0 ? <p className="text-sm text-zinc-500">No runs yet. <Link href="/stress" className="underline">Run a stress test</Link>.</p> : (
          <Table
            head={['Run', 'Scenario', 'Horizon', 'ECL before → after', 'CAR after', 'Status']}
            align={['l', 'l', 'l', 'r', 'r', 'l']}
            rows={d.runs.slice(0, 6).map((r) => [
              <Link key="a" href={`/runs/${r.id}`} className="font-mono text-xs underline">{r.id}</Link>,
              scenarioOf(r.input.scenario).name, `${r.input.horizon} · ${r.input.approach}`,
              `${ghs(r.headline.ecl)} → ${ghs(r.headline.eclStressed)}`,
              <span key="c" className={r.headline.carAfter < 0.13 ? 'text-red-600' : ''}>{pct(r.headline.carAfter)}</span>,
              <Badge key="s" tone={r.status === 'approved' ? 'green' : r.status === 'submitted' ? 'amber' : r.status === 'rejected' ? 'red' : 'zinc'}>{r.status}</Badge>,
            ])}
          />
        )}
      </Card>
    </>
  );
}
