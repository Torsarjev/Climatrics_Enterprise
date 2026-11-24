import Link from 'next/link';
import { activeLoans, screenRuns } from '@/lib/store';
import { portfolioScreening } from '@/lib/esg/portfolio';
import { Bars, Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { ghs, pct } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function PortfolioScreeningPage() {
  const { dataset, loans } = await activeLoans();
  const P = await portfolioScreening(loans, await screenRuns(), dataset.id);
  const share = (n: number) => `${pct(n / P.ead)} · ${ghs(n)}`;

  return (
    <>
      <PageHead area="Engine I · Portfolio screening" title="Portfolio sustainability screening" intro={`All ${P.facilities.toLocaleString()} facilities screened with the same versioned rules. Facilities without an analyst screening use the data in the loan extract, so most sustainability answers are unknown and stay unknown. Aligned exposure counts only activities in approved screenings.`}>
        <Link href="/screening" className="text-sm text-[#3a5a45] underline">← Screen a facility</Link>
      </PageHead>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Taxonomy-aligned exposure" value={pct(P.alignedRatio, 2)} sub={`${ghs(P.tax.aligned)} of ${ghs(P.ead)} · approved activities only`} tone="good" />
        <Stat label="Eligible, pending evidence or approval" value={ghs(P.tax.pending)} sub={pct(P.tax.pending / P.ead)} tone="warn" />
        <Stat label="ESMS high risk" value={pct(P.tier.High.ead / P.ead)} sub={`${P.tier.High.n} facilities · ${ghs(P.tier.High.ead)}`} tone="bad" />
        <Stat label="Exclusion-list hits" value={String(P.gate.excluded.n)} sub={`${P.gate.review.n} uncertain, sent to review`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Green Taxonomy (reported separately, never netted)">
          <Bars rows={[{ label: 'Aligned (approved)', value: P.tax.aligned }, { label: 'Eligible pending', value: P.tax.pending }, { label: 'Not aligned', value: P.tax['not aligned'] }, { label: 'Unassessed', value: P.tax.unassessed }]} format={share} />
          {P.alignedFrom.length > 0 && <p className="mt-3 text-xs text-zinc-600">Aligned exposure comes from: {P.alignedFrom.map((a) => <Link key={a.runId} href={`/screening/${a.runId}`} className="mr-2 underline">{a.facilityId} ({ghs(a.amount)}, {a.runId})</Link>)}</p>}
          <p className="mt-2 text-xs text-zinc-500">Aligned ratio = aligned exposure from distinct approved activity allocations ÷ total outstanding.</p>
        </Card>
        <Card title="ESMS">
          <Table head={['', 'Facilities', 'Exposure']} align={['l', 'r', 'r']} rows={[
            ['Exclusion gate: pass', P.gate.pass.n, share(P.gate.pass.ead)], ['Exclusion gate: review', P.gate.review.n, share(P.gate.review.ead)], ['Exclusion gate: excluded', P.gate.excluded.n, share(P.gate.excluded.ead)],
            ['Risk: High (enhanced due diligence)', P.tier.High.n, share(P.tier.High.ead)], ['Risk: Medium', P.tier.Medium.n, share(P.tier.Medium.ead)], ['Risk: Low', P.tier.Low.n, share(P.tier.Low.ead)],
          ]} />
        </Card>
        <Card title="Ghana NDC contribution" note={`${ghs(P.ndcTotal)} in total, counted once per facility`}>
          <Table head={['Programme', 'Objective', 'Facilities', 'Potential', 'Verified']} align={['l', 'l', 'r', 'r', 'r']}
            rows={P.ndc.map((n) => [n.programme, n.objective, n.facilities, ghs(n.potential), ghs(n.verified)])} />
        </Card>
        <Card title="SDG contribution" note={`${ghs(P.sdgTotal)} in total, counted once per facility`}>
          <Table head={['Target', 'Facilities', 'Exposure']} align={['l', 'r', 'r']} rows={P.sdg.map((s) => [`SDG ${s.target}`, s.facilities, share(s.exposure)])} />
          <p className="mt-3 text-xs font-semibold uppercase text-zinc-500">Adverse-impact flags</p>
          {P.adverse.length ? <Table head={['Target', 'Flag', 'Facilities', 'Exposure']} align={['l', 'l', 'r', 'r']} rows={P.adverse.map((a) => [a.target, a.title, a.n, ghs(a.exposure)])} /> : <p className="text-sm text-zinc-500">None identified from the data available.</p>}
        </Card>
      </div>

      <Card title="How this run is produced" className="mt-6">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Every facility is evaluated with the same rule versions; the run fingerprint <span className="font-mono">{P.fingerprint}</span> changes only if the data, rules or approved screenings change, so bulk runs are repeatable.</li>
          <li>{P.screenedByAnalyst} facilit{P.screenedByAnalyst === 1 ? 'y has' : 'ies have'} an analyst screening; the latest approved run is used where one exists. The rest use the loan extract: sector, region, purpose and exposure.</li>
          <li>One financed activity per facility is inferred from sector and purpose; “working capital” is unassessed because the use of funds is not specified.</li>
          <li>Unknown answers stay unknown; they are reported as gaps and never counted as compliant.</li>
          <li>Results feed Engines II–VI: risk flags and sites to physical risk and stress testing, evidence to disclosure, activities to financed emissions, actions to governance.</li>
        </ul>
        <Illustrative>Provisional rules and synthetic borrowers. Figures are produced from the rules on every load; none are hard-coded.</Illustrative>
      </Card>
    </>
  );
}
