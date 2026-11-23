import Link from 'next/link';
import { activeLoans, db } from '@/lib/store';
import { scenarioOf, sectorOf } from '@/lib/params';
import { physicalScore } from '@/lib/engine';
import { financedBook } from '@/lib/emissions';
import { Badge, Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { ghs, pct } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

type Status = 'in system' | 'partial' | 'bank input';
const st = (s: Status) => <Badge tone={s === 'in system' ? 'green' : s === 'partial' ? 'amber' : 'zinc'}>{s}</Badge>;
const go = (href: string, t: string) => <Link href={href} className="underline">{t}</Link>;

export default async function DisclosurePage() {
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

  const s2: [string, string, React.ReactNode, Status][] = [
    ['Governance', 'Board oversight of climate risks and opportunities', 'Board and committee terms of reference', 'bank input'],
    ['Governance', 'Management’s role, controls and procedures', <span key="g">Maker-checker, roles and audit trail: {go('/governance', 'Governance')}</span>, 'in system'],
    ['Strategy', 'Climate risks and opportunities, and their time horizons', <span key="s">{go('/physical', 'Physical')}, {go('/transition', 'Transition')}, {go('/alignment', 'Taxonomy')} · 2030 / 2040 / 2050</span>, 'in system'],
    ['Strategy', 'Current and anticipated effects on financial position and performance', run ? <span key="r">ECL {ghs(run.headline.ecl)} → {ghs(run.headline.eclStressed)} in {go(`/runs/${run.id}`, run.id)}</span> : 'Needs an approved stress run', run ? 'in system' : 'partial'],
    ['Strategy', 'Climate resilience assessed with scenario analysis', <span key="c">{scenarios} NGFS scenario(s) run · capital and liquidity on {go('/capital', 'ICAAP & ILAAP')}</span>, scenarios >= 2 ? 'in system' : 'partial'],
    ['Strategy', 'Transition plan and how the bank will respond', 'Bank strategy document; engagement list from Transition risk', 'partial'],
    ['Risk management', 'Processes to identify, assess, prioritise and monitor climate risks', <span key="m">{go('/screening', 'Screening')} at origination, portfolio monitoring, stress testing</span>, 'in system'],
    ['Risk management', 'Integration into overall risk management', 'Credit (ECL, staging), ICAAP and ILAAP integration', 'in system'],
    ['Metrics & targets', 'Scope 1, 2 and 3 GHG emissions, incl. financed emissions (scope 3, category 15)', <span key="f">{(fe.total / 1e3).toFixed(0)}k tCO₂e financed · {go('/emissions', 'Emissions')}; own operations from the bank</span>, 'partial'],
    ['Metrics & targets', 'Amount and share of assets vulnerable to transition risk', `${ghs(carbon)} (${pct(carbon / ead)}) in carbon-intensive sectors`, 'in system'],
    ['Metrics & targets', 'Amount and share of assets vulnerable to physical risk', `${ghs(highPhys)} (${pct(highPhys / ead)}) with physical score ≥ 0.5 today`, 'in system'],
    ['Metrics & targets', 'Assets aligned with climate opportunities', `${ghs(green)} (${pct(green / ead)}) green / aligned`, 'in system'],
    ['Metrics & targets', 'Climate-related targets and progress', 'Targets set by the board; tracked here once agreed', 'bank input'],
  ];

  const bog: [string, string, Status][] = [
    ['Governance and board oversight', 'Roles, approvals and audit trail; board papers from the bank', 'partial'],
    ['Strategy and business model', 'Exposure maps, sector sensitivity, taxonomy alignment', 'in system'],
    ['Risk management integration', 'Screening, ECL staging, ICAAP and ILAAP', 'in system'],
    ['Scenario analysis and stress testing', 'NGFS scenarios, three horizons, approved and reproducible runs', 'in system'],
    ['Metrics, data and reporting', 'Financed emissions, physical and transition exposure, regulatory pack', 'in system'],
  ];

  const counts = (['in system', 'partial', 'bank input'] as Status[]).map((k) => s2.filter((x) => x[3] === k).length);

  return (
    <>
      <PageHead area="Engine IV · IFRS S1/S2 & Bank of Ghana evidence" title="Disclosure evidence" intro="Each IFRS S2 disclosure requirement is mapped to the evidence this platform produces, with live figures and links to the source screen. Gaps that need the bank’s own input are shown as such." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Requirements with evidence in system" value={`${counts[0]} / ${s2.length}`} tone="good" />
        <Stat label="Partial" value={String(counts[1])} sub="system evidence plus bank input" tone="warn" />
        <Stat label="Bank input needed" value={String(counts[2])} sub="board and strategy documents" />
        <Stat label="Approved stress run" value={run ? run.id : 'None yet'} sub={run ? `${scenarioOf(run.input.scenario).name} · ${run.input.horizon}` : 'approve a run to complete Strategy'} tone={run ? 'good' : 'warn'} />
      </div>

      <Card title="IFRS S2: climate-related disclosures" className="mt-6" note="IFRS S1 general requirements apply to the whole report">
        <Table head={['Pillar', 'Requirement', 'Evidence from the platform', 'Status']} rows={s2.map(([p, r, e, s]) => [<b key="p">{p}</b>, r, e, st(s)])} />
      </Card>

      <Card title="Bank of Ghana climate-related risk expectations" className="mt-6">
        <Table head={['Area', 'Evidence from the platform', 'Status']} rows={bog.map(([a, e, s]) => [<b key="a">{a}</b>, e, st(s)])} />
        <Illustrative>Areas are summarised. The clause-by-clause mapping to the Bank of Ghana directive is confirmed with GCB’s compliance team during discovery.</Illustrative>
      </Card>
    </>
  );
}
