import Link from 'next/link';
import { db, paramsHash } from '@/lib/store';
import { HAZARD_DATA_VERSION, MODEL_VERSION, scenarioOf } from '@/lib/params';
import { Badge, Card, PageHead, Table } from '@/components/ui';
import { when } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const CONTROLS = [
  ['Maker-checker', 'A run can only be approved by a different person from the one who created or submitted it.'],
  ['Immutable audit trail', 'Every load, run, submission, approval and re-run is logged with who, when and what.'],
  ['Reproducibility', 'Each run stores dataset hash, parameter hash, model version and random seed; re-running must give the same output hash.'],
  ['Versioned inputs', 'Datasets, hazard snapshots, scenario sets and model parameters are versioned; superseded versions are kept.'],
  ['Explainability', 'Every stressed PD, LGD and ECL can be decomposed into transition, physical and macro drivers.'],
  ['Segregation of duties', 'Analysts run, approvers approve, auditors read. Enforced by role-based access.'],
  ['Data quality gates', 'Invalid rows are quarantined in an exception queue; totals are reconciled before use.'],
];

export default async function GovernancePage() {
  const d = await db();
  const ph = await paramsHash();
  return (
    <>
      <PageHead area="Engine VI · Governance, lineage & version control" title="Governance" intro="Model governance is built in, not bolted on: every number on every screen can be traced to its inputs, model version and approver." />
      <Card title="Lineage">
        <ol className="grid gap-2 text-sm md:grid-cols-6">
          {[['Source extract', d.activeDataset], ['Validation & reconciliation', 'exception queue'], ['Hazard data', HAZARD_DATA_VERSION], ['Scenario set', 'NGFS (illustrative)'], ['Model', MODEL_VERSION], ['Parameters', `${ph.slice(0, 10)}…`]].map(([t, v], i) => (
            <li key={t} className="rounded-md border border-zinc-200 p-2"><p className="text-xs text-zinc-500">{i + 1}. {t}</p><p className="mt-1 break-all font-mono text-xs">{v}</p></li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-zinc-500">→ stress run → approval → regulatory report. Open any run to see its full lineage and re-run it.</p>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Model inventory">
          <Table head={['Component', 'Version', 'Owner', 'Status']} rows={[
            ['Climate credit model (PD/LGD)', MODEL_VERSION, 'Methodology lead', <Badge key="a" tone="amber">pending validation</Badge>],
            ['Physical hazard scoring', HAZARD_DATA_VERSION, 'GIS lead', <Badge key="b" tone="amber">pending validation</Badge>],
            ['Loss distribution (one-factor)', 'vasicek-mc-1.0', 'Quant lead', <Badge key="c" tone="amber">pending validation</Badge>],
            ['ICAAP/ILAAP bridge', 'capital-bridge-0.1', 'Treasury / ALM', <Badge key="d" tone="amber">pending validation</Badge>],
            ['Engine I screening rules (ESMS, NDC, taxonomy, SDG)', 'esg-rules v0.1 · provisional', 'Sustainability / ESMS', <Badge key="e" tone="amber">pending validation</Badge>],
            ['Financed emissions (PCAF)', 'pcaf-business-loans-0.1', 'Sustainability', <Badge key="f" tone="amber">pending validation</Badge>],
          ]} />
        </Card>
        <Card title="Controls">
          <ul className="space-y-2 text-sm">{CONTROLS.map(([t, s]) => <li key={t}><b>{t}.</b> <span className="text-zinc-600">{s}</span></li>)}</ul>
        </Card>
      </div>
      <Card title="Runs awaiting or completed review" className="mt-6">
        <Table head={['Run', 'Scenario', 'Maker', 'Checker', 'Status']} rows={d.runs.map((r) => [
          <Link key="a" href={`/runs/${r.id}`} className="font-mono text-xs underline">{r.id}</Link>, `${scenarioOf(r.input.scenario).name} · ${r.input.horizon}`, r.by, r.reviewedBy ?? '—',
          <Badge key="s" tone={r.status === 'approved' ? 'green' : r.status === 'submitted' ? 'amber' : r.status === 'rejected' ? 'red' : 'zinc'}>{r.status}</Badge>,
        ])} />
      </Card>
      <Card title="Audit trail" className="mt-6" note={<a href="/api/audit" className="underline">Export CSV</a>}>
        <Table head={['When', 'Who', 'Action', 'Target', 'Detail']} rows={d.audit.slice(0, 40).map((a) => [when(a.at), a.by, <span key="a" className="font-mono text-xs">{a.action}</span>, <span key="t" className="font-mono text-xs">{a.target}</span>, <span key="d" className="text-zinc-600">{a.detail}</span>])} />
      </Card>
    </>
  );
}
