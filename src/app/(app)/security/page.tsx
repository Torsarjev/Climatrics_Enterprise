import Link from 'next/link';
import { Badge, Card, PageHead, Table } from '@/components/ui';

const LIVE = [
  ['Authentication', 'Named accounts; passwords hashed with scrypt; signed (HMAC-SHA256) session cookie, HttpOnly, SameSite, Secure over HTTPS, 8-hour expiry', 'Sign in / sign out'],
  ['Brute-force protection', '5 failed attempts lock the account for 15 minutes', 'Login page message'],
  ['Authorisation', 'Role checked on the server for every action and API call: analyst runs and loads data, approver approves, auditor is read-only', 'Sign in as Yaw and try to run'],
  ['Maker-checker', 'The person who submits a run or screening cannot approve it; approvals need a note', 'Credit risk & ECL · Screening'],
  ['Audit trail', 'Every sign-in, data load, run, screening, approval and export is logged with user and time; CSV export', 'Model governance'],
  ['API protection', 'Every API except the health probe returns 401 without a valid session', 'Try an API link while signed out'],
  ['Transport security', 'HTTPS only; HSTS, X-Frame-Options DENY, nosniff, strict referrer and permissions policies on every response', 'Browser developer tools → response headers'],
  ['Secrets', 'Session key and demo password held as host environment variables; secret scanning blocks deploys that contain them', 'Deploy pipeline'],
  ['Reproducibility', 'Datasets and runs fingerprinted (SHA-256 of data, parameters, model version and output); any run can be re-run and compared', 'Run detail → Reproduce'],
  ['Change control', 'Every change goes through version control and an automated pipeline (lint, type check, build) before deploy', 'GitHub Actions'],
];

const PLANNED = [
  ['Single sign-on', 'SAML 2.0 / OIDC with GCB’s identity provider (e.g. Microsoft Entra ID); no local passwords', 'Phase 1'],
  ['Multi-factor authentication', 'Enforced through GCB’s identity provider; step-up for approvals and exports', 'Phase 1'],
  ['Encryption at rest', 'AES-256 on database and object storage; keys in a KMS/HSM under GCB custody where required', 'Phase 1'],
  ['Network isolation', 'Private subnets, WAF in front of the API gateway, no public database endpoint, IP allow-listing for integrations', 'Phase 1'],
  ['Secrets vault', 'Managed vault with rotation; service identities instead of shared keys', 'Phase 1'],
  ['Data protection', 'Field-level masking of customer identifiers outside production; Ghana Data Protection Act 2012 (Act 843) compliance', 'Phase 1'],
  ['Monitoring', 'Centralised logs to GCB’s SIEM; alerts on failed sign-ins, privilege changes and bulk exports', 'Phase 3'],
  ['Assurance', 'Independent penetration test and vulnerability scan before go-live; findings tracked to closure', 'Phase 4'],
  ['Resilience', 'Daily encrypted backups, tested restores, agreed RPO/RTO, annual DR test', 'Phase 4'],
  ['Cyber directive', 'Controls mapped to the Bank of Ghana Cyber and Information Security Directive', 'Phase 0 (mapping)'],
];

const API: [string, string, string, string, string?][] = [
  ['GET', '/api/health', 'Liveness probe (no data returned)', 'Public', '/api/health'],
  ['GET', '/api/sample', 'Demo loan-book extract (CSV) in the ingestion format', 'Any signed-in user', '/api/sample'],
  ['GET', '/api/runs', 'Stress-test runs with fingerprints, status and headline results (JSON)', 'Any signed-in user', '/api/runs'],
  ['GET', '/api/board', 'Risk appetite limits, KRIs, targets and actions (JSON)', 'Any signed-in user', '/api/board'],
  ['GET', '/api/calibration', 'Ghana-calibrated NGFS scenario variables with sources (CSV)', 'Any signed-in user', '/api/calibration'],
  ['GET', '/api/screening/runs', 'Sustainability screening register (JSON)', 'Any signed-in user', '/api/screening/runs'],
  ['POST', '/api/screening/runs', 'Screen a facility: activities, questionnaire, evidence → ESMS, NDC, taxonomy, SDG', 'Analyst'],
  ['GET', '/api/screening/runs/{id}', 'One screening with criterion-level results and rule versions', 'Any signed-in user'],
  ['POST', '/api/screening/runs/{id}/review', 'Submit, approve, escalate or return a screening (maker-checker)', 'Analyst submits · approver decides'],
  ['GET', '/api/screening/portfolio', 'Portfolio screening: aligned ratio, ESMS tiers, NDC and SDG totals (JSON)', 'Any signed-in user', '/api/screening/portfolio'],
  ['GET', '/api/audit', 'Audit trail (CSV)', 'Any signed-in user', '/api/audit'],
];

const CONTRACTS = [
  ['Core banking / IFRS 9 loan extract', 'Monthly + on demand', 'SFTP file drop (CSV, field dictionary) or REST pull', 'Control totals: record count and total EAD must match; rejected rows returned with reasons'],
  ['Collateral register', 'Monthly', 'CSV extract with GPS or address', 'Geocoding fallback with confidence flag (GPS, address, region)'],
  ['Customer master', 'Daily delta', 'REST or file', 'Sector (ISIC) and group mapping; customer IDs masked outside production'],
  ['General ledger', 'Monthly close', 'Journal-ready provision file', 'Reconciled to the ECL engine before posting'],
  ['Capital and liquidity (ICAAP/ILAAP)', 'Quarterly', 'Template upload or API', 'CET1, Tier 2, RWA, HQLA and outflows from Finance and Treasury'],
  ['Identity provider', 'Real time', 'SAML 2.0 / OIDC', 'Roles mapped from directory groups'],
  ['Regulatory reporting', 'Per cycle', 'PDF / Excel pack and REST API', 'Every figure traceable to an approved run ID'],
];

const PROVIDERS: [string, string, string, 'green' | 'amber' | 'zinc'][] = [
  ['NGFS Phase V (NiGEM, GCAM)', 'GDP, inflation, rates, carbon price by scenario and year', 'In use', 'green'],
  ['World Bank CCKP', 'Ghana flood and climate-hazard projections by SSP', 'In use', 'green'],
  ['World Bank WDI', 'Ghana macro volatility used to localise NGFS paths', 'In use', 'green'],
  ['JRC global flood maps and depth-damage curves', 'Flood depth at collateral sites; damage by asset type', 'Curves in use · depth grids next', 'amber'],
  ['ERA5 / NASA POWER', 'Heat and drought indicators at site level', 'Adapter planned', 'zinc'],
  ['Commercial hazard data (e.g. Fathom)', 'High-resolution flood depth if GCB licenses it', 'Optional', 'zinc'],
];

export default function SecurityPage() {
  return (
    <>
      <PageHead area="Area 10 · Security, integration & scalability" title="Security & integrations" intro="What is enforced in this prototype today, what the production platform adds, the APIs available now, and the integration contracts with GCB systems." />

      <Card title="Controls live in this prototype" note="each can be checked during the demo">
        <Table head={['Control', 'How it works', 'Where to see it']} rows={LIVE.map(([a, b, c]) => [<b key="a">{a}</b>, b, <span key="c" className="text-xs text-zinc-600">{c}</span>])} />
      </Card>

      <Card title="Production controls" note="delivered in the implementation phases" className="mt-6">
        <Table head={['Control', 'Design', 'Phase']} rows={PLANNED.map(([a, b, c]) => [<b key="a">{a}</b>, b, <Badge key="c" tone="blue">{c}</Badge>])} />
      </Card>

      <Card title="API catalogue" note="live endpoints · session required unless public" className="mt-6">
        <Table head={['Method', 'Endpoint', 'Returns', 'Access', '']} rows={API.map(([m, p, d, a, href]) => [
          <Badge key="m" tone={m === 'GET' ? 'green' : 'amber'}>{m}</Badge>, <span key="p" className="font-mono text-xs">{p}</span>, d, <span key="a" className="text-xs text-zinc-600">{a}</span>,
          href ? <Link key="t" href={href} target="_blank" className="text-xs underline">Try</Link> : '',
        ])} />
        <p className="mt-3 text-xs text-zinc-500">Production adds an API gateway with OAuth 2.0 client credentials for system-to-system calls, rate limits, request logging and an OpenAPI specification for GCB’s integration team.</p>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Integration contracts with GCB systems">
          <Table head={['Source', 'Frequency', 'Interface', 'Controls']} rows={CONTRACTS} />
          <p className="mt-3 text-xs text-zinc-500">The prototype’s Data ingestion page applies the same contract to the loan extract: validation rules V01–V08, control totals and a rejected-rows report.</p>
        </Card>
        <Card title="Climate and scenario data providers">
          <Table head={['Provider', 'Used for', 'Status']} rows={PROVIDERS.map(([a, b, c, t]) => [a, b, <Badge key="s" tone={t}>{c}</Badge>])} />
          <p className="mt-3 text-xs text-zinc-500">Each provider sits behind its own adapter. Every snapshot is stored with its version, retrieval date and licence, so a run can always be traced to the exact data it used.</p>
        </Card>
      </div>

      <Card title="Scalability" className="mt-6">
        <Table head={['Concern', 'Approach']} rows={[
          ['Portfolio size', 'Loan-level calculations are independent, so runs split across workers; the prototype runs 1,000 facilities × 3 scenarios in well under a second'],
          ['Long runs', 'Monte Carlo, bulk screening and report generation run as queued jobs off the request path, with progress and retries'],
          ['Geospatial', 'PostGIS spatial indexes match collateral to hazard grid cells; hazard rasters pre-tiled by region'],
          ['Read load', 'Results stored per approved run, so dashboards read stored figures rather than recompute'],
          ['Growth', 'Stateless application tier scales horizontally; database read replicas for reporting'],
          ['New regulation', 'Rules, scenarios and frameworks are versioned data, so new criteria are added without code changes'],
        ]} />
      </Card>
    </>
  );
}
