import { Badge, Card, Illustrative, PageHead, Table } from '@/components/ui';

const PHASES = [
  ['0 · Mobilise and discover', 'M1', 'Stakeholder workshops, data inventory, integration and security requirements, hosting decision', 'Approved requirements and architecture'],
  ['1 · Data foundation and ESMS', 'M2–M3', 'GCB connectors, Ghana geocoding, climate data adapters, Engine I screening workflow', 'Source tests passed; screening UAT signed'],
  ['2 · Geospatial and portfolio', 'M4–M5', 'Temperature, drought and flood overlays, exposure aggregation, maps', 'Geo coverage and hazard QA signed'],
  ['3 · Scenario and ECL', 'M6–M8', 'NGFS/CCKP mapping, financial transmission, PD/LGD/EAD/ECL validation', 'Risk/model validation and ECL UAT signed'],
  ['4 · ICAAP/ILAAP and reporting', 'M8–M10', 'Capital and liquidity scenarios, IFRS S1/S2 and BoG evidence, financed emissions, governance dashboard', 'Regulatory and finance UAT signed'],
  ['5 · Integrated rollout', 'M11–M12', 'Security tests, end-to-end UAT, training, DR test, go-live, handover', 'Formal GCB acceptance'],
];

const DEPLOY = [
  ['Bank-approved cloud', 'In-region tenancy under GCB’s cloud policy; private connectivity to GCB; GCB-held keys optional', 'Fastest to provision; managed scaling and backups'],
  ['Hybrid', 'Application tier in cloud; customer-level data and database in GCB’s data centre; only aggregated results leave the bank', 'Keeps borrower data on premises'],
  ['On-premise', 'Containers on GCB infrastructure (Kubernetes or VMs); GCB operates, we support', 'Full data residency; GCB IT runs the platform'],
];

const TRAINING = [
  ['Board and Board Risk Committee', 'Climate risk appetite, reading the governance dashboard, scenario results and their limits', 'Briefing session, 2 hours'],
  ['CRO and Risk', 'Scenario design, ECL uplift, ICAAP/ILAAP results, approving runs, model limitations', 'Workshop, 2 days'],
  ['Treasury and ALCO', 'Stressed liquidity, HQLA repricing, capital headroom, limit early warnings', 'Workshop, 1 day'],
  ['Credit and relationship managers', 'Engine I screening, questionnaire, evidence, ESMS conditions in credit applications', 'Hands-on, 1 day + e-learning'],
  ['Sustainability and Finance', 'Taxonomy and SDG reporting, financed emissions (PCAF), IFRS S2 disclosure pack', 'Hands-on, 1 day'],
  ['Model risk and Internal Audit', 'Methodology, parameters, reproducing runs, audit trail, change control', 'Technical session, 1 day'],
  ['IT administrators', 'User and role administration, data loads, monitoring, backups, upgrades, incident handling', 'Technical, 2 days + runbooks'],
];

const SEVERITY: [string, string, string, string][] = [
  ['P1 · Critical', 'Platform unavailable, or results wrong for a regulatory submission', '1 hour', '4 hours workaround'],
  ['P2 · High', 'A core workflow (run, approve, report) blocked for a team', '4 business hours', '1 business day'],
  ['P3 · Medium', 'Feature impaired with a workaround available', '1 business day', 'Next scheduled release'],
  ['P4 · Low', 'Question, cosmetic issue or enhancement request', '2 business days', 'Prioritised in the backlog'],
];

const DELIVERABLES = [
  ['Architecture and integration specification', 'GCB sign-off of data flows, hosting, API contracts, threat model and data residency'],
  ['Climate data connectors and Ghana geo module', 'Ghana location retrieval demonstrated, with licensing, lineage and source/accuracy warnings'],
  ['Engines I–V', 'End-to-end configured workflows and approved business rules'],
  ['ECL and ICAAP/ILAAP pack', 'Reconciliation to benchmark models, scenario reproducibility and model risk review'],
  ['IFRS S1/S2 and BoG mapping', 'Requirement-to-evidence traceability; approval and export demonstrated'],
  ['Governance dashboard (Engine VI)', 'Board risk appetite, KRIs and targets live on approved runs; role-based UAT signed'],
  ['Security and operational readiness', 'Penetration-test remediation, RBAC, backups, monitoring and DR test'],
  ['Training and handover', 'Role-specific training, admin manuals, runbooks, support and source documentation'],
  ['Final impact and closure report', 'Baseline vs target, adoption metrics, unresolved issues and approved roadmap'],
];

export default function ImplementationPage() {
  return (
    <>
      <PageHead area="Area 11 · Implementation, training & support" title="Implementation & support" intro="A gated twelve-month delivery. No engine moves to production without the relevant GCB sign-off, and each gate records its entry criteria, deliverables, test evidence, owner and approver." />

      <Card title="Twelve-month roadmap" note="Technical Proposal §9">
        <Table head={['Phase', 'Timing', 'Activities', 'Exit gate']} rows={PHASES.map(([a, b, c, d]) => [<b key="a">{a}</b>, b, c, <Badge key="d" tone="green">{d}</Badge>])} />
        <div className="mt-4 grid grid-cols-12 gap-1 text-[10px] text-zinc-500">
          {Array.from({ length: 12 }, (_, i) => <div key={i} className="text-center">M{i + 1}</div>)}
          {[[0, 1], [1, 3], [3, 5], [5, 8], [7, 10], [10, 12]].map(([s, e], i) => (
            <div key={`p${i}`} className="col-span-12 grid grid-cols-12 gap-1">
              <div style={{ gridColumn: `${s + 1} / ${e + 1}` }} className="rounded bg-emerald-600/80 px-1 py-0.5 text-white">Phase {i}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Delivery channels" note="§9.1">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Facilitated on-site workshops at GCB, as agreed</li>
            <li>Secure remote engineering and project governance</li>
            <li>Bank-approved cloud or hybrid deployment</li>
            <li>API and scheduled data exchange with GCB systems</li>
            <li>Administrator and analyst training; knowledge transfer</li>
            <li>Documented service desk and post-go-live support</li>
          </ul>
          <p className="mt-3 text-xs text-zinc-500">Site visits and support obligations are set in the separate commercial and services agreement.</p>
        </Card>
        <Card title="Bank-led co-design" note="§16.5">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>GCB Risk, Credit, Treasury/ALM, Finance, Sustainability, IT and Internal Control counterparts confirm decisions, model ownership, data definitions and acceptance thresholds.</li>
            <li>GCB’s banking applications, credit grades, PD/LGD models, capital reporting and Treasury records stay the systems of record.</li>
            <li>Bank-approved outputs are kept separate from provisional estimates and advisory suggestions.</li>
            <li>Early demonstrations and a prioritised backlog keep feedback flowing from month one.</li>
          </ul>
        </Card>
      </div>

      <Card title="Deployment options" note="decided in Phase 0" className="mt-6">
        <Table head={['Model', 'How it works', 'Why choose it']} rows={DEPLOY.map(([a, b, c]) => [<b key="a">{a}</b>, b, c])} />
        <p className="mt-3 text-xs text-zinc-500">All options keep dev, test and production separate and keep production data out of lower environments. Data residency, key custody and Ghana Data Protection Act requirements are agreed before build.</p>
      </Card>

      <Card title="Training by role" note="delivered in Phase 5, refreshers each year" className="mt-6">
        <Table head={['Audience', 'Content', 'Format']} rows={TRAINING.map(([a, b, c]) => [<b key="a">{a}</b>, b, <span key="c" className="text-xs text-zinc-600">{c}</span>])} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Support model" note="proposed · to be agreed in the SLA">
          <Table head={['Severity', 'Example', 'Response', 'Resolution target']} rows={SEVERITY.map(([a, b, c, d]) => [<b key="a">{a}</b>, b, c, d])} />
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            <li>Tier 1: GCB super-users and IT service desk</li>
            <li>Tier 2: ClimaTRICs application and data support</li>
            <li>Tier 3: engineering and model methodology team</li>
            <li>Hypercare: 90 days after go-live with daily check-ins for the first month</li>
            <li>Quarterly releases; scenario and rule updates (e.g. new NGFS phase) as versioned changes</li>
          </ul>
        </Card>
        <Card title="Knowledge transfer">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Operating runbooks: data loads, scenario runs, month-end, backup and restore, incident response</li>
            <li>Administrator manuals: users, roles, rule and parameter changes under maker-checker</li>
            <li>Model documentation: methodology, parameters, calibration sources and limitations, for model validation</li>
            <li>Source code and model governance records, as contractually agreed</li>
            <li>Train-the-trainer for GCB super-users, so new staff are trained in-house</li>
            <li>Shadowing: GCB staff run the month-end cycle with us for two cycles, then we shadow them</li>
          </ul>
        </Card>
      </div>

      <Card title="Deliverables and acceptance" note="§10" className="mt-6">
        <Table head={['Deliverable', 'Acceptance evidence']} rows={DELIVERABLES.map(([a, b]) => [<b key="a">{a}</b>, b])} />
        <p className="mt-3 text-xs text-zinc-500">Acceptance follows the signed requirements traceability matrix and demonstrable outputs, not claims of regulatory certification.</p>
      </Card>

      <Card title="What we need from GCB" note="§16.6" className="mt-6">
        <ul className="grid list-disc gap-x-8 gap-y-1 pl-5 text-sm md:grid-cols-2">
          <li>Borrower, loan and collateral records with geolocation</li>
          <li>Borrower financial statements and debt schedules</li>
          <li>Credit ratings, PD/LGD/EAD models and staging policy</li>
          <li>Regulatory capital and RWA baselines</li>
          <li>Treasury HQLA positions, duration/convexity and liquidity cash flows</li>
          <li>ESMS policy, risk appetite and reporting obligations</li>
          <li>System access and named integration owners</li>
          <li>Independent model reviewers</li>
        </ul>
        <Illustrative>Severity targets, training durations and hypercare length are proposals for the services agreement.</Illustrative>
      </Card>
    </>
  );
}
