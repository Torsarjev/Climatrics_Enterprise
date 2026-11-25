import Link from 'next/link';
import { activeLoans, db, getRun, screenRuns } from '@/lib/store';
import { financedBook } from '@/lib/emissions';
import { portfolioScreening } from '@/lib/esg/portfolio';
import { boardView } from '@/lib/board';
import { scenarioOf, sectorOf } from '@/lib/params';
import { Badge, PageHead, Table } from '@/components/ui';
import { PrintButton } from '@/components/print-button';
import { ghs, pct, when } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const { run: runId } = await searchParams;
  const d = await db();
  const id = runId ?? d.runs.find((r) => r.status === 'approved')?.id ?? d.runs[0]?.id;
  const found = id ? await getRun(id) : null;
  if (!found) return (<><PageHead area="Area 9 · Regulatory reporting" title="Reports" /><p className="text-sm text-zinc-600">No stress runs yet. <Link href="/stress" className="underline">Run one first</Link>.</p></>);
  const { rec, run } = found;
  const { loans, dataset } = await activeLoans();
  const S = run.summary, C = run.capital, Q = run.liquidity, L = run.lossDist;
  const ead = S.ead;
  const carbon = loans.filter((l) => sectorOf(l.sector).transition >= 0.5).reduce((a, l) => a + l.ead, 0);
  const sr = await screenRuns();
  const B = financedBook(loans);
  const P = await portfolioScreening(loans, sr, dataset.id);
  const V = await boardView(loans, sr, dataset.id);
  const bySectorEm = [...B.rows.reduce((m, x) => m.set(x.l.sector, (m.get(x.l.sector) ?? 0) + x.financed), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const t = (n: number) => `${(n / 1e3).toLocaleString('en-GB', { maximumFractionDigits: 0 })}k tCO₂e`;
  const highPhys = run.results.filter((r) => r.physical >= 0.5).reduce((a, r) => a + r.ead, 0);

  return (
    <>
      <PageHead area="Engine IV · Regulatory & management reporting" title="Climate risk regulatory pack" intro="Generated from an approved run. Structured to support Bank of Ghana climate-related disclosure and IFRS S2 metrics.">
        <div className="no-print flex items-center gap-2">
          {d.runs.length > 1 && <span className="text-xs text-zinc-500">Run:</span>}
          {d.runs.slice(0, 5).map((r) => <Link key={r.id} href={`/reports?run=${r.id}`} className={`font-mono text-xs ${r.id === rec.id ? 'font-bold underline' : 'text-zinc-500'}`}>{r.id}</Link>)}
          <PrintButton />
        </div>
      </PageHead>

      <article className="space-y-6 rounded-lg border border-zinc-200 bg-white p-8 print:border-0 print:p-0">
        {rec.status !== 'approved' && (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">DRAFT: this run has not been approved and is not for submission. Approve it on the run page first.</p>
        )}
        <header className="border-b border-zinc-200 pb-4">
          <p className="text-xs uppercase tracking-wider text-zinc-500">Demo Bank Ghana · Climate Risk Stress Test Report · synthetic</p>
          <h2 className="mt-1 text-xl font-semibold">{scenarioOf(rec.input.scenario).name} · horizon {rec.input.horizon}</h2>
          <p className="mt-1 text-sm text-zinc-600">Reporting date 30 Sep 2026 · Run {rec.id} · {rec.input.approach} · status <Badge tone={rec.status === 'approved' ? 'green' : 'amber'}>{rec.status}</Badge>{rec.reviewedBy && ` · approved by ${rec.reviewedBy}`}</p>
        </header>

        <section>
          <h3 className="mb-2 text-sm font-semibold">1. Summary</h3>
          <p className="text-sm text-zinc-700">
            Under the {scenarioOf(rec.input.scenario).name} scenario at {rec.input.horizon}, expected credit loss rises from {ghs(S.ecl)} to {ghs(S.eclStressed)}, requiring {ghs(S.eclStressed - S.ecl)} of additional provisions.
            The total capital ratio moves from {pct(C.carBefore)} to {pct(C.carAfter)} against a minimum of {pct(C.minimum, 0)}{C.carAfter < C.minimum ? ', a breach that would require a capital plan' : ', remaining above the minimum'}.
            The liquidity coverage ratio moves from {pct(Q.lcrBefore, 0)} to {pct(Q.lcrAfter, 0)}.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">2. Exposure and risk concentration</h3>
          <Table head={['Metric', 'Value']} align={['l', 'r']} rows={[
            ['Total credit exposure (EAD)', ghs(ead)], ['Exposure to carbon-intensive sectors', `${ghs(carbon)} (${pct(carbon / ead)})`],
            ['Exposure with high physical risk (under this scenario)', `${ghs(highPhys)} (${pct(highPhys / ead)})`], ['Facilities assessed', String(S.loans)],
          ]} />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">3. Credit impact</h3>
          <Table head={['Metric', 'Base', 'Stressed']} align={['l', 'r', 'r']} rows={[
            ['Weighted PD (performing)', pct(S.pd, 2), pct(S.pdStressed, 2)], ['Weighted LGD', pct(S.lgd), pct(S.lgdStressed)], [rec.input.eclModel ? 'Stage-based discounted ECL' : 'Legacy one-year ECL', ghs(S.ecl), ghs(S.eclStressed)],
            ['Stage 2 exposure', ghs(S.stages[1].before), ghs(S.stages[1].after)], ['Stage 3 exposure', ghs(S.stages[2].before), ghs(S.stages[2].after)],
            ['Credit VaR 99.9%', ghs(L.base.var999), ghs(L.stressed.var999)], ['Economic capital', ghs(L.base.economicCapital), ghs(L.stressed.economicCapital)],
          ]} />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">4. Most affected sectors</h3>
          <Table head={['Sector', 'EAD', 'ECL base', 'ECL stressed']} align={['l', 'r', 'r', 'r']} rows={S.bySector.filter((s) => s.ead > 0).sort((a, b) => b.eclStressed - b.ecl - (a.eclStressed - a.ecl)).slice(0, 6).map((s) => [s.name, ghs(s.ead), ghs(s.ecl), ghs(s.eclStressed)])} />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">5. Capital and liquidity (ICAAP / ILAAP)</h3>
          <Table head={['Metric', 'Base', 'Stressed', 'Minimum']} align={['l', 'r', 'r', 'r']} rows={[
            ['Total capital ratio', pct(C.carBefore), pct(C.carAfter), pct(C.minimum, 0)], ['CET1 ratio', pct(C.cet1Before), pct(C.cet1After), '—'], ['Liquidity coverage ratio', pct(Q.lcrBefore, 0), pct(Q.lcrAfter, 0), pct(Q.minimum, 0)],
          ]} />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">6. Financed emissions (PCAF)</h3>
          <Table head={['Metric', 'Value']} align={['l', 'r']} rows={[
            ['Financed emissions (Scope 1 and 2 of borrowers)', t(B.total)], ['Emissions intensity', `${B.intensity.toFixed(0)} tCO₂e per GHS m lent`],
            ['Exposure-weighted data quality score (1 best, 5 worst)', B.dqWeighted.toFixed(1)],
            ...bySectorEm.map(([k, v]) => [`  ${sectorOf(k as Parameters<typeof sectorOf>[0]).name}`, `${t(v)} (${pct(v / B.total)})`]),
          ]} />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">7. Sustainability screening (Engine I)</h3>
          <Table head={['Metric', 'Value']} align={['l', 'r']} rows={[
            ['Taxonomy-aligned exposure (approved screenings only)', `${ghs(P.tax.aligned)} (${pct(P.alignedRatio, 2)})`], ['Eligible, pending evidence or approval', `${ghs(P.tax.pending)} (${pct(P.tax.pending / P.ead)})`],
            ['ESMS high-risk facilities', `${P.tier.High.n} · ${ghs(P.tier.High.ead)}`], ['Exclusion-list hits', `${P.gate.excluded.n} (${P.gate.review.n} under review)`],
            ['NDC-contributing exposure', ghs(P.ndcTotal)], ['SDG-contributing exposure', ghs(P.sdgTotal)],
          ]} />
          <p className="mt-2 text-xs text-zinc-500">Rule fingerprint {P.fingerprint}; {P.screenedByAnalyst} analyst screenings, the rest from the loan extract.</p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">8. Risk appetite and management actions</h3>
          <Table head={['Limit', 'Current', 'Limit', 'Status']} align={['l', 'r', 'r', 'l']} rows={V.limits.map((l) => [`${l.id} ${l.metric}`, l.display, l.limitDisplay, <Badge key={l.id} tone={l.status === 'breach' ? 'red' : l.status === 'warning' ? 'amber' : 'green'}>{l.status === 'breach' ? 'Breach' : l.status === 'warning' ? 'Early warning' : 'Within'}</Badge>])} />
          <p className="mt-3 text-xs font-semibold uppercase text-zinc-500">Open actions ({V.actions.length})</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">{V.actions.slice(0, 8).map((a, i) => <li key={i}>{a.subject}: {a.action} ({a.owner})</li>)}</ul>
          <p className="mt-2 text-xs text-zinc-500">Limits are assessed on the active portfolio across all three NGFS views, not only this run. Thresholds are illustrative until set by the Board.</p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">9. Methodology, data and governance</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
            <li>Data: {dataset.name} ({dataset.id}, SHA-256 {dataset.hash.slice(0, 16)}…), {dataset.control.rowsAccepted} facilities accepted, {dataset.control.rowsRejected} rejected, reconciled.</li>
            <li>Model {rec.modelVersion}; hazard data {rec.hazardVersion}; parameters {rec.paramsHash.slice(0, 16)}…; loss simulation seed {rec.seed}.</li>
            <li>Prepared by {rec.by} on {when(rec.createdAt)}{rec.reviewedBy ? `; approved by ${rec.reviewedBy} on ${rec.reviewedAt ? when(rec.reviewedAt) : ''}` : '; not yet approved'}.</li>
            <li>Limitations: synthetic portfolio; illustrative scenario and model parameters pending methodology sign-off and independent validation.</li>
          </ul>
        </section>
      </article>
    </>
  );
}
