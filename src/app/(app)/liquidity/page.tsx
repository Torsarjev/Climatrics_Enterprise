import Link from 'next/link';
import { db, getRun } from '@/lib/store';
import { scenarioOf } from '@/lib/params';
import { Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { ghs, pct, pp } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function LiquidityPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run: runId } = await searchParams;
  const { runs } = await db();
  const id = runId ?? runs.find((run) => run.status === 'approved')?.id ?? runs[0]?.id;
  const found = id ? await getRun(id) : null;
  if (!found) return <><PageHead area="ILAAP" title="Liquidity adequacy" /><p className="text-sm">No scenario run is available. <Link href="/stress" className="underline">Open scenario analysis</Link>.</p></>;
  const { run, rec } = found;
  const liquidity = run.liquidity;

  return <>
    <PageHead area="ILAAP" title="Liquidity adequacy" intro={`Liquidity assessment using ${rec.id}: ${scenarioOf(rec.input.scenario).name}, ${rec.input.horizon}.`}>
      <Link href={`/runs/${rec.id}`} className="text-sm underline">Source scenario run</Link>
    </PageHead>
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat label="Liquidity coverage ratio" value={`${pct(liquidity.lcrBefore)} → ${pct(liquidity.lcrAfter)}`} sub={pp(liquidity.lcrAfter - liquidity.lcrBefore)} />
      <Stat label="Headroom to minimum" value={pp(liquidity.lcrAfter - liquidity.minimum)} sub={`Minimum ${pct(liquidity.minimum, 0)}`} />
      <Stat label="High-quality liquid assets" value={ghs(liquidity.hqla)} />
    </div>
    <Card title="Cash outflows under climate stress" className="mt-6">
      <Table head={['Item', 'Baseline', 'Stressed']} rows={[
        ...liquidity.segments.map((item) => [`${item.segment.toUpperCase()} deposit outflows`, ghs(item.outBase), ghs(item.outClimate)]),
        ['Undrawn credit lines drawn', ghs(liquidity.drawBase), ghs(liquidity.drawStressed)],
      ]} />
      <Illustrative>Illustrative funding and liquid asset balances. The selected credit scenario supplies physical stress and stressed performing exposure for this liquidity assessment.</Illustrative>
    </Card>
    <Card title="Compare saved scenario runs" className="mt-6">
      <Table head={['Run', 'Pathway', 'Year', 'Stressed LCR']} rows={runs.slice(0, 12).map((item) => [
        <Link key={item.id} href={`/liquidity?run=${item.id}`} className="underline">{item.id}</Link>,
        scenarioOf(item.input.scenario).name, item.input.horizon, pct(item.headline.lcrAfter),
      ])} />
    </Card>
  </>;
}
