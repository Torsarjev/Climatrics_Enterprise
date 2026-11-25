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
  if (!found) return (<><PageHead area="ICAAP" title="ICAAP" /><p className="text-sm text-zinc-600">No stress runs yet. <Link href="/stress" className="underline">Run one first</Link>.</p></>);
  const { rec, run } = found;
  const C = run.capital;
  const all = d.runs.slice(0, 8);

  return (
    <>
      <PageHead area="ICAAP" title="Capital adequacy" intro={`Capital assessment using ${rec.id}: ${scenarioOf(rec.input.scenario).name}, ${rec.input.horizon}.`}><Link href={`/runs/${rec.id}`} className="text-sm underline">Source scenario run</Link><Link href={`/liquidity?run=${rec.id}`} className="text-sm underline">ILAAP</Link></PageHead>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat href="/methodology#capital" label="Total capital ratio" value={`${pct(C.carBefore)} → ${pct(C.carAfter)}`} sub={pp(C.carAfter - C.carBefore)} tone={C.carAfter < C.minimum ? 'bad' : 'good'} />
        <Stat href="/methodology#capital" label="CET1 ratio" value={`${pct(C.cet1Before)} → ${pct(C.cet1After)}`} />
        <Stat href="/methodology#capital" label="Headroom to minimum" value={pct(C.carAfter - C.minimum)} sub={`minimum ${pct(C.minimum, 0)} · configurable`} tone={C.carAfter < C.minimum ? 'bad' : 'good'} />
        <Stat href="/methodology#capital" label="Capital shortfall" value={C.carAfter < C.minimum ? ghs(C.minimum * C.rwaAfter - C.capitalAfter) : 'None'} sub="to restore the minimum" tone={C.carAfter < C.minimum ? 'bad' : 'good'} />
      </div>
      <Card title="ICAAP capital bridge" className="mt-6">
          <Table head={['Item', 'GHS']} align={['l', 'r']} rows={[
            ['Regulatory capital (CET1 + Tier 2)', ghs(C.capitalBefore)],
            ['− Additional climate provisions (ΔECL)', ghs(-C.additionalProvisions)],
            [<b key="a">Stressed capital</b>, <b key="b">{ghs(C.capitalAfter)}</b>],
            ['Risk-weighted assets before', ghs(C.rwaBefore)],
            ['Risk-weighted assets after', ghs(C.rwaAfter)],
          ]} />
          <p className="mt-3 text-xs text-zinc-500">Pillar 2 view: climate-stressed economic capital {ghs(run.lossDist.stressed.economicCapital)} vs available capital {ghs(C.capitalAfter)}.</p>
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
