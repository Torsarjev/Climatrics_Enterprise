import Link from 'next/link';
import { db, getRun } from '@/lib/store';
import { scenarioOf } from '@/lib/params';
import { Card, Illustrative, PageHead, Table } from '@/components/ui';
import { EvidenceCards } from '@/components/evidence-cards';
import { RunApproval } from '@/components/run-approval';
import { ghs, pct, pp } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function LiquidityPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run: runId } = await searchParams;
  const { runs } = await db();
  const id = runId ?? runs.find((run) => run.status === 'approved')?.id ?? runs[0]?.id;
  const found = id ? await getRun(id) : null;
  if (!found) return <><PageHead area="Climate ILAAP" title="Liquidity adequacy" /><p className="text-sm">No scenario run is available. <Link href="/stress" className="underline">Open scenario analysis</Link>.</p></>;
  const { run, rec } = found;
  const liquidity = run.liquidity;

  const grossBefore = liquidity.segments.reduce((sum, item) => sum + item.outBase, liquidity.drawBase);
  const grossAfter = liquidity.segments.reduce((sum, item) => sum + item.outClimate, liquidity.drawStressed);
  const netOutflows = (gross: number) => Math.max(gross - Math.min(liquidity.inflows, gross * 0.75), 1);
  const source = <Link href={`/runs/${rec.id}`} className="underline">Open source run {rec.id}</Link>;

  return <>
    <PageHead area="Climate ILAAP" title="Liquidity adequacy" intro={`Liquidity assessment using ${rec.id}: ${scenarioOf(rec.input.scenario).name}, ${rec.input.horizon}.`}>
      <Link href={`/runs/${rec.id}`} className="text-sm underline">Source scenario run</Link>
    </PageHead>
    <RunApproval rec={rec} figures="liquidity" />
    <EvidenceCards key={rec.id} label="Liquidity metrics" items={[
      { id: 'lcr', label: 'Liquidity coverage ratio', value: `${pct(liquidity.lcrBefore)} → ${pct(liquidity.lcrAfter)}`, sub: pp(liquidity.lcrAfter - liquidity.lcrBefore),
        evidence: <><p>High-quality liquid assets ÷ net cash outflows. The model uses the same eligible inflows in both calculations, caps the deduction at 75% of gross outflows, and floors net outflows at GHS 1.</p>
          <Table head={['Input', 'Baseline', 'Stressed']} rows={[
            ['High-quality liquid assets', ghs(liquidity.hqla), ghs(liquidity.hqla)],
            ['Gross outflows', ghs(grossBefore), ghs(grossAfter)],
            ['Inflows deducted', ghs(Math.min(liquidity.inflows, grossBefore * 0.75)), ghs(Math.min(liquidity.inflows, grossAfter * 0.75))],
            ['Net outflows', ghs(netOutflows(grossBefore)), ghs(netOutflows(grossAfter))],
          ]} />{source}</> },
      { id: 'headroom', label: 'Headroom to minimum', value: pp(liquidity.lcrAfter - liquidity.minimum), sub: `Minimum ${pct(liquidity.minimum, 0)}`,
        evidence: <><p>Stressed LCR ({pct(liquidity.lcrAfter, 4)}) minus the configured liquidity minimum ({pct(liquidity.minimum, 4)}). A negative result indicates a breach of the model minimum.</p>{source}</> },
      { id: 'hqla', label: 'High-quality liquid assets', value: ghs(liquidity.hqla),
        evidence: <><p>GHS {liquidity.hqla.toLocaleString('en-GB')} is the illustrative Treasury balance configured in the bank model. The same balance is used for the baseline and stressed LCR. The selected scenario changes modelled cash flows.</p>{source}</> },
    ]} />
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
