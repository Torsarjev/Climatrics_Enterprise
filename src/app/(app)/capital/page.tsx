import Link from 'next/link';
import { db, getRun } from '@/lib/store';
import { BANK, scenarioOf } from '@/lib/params';
import { Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { ghs, pct, pp } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function CapitalPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run: runId } = await searchParams;
  const d = await db();
  const id = runId ?? d.runs.find((r) => r.status === 'approved')?.id ?? d.runs[0]?.id;
  const found = id ? await getRun(id) : null;
  if (!found) return (<><PageHead area="Area 6 · ICAAP & ILAAP" title="ICAAP & ILAAP" /><p className="text-sm text-zinc-600">No stress runs yet. <Link href="/stress" className="underline">Run one first</Link>.</p></>);
  const { rec, run } = found;
  const C = run.capital, Q = run.liquidity;
  const all = d.runs.slice(0, 8);

  return (
    <>
      <PageHead area="Engine III · ICAAP & ILAAP integration" title="Capital and liquidity adequacy" intro={`Climate stress results flow into the capital and liquidity assessments. Showing ${rec.id}: ${scenarioOf(rec.input.scenario).name}, ${rec.input.horizon}.`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat href="/methodology#capital" label="Total capital ratio" value={`${pct(C.carBefore)} → ${pct(C.carAfter)}`} sub={pp(C.carAfter - C.carBefore)} tone={C.carAfter < C.minimum ? 'bad' : 'good'} />
        <Stat href="/methodology#capital" label="CET1 ratio" value={`${pct(C.cet1Before)} → ${pct(C.cet1After)}`} />
        <Stat href="/methodology#capital" label="Headroom to minimum" value={pct(C.carAfter - C.minimum)} sub={`minimum ${pct(C.minimum, 0)} · configurable`} tone={C.carAfter < C.minimum ? 'bad' : 'good'} />
        <Stat href="/methodology#capital" label="Capital shortfall" value={C.carAfter < C.minimum ? ghs(C.minimum * C.rwaAfter - C.capitalAfter) : 'None'} sub="to restore the minimum" tone={C.carAfter < C.minimum ? 'bad' : 'good'} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="ICAAP: capital bridge">
          <Table head={['Item', 'GHS']} align={['l', 'r']} rows={[
            ['Regulatory capital (CET1 + Tier 2)', ghs(C.capitalBefore)],
            ['− Additional climate provisions (ΔECL)', ghs(-C.additionalProvisions)],
            [<b key="a">Stressed capital</b>, <b key="b">{ghs(C.capitalAfter)}</b>],
            ['Risk-weighted assets before', ghs(C.rwaBefore)],
            ['Risk-weighted assets after', ghs(C.rwaAfter)],
          ]} />
          <p className="mt-3 text-xs text-zinc-500">Pillar 2 view: climate-stressed economic capital {ghs(run.lossDist.stressed.economicCapital)} vs available capital {ghs(C.capitalAfter)}.</p>
        </Card>
        <Card title="ILAAP: liquidity under climate stress" note={`physical severity ${pct(Q.severity, 0)}`}>
          <Table head={['Outflow', 'Base', 'Climate-stressed']} align={['l', 'r', 'r']} rows={[
            ...Q.segments.map((s) => [`${s.segment[0].toUpperCase()}${s.segment.slice(1)} deposits (${ghs(s.balance)})`, ghs(s.outBase), ghs(s.outClimate)]),
            ['Undrawn credit lines drawn', ghs(Q.drawBase), ghs(Q.drawStressed)],
            ['High-quality liquid assets', ghs(Q.hqla), ghs(Q.hqla)],
            [<b key="l">Liquidity coverage ratio</b>, <b key="a">{pct(Q.lcrBefore, 0)}</b>, <b key="b" className={Q.lcrAfter < Q.minimum ? 'text-red-600' : ''}>{pct(Q.lcrAfter, 0)}</b>],
          ]} />
          <p className="mt-3 text-xs text-zinc-500">Climate outflows: deposit withdrawals in affected regions and sectors, plus higher draw-down of committed lines after acute events.</p>
        </Card>
      </div>
      <Card title="All scenarios side by side" className="mt-6">
        <Table head={['Run', 'Scenario', 'Horizon', 'CAR after', 'LCR after', 'VaR 99.9 stressed']} align={['l', 'l', 'l', 'r', 'r', 'r']} rows={all.map((r) => [
          <Link key="r" href={`/capital?run=${r.id}`} className="font-mono text-xs underline">{r.id}</Link>, scenarioOf(r.input.scenario).name, r.input.horizon,
          <span key="c" className={r.headline.carAfter < BANK.carMinimum ? 'text-red-600' : ''}>{pct(r.headline.carAfter)}</span>, pct(r.headline.lcrAfter, 0), ghs(r.headline.var999),
        ])} />
        <Illustrative>Capital, RWA and liquidity figures belong to a synthetic bank. The minimum ratios are configurable and must be confirmed against current Bank of Ghana requirements.</Illustrative>
      </Card>
    </>
  );
}
