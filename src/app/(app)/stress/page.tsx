import Link from 'next/link';
import { ghanaShocks, NGFS_RELEASE } from '@/lib/calibration';
import { currentUser, db } from '@/lib/store';
import { scenarioOf } from '@/lib/params';
import { Badge, Card, PageHead, Table } from '@/components/ui';
import { GCB_PATHWAYS } from '@/lib/gcb-scenarios';
import { RunForm } from '@/components/run-form';
import { ghs, when } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function StressPage() {
  const user = await currentUser();
  const d = await db();
  const pathways = GCB_PATHWAYS.map(({ years, ...pathway }) => ({
    ...pathway, points: years.map((year) => ({ year, shocks: ghanaShocks(pathway.key, year) })),
  }));
  return (
    <>
      <PageHead area="Engine III · Scenario analysis & stress testing" title="Climate scenarios & credit losses" intro="Select a GCB pathway, projection year and credit approach. Trace the scenario from Ghana-calibrated variables to facility PD, LGD, IFRS 9 stage and discounted ECL." />
      {user.can.includes('run' as never)
        ? <Card title="Run a GCB scenario"><RunForm pathways={pathways} /></Card>
        : user.can.includes('approve' as never)
          ? <Card title="Awaiting your approval" note="approvers review; analysts run">
              {d.runs.filter((r) => r.status === 'submitted').length === 0 ? <p className="text-sm text-zinc-500">No runs waiting for approval.</p> : (
                <ul className="space-y-1 text-sm">{d.runs.filter((r) => r.status === 'submitted').map((r) => <li key={r.id}><Link href={`/runs/${r.id}`} className="font-mono text-xs underline">{r.id}</Link> · {scenarioOf(r.input.scenario).name} · {r.input.horizon} · submitted by {r.submittedBy}</li>)}</ul>
              )}
              <p className="mt-3 text-xs text-zinc-500">{user.name} is an approver, so cannot start runs (separation of duties). Switch to an analyst (Kofi Mensah) at the top right to run a stress test.</p>
            </Card>
          : <Card title="New run"><p className="text-sm text-zinc-600">Read-only: auditors can inspect every run and its lineage but cannot start one. Switch to an analyst (Kofi Mensah) at the top right to run a stress test.</p></Card>}

      <Card title="GCB pathway windows" className="mt-6" note={<Link href="/calibration" className="underline">Calibration and source data</Link>}>
        <Table head={['Pathway', 'NGFS scenario', 'Eligible years']} rows={GCB_PATHWAYS.map((pathway) => [
          pathway.label, pathway.name, `${pathway.years[0]}–${pathway.years.at(-1)}`,
        ])} />
        <p className="mt-3 text-sm text-zinc-600">Source: {NGFS_RELEASE} and World Bank CCKP Ghana projections. The app linearly interpolates the five-year NGFS observations for annual runs. GDP uses the change in NGFS deviation over up to five years, with the lookback starting no earlier than 2025.</p>
      </Card>

      <Card title="Credit loss workflow" className="mt-6">
        <ol className="grid gap-3 text-sm md:grid-cols-4">
          {['Select pathway and year', 'Stress borrower financials or sector rates', 'Recalculate PD, LGD and stage', 'Discount and aggregate ECL'].map((step) => <li key={step} className="rounded-lg bg-lime-50 p-3 font-medium">{step}</li>)}
        </ol>
        <p className="mt-3 text-sm text-zinc-600">The scenario records provide inputs to <Link href="/capital" className="underline">ICAAP</Link> and <Link href="/liquidity" className="underline">ILAAP</Link>.</p>
      </Card>

      <Card title="Run history" className="mt-6">
        <Table head={['Run', 'Scenario', 'Horizon', 'Approach', 'ECL after', 'By', 'When', 'Status']} rows={d.runs.map((r) => [
          <Link key="a" href={`/runs/${r.id}`} className="font-mono text-xs underline">{r.id}</Link>, scenarioOf(r.input.scenario).name, r.input.horizon, r.input.approach,
          ghs(r.headline.eclStressed), r.by, when(r.createdAt),
          <Badge key="s" tone={r.status === 'approved' ? 'green' : r.status === 'submitted' ? 'amber' : r.status === 'rejected' ? 'red' : 'zinc'}>{r.status}</Badge>,
        ])} />
      </Card>
    </>
  );
}
