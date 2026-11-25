import Link from 'next/link';
import { db, paramsHash, verifyDataset } from '@/lib/store';
import { activeCalibration, NGFS_RELEASE } from '@/lib/calibration';
import { EvidenceCards } from '@/components/evidence-cards';
import { HAZARD_DATA_VERSION, MODEL_VERSION, scenarioOf } from '@/lib/params';
import { Badge, Card, PageHead, Table } from '@/components/ui';
import { ghs, when } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const CONTROLS = [
  ['Maker-checker', 'A run can only be approved by a different person from the one who created or submitted it.'],
  ['Activity log', 'Every load, run, submission, approval and re-run is logged with who, when and what.'],
  ['Reproducibility', 'Each run stores dataset hash, parameter hash, model version and random seed; re-running must give the same output hash.'],
  ['Versioned inputs', 'Datasets, hazard snapshots, scenario sets and model parameters are versioned; superseded versions are kept.'],
  ['Explainability', 'Every stressed PD, LGD and ECL can be decomposed into transition, physical and macro drivers.'],
  ['Segregation of duties', 'Analysts run, approvers approve, auditors read. Enforced by role-based access.'],
  ['Data quality gates', 'Invalid rows are quarantined in an exception queue; totals are reconciled before use.'],
];

export default async function GovernancePage() {
  const d = await db();
  const ph = await paramsHash();
  const dataset = d.datasets.find((entry) => entry.id === d.activeDataset);
  const verification = dataset && await verifyDataset(dataset);
  const latest = d.runs[0];
  const calibration = activeCalibration(d.calibration);
  const runLink = latest ? <Link href={`/runs/${latest.id}`} className="underline">Open saved run lineage for {latest.id}</Link> : <Link href="/stress" className="underline">Open Scenario Analysis</Link>;
  const waiting = d.runs.filter((run) => run.status === 'submitted');
  const reviewed = d.runs.filter((run) => run.status === 'approved' || run.status === 'rejected');
  return (
    <>
      <PageHead area="Engine VI · Governance, lineage & version control" title="Data and model governance" intro="Trace source data, model settings, review decisions and audit events." />
      <EvidenceCards label="Governance metrics" items={[
        { id: 'source', label: 'Source extract', value: dataset?.id ?? 'Unavailable',
          evidence: <><p>{dataset?.name} · Imported by {dataset?.by ?? '—'}{dataset && ` · ${when(dataset.uploadedAt)}`}</p>
            <p className="break-all">SHA-256 {dataset?.hash ?? '—'}</p><Link href="/data" className="underline">Open source data and versions</Link></> },
        { id: 'validation', label: 'Validation and reconciliation', value: dataset ? `${dataset.rejected.length} rejected` : 'Unavailable',
          evidence: <><p>{dataset?.control.rowsAccepted ?? 0} accepted rows · {dataset?.rejected.length ?? 0} rejected rows on the active extract.</p>{dataset && <p>{dataset.warnings.geoApproximate} approximate locations · {dataset.warnings.noTransitionPlanHighSector} high-transition-sensitivity facilities without a transition plan.</p>}{dataset && <p>Input exposure {ghs(dataset.control.eadRead)} · accepted {ghs(dataset.control.eadAccepted)} · rejected {ghs(dataset.control.eadRejected)} · {dataset.control.reconciled ? 'reconciled' : 'reconciliation exception'}</p>}<Link href="/data" className="underline">Open reconciliation and exceptions</Link></> },
        { id: 'hazards', label: 'Hazard data', value: HAZARD_DATA_VERSION,
          evidence: <><p>Version used for physical hazard scoring. Open the hazard map and portfolio methodology to inspect location, exposure and vulnerability inputs.</p><Link href="/physical#engine-ii-methodology" className="underline">Open Physical Risk methodology</Link></> },
        { id: 'scenarios', label: 'Scenario set', value: 'NGFS Phase V', sub: calibration.id,
          evidence: <><p>{NGFS_RELEASE}. The current calibration is {calibration.id}. Saved runs carry their own calibration reference.</p><Link href="/calibration" className="underline">Open calibration evidence</Link> · {runLink}</> },
        { id: 'model', label: 'Credit model', value: latest?.modelVersion ?? MODEL_VERSION,
          evidence: <><p>{latest ? `${latest.id} records model ${latest.modelVersion} and hazard data ${latest.hazardVersion}.` : 'The version is recorded with each executed stress run.'}</p>{runLink} · <a href="#model-inventory" className="underline">Model inventory</a></> },
        { id: 'parameters', label: 'Parameter fingerprint', value: `${ph.slice(0, 12)}…`,
          evidence: <><p className="break-all">Current base model SHA-256 {ph}</p>{latest && <p className="break-all">Saved run {latest.id} SHA-256 {latest.paramsHash}</p>}{runLink}</> },
        { id: 'reviews', label: 'Run review', value: `${waiting.length} awaiting review`, sub: `${reviewed.length} reviewed`,
          evidence: <><p>{waiting.length} submitted runs await a checker. {reviewed.length} runs have an approval or rejection decision.</p><a href="#run-review" className="underline">Open maker-checker records</a></> },
        { id: 'audit', label: 'Audit events', value: d.audit.length.toLocaleString('en-GB'),
          evidence: <><p>Count of saved audit records. The log shows the actor, time, action and target.</p><a href="#audit-trail" className="underline">Open latest audit events</a> · <a href="/api/audit" className="underline">Export audit CSV</a></> },
      ]} />
      <Card title="Loan book integrity and lineage" className="mt-6">
        <p className="mb-3 text-sm">Analysts identify the source and provide its independently obtained SHA-256 when available. Ingestion checks the schema, quarantines invalid rows, reconciles row counts and exposure, then reads the stored file back before activating it. Each loan book read checks the stored content against the ingestion fingerprint.</p>
        {verification && <div className="mb-4 break-all rounded-lg bg-zinc-50 p-3 text-sm"><b>Active extract · {verification.matches ? 'Stored content verified' : 'Integrity exception'}</b><p>Checked {when(verification.checkedAt)}</p><p>Recorded SHA-256 {verification.expected}</p><p>Observed SHA-256 {verification.observed ?? 'File missing'}</p></div>}
        <Table head={['Extract and source', 'Custodian / loaded', 'Validation', 'Upstream checksum at first load', 'Downstream scenario runs']} rows={d.datasets.map(x => [
          <span key="id" className="break-all">{x.name} · {x.id}<br/>{x.source ?? 'Source reference unavailable on historical record'}</span>,
          x.by + ' · ' + when(x.uploadedAt), (x.rulesVersion ?? 'Legacy checks') + ' · ' + x.control.rowsAccepted + ' accepted / ' + x.control.rowsRejected + ' rejected',
          x.sourceDigest ? 'Matched source checksum' : 'Independent checksum unavailable',
          <span key="runs">{d.runs.filter(r => r.datasetId === x.id).map(r => <Link key={r.id} className="mr-2 underline" href={'/runs/' + r.id}>{r.id}</Link>)}</span>
        ])}/>
        <p className="mt-3 text-sm">For an exception, compare the recorded digest with the originating system, investigate rejected rows with the data owner, and submit a corrected version. Reviewers can trace successful and blocked validation attempts in the audit log. A local digest verifies consistency with ingestion. Independent source verification requires a trusted upstream checksum.</p>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div id="model-inventory" className="scroll-mt-6"><Card title="Model inventory">
          <Table head={['Component', 'Version', 'Owner', 'Status']} rows={[
            ['Climate credit model (PD/LGD)', MODEL_VERSION, 'Methodology lead', <Badge key="a" tone="amber">pending validation</Badge>],
            ['Physical hazard scoring', HAZARD_DATA_VERSION, 'GIS lead', <Badge key="b" tone="amber">pending validation</Badge>],
            ['Loss distribution (one-factor)', 'vasicek-mc-1.0', 'Quant lead', <Badge key="c" tone="amber">pending validation</Badge>],
            ['ICAAP/ILAAP bridge', 'capital-bridge-0.1', 'Treasury / ALM', <Badge key="d" tone="amber">pending validation</Badge>],
            ['Engine I screening rules (ESMS, NDC, taxonomy, SDG)', 'esg-rules v0.1 · provisional', 'Sustainability / ESMS', <Badge key="e" tone="amber">pending validation</Badge>],
            ['Financed emissions (PCAF)', 'pcaf-business-loans-0.1', 'Sustainability', <Badge key="f" tone="amber">pending validation</Badge>],
          ]} />
        </Card>
        </div>
        <Card title="Controls">
          <ul className="space-y-2 text-sm">{CONTROLS.map(([t, s]) => <li key={t}><b>{t}.</b> <span className="text-zinc-600">{s}</span></li>)}</ul>
        </Card>
      </div>
      <div id="run-review" className="scroll-mt-6"><Card title="Runs awaiting or completed review" className="mt-6">
        <Table head={['Run', 'Scenario', 'Maker', 'Checker', 'Status']} rows={d.runs.map((r) => [
          <Link key="a" href={`/runs/${r.id}`} className="font-mono text-xs underline">{r.id}</Link>, `${scenarioOf(r.input.scenario).name} · ${r.input.horizon}`, r.by, r.reviewedBy ?? '—',
          <Badge key="s" tone={r.status === 'approved' ? 'green' : r.status === 'submitted' ? 'amber' : r.status === 'rejected' ? 'red' : 'zinc'}>{r.status}</Badge>,
        ])} />
      </Card>
      </div>
      <div id="audit-trail" className="scroll-mt-6"><Card title="Audit trail" className="mt-6" note={<a href="/api/audit" className="underline">Export CSV</a>}>
        <Table head={['When', 'Who', 'Action', 'Target', 'Detail']} rows={d.audit.slice(0, 40).map((a) => [when(a.at), a.by, <span key="a" className="font-mono text-xs">{a.action}</span>, <span key="t" className="font-mono text-xs">{a.target}</span>, <span key="d" className="text-zinc-600">{a.detail}</span>])} />
      </Card>
      </div>
    </>
  );
}
