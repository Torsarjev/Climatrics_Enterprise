import Link from 'next/link';
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

const ENGINE_BOXES = [
  ['Engine I', 'ESMS screening', 'SDG classification', '/screening'],
  ['Engine II', 'Geospatial hazards', 'Exposure & vulnerability', '/physical'],
  ['Engine III', 'DSCR → ECL', 'Portfolio Climate ICAAP / ILAAP', '/stress'],
  ['Engine IV', 'IFRS S1 / S2', 'BoG evidence mapping', '/reports'],
  ['Engine V', 'Carbon accounting', 'Financed emissions', '/emissions'],
];

const Box = ({ title, sub, strong, href }: { title: string; sub: string; strong?: boolean; href?: string }) => {
  const body = <><p className="text-xs font-bold uppercase tracking-wide text-[#1f3d12]">{title}</p><p className="mt-1 text-xs text-zinc-700">{sub}</p></>;
  const cls = `block rounded-lg border-2 border-[#7aa63a] px-3 py-2.5 text-center ${strong ? 'bg-[#e2f2b8]' : 'bg-[#f3f9e6]'}`;
  return href ? <Link href={href} className={`${cls} hover:border-[#4f7a1f] hover:bg-[#e2f2b8]`}>{body}</Link> : <div className={cls}>{body}</div>;
};
const Down = () => <div aria-hidden className="flex justify-center py-1 text-[#7aa63a]">▼</div>;

function SystemDiagram() {
  return (
    <figure aria-label="ClimaTRICs Enterprise end-to-end system architecture">
      <div className="grid gap-3 sm:grid-cols-2">
        <Box title="GCB internal banking data" sub="Borrowers · Credit · Collateral · Capital · Treasury · ALM" href="/data" />
        <Box title="Climate & external reference data" sub="CCKP · ERA5 · Open-Meteo · NASA · NGFS · Flood maps" href="/calibration" />
      </div>
      <Down />
      <Box strong title="Secure data integration & control" sub="API / SFTP · ETL · Geocoding · Quality checks · Access controls · Source lineage" href="/data" />
      <Down />
      <Box title="Shared data, scenario & model services" sub="Portfolio / geospatial store · Scenario registry · Model versions · Evidence repository · Audit log" href="/governance" />
      <Down />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ENGINE_BOXES.map(([t, a, b, href]) => <Box key={t} strong title={t} sub={`${a} · ${b}`} href={href} />)}
      </div>
      <Down />
      <Box title="Engine VI | Climate governance dashboard" sub="Board appetite · KRIs · Portfolio heatmaps · Targets vs actuals · Alerts · Approvals" href="/board" />
      <Down />
      <p className="text-center text-xs font-bold uppercase tracking-wide text-[#1f3d12]">Role-based user interfaces · Regulatory reporting · Management decisions</p>
      <figcaption className="mt-4 text-xs text-zinc-500">From the Technical Proposal, section 2. A logically separated ingestion plane, climate and banking data plane, analytics plane and presentation/evidence plane. Data flows only through approved interfaces with role-based permissions, and bank customer data stays within the deployment boundary GCB approves. Click any box to open that part of the prototype.</figcaption>
    </figure>
  );
}

export default function ArchitecturePage() {
  return (
    <>
      <PageHead area="Areas 10–11 · Architecture, security & delivery" title="Architecture" intro="Modular services behind an API gateway, batch jobs for heavy runs, and a governed data layer. Every component can scale independently." />
      <Card title="ClimaTRICs Enterprise · End-to-end system architecture" className="mb-6"><SystemDiagram /></Card>
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
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Link href="/security" className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-emerald-600"><p className="text-sm font-semibold">Security & integrations →</p><p className="mt-1 text-sm text-zinc-600">Controls live in this prototype, production controls, API catalogue, GCB integration contracts and scalability.</p></Link>
        <Link href="/implementation" className="rounded-lg border border-zinc-200 bg-white p-4 hover:border-emerald-600"><p className="text-sm font-semibold">Implementation & support →</p><p className="mt-1 text-sm text-zinc-600">Twelve-month gated roadmap, deployment options, training by role, support model and knowledge transfer.</p></Link>
      </div>
    </>
  );
}
