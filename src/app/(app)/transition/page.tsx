import { activeLoans } from '@/lib/store';
import { SECTORS, sectorOf } from '@/lib/params';
import { transitionScore } from '@/lib/engine';
import { financedBook } from '@/lib/emissions';
import { Badge, Bars, Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { ghs, num, pct } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function TransitionPage() {
  const { loans } = await activeLoans();
  const ead = loans.reduce((a, l) => a + l.ead, 0);
  const intensive = loans.filter((l) => sectorOf(l.sector).transition >= 0.5);
  const intEad = intensive.reduce((a, l) => a + l.ead, 0);
  const financed = financedBook(loans).total;
  const plans = intensive.filter((l) => l.transitionPlan).reduce((a, l) => a + l.ead, 0);

  const rows = SECTORS.map((s) => {
    const xs = loans.filter((l) => l.sector === s.key), e = xs.reduce((a, l) => a + l.ead, 0);
    return { s, e, plan: xs.filter((l) => l.transitionPlan).length / (xs.length || 1), score: xs.reduce((a, l) => a + transitionScore(l, 1) * l.ead, 0) / (e || 1) };
  }).sort((a, b) => b.s.transition - a.s.transition);

  const watch = loans.filter((l) => sectorOf(l.sector).transition >= 0.5 && !l.transitionPlan).sort((a, b) => b.ead - a.ead).slice(0, 8);

  return (
    <>
      <PageHead area="Area 3 · Transition risk" title="Transition risk" intro="Exposure to policy, carbon-price, technology and market shifts. Sector sensitivity is adjusted for each counterparty's emissions intensity and transition readiness." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Carbon-intensive sectors" value={pct(intEad / ead)} sub={ghs(intEad)} tone="warn" />
        <Stat label="With a credible transition plan" value={pct(plans / (intEad || 1))} sub="of carbon-intensive EAD" />
        <Stat label="Financed emissions" value={`${(financed / 1000).toFixed(0)}k tCO₂e`} sub="PCAF · detail on the Emissions page" />
        <Stat label="Sectors assessed" value={String(SECTORS.length)} sub="sensitivity scored 0–1" />
      </div>
      <Card title="Sector sensitivity and counterparty readiness" className="mt-6">
        <Table head={['Sector', 'Sensitivity', 'Carbon intensity', 'EAD', 'Share with plan', 'Counterparty score (max shock)']} align={['l', 'r', 'r', 'r', 'r', 'r']} rows={rows.map(({ s, e, plan, score }) => [
          <span key="n">{s.name} {s.transition >= 0.5 && <Badge tone="amber">carbon-intensive</Badge>}</span>, num(s.transition), `${s.carbonIntensity} t/GHS m`, ghs(e), pct(plan, 0), num(score),
        ])} />
        <p className="mt-3 text-xs text-zinc-500">Counterparty score = sector sensitivity × scenario shock × (0.6 + 0.4 × relative emissions intensity) × (1 − 60% relief if a credible transition plan exists).</p>
        <Illustrative />
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Transition sensitivity by sector"><Bars rows={rows.map((r) => ({ label: r.s.name, value: r.s.transition }))} format={(n) => num(n)} max={1} color="bg-sky-600" /></Card>
        <Card title="Engagement watch-list" note="carbon-intensive, no transition plan">
          <Table head={['Borrower', 'Sector', 'EAD', 'Intensity']} align={['l', 'l', 'r', 'r']} rows={watch.map((l) => [l.borrower, sectorOf(l.sector).name, ghs(l.ead), `${l.emissionsIntensity}`])} />
        </Card>
      </div>
    </>
  );
}
