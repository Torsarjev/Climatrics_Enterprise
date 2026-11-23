import { Card, PageHead, Table } from '@/components/ui';

const LAYERS = [
  ['Users', 'Analysts · Approvers · Risk committee · Auditors · GCB IT', 'bg-zinc-100'],
  ['Access', 'GCB identity provider (SSO: SAML / OIDC, e.g. Entra ID) · MFA enforced · role-based access', 'bg-emerald-50'],
  ['Applications', 'Web workspace · dashboards · approvals · report builder', 'bg-white'],
  ['API gateway', 'Authenticated REST APIs · rate limits · request audit', 'bg-white'],
  ['Engines', 'I ESMS/SDG screening · II Geospatial physical risk · III NGFS scenarios, ECL, ICAAP/ILAAP · IV IFRS S1/S2 & BoG evidence · V Financed emissions · VI Governance', 'bg-sky-50'],
  ['Jobs', 'Batch ingestion · validation & reconciliation · scenario runs · queues with retries and exception handling', 'bg-white'],
  ['Data', 'PostgreSQL + PostGIS (versioned, append-only audit) · object storage for snapshots and reports', 'bg-amber-50'],
  ['Sources', 'Core banking / IFRS 9 extracts · collateral system · CCKP · ERA5 · NASA POWER · Fathom · NGFS', 'bg-zinc-100'],
];

const SECURITY = [
  ['Identity', 'SSO with GCB’s identity provider; MFA enforced; no shared accounts'],
  ['Authorisation', 'Role-based access with least privilege; maker-checker on approvals'],
  ['Encryption', 'TLS 1.2+ in transit; AES-256 at rest; keys in a managed KMS/HSM'],
  ['Network', 'Private subnets; WAF in front of the gateway; no public database access'],
  ['Secrets', 'Vault-managed secrets; rotation; nothing in code or config files'],
  ['Audit', 'Append-only audit log of data loads, runs, approvals, logins and exports'],
  ['Environments', 'Segregated dev / test / production; production data never in lower environments'],
  ['Assurance', 'Independent penetration test before go-live; remediation tracked to closure'],
  ['Resilience', 'Daily backups, tested restores, documented RPO/RTO and DR test'],
  ['Data residency', 'Hosting options documented for GCB sign-off (on-premise or in-region cloud)'],
];

const STACK = [
  ['Frontend', 'React / Next.js with TypeScript', 'Analyst workspace, dashboards, approvals, report builder'],
  ['Backend', 'NestJS (TypeScript)', 'APIs, workflow, maker-checker, role checks on every request, audit hooks'],
  ['Analytics engine', 'Python (NumPy, SciPy, pandas)', 'Climate PD/LGD, IFRS 9 ECL, Monte Carlo VaR, ICAAP/ILAAP; reviewable by GCB model validators'],
  ['Database', 'PostgreSQL + PostGIS', 'Versioned datasets, append-only audit, collateral matched to hazard grids by coordinate'],
  ['Data processing', 'Python, pandas, background job queue', 'Ingestion, validation, reconciliation and long scenario runs off the request path'],
  ['Visualisation', 'Interactive dashboards, charts, GIS maps', 'Portfolio, hazard and scenario views; exports to PDF and Excel'],
  ['Security', 'RBAC · MFA · SSO · encryption · audit logging', 'GCB identity provider, least privilege, TLS 1.2+ and AES-256, every action logged'],
];

export default function ArchitecturePage() {
  return (
    <>
      <PageHead area="Areas 10–11 · Architecture, security & delivery" title="Architecture" intro="Modular services behind an API gateway, batch jobs for heavy runs, and a governed data layer. Every component can scale independently." />
      <Card title="Reference architecture">
        <div className="space-y-2">
          {LAYERS.map(([t, s, bg]) => (
            <div key={t} className={`grid grid-cols-[8rem_1fr] items-center gap-4 rounded-md border border-zinc-200 px-3 py-2 text-sm ${bg}`}>
              <span className="font-semibold">{t}</span><span className="text-zinc-700">{s}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Production technology stack" className="mt-6" note="target platform">
        <Table head={['Layer', 'Technology', 'Role']} rows={STACK} />
        <p className="mt-3 text-xs text-zinc-500">This prototype demonstrates the workflow and controls on synthetic data. The production platform is built on the stack above, with the analytics engine as a separate Python service so methodology and validation teams work in the language they review.</p>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Security controls"><Table head={['Area', 'Control']} rows={SECURITY} /></Card>
        <Card title="Integration">
          <Table head={['Interface', 'Pattern']} rows={[
            ['Core banking / IFRS 9', 'Scheduled file drop (SFTP) or API; field dictionary; control totals'],
            ['Collateral system', 'Monthly extract with GPS or address; geocoding fallback with confidence flag'],
            ['General ledger', 'Provision outputs as journal-ready file, reconciled to ECL engine'],
            ['Regulatory submission', 'Report pack export (PDF, Excel) and API for downstream tools'],
            ['Climate data providers', 'Source-specific adapters with versioned snapshots and licence metadata'],
          ]} />
          <p className="mt-3 text-xs text-zinc-500">Every integration is idempotent, retried safely and reconciled at each hand-off.</p>
        </Card>
      </div>
      <Card title="Implementation and knowledge transfer" className="mt-6">
        <Table head={['Phase', 'Months', 'Outcome']} rows={[
          ['0 · Discovery & architecture sign-off', 'M1', 'Data inventory, integration contracts, threat model, hosting decision'],
          ['1 · Data foundation', 'M2–M3', 'Ingestion, validation, lineage, hazard and scenario data connectors'],
          ['2 · Engines', 'M4–M6', 'Physical, transition, scenario, ECL and ICAAP/ILAAP engines'],
          ['3 · Reporting & governance', 'M6–M8', 'Dashboards, approvals, regulatory pack, IFRS S1/S2 evidence'],
          ['4 · Hardening & UAT', 'M8–M10', 'Penetration test, DR test, user acceptance, model validation support'],
          ['5 · Rollout & handover', 'M11–M12', 'Training, runbooks, administrator manuals, source documentation, hypercare'],
        ]} />
      </Card>
    </>
  );
}
