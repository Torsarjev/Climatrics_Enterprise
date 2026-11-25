import Link from 'next/link';
import { activeLoans, db } from '@/lib/store';
import { scenarioOf, sectorOf } from '@/lib/params';
import { physicalScore } from '@/lib/engine';
import { financedBook } from '@/lib/emissions';
import { Badge, Card, Illustrative, PageHead, Table } from '@/components/ui';
import { EvidenceCards } from '@/components/evidence-cards';
import { ghs, pct } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

type Status = 'in system' | 'partial' | 'bank input';
const st = (s: Status) => <Badge tone={s === 'in system' ? 'green' : s === 'partial' ? 'amber' : 'zinc'}>{s}</Badge>;
const go = (href: string, t: string) => <Link href={href} className="underline">{t}</Link>;

type Requirement = [string, string, React.ReactNode, Status];
const statuses: { key: Status; label: string }[] = [
  { key: 'in system', label: 'Requirements with evidence in system' },
  { key: 'partial', label: 'Partial' },
  { key: 'bank input', label: 'Bank input needed' },
];

export default async function DisclosurePage({ searchParams }: { searchParams: Promise<{ standard?: string }> }) {
  const { standard: requested } = await searchParams;
  const standard = requested === 's1' ? 's1' : 's2';
  const d = await db();
  const { loans } = await activeLoans();
  const ead = loans.reduce((a, l) => a + l.ead, 0);
  const carbon = loans.filter((l) => sectorOf(l.sector).transition >= 0.5).reduce((a, l) => a + l.ead, 0);
  const highPhys = loans.filter((l) => physicalScore(l, 1).score >= 0.5).reduce((a, l) => a + l.ead, 0);
  const green = loans.filter((l) => sectorOf(l.sector).taxonomy === 'green').reduce((a, l) => a + l.ead, 0);
  const fe = financedBook(loans);
  const approved = d.runs.filter((r) => r.status === 'approved');
  const scenarios = new Set(d.runs.map((r) => r.input.scenario)).size;
  const run = approved[0];

  const s2: Requirement[] = [
    ['Governance', 'Board oversight of climate risks and opportunities', 'Board and committee terms of reference', 'bank input'],
    ['Governance', 'Management’s role, controls and procedures', <span key="g">Maker-checker, roles and audit trail: {go('/governance', 'Governance')}</span>, 'in system'],
    ['Strategy', 'Climate risks and opportunities, and their time horizons', <span key="s">{go('/physical', 'Physical')}, {go('/transition', 'Transition')}, {go('/alignment', 'Taxonomy')} · 2030 / 2040 / 2050</span>, 'in system'],
    ['Strategy', 'Current and anticipated effects on financial position and performance', run ? <span key="r">ECL {ghs(run.headline.ecl)} → {ghs(run.headline.eclStressed)} in {go(`/runs/${run.id}`, run.id)}</span> : 'Needs an approved stress run', run ? 'in system' : 'partial'],
    ['Strategy', 'Climate resilience assessed with scenario analysis', <span key="c">{scenarios} NGFS scenario(s) run · capital and liquidity on {go('/capital', 'ICAAP')} and {go('/liquidity', 'ILAAP')}</span>, scenarios >= 2 ? 'in system' : 'partial'],
    ['Strategy', 'Transition plan and how the bank will respond', 'Bank strategy document; engagement list from Transition risk', 'partial'],
    ['Risk management', 'Processes to identify, assess, prioritise and monitor climate risks', <span key="m">{go('/screening', 'Screening')} at origination, portfolio monitoring, stress testing</span>, 'in system'],
    ['Risk management', 'Integration into overall risk management', <span key="i">{go('/credit', 'Credit and staging')} · {go('/capital', 'ICAAP')} · {go('/liquidity', 'ILAAP')}</span>, 'in system'],
    ['Metrics & targets', 'Scope 1, 2 and 3 GHG emissions, incl. financed emissions (scope 3, category 15)', <span key="f">{(fe.total / 1e3).toFixed(0)}k tCO₂e financed · {go('/emissions', 'Emissions')}; own operations from the bank</span>, 'partial'],
    ['Metrics & targets', 'Amount and share of assets vulnerable to transition risk', <span key="tr">{ghs(carbon)} ({ead ? pct(carbon / ead) : '—'}) in sectors with transition sensitivity ≥ 0.5 · {go('/transition', 'Transition risk')}</span>, 'in system'],
    ['Metrics & targets', 'Amount and share of assets vulnerable to physical risk', <span key="pr">{ghs(highPhys)} ({ead ? pct(highPhys / ead) : '—'}) with baseline regional score ≥ 3.0 of 5. The credit model combines the strongest hazard–sector vulnerability product (70%) with their mean (30%) before converting to a 1–5 scale.</span>, 'in system'],
    ['Metrics & targets', 'Assets aligned with climate opportunities', <span key="tx">{ghs(green)} ({ead ? pct(green / ead) : '—'}) in sectors tagged green by the model · {go('/alignment', 'Taxonomy')}</span>, 'in system'],
    ['Metrics & targets', 'Climate-related targets and progress', 'Targets set by the board; tracked here once agreed', 'bank input'],
  ];

  const bog: [string, string, Status][] = [
    ['Governance and board oversight', 'Roles, approvals and audit trail; board papers from the bank', 'partial'],
    ['Strategy and business model', 'Exposure maps, sector sensitivity, taxonomy alignment', 'in system'],
    ['Risk management integration', 'Screening, ECL staging, ICAAP and ILAAP', 'in system'],
    ['Scenario analysis and stress testing', 'NGFS scenarios, three horizons, approved and reproducible runs', 'in system'],
    ['Metrics, data and reporting', 'Financed emissions, physical and transition exposure, regulatory pack', 'in system'],
  ];

  const s1: Requirement[] = [
    ['General requirements', 'Material sustainability-related risks and opportunities and reporting boundary', <span key="m">{go('/screening', 'Portfolio screening')} supports the assessment. Bank input is needed for materiality judgements and the reporting entity.</span>, 'partial'],
    ['Governance', 'Oversight of sustainability-related risks and opportunities', <span key="g">{go('/governance', 'Governance controls')} and audit records. Bank input is needed for Board responsibilities and evidence of oversight.</span>, 'partial'],
    ['Strategy', 'Effects on business model, value chain, strategy and financial prospects', <span key="s">{go('/transition', 'Transition exposure')} and {go('/stress', 'scenario financial impacts')} cover climate. Bank input is needed for the wider sustainability assessment and strategy.</span>, 'partial'],
    ['Risk management', 'Processes to identify, assess, prioritise and monitor risks and opportunities', <span key="r">{go('/screening', 'Screening workflow')} and {go('/governance', 'review trail')}. Bank input is needed on enterprise-wide processes and integration.</span>, 'partial'],
    ['Metrics and targets', 'Metrics, targets and progress for material sustainability matters', <span key="t">{go('/emissions', 'Financed emissions')} and {go('/alignment', 'taxonomy evidence')}. Bank input is needed for bank-wide targets and other material metrics.</span>, 'partial'],
    ['General requirements', 'Reporting period, connected information, comparatives and statement of compliance', 'Bank reporting package and financial statements, reporting-period comparatives, and compliance assessment.', 'bank input'],
  ];
  const items = standard === 's1' ? s1 : s2;
  const table = (requirements: Requirement[]) => <Table head={['Pillar', 'Requirement', 'Evidence or gap', 'Status']} rows={requirements.map(([pillar, requirement, evidence, status]) => [
    pillar, requirement, evidence, st(status),
  ])} />;
  return (
    <>
      <PageHead area="Engine IV · IFRS S1/S2 & Bank of Ghana evidence" title="Disclosure evidence" intro="Review mapped disclosure topics, trace supporting records and identify information the bank still needs to provide." />
      <nav aria-label="Disclosure standards" className="mb-4 flex gap-2">
        {(['s1', 's2'] as const).map((key) => <Link key={key} href={`/disclosure?standard=${key}`} aria-current={standard === key ? 'page' : undefined}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:border-lime-600 aria-[current=page]:border-lime-600 aria-[current=page]:bg-lime-100">IFRS {key.toUpperCase()}</Link>)}
      </nav>
      <EvidenceCards key={standard} label={`IFRS ${standard.toUpperCase()} coverage metrics`} items={[
        ...statuses.map(({ key, label }) => {
          const matching = items.filter((row) => row[3] === key);
          return { id: key, label, value: `${matching.length} / ${items.length}`, evidence: matching.length
            ? table(matching) : <p>No mapped topics for this standard have this status.</p> };
        }),
        { id: 'approved', label: 'Approved stress run', value: run?.id ?? 'None yet',
          sub: run ? `${scenarioOf(run.input.scenario).name} · ${run.input.horizon}` : undefined,
          evidence: run ? <><p>Source run {run.id} · {scenarioOf(run.input.scenario).name} · {run.input.horizon} · Reviewed by {run.reviewedBy ?? '—'}. Portfolio ECL moved from {ghs(run.headline.ecl)} to {ghs(run.headline.eclStressed)}.</p>{go(`/runs/${run.id}`, 'Open approved stress run')} · {go(`/reports?run=${run.id}`, 'Open regulatory pack')}</>
            : <p>An approved stress run provides scenario financial effects for the Strategy evidence. {go('/governance#run-review', 'Open run review')}</p> },
      ]} />

      <Card title={standard === 's1' ? 'IFRS S1 · Sustainability-related financial disclosures' : 'IFRS S2 · Climate-related disclosures'} className="mt-6">
        {table(items)}
        <Illustrative>Coverage counts refer to the topics mapped here. Bank reporting scope, materiality and compliance require a separate assessment. <a className="underline" href={standard === 's1' ? 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s1-general-requirements/' : 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/'}>IFRS Foundation · {standard.toUpperCase()}</a></Illustrative>
      </Card>

      <Card title="Bank of Ghana climate-related risk expectations" className="mt-6">
        <Table head={['Area', 'Evidence from the platform', 'Status']} rows={bog.map(([a, e, s]) => [<b key="a">{a}</b>, e, st(s)])} />
        <Illustrative>Areas are summarised. The clause-by-clause mapping to the Bank of Ghana directive is confirmed with GCB’s compliance team during discovery.</Illustrative>
      </Card>
    </>
  );
}
