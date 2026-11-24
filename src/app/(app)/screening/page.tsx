import { activeLoans, currentUser, db } from '@/lib/store';
import { REGIONS, SECTORS, sectorOf } from '@/lib/params';
import { EXCLUSIONS, ES_FLAGS, bookCategory } from '@/lib/screening';
import { Badge, Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { ScreenForm } from '@/components/screen-form';
import { ghs, pct, when, s5 } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const tone = (d: string) => (d === 'Proceed' ? 'green' : d === 'Decline' ? 'red' : 'amber') as 'green' | 'red' | 'amber';
const score = (n: number) => <span className={n >= 0.5 ? 'font-semibold text-red-600' : n >= 0.3 ? 'text-amber-700' : ''}>{s5(n)} / 5</span>;

export default async function ScreeningPage() {
  const d = await db();
  const user = await currentUser();
  const { loans } = await activeLoans();
  const list = d.screenings ?? [];
  const latest = list[0];
  const ead = loans.reduce((a, l) => a + l.ead, 0);
  const cats = (['A', 'B', 'C'] as const).map((c) => {
    const xs = loans.filter((l) => bookCategory(l) === c);
    return { c, n: xs.length, ead: xs.reduce((a, l) => a + l.ead, 0) };
  });

  return (
    <>
      <PageHead area="Engine I · ESMS & SDG screening" title="Screening at origination" intro="Before a loan is approved, the borrower is screened against the exclusion list, categorised for environmental and social risk, scored for climate risk at its location, and tagged to the SDGs and taxonomy. The decision and its reasons are recorded in the audit trail." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cats.map(({ c, n, ead: e }) => <Stat key={c} label={`Existing book · category ${c}`} value={pct(e / ead)} sub={`${n} facilities · ${ghs(e)}`} tone={c === 'A' ? 'bad' : c === 'B' ? 'warn' : 'good'} />)}
        <Stat label="Screenings recorded" value={String(list.length)} sub={latest ? `latest ${latest.id}` : 'none yet'} />
      </div>

      <Card title="New loan application" className="mt-6" note="prefilled example: edit any field">
        {user.can.includes('run' as never)
          ? <ScreenForm sectors={SECTORS.map(({ key, name }) => ({ key, name }))} regions={REGIONS.map((r) => r.name)} exclusions={EXCLUSIONS} flags={ES_FLAGS} />
          : <p className="text-sm text-zinc-600">{user.name} ({user.role}) can review screenings but not record them. Switch to an analyst (Kofi Mensah) at the top right to screen a new application.</p>}
      </Card>

      {latest && (
        <Card title={`Result: ${latest.app.borrower} (${latest.id})`} className="mt-6" note={`${sectorOf(latest.app.sector).name} · ${latest.app.region} · GHS ${latest.app.amountM}m · by ${latest.by}`}>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={tone(latest.result.decision)}>{latest.result.decision}</Badge>
            <Badge tone={latest.result.category === 'A' ? 'red' : latest.result.category === 'B' ? 'amber' : 'green'}>E&amp;S category {latest.result.category}</Badge>
            <span className="text-sm text-zinc-600">{latest.result.reasons.join(' · ')}</span>
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            <Table head={['Check', 'Result']} align={['l', 'r']} rows={[
              ['Physical risk today', score(latest.result.physicalToday)],
              ['Physical risk 2050 (Current Policies)', <span key="p">{score(latest.result.physical2050)} · main hazard {latest.result.topHazard}</span>],
              ['Transition risk 2040 (Delayed Transition)', score(latest.result.transition)],
              ['SDGs supported', latest.result.sdg.map((s) => `SDG ${s}`).join(', ')],
              ['Ghana NDC sector', latest.result.ndc ?? 'n/a'],
              ['Green taxonomy', latest.result.taxonomy],
            ]} />
            <div>
              <p className="text-sm font-semibold">Conditions</p>
              {latest.result.conditions.length
                ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{latest.result.conditions.map((c) => <li key={c}>{c}</li>)}</ul>
                : <p className="mt-2 text-sm text-zinc-600">None.</p>}
            </div>
          </div>
        </Card>
      )}

      <Card title="Screening register" className="mt-6" note="every decision is in the audit trail">
        {list.length === 0 ? <p className="text-sm text-zinc-500">No screenings recorded yet.</p> : (
          <Table head={['ID', 'When', 'Borrower', 'Sector', 'Amount', 'Category', 'Decision', 'By']} rows={list.map((s) => [
            <span key="i" className="font-mono text-xs">{s.id}</span>, when(s.at), s.app.borrower, sectorOf(s.app.sector).name, `GHS ${s.app.amountM}m`, s.result.category,
            <Badge key="d" tone={tone(s.result.decision)}>{s.result.decision}</Badge>, s.by,
          ])} />
        )}
      </Card>

      <Card title="Decision rules" className="mt-6">
        <Table head={['Rule', 'Outcome']} rows={[
          ['Any exclusion-list activity', 'Decline'],
          ['Category A: high-risk sector with land acquisition or a protected area, or a high-risk sector at GHS 50m+ with E&S flags', 'Refer to the E&S committee; ESAP required'],
          ['Category B: high-risk sector or any E&S flag', 'Proceed with conditions (ESAP)'],
          ['Physical risk at 2050 ≥ 3.0 (of 5)', 'Adaptation and insurance condition'],
          ['Transition risk ≥ 2.6 (of 5) and no transition plan', 'Transition plan covenant'],
        ]} />
        <Illustrative>Categories follow the IFC A/B/C approach. The exclusion list, questionnaire and thresholds are illustrative and would be replaced by GCB’s ESMS policy.</Illustrative>
      </Card>
    </>
  );
}
