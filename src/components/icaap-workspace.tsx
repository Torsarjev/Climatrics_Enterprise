import Link from 'next/link';
import { IcaapForm, IcaapReview } from './icaap-form';
import { Badge, Card, PageHead, Table } from './ui';
import { EvidenceCards } from './evidence-cards';
import { ghs, pct, when } from '@/lib/fmt';
import { GCB_PATHWAYS } from '@/lib/gcb-scenarios';
import type { IcaapAssessment } from '@/lib/icaap';
import type { RunRecord, User } from '@/lib/store';

export function IcaapWorkspace({ runs, history, assessment, user }: {
  runs: RunRecord[]; history: IcaapAssessment[]; assessment?: IcaapAssessment; user: User;
}) {
  const choices = GCB_PATHWAYS.map(({ key, name, years }) => {
    const eligible = runs.filter((run) => run.input.scenario === key && run.batchId && run.reporting);
    const batches = [...new Set(eligible.map((run) => run.batchId!))].flatMap((id) => {
      const rows = eligible.filter((run) => run.batchId === id);
      if (rows.length !== years.length || years.some((year) => !rows.some((run) => run.input.horizon === year)) || rows.some((run) => run.status === 'rejected')) return [];
      return [{ id, datasetHash: rows[0].datasetHash, paramsHash: rows[0].paramsHash, approach: rows[0].input.approach, label: `${rows.at(-1)!.id}–${rows[0].id} · ${rows[0].datasetId} · ${rows[0].input.approach} · ${rows.every((run) => run.status === 'approved') ? 'approved' : 'review pending'}` }];
    });
    return { key, name, years, batches };
  });
  const mayRun = user.can.includes('run' as never);
  const mayApprove = user.can.includes('approve' as never);
  const rows = assessment?.rows ?? [];
  const worst = [...rows].sort((a, b) => a.stressed.totalRatio - b.stressed.totalRatio)[0];
  const breaches = rows.filter((row) => row.stressed.shortfall > 0);
  const largest = [...rows].sort((a, b) => b.stressed.shortfall - a.stressed.shortfall)[0];
  const reviewActions = assessment?.status === 'draft' && mayRun && assessment.by === user.name ? ['submit'] as const
    : assessment?.status === 'submitted' && mayApprove && assessment.by !== user.name ? ['approve', 'reject'] as const : [];
  return <>
    <PageHead area="ICAAP · Portfolio capital" title="Climate capital adequacy" intro="Project baseline and stressed regulatory capital for all three GCB pathways using saved Engine III credit-loss outputs and a separate finance baseline.">
      <Link href="/stress" className="text-sm underline">Scenario Analysis</Link>
    </PageHead>

    {assessment && <div className="mb-6 space-y-5">
      <Card title="Assessment evidence" note={<Badge tone={assessment.status === 'approved' ? 'green' : assessment.status === 'rejected' ? 'red' : 'amber'}>{assessment.status}</Badge>}>
        <p className="break-all text-sm">{assessment.id} · {assessment.opening.entity} · {assessment.opening.portfolio} · opening {assessment.opening.asOf}</p>
        <p className="mt-2 text-sm">{assessment.opening.illustrative ? 'Illustrative finance inputs' : 'Finance reference'} · {assessment.opening.source} · GHS · {assessment.datasetId} · {assessment.version}</p>
        <p className="mt-2 text-sm">Created by {assessment.by} · {when(assessment.createdAt)}{assessment.reviewer ? ` · ${assessment.status} by ${assessment.reviewer} on ${when(assessment.reviewedAt!)}` : ''}</p>
        {assessment.note && <p className="mt-2 text-sm">{assessment.note}</p>}
        <p className="mt-2 break-all text-xs text-zinc-600">Evidence SHA-256 {assessment.evidenceHash}</p>
        <a href={`/api/icaap?id=${assessment.id}`} className="mt-3 inline-block text-sm underline">Download assessment and audit evidence (JSON)</a>
        <a href={`/api/icaap?id=${assessment.id}&format=csv`} className="ml-4 inline-block text-sm underline">Download reporting results (CSV)</a>
        {reviewActions.length > 0 && <IcaapReview id={assessment.id} actions={[...reviewActions]} />}
      </Card>

      <EvidenceCards key={assessment.id} label="ICAAP assessment metrics" items={[
        { id: 'car', label: 'Lowest stressed total capital ratio', value: pct(worst.stressed.totalRatio, 2), sub: `${worst.pathway} · ${worst.source.year}`,
          evidence: <p>Eligible capital {ghs(worst.stressed.total)} ÷ {ghs(worst.stressed.rwa)} RWA. Configured total requirement {pct(assessment.opening.totalMin, 2)}.</p> },
        { id: 'breaches', label: 'Periods below requirement', value: String(breaches.length), sub: `of ${rows.length} scenario periods`,
          evidence: breaches.length ? <Table head={['Pathway', 'Year', 'CET1 headroom', 'Tier 1 headroom', 'Total headroom']} rows={breaches.map((row) => [row.pathway, row.source.year, ghs(row.stressed.headroom.cet1), ghs(row.stressed.headroom.tier1), ghs(row.stressed.headroom.total)])} /> : <p>All tested periods meet the configured CET1, Tier 1 and total capital requirements.</p> },
        { id: 'shortfall', label: 'Largest capital shortfall', value: ghs(largest.stressed.shortfall),
          evidence: <p>Largest shortfall across all three requirements and scenario periods. {largest.stressed.shortfall > 0 ? `${largest.pathway} · ${largest.source.year}. Test an eligible CET1 injection, dividend restraint, or credit RWA reduction in the finance file.` : 'No period has a capital shortfall.'}</p> },
      ]} />

      <Card title="Capital projections by pathway and reporting year">
        <p className="mb-3 text-sm text-zinc-600">GCB decision windows in this workspace are short term (orderly, 2027–2029), medium term (disorderly, 2030–2034), and long term (Current Policies, 2035–2050). The table uses the upstream reporting years, with period flows spanning any gaps.</p>
        <Table head={['Pathway / year', 'Period impairment base → stressed', 'Eligible capital base → stressed', 'RWA base → stressed', 'CET1 base → stressed', 'Tier 1 base → stressed', 'Total ratio base → stressed', 'Binding headroom', 'Reverse stress']} rows={rows.map((row) => [
          <Link key={row.source.runId} href={`#icaap-${row.source.scenario}-${row.source.year}`} className="underline">{row.pathway} · {row.source.year}</Link>,
          `${ghs(row.baselineExpense)} → ${ghs(row.stressedExpense)}`, `${ghs(row.baseline.total)} → ${ghs(row.stressed.total)}`, `${ghs(row.baseline.rwa)} → ${ghs(row.stressed.rwa)}`,
          `${pct(row.baseline.cet1Ratio, 2)} → ${pct(row.stressed.cet1Ratio, 2)}`, `${pct(row.baseline.tier1Ratio, 2)} → ${pct(row.stressed.tier1Ratio, 2)}`,
          `${pct(row.baseline.totalRatio, 2)} → ${pct(row.stressed.totalRatio, 2)}`, ghs(Math.min(...Object.values(row.stressed.headroom))), ghs(row.stressed.reverseStress),
        ])} />
        <p className="mt-3 text-sm text-zinc-600">Reverse stress is the additional after-tax CET1 loss that would use up the binding headroom, holding RWA and other capital fixed.</p>
      </Card>

      <Card title="Reporting-year reconciliation and action register">
        {rows.map((row) => <details key={row.source.runId} id={`icaap-${row.source.scenario}-${row.source.year}`} className="scroll-mt-4 border-b border-zinc-200 py-3 last:border-0 target:bg-lime-50">
          <summary className="cursor-pointer text-sm font-medium">{row.pathway} · {row.source.year} · {row.source.runId}</summary>
          <div className="space-y-3 py-3 text-sm">
            <p>{row.source.facilities} facilities · {row.source.borrowers ?? 'unavailable'} distinct borrower IDs · source status at execution {row.source.status} · {row.source.version}.</p>
            <p><Link href={`/runs/${row.source.runId}`} className="underline">Open source run</Link> · <Link href={`/runs/batch/${row.source.batchId}`} className="underline">Open source batch</Link></p>
            <Table head={['Bridge item', 'Baseline', 'Stressed']} rows={[
              ['Opening ECL stock', ghs(row.previousBase), ghs(row.previousStress)], ['Closing ECL stock', ghs(row.source.baseline), ghs(row.source.stressed)],
              ['Period impairment expense', ghs(row.baselineExpense), ghs(row.stressedExpense)], ['After-tax period profit', ghs(row.baselineProfit), ghs(row.stressedProfit)],
              ['Opening CET1', ghs(row.baseOpeningCet1), ghs(row.stressOpeningCet1)], ['Closing CET1', ghs(row.baseline.cet1), ghs(row.stressed.cet1)],
              ['CET1 headroom', ghs(row.baseline.headroom.cet1), ghs(row.stressed.headroom.cet1)], ['Tier 1 headroom', ghs(row.baseline.headroom.tier1), ghs(row.stressed.headroom.tier1)], ['Total headroom', ghs(row.baseline.headroom.total), ghs(row.stressed.headroom.total)],
            ]} />
            <p>Incremental period impairment {ghs(row.incrementalExpense)}. Net write-offs and recoveries are shared assumptions for both paths.</p>
            <p>Stressed total capital ratio before actions {pct(row.unmitigated.totalRatio, 2)} → after actions {pct(row.stressed.totalRatio, 2)}. Shortfall {ghs(row.unmitigated.shortfall)} → {ghs(row.stressed.shortfall)}.</p>
            <p>Applied stress actions · CET1 injection {ghs(row.finance.injection)} · dividends retained {ghs(row.finance.dividendRestraint)} · credit RWA reduction {ghs(row.finance.rwaReduction)}.</p>
            <Table head={['Sector', 'Baseline closing ECL', 'Stressed closing ECL']} rows={row.source.sectors.map((sector) => [sector.name, ghs(sector.baseline), ghs(sector.stressed)])} />
          </div>
        </details>)}
      </Card>
    </div>}

    {mayRun && <Card title="Run a capital assessment" className="mb-6">
      <IcaapForm choices={choices} />
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium">Finance CSV field guide</summary>
        <p className="mt-2">Enter all amounts in GHS, with one row per scenario and reporting year. The legal entity and portfolio must refer to the entire selected Engine III extract. Period amounts cover the interval from the opening date or previous reporting date.</p>
        <Table head={['Fields', 'What to enter']} rows={[
          ['income, writeoffs, recoveries, dividends', 'Pre-provision income, allowance write-offs, recoveries credited to allowance, and planned distributions for the period.'],
          ['adjustments', 'Net signed CET1 impact of capital adjustments and deductions for the period.'],
          ['creditRwa, marketRwa, operationalRwa, otherRwa', 'Closing baseline RWA by risk class. Use otherRwa for balances that are outside the named classes.'],
          ['stressCreditRwaDelta', 'Signed change in closing credit RWA under stress before actions.'],
          ['injection, dividendRestraint, rwaReduction', 'Period eligible CET1 injection, period dividend savings, and reduction to closing stressed credit RWA.'],
        ]} />
      </details>
    </Card>}
    <Card title="Saved ICAAP assessments" className="mb-6">
      {history.length ? <Table head={['Assessment', 'Entity', 'Maker', 'Status', 'Created']} rows={history.map((item) => [
        <Link key={item.id} href={`/capital?assessment=${item.id}`} className="underline">{item.id}</Link>, item.opening.entity, item.by, item.status, when(item.createdAt),
      ])} /> : <p className="text-sm text-zinc-600">No dedicated ICAAP assessments have been saved.</p>}
    </Card>
    <Card title="Projection method">
      <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
        <li>Each pathway starts from the same opening balance sheet. Illustrative finance uses opening inputs from the form, loan exposure plus bundled other RWA, and zero earnings and management actions. The selected Engine III batches all use the same full loan-book snapshot, credit approach and scenario parameter fingerprint. Facility, sector and saved portfolio ECL totals reconcile to one pesewa.</li>
        <li>Period impairment equals closing ECL minus opening allowance plus write-offs minus recoveries. Each reporting date becomes the next period’s opening allowance. Enter income, write-offs, recoveries, dividends and adjustments for the entire interval between reporting dates. RWA fields represent closing balances.</li>
        <li>CET1 rolls forward by after-tax profit, dividends, adjustments and tested capital actions. Tax applies to positive profits. Opening eligible AT1 and Tier 2 are held constant. Credit RWA stress and reductions come from the finance input.</li>
        <li>Headroom compares each capital tier with its configured requirement including buffers. The reported shortfall is the amount of additional eligible CET1 needed to restore all three requirements at fixed RWA.</li>
        <li>Source runs can be previewed before approval. An independent checker can approve the ICAAP assessment after every source run is approved. The finance reference identifies the bank return or internal reconciliation for review.</li>
      </ul>
    </Card>
  </>;
}
