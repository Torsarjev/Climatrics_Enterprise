import { activeLoans } from '@/lib/store';
import { SECTORS, sectorOf } from '@/lib/params';
import { Bars, Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { ghs, pct } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const SDG: Record<number, string> = { 2: 'Zero hunger', 7: 'Clean energy', 8: 'Decent work & growth', 9: 'Industry & infrastructure', 11: 'Sustainable cities', 12: 'Responsible production', 13: 'Climate action', 15: 'Life on land' };

export default async function AlignmentPage() {
  const { loans } = await activeLoans();
  const ead = loans.reduce((a, l) => a + l.ead, 0);
  const greenPurpose = (l: (typeof loans)[number]) => sectorOf(l.sector).taxonomy === 'green' || (sectorOf(l.sector).taxonomy === 'transition' && l.transitionPlan && /solar|hydro|irrigation/i.test(l.purpose));
  const sumEad = (xs: typeof loans) => xs.reduce((a, l) => a + l.ead, 0);
  const green = sumEad(loans.filter(greenPurpose));
  const trans = sumEad(loans.filter((l) => !greenPurpose(l) && sectorOf(l.sector).taxonomy === 'transition'));
  const sdg = Object.keys(SDG).map(Number).map((g) => ({ label: `SDG ${g} · ${SDG[g]}`, value: loans.filter((l) => sectorOf(l.sector).sdg.includes(g)).reduce((a, l) => a + l.ead, 0) })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const ndc = ['Energy', 'AFOLU', 'Industry', 'Transport'].map((n) => ({ label: n, value: loans.filter((l) => sectorOf(l.sector).ndc === n).reduce((a, l) => a + l.ead, 0) }));

  return (
    <>
      <PageHead area="Engine I · SDG, NDC & taxonomy alignment" title="SDG, Ghana NDC and Green Taxonomy" intro="Every facility is tagged against the SDGs, the sectors in Ghana's Nationally Determined Contribution, and the green taxonomy categories. Tags are rule-based and auditable." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Taxonomy: green / aligned" value={pct(green / ead)} sub={ghs(green)} tone="good" />
        <Stat label="Taxonomy: transition" value={pct(trans / ead)} sub={ghs(trans)} tone="warn" />
        <Stat label="Not eligible" value={pct(1 - (green + trans) / ead)} sub={ghs(ead - green - trans)} />
        <Stat label="In NDC priority sectors" value={pct(ndc.reduce((a, n) => a + n.value, 0) / ead)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Exposure by SDG" note="a facility can support several SDGs"><Bars rows={sdg} format={ghs} color="bg-emerald-600" /></Card>
        <Card title="Exposure in Ghana NDC sectors"><Bars rows={ndc} format={ghs} color="bg-sky-600" /></Card>
      </div>
      <Card title="Tagging rules" className="mt-6">
        <Table head={['Sector', 'SDGs', 'NDC sector', 'Taxonomy category']} rows={SECTORS.map((s) => [s.name, s.sdg.join(', '), s.ndc ?? '—', s.taxonomy === 'green' ? 'Green / aligned' : s.taxonomy === 'transition' ? 'Transition (eligible if plan and purpose qualify)' : 'Not eligible'])} />
        <Illustrative>Mapping is illustrative. The production mapping is to the Ghana Green Finance Taxonomy and GCB’s ESMS, confirmed with GCB’s sustainability team.</Illustrative>
      </Card>
    </>
  );
}
