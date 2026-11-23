import { activeLoans, currentUser, db } from '@/lib/store';
import { Badge, Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { IngestForm } from '@/components/ingest-form';
import { ghs, when } from '@/lib/fmt';
import { COLUMNS } from '@/lib/portfolio';
import { HAZARD_DATA_VERSION } from '@/lib/params';

export const dynamic = 'force-dynamic';

const SOURCES = [
  ['Loan book', 'Core banking / IFRS 9 engine extract', 'Monthly · CSV or API', 'Facility, exposure, PD, LGD, stage, maturity'],
  ['Collateral', 'Collateral management system', 'Monthly', 'Type, value, GPS or address'],
  ['Hazards', 'World Bank CCKP, ERA5, NASA POWER, Fathom', 'Versioned snapshots', `Flood, drought, heat, coastal (${HAZARD_DATA_VERSION})`],
  ['Scenarios', 'NGFS scenario database', 'Per NGFS release', 'Carbon price, GDP, physical intensity'],
  ['Counterparty ESG', 'ESMS questionnaires, client disclosures', 'Annual', 'Emissions intensity, transition plan'],
];

export default async function DataPage() {
  const d = await db();
  const user = await currentUser();
  const { dataset } = await activeLoans();
  const c = dataset.control;
  return (
    <>
      <PageHead area="Data ingestion & governance" title="Data" intro="Every extract is validated, reconciled to control totals, hashed and versioned before any model can use it. Rejected rows never reach the engines." />
      <Card title="Load a loan book extract">
        {user.can.includes('ingest' as never) ? <IngestForm canIngest /> : <p className="text-sm text-zinc-600">{user.name} ({user.role}) can review the data and its validation results, but loading data is restricted to analysts.</p>}
        <p className="mt-2 text-xs text-zinc-500">Expected columns: <span className="font-mono">{COLUMNS.join(', ')}</span></p>
      </Card>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Rows read" value={String(c.rowsRead)} sub={ghs(c.eadRead)} />
        <Stat label="Accepted" value={String(c.rowsAccepted)} sub={ghs(c.eadAccepted)} tone="good" />
        <Stat label="Rejected to exception queue" value={String(c.rowsRejected)} sub={ghs(c.eadRejected)} tone={c.rowsRejected ? 'bad' : undefined} />
        <Stat label="Reconciliation" value={c.reconciled ? 'Balanced ✓' : 'Break ✕'} sub="read = accepted + rejected (rows and GHS)" tone={c.reconciled ? 'good' : 'bad'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Exception queue" note={`${dataset.rejected.length} rows`}>
          <Table head={['Row', 'Facility', 'Reason']} rows={dataset.rejected.map((r) => [r.row, <span key="i" className="font-mono text-xs">{r.id}</span>, r.reasons.join('; ')])} />
        </Card>
        <Card title="Data quality warnings">
          <ul className="space-y-2 text-sm">
            <li><Badge tone="amber">{dataset.warnings.geoApproximate}</Badge> facilities located by address or region, not GPS. Physical risk is flagged as lower-confidence for these.</li>
            <li><Badge tone="amber">{dataset.warnings.noTransitionPlanHighSector}</Badge> high-transition-sector borrowers with no transition plan on file.</li>
          </ul>
          <p className="mt-4 text-xs text-zinc-500">Rule: stale or missing data is shown as such, never as live.</p>
        </Card>
      </div>

      <Card title="Dataset versions (lineage)" className="mt-6">
        <Table head={['Dataset', 'Name', 'SHA-256', 'Loaded', 'By', 'Accepted', 'Status']} rows={d.datasets.map((x) => [
          <span key="i" className="font-mono text-xs">{x.id}</span>, x.name, <span key="h" className="font-mono text-xs">{x.hash.slice(0, 16)}…</span>, when(x.uploadedAt), x.by, x.control.rowsAccepted,
          x.id === d.activeDataset ? <Badge key="a" tone="green">active</Badge> : <Badge key="a">superseded</Badge>,
        ])} />
      </Card>

      <Card title="Source systems and integration contracts" className="mt-6">
        <Table head={['Domain', 'Source', 'Frequency', 'Fields']} rows={SOURCES} />
        <Illustrative>Hazard and scenario values in this prototype are illustrative. Production uses the licensed sources listed, with versioned snapshots and licence metadata.</Illustrative>
      </Card>
    </>
  );
}
