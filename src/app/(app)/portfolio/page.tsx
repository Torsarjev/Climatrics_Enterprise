import { activeLoans } from '@/lib/store';
import { COLLATERAL, REGIONS, SECTORS } from '@/lib/params';
import { Bars, Card, PageHead, Stat, Table } from '@/components/ui';
import { ghs, pct } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
  const { loans } = await activeLoans();
  const ead = loans.reduce((a, l) => a + l.ead, 0);
  const group = <K extends string>(key: (l: (typeof loans)[number]) => K) => {
    const m = new Map<K, number>();
    loans.forEach((l) => m.set(key(l), (m.get(key(l)) ?? 0) + l.ead));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const bySector = group((l) => l.sector).map(([k, v]) => ({ label: SECTORS.find((s) => s.key === k)!.name, value: v }));
  const byRegion = group((l) => l.region).map(([k, v]) => ({ label: k, value: v }));
  const byColl = group((l) => l.collateralType).map(([k, v]) => ({ label: COLLATERAL[k].name, value: v }));
  const bucket = (y: number) => (y <= 1 ? '≤ 1 year' : y <= 3 ? '1–3 years' : y <= 5 ? '3–5 years' : y <= 10 ? '5–10 years' : '> 10 years');
  const order = ['≤ 1 year', '1–3 years', '3–5 years', '5–10 years', '> 10 years'];
  const byMat = group((l) => bucket(l.maturityYears)).sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0])).map(([k, v]) => ({ label: k, value: v }));
  const byStage = [1, 2, 3].map((s) => ({ label: `Stage ${s}`, value: loans.filter((l) => l.stage === s).reduce((a, l) => a + l.ead, 0) }));
  const top = [...loans].sort((a, b) => b.ead - a.ead).slice(0, 10);
  const top10 = top.reduce((a, l) => a + l.ead, 0);
  const secured = loans.reduce((a, l) => a + Math.min(l.collateralValue, l.ead), 0);
  const share = (n: number) => `${pct(n / ead)} · ${ghs(n)}`;
  const wPd = loans.filter((l) => l.pd < 1).reduce((a, l) => a + l.pd * l.ead, 0) / loans.filter((l) => l.pd < 1).reduce((a, l) => a + l.ead, 0);

  return (
    <>
      <PageHead area="Area 1 · Portfolio mapping & tagging" title="Portfolio exposure" intro="The book is tagged by sector, geography, collateral and maturity. These tags drive every downstream climate assessment." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat href="/methodology#exposure" label="Total EAD" value={ghs(ead)} sub={`${loans.length} facilities in ${REGIONS.length} regions`} />
        <Stat href="/methodology#pd" label="Weighted PD (performing)" value={pct(wPd, 2)} sub="bank's own PD model" />
        <Stat href="/methodology#collateral" label="Collateral cover" value={pct(secured / ead, 0)} sub="capped at exposure" />
        <Stat href="/methodology#concentration" label="Top-10 concentration" value={pct(top10 / ead)} sub={ghs(top10)} tone="warn" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="By sector"><Bars rows={bySector} format={share} /></Card>
        <Card title="By region"><Bars rows={byRegion} format={share} /></Card>
        <Card title="By collateral type"><Bars rows={byColl} format={share} /></Card>
        <div className="space-y-6">
          <Card title="By residual maturity"><Bars rows={byMat} format={share} /></Card>
          <Card title="By IFRS 9 stage"><Bars rows={byStage} format={share} /></Card>
        </div>
      </div>
      <Card title="Largest exposures by borrower" className="mt-6">
        <Table head={['Facility', 'Borrower', 'Sector', 'Region', 'EAD', 'Collateral', 'Maturity', 'PD']} align={['l', 'l', 'l', 'l', 'r', 'l', 'r', 'r']} rows={top.map((l) => [
          <span key="i" className="font-mono text-xs">{l.id}</span>, l.borrower, SECTORS.find((s) => s.key === l.sector)!.name, l.region, ghs(l.ead), COLLATERAL[l.collateralType].name, `${l.maturityYears}y`, l.pd >= 1 ? 'Default' : pct(l.pd, 2),
        ])} />
      </Card>
    </>
  );
}
