import Link from 'next/link';
import { Badge, Table } from '@/components/ui';
import { ghs, pct, pp, when } from '@/lib/fmt';
import { GCB_PATHWAYS } from '@/lib/gcb-scenarios';
import { scenarioOf } from '@/lib/params';
import type { ReportingBatch } from '@/lib/reporting-batches';

const statusTone = { approved: 'green', draft: 'zinc', submitted: 'amber', rejected: 'red' } as const;

export function MultiYearReport({ batches, board = false }: { batches: ReportingBatch[]; board?: boolean }) {
  return (
    <div className="space-y-5">
      {batches.map((batch) => {
        const { first, records } = batch;
        const expected = GCB_PATHWAYS.find((pathway) => pathway.key === first.input.scenario);
        const missing = expected?.years.filter((year) => !records.some((record) => record.input.horizon === year)) ?? [];
        return (
          <section key={batch.id} className="space-y-3 rounded-lg border border-zinc-200 p-3 sm:p-4 print:p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-base font-semibold">{scenarioOf(first.input.scenario).name}</h4>
              <Badge tone={batch.approved ? 'green' : 'amber'}>{batch.approved ? 'All included years approved' : 'Pending approval or rejected years'}</Badge>
            </div>
            <p className="text-sm text-zinc-600">{first.input.approach} · dataset {first.datasetId} · model {first.modelVersion} · {when(first.createdAt)}</p>
            {missing.length > 0 && <p className="text-sm font-medium text-amber-900">Reporting years outside this batch: {missing.join(', ')}.</p>}
            <Table head={['Year / run', 'ECL baseline / stressed', 'Pre-tax profit impact', 'Capital and CAR baseline / stressed', 'LCR baseline / stressed', 'Review']}
              rows={records.map((rec) => {
                const { headline: h, reporting: r } = rec;
                return [
                  <span key="year"><b>{rec.input.horizon}</b><Link href={`/runs/${rec.id}`} className="block text-xs underline">{rec.id}</Link></span>,
                  <span key="ecl">{ghs(h.ecl)} / {ghs(h.eclStressed)}<span className="block text-xs text-zinc-600">Change {ghs(r.incrementalEcl)}</span></span>,
                  ghs(r.profitBeforeTaxImpact),
                  <span key="car">{ghs(r.capitalBefore)} / {ghs(r.capitalAfter)}<span className="block">{pct(h.carBefore, 2)} / {pct(h.carAfter, 2)}</span><span className="block text-xs text-zinc-600">{pp(h.carAfter - h.carBefore, 2)}</span></span>,
                  <span key="lcr">{pct(r.lcrBefore, 2)} / {pct(h.lcrAfter, 2)}<span className="block text-xs text-zinc-600">{pp(h.lcrAfter - r.lcrBefore, 2)}</span></span>,
                  <span key="review"><Badge tone={statusTone[rec.status]}>{rec.status}</Badge>{rec.reviewedBy && <span className="block text-xs">{rec.reviewedBy}</span>}</span>,
                ];
              })} />
            <p className="break-all text-xs text-zinc-600 print:text-[10px]">Batch {batch.id}{!board && ` · dataset SHA-256 ${first.datasetHash} · parameters SHA-256 ${first.paramsHash}`}</p>
            <div className="no-print flex flex-wrap gap-4 text-sm">
              <Link href={`/runs/batch/${batch.id}`} className="underline">Open assessment</Link>
              {board && <Link href={`/reports?batch=${batch.id}&audience=board`} className="underline">Open Board pack for this batch</Link>}
              <a href={`/api/runs/batch/${batch.id}`} className="underline">Audit CSV</a>
            </div>
          </section>
        );
      })}
      <p className="text-sm text-zinc-600">Pre-tax profit impact is the negative of incremental ECL provisions. A full profit forecast requires a separate earnings model. Each year independently stresses the saved loan book. The rows are point-in-time results and have no cumulative total.</p>
    </div>
  );
}
