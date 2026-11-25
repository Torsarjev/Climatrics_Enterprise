import Link from 'next/link';
import { activeLoans, db, screenRuns } from '@/lib/store';
import { MultiYearReport } from '@/components/multi-year-report';
import { latestByPathway, reportingBatches } from '@/lib/reporting-batches';
import { boardView } from '@/lib/board';
import { ghs } from '@/lib/fmt';
import { Badge, Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';

export const dynamic = 'force-dynamic';

const TONE = { breach: 'red', warning: 'amber', within: 'green' } as const;
const LABEL = { breach: 'Breach', warning: 'Early warning', within: 'Within appetite' };
const day = (s: string) => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function BoardPage() {
  const { dataset, loans } = await activeLoans();
  const batches = latestByPathway(reportingBatches((await db()).runs).filter((batch) => batch.first.datasetId === dataset.id));
  const v = await boardView(loans, await screenRuns(), dataset.id);
  const count = (s: keyof typeof LABEL) => v.limits.filter((l) => l.status === s).length;
  const refreshed = new Date(v.asOf).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <>
      <PageHead area="Engine VI · Board & management" title="Board & management dashboard" intro={`Climate risk appetite, key risk indicators, targets and the management actions that follow from them. Risk indicators use the active dataset (${dataset.name}). Scenario results come from saved runs.`}>
        <span className="text-xs text-zinc-500">Refreshed {refreshed} · <Link href="/api/board" className="underline">JSON</Link></span>
      </PageHead>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Limits breached" value={String(count('breach'))} sub={`of ${v.limits.length} risk appetite limits`} tone={count('breach') ? 'bad' : 'good'} />
        <Stat label="Early warnings" value={String(count('warning'))} sub="past the amber trigger" tone={count('warning') ? 'warn' : 'good'} />
        <Stat label="Within appetite" value={String(count('within'))} sub="no action needed" tone="good" />
        <Stat label="Open management actions" value={String(v.actions.length)} sub={`${v.actions.filter((a) => a.overdue).length} overdue`} />
      </div>

      <Card title="Multi-year climate scenario results" className="mt-6" note={<Link href="/reports?audience=board" className="underline">Open Board climate risk pack</Link>}>
        {batches.length ? <MultiYearReport batches={batches} board /> : <p className="text-sm text-zinc-600">No multi-year scenarios are saved for the active loan book. <Link href="/stress" className="underline">Scenario analysis</Link></p>}
      </Card>

      <Card title="Climate risk appetite" note="limits set by the Board Risk Committee · illustrative values" className="mt-6">
        <Table head={['ID', 'Metric', 'Current', 'Limit', 'Amber trigger', 'Status', 'Owner']} align={['l', 'l', 'r', 'r', 'r', 'l', 'l']} rows={v.limits.map((l) => [
          <span key="id" className="whitespace-nowrap font-mono text-xs">{l.id}</span>,
          <span key="m"><Link href={l.link} className="underline decoration-zinc-300 hover:decoration-zinc-700">{l.metric}</Link><span className="block text-xs text-zinc-500">{l.formula}</span><span className="block text-xs text-zinc-500">{l.note}</span></span>,
          <b key="v">{l.display}</b>, l.limitDisplay, l.amberDisplay,
          <Badge key="s" tone={TONE[l.status]}>{LABEL[l.status]}</Badge>, l.owner,
        ])} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Key risk indicators">
          <Table head={['Indicator', 'Value', 'Data']} align={['l', 'r', 'l']} rows={v.kris.map((k) => [
            <span key="k"><Link href={k.link} className="underline decoration-zinc-300 hover:decoration-zinc-700">{k.kri}</Link><span className="block text-xs text-zinc-500">{k.formula}</span></span>,
            <b key="v">{k.value}</b>, <span key="q" className="text-xs text-zinc-600">{k.quality}</span>,
          ])} />
        </Card>
        <Card title="Targets vs actual">
          <div className="space-y-4">
            {v.targets.map((t) => (
              <div key={t.target} className="text-sm">
                <div className="flex justify-between gap-3"><span className="font-medium">{t.target}</span><span className="text-zinc-600">{t.actual}</span></div>
                <div className="mt-1 h-2 rounded bg-zinc-100"><div className="h-2 rounded bg-emerald-600" style={{ width: `${Math.max(0, Math.min(1, t.progress)) * 100}%` }} /></div>
                <p className="mt-1 text-xs text-zinc-500">Baseline {t.baseline} · target {t.target2} · {t.owner}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card title="Portfolio screening actions" className="mt-6">
        <Table head={['Action', 'Suggested owner', 'Facilities', 'Outstanding']} rows={v.screeningActions.map((action) => [
          <Link key={action.code} href={{ pathname: '/screening/portfolio', query: { action: action.code } }} className="underline">{action.text}</Link>,
          action.owner, action.n, ghs(action.ead),
        ])} />
      </Card>

      <Card title="Management action tracker" note="from screenings and limit status" className="mt-6">
        {v.actions.length ? (
          <Table head={['Source', 'Subject', 'Action', 'Owner', 'Due', 'Status']} rows={v.actions.map((a, i) => [
            <Link key={`s${i}`} href={a.link} className="underline">{a.source}</Link>, a.subject, a.action, a.owner, day(a.due),
            <Badge key={`b${i}`} tone={a.overdue ? 'red' : a.status === 'Escalated' ? 'amber' : 'blue'}>{a.overdue ? 'Overdue' : a.status}</Badge>,
          ])} />
        ) : <p className="text-sm text-zinc-500">No open actions.</p>}
        <p className="mt-3 text-xs text-zinc-500">Screening actions come from the ESMS result of each facility’s latest screening. Limit actions are raised automatically when a metric passes its amber trigger or its limit. In production each action has an assignee, evidence of closure and an approval, all written to the audit trail.</p>
      </Card>

      <Card title="Reporting cycle" className="mt-6">
        <Table head={['Forum', 'Frequency', 'Pack']} rows={[
          ['Board Risk Committee', 'Quarterly', 'Risk appetite status, breaches and remediation, scenario results, targets'],
          ['ALCO', 'Monthly', 'Stressed liquidity and capital headroom, concentration, limit early warnings'],
          ['Executive Risk Committee', 'Monthly', 'KRIs, action tracker, screening pipeline, data-quality issues'],
          ['Credit Committee', 'Per transaction', 'Engine I screening outcome and ESMS conditions for the facility'],
        ]} />
        <Illustrative>Limits, triggers and targets are illustrative until GCB’s Board sets them; the metrics, formulas and status logic are live.</Illustrative>
      </Card>
    </>
  );
}
