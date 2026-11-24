import Link from 'next/link';
import { ghanaShocks, NGFS_RELEASE } from '@/lib/calibration';
import { currentUser, db } from '@/lib/store';
import { HORIZONS, SCENARIOS, scenarioOf } from '@/lib/params';
import { Badge, Card, PageHead, Table } from '@/components/ui';
import { RunForm } from '@/components/run-form';
import { ghs, pct, when } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function StressPage() {
  const user = await currentUser();
  const d = await db();
  return (
    <>
      <PageHead area="Engine III · Scenario analysis & stress testing" title="Stress test" intro="Choose an NGFS scenario and horizon. The engine translates the scenario into counterparty PD and LGD, recomputes IFRS 9 staging and ECL, simulates the loss distribution, and feeds ICAAP and ILAAP." />
      {user.can.includes('run' as never)
        ? <Card title="New run"><RunForm scenarios={SCENARIOS.map(({ key, name, family }) => ({ key, name, family }))} horizons={HORIZONS} canRun /></Card>
        : user.can.includes('approve' as never)
          ? <Card title="Awaiting your approval" note="approvers review; analysts run">
              {d.runs.filter((r) => r.status === 'submitted').length === 0 ? <p className="text-sm text-zinc-500">No runs waiting for approval.</p> : (
                <ul className="space-y-1 text-sm">{d.runs.filter((r) => r.status === 'submitted').map((r) => <li key={r.id}><Link href={`/runs/${r.id}`} className="font-mono text-xs underline">{r.id}</Link> · {scenarioOf(r.input.scenario).name} · {r.input.horizon} · submitted by {r.submittedBy}</li>)}</ul>
              )}
              <p className="mt-3 text-xs text-zinc-500">{user.name} is an approver, so cannot start runs (separation of duties). Switch to an analyst (Kofi Mensah) at the top right to run a stress test.</p>
            </Card>
          : <Card title="New run"><p className="text-sm text-zinc-600">Read-only: auditors can inspect every run and its lineage but cannot start one. Switch to an analyst (Kofi Mensah) at the top right to run a stress test.</p></Card>}

      <Card title="Ghana-calibrated NGFS scenarios" className="mt-6" note={<a href="/calibration" className="underline">method and NGFS source values</a>}>
        <Table head={['Scenario', 'Family', ...HORIZONS.map((h) => `${h}`)]} rows={SCENARIOS.map((s) => [
          s.name, s.family,
          ...HORIZONS.map((h) => { const g = ghanaShocks(s.key, h); return <span key={h} className="text-xs tabular-nums">GDP {g.gdp.toFixed(1)}% · carbon ${g.carbon.toFixed(0)}/t · rain ×{g.flood.toFixed(2)}</span>; }),
        ])} />
        <p className="mt-2 text-xs text-zinc-500">Source: {NGFS_RELEASE}; World Bank CCKP Ghana projections. GDP is the extra shortfall over the five years to the horizon, scaled for Ghana.</p>
      </Card>

      <Card title="How the scenario reaches the balance sheet" className="mt-6">
        <ol className="grid gap-3 text-sm md:grid-cols-5">
          {[['Ghana calibration', 'NGFS regional shock × Ghana coefficient'], ['Borrower or sector', 'revenue, costs, collateral · or sector sensitivity'], ['PD', 'bottom-up: CFADS → DSCR → PD band · top-down: sector sensitivities'], ['LGD', 'flood depth → damage curve → lost recovery'], ['ECL → capital', 'one-year ECL, VaR, CAR, LCR']].map(([t, s], i) => (
            <li key={t} className="rounded-md border border-zinc-200 p-3"><p className="font-semibold">{i + 1}. {t}</p><p className="mt-1 text-xs text-zinc-500">{s}</p></li>
          ))}
        </ol>
      </Card>

      <Card title="Run history" className="mt-6">
        <Table head={['Run', 'Scenario', 'Horizon', 'Approach', 'ECL after', 'By', 'When', 'Status']} rows={d.runs.map((r) => [
          <Link key="a" href={`/runs/${r.id}`} className="font-mono text-xs underline">{r.id}</Link>, scenarioOf(r.input.scenario).name, r.input.horizon, r.input.approach,
          `${ghs(r.headline.eclStressed)} (CAR ${pct(r.headline.carAfter)})`, r.by, when(r.createdAt),
          <Badge key="s" tone={r.status === 'approved' ? 'green' : r.status === 'submitted' ? 'amber' : r.status === 'rejected' ? 'red' : 'zinc'}>{r.status}</Badge>,
        ])} />
      </Card>
    </>
  );
}
