import { activeLoans } from '@/lib/store';
import { SECTORS, sectorOf } from '@/lib/params';
import { DQ_SHORT, financedBook } from '@/lib/emissions';
import { Bars, Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { ghs, pct } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const t = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}m` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(0));

export default async function EmissionsPage() {
  const { loans } = await activeLoans();
  const B = financedBook(loans);
  const bySector = SECTORS.map((s) => {
    const xs = B.rows.filter((x) => x.l.sector === s.key);
    const ead = xs.reduce((a, x) => a + x.l.ead, 0), fe = xs.reduce((a, x) => a + x.financed, 0);
    return { s, ead, fe, intensity: fe / (ead / 1e6), dq: xs.reduce((a, x) => a + x.dq * x.l.ead, 0) / ead };
  }).sort((a, b) => b.fe - a.fe);
  const dqDist = [1, 2, 3, 4, 5].map((q) => ({ label: `${q} · ${DQ_SHORT[q]}`, value: B.rows.filter((x) => x.dq === q).reduce((a, x) => a + x.l.ead, 0) / B.ead }));
  const top = [...B.rows].sort((a, b) => b.financed - a.financed).slice(0, 10);
  const carbonShare = bySector.filter((x) => x.s.transition >= 0.5).reduce((a, x) => a + x.fe, 0) / B.total;

  return (
    <>
      <PageHead area="Engine V · Financed emissions (PCAF)" title="Financed emissions" intro="The emissions the bank finances through its lending, measured with the PCAF Global GHG Accounting Standard for business loans. Each borrower’s emissions are attributed to the bank in proportion to its share of the borrower’s financing, with a data quality score for every number." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Financed emissions" value={`${t(B.total)} tCO₂e`} sub="scope 1 + 2 of borrowers, per year" />
        <Stat label="Emissions intensity" value={`${B.intensity.toFixed(0)} t`} sub="tCO₂e per GHS m lent" />
        <Stat label="From carbon-intensive sectors" value={pct(carbonShare)} sub="of financed emissions" tone="warn" />
        <Stat label="Data quality score" value={B.dqWeighted.toFixed(1)} sub="exposure-weighted · 1 best, 5 worst" tone={B.dqWeighted > 3.5 ? 'warn' : undefined} />
      </div>

      <Card title="How it is calculated" className="mt-6">
        <p className="rounded-md bg-zinc-50 px-3 py-2 font-mono text-sm">financed emissions = (outstanding amount ÷ borrower’s total equity + debt) × borrower’s emissions</p>
        <p className="mt-2 text-sm text-zinc-600">The first term is the <b>attribution factor</b>. Borrower emissions come from reported data where available (score 1–2), otherwise from activity data or sector emission factors (score 3–5). Scores improve as clients disclose, which the engagement programme tracks.</p>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Financed emissions by sector" note="tCO₂e per year">
          <Bars rows={bySector.map((x) => ({ label: x.s.name, value: x.fe }))} format={t} color="bg-zinc-700" />
        </Card>
        <Card title="Data quality" note="share of exposure by PCAF score">
          <Bars rows={dqDist} format={(n) => pct(n)} color="bg-sky-600" />
        </Card>
      </div>

      <Card title="Sector detail" className="mt-6">
        <Table head={['Sector', 'EAD', 'Financed tCO₂e', 'Share', 'Intensity (t / GHS m)', 'Data quality']} align={['l', 'r', 'r', 'r', 'r', 'r']}
          rows={bySector.map((x) => [x.s.name, ghs(x.ead), t(x.fe), pct(x.fe / B.total), x.intensity.toFixed(0), x.dq.toFixed(1)])} />
      </Card>

      <Card title="Largest financed emitters" className="mt-6" note="engagement priorities">
        <Table head={['Facility', 'Borrower', 'Sector', 'EAD', 'Attribution', 'Borrower tCO₂e', 'Financed tCO₂e', 'Score', 'Plan']} align={['l', 'l', 'l', 'r', 'r', 'r', 'r', 'r', 'l']}
          rows={top.map((x) => [<span key="i" className="font-mono text-xs">{x.l.id}</span>, x.l.borrower, sectorOf(x.l.sector).name, ghs(x.l.ead), pct(x.attribution), t(x.companyEmissions), t(x.financed), x.dq, x.l.transitionPlan ? 'Yes' : 'No'])} />
        <Illustrative>Borrower emissions, revenues and balance sheets are synthetic. Production uses client disclosures, ESMS questionnaires and PCAF emission factors, with scope 3 added for sectors where PCAF requires it.</Illustrative>
      </Card>
    </>
  );
}
