import Link from 'next/link';
import { db, getRun } from '@/lib/store';
import { BANK, scenarioOf } from '@/lib/params';
import { Card, Illustrative, PageHead, Table } from '@/components/ui';
import { EvidenceCards } from '@/components/evidence-cards';
import { RunApproval } from '@/components/run-approval';
import { ghs, pct, pp } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function CapitalPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run: runId } = await searchParams;
  const d = await db();
  const id = runId ?? d.runs.find((r) => r.status === 'approved')?.id ?? d.runs[0]?.id;
  const found = id ? await getRun(id) : null;
  if (!found) return (<><PageHead area="Climate ICAAP" title="Climate ICAAP" /><p className="text-sm text-zinc-600">No stress runs yet. <Link href="/stress" className="underline">Run one first</Link>.</p></>);
  const { rec, run } = found;
  const C = run.capital;
  const minimumCapital = C.minimum * C.rwaAfter;
  const shortfall = Math.max(0, minimumCapital - C.capitalAfter);
  const amount = (value: number) => `GHS ${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
  const capitalRows = (baseline: number, stressed: number) => <Table head={['Input', 'Baseline', 'Stressed']} rows={[
    ['Capital numerator', amount(baseline), amount(stressed)], ['Risk-weighted assets', amount(C.rwaBefore), amount(C.rwaAfter)],
  ]} />;
  const source = <Link href={`/runs/${rec.id}`} className="underline">Open source run {rec.id}</Link>;
  const all = d.runs.slice(0, 8);

  return (
    <>
      <PageHead area="Climate ICAAP" title="Capital adequacy" intro={`Capital assessment using ${rec.id}: ${scenarioOf(rec.input.scenario).name}, ${rec.input.horizon}.`}><Link href={`/runs/${rec.id}`} className="text-sm underline">Source scenario run</Link><Link href={`/liquidity?run=${rec.id}`} className="text-sm underline">ILAAP</Link></PageHead>
      <RunApproval rec={rec} figures="capital" />
      <EvidenceCards key={rec.id} label="Capital metrics" items={[
        { id: 'car', label: 'Total capital ratio', value: `${pct(C.carBefore)} → ${pct(C.carAfter)}`, sub: pp(C.carAfter - C.carBefore),
          evidence: <><p>Total capital ÷ risk-weighted assets for each assessment. Climate provisions reduce capital by {amount(C.capitalBefore - C.capitalAfter)} after the modelled tax effect.</p>{capitalRows(C.capitalBefore, C.capitalAfter)}{source}</> },
        { id: 'cet1', label: 'CET1 ratio', value: `${pct(C.cet1Before)} → ${pct(C.cet1After)}`,
          evidence: <><p>Common Equity Tier 1 capital ÷ risk-weighted assets. The after-tax provision adjustment is applied to CET1.</p>{capitalRows(BANK.cet1, BANK.cet1 - (C.capitalBefore - C.capitalAfter))}{source}</> },
        { id: 'headroom', label: 'Headroom to minimum', value: pp(C.carAfter - C.minimum), sub: `Model minimum ${pct(C.minimum, 0)}`,
          evidence: <><p>Stressed total capital ratio ({pct(C.carAfter, 4)}) minus the configured minimum ({pct(C.minimum, 4)}) equals {pp(C.carAfter - C.minimum)}. A negative result indicates a shortfall.</p>{capitalRows(C.capitalBefore, C.capitalAfter)}{source}</> },
        { id: 'shortfall', label: 'Capital shortfall', value: shortfall > 0 ? ghs(shortfall) : 'None', sub: 'To restore the model minimum',
          evidence: <><p>Required capital equals {pct(C.minimum)} × stressed RWA of {amount(C.rwaAfter)} = {amount(minimumCapital)}. Any excess over available stressed capital of {amount(C.capitalAfter)} is the shortfall. Result {amount(shortfall)}.</p>{source}</> },
      ]} />
      <Card title="Climate ICAAP capital bridge" className="mt-6">
          <Table head={['Item', 'GHS']} align={['l', 'r']} rows={[
            ['Regulatory capital (CET1 + Tier 2)', ghs(C.capitalBefore)],
            ['− After-tax provision impact on capital', ghs(C.capitalAfter - C.capitalBefore)],
            [<b key="a">Stressed capital</b>, <b key="b">{ghs(C.capitalAfter)}</b>],
            ['Risk-weighted assets before', ghs(C.rwaBefore)],
            ['Risk-weighted assets after', ghs(C.rwaAfter)],
          ]} />
          <p className="mt-3 text-xs text-zinc-500">Pre-tax ECL increase {ghs(C.additionalProvisions)}. Pillar 2 view · climate-stressed economic capital {ghs(run.lossDist.stressed.economicCapital)} vs available capital {ghs(C.capitalAfter)}.</p>
        </Card>
      <Card title="All scenarios side by side" className="mt-6">
        <Table head={['Run', 'Scenario', 'Horizon', 'CAR after', 'VaR 99.9 stressed']} align={['l', 'l', 'l', 'r', 'r']} rows={all.map((r) => [
          <Link key="r" href={`/capital?run=${r.id}`} className="font-mono text-xs underline">{r.id}</Link>, scenarioOf(r.input.scenario).name, r.input.horizon,
          <span key="c" className={r.headline.carAfter < BANK.carMinimum ? 'text-red-600' : ''}>{pct(r.headline.carAfter)}</span>, ghs(r.headline.var999),
        ])} />
        <Illustrative>Capital and RWA figures belong to a synthetic bank. The minimum ratios are configurable and must be confirmed against current Bank of Ghana requirements.</Illustrative>
      </Card>
    </>
  );
}
