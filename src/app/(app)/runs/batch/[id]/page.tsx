import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge, Card, PageHead, Table } from '@/components/ui';
import { ghs, pct, pp, when } from '@/lib/fmt';
import { CALIBRATION_VERSION } from '@/lib/calibration';
import { scenarioOf } from '@/lib/params';
import { scenarioBatchRuns } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function ScenarioBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const records = await scenarioBatchRuns(id);
  const first = records[0];
  if (!first) notFound();
  const pathway = scenarioOf(first.input.scenario);
  return (
    <>
      <PageHead area="Engine III · Multi-year assessment" title={`${pathway.name} · reporting years`}
        intro={`${records.map((rec) => rec.input.horizon).join(', ')} · ${first.input.approach} · ${first.datasetId} · Run by ${first.by} on ${when(first.createdAt)}`}>
        <Link href={`/reports?batch=${id}`} className="rounded-md bg-lime-200 px-3 py-2 text-sm font-semibold">Regulatory pack</Link>
        <a href={`/api/runs/batch/${id}`} className="rounded-md bg-lime-200 px-3 py-2 text-sm font-semibold">Download audit CSV</a>
        <Link href="/stress" className="text-sm underline">Scenario analysis</Link>
      </PageHead>
      <Card title="Year-by-year impact" note="GHS amounts and percentage-point changes">
        <Table head={['Reporting year / run', 'ECL base → stressed', 'Incremental ECL', 'Pre-tax profit impact', 'Capital base → stressed', 'CAR base → stressed', 'LCR base → stressed', 'Review status']}
          rows={records.map((rec) => {
            const report = rec.reporting!;
            const { headline } = rec;
            return [
              <Link key="year" href={`/runs/${rec.id}`} className="whitespace-nowrap font-medium underline">{rec.input.horizon} · {rec.id}</Link>,
              `${ghs(headline.ecl)} → ${ghs(headline.eclStressed)}`,
              ghs(report.incrementalEcl), ghs(report.profitBeforeTaxImpact),
              `${ghs(report.capitalBefore)} → ${ghs(report.capitalAfter)}`,
              <span key="car" className="whitespace-nowrap">{pct(headline.carBefore, 2)} → {pct(headline.carAfter, 2)}<span className="block text-xs">{pp(headline.carAfter - headline.carBefore, 2)} · <Link href={`/capital?run=${rec.id}`} className="underline">ICAAP</Link></span></span>,
              <span key="lcr" className="whitespace-nowrap">{pct(report.lcrBefore, 2)} → {pct(headline.lcrAfter, 2)}<span className="block text-xs">{pp(headline.lcrAfter - report.lcrBefore, 2)} · <Link href={`/liquidity?run=${rec.id}`} className="underline">ILAAP</Link></span></span>,
              <Badge key="status" tone={rec.status === 'approved' ? 'green' : rec.status === 'submitted' ? 'amber' : rec.status === 'rejected' ? 'red' : 'zinc'}>{rec.status}</Badge>,
            ];
          })} />
        <p className="mt-4 text-sm text-zinc-600">Pre-tax profit impact is baseline ECL minus stressed ECL. It measures the incremental provision only. Total bank profit requires a separate earnings forecast. Each year stresses the same saved loan book independently, so the rows are point-in-time results with no cumulative total.</p>
      </Card>
      <Card title="Batch audit trail" className="mt-6">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-zinc-500">Batch reference</dt><dd className="break-all font-mono">{id}</dd></div>
          <div><dt className="text-zinc-500">Dataset fingerprint</dt><dd className="break-all font-mono">{first.datasetHash}</dd></div>
          <div><dt className="text-zinc-500">Ghana calibration</dt><dd><Link className="underline" href={`/calibration?run=${first.id}&scenario=${first.input.scenario}`}>{first.input.calibration?.id ?? CALIBRATION_VERSION}</Link></dd></div>
          <div><dt className="text-zinc-500">Model version</dt><dd>{first.modelVersion}</dd></div>
          <div><dt className="text-zinc-500">Parameters fingerprint</dt><dd className="break-all font-mono">{first.paramsHash}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-zinc-600">Open an individual run to inspect the scenario variables, recalculate the result, or submit it for independent review. The CSV includes the full output fingerprints, review status and unrounded measures.</p>
      </Card>
    </>
  );
}
