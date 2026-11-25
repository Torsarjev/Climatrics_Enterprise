import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser, effectiveInput, getScreenRun, rulesHash, screenRuns } from '@/lib/store';
import { ACTIVITIES, type Framework } from '@/lib/esg/rules';
import { evidenceLabel, neededEvidence, type Outcome } from '@/lib/esg/engine';
import { Badge, Card, Illustrative, PageHead, Table } from '@/components/ui';
import { AttachEvidence, ScreenReview } from '@/components/screen-review';
import { ghs, when } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const OUT: Record<Outcome, ['green' | 'red' | 'amber' | 'zinc', string]> = { pass: ['green', 'pass'], fail: ['red', 'fail'], unknown: ['amber', 'unknown'], na: ['zinc', 'n/a'] };
const TAX_TONE = { aligned: 'green', 'eligible pending': 'amber', 'not aligned': 'zinc', unassessed: 'zinc' } as const;
const DECISION = { red: 'border-red-300 bg-red-50 text-red-800', amber: 'border-amber-300 bg-amber-50 text-amber-900', green: 'border-emerald-300 bg-emerald-50 text-emerald-900' };
const FW_TITLE: Record<Framework, string> = { ESMS: 'ESMS', NDC: 'Ghana NDC', TAXONOMY: 'Green Taxonomy', SDG: 'SDG' };

export default async function ScreenRunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await getScreenRun(id);
  if (!found) notFound();
  const { rec, result: R } = found;
  const user = await currentUser();
  const input = effectiveInput(rec);
  const history = (await screenRuns()).filter((r) => r.facilityId === rec.facilityId);
  const actName = (code: string) => ACTIVITIES[code]?.name ?? code;
  const approved = rec.status === 'approved';
  const taxTotals = R.taxonomy.reduce<Record<string, number>>((a, t) => ({ ...a, [t.status]: (a[t.status] ?? 0) + t.amount }), {});
  const currentRules = rec.rulesHash === await rulesHash();
  const alignedCounted = approved && currentRules && R.esms.gate === 'pass' ? taxTotals.aligned ?? 0 : 0;
  const hasSnapshot = !!rec.result;
  const evidenceIds = [...new Set([...neededEvidence(input), ...Object.keys(input.evidence)])];
  const provided = Object.entries(rec.input.evidence).filter(([, item]) => item.status === 'provided')
    .map(([id, item]) => ({ id, label: evidenceLabel(id), ref: item.ref }));

  return (
    <>
      <PageHead area={`Engine I · Screening run ${rec.id}`} title={`${rec.borrower}`} intro={`Facility ${rec.facilityId} · outstanding ${ghs(input.ead)} · run by ${rec.by} on ${when(rec.createdAt)}${rec.parent ? ` · replaces ${rec.parent}` : ''}.`}>
        <Badge tone={approved ? 'green' : rec.status === 'escalated' ? 'red' : rec.status === 'submitted' ? 'amber' : 'zinc'}>{rec.status}</Badge>
        {user.can.includes('run' as never) && <Link href={{ pathname: '/screening', query: { from: rec.id } }} className="text-sm font-medium underline">Revise and re-screen</Link>}
      </PageHead>

      {!hasSnapshot && <p className="mb-4 text-sm text-amber-800">This older assessment predates saved rule results. The displayed evaluation uses the current rules.</p>}
      <div className={`rounded-lg border px-4 py-3 ${DECISION[R.decision.tone]}`}>
        <p className="font-semibold">{R.decision.label}</p>
        <p className="mt-0.5 text-sm">Exclusion gate: <b>{R.esms.gate}</b> · ESMS risk: <b>{R.esms.tier}</b>. The ESMS decision governs credit progression.{R.esms.gate === 'excluded' && ' Review the framework results for diagnostic purposes.'}</p>
      </div>

      {input.transitionRiskScore !== undefined && <p className="mt-3 text-sm text-zinc-700">Engine I transition risk score <strong>{input.transitionRiskScore.toFixed(2)} / 5</strong> · {approved && input.evidence.EV_TRANSITION_SCORE?.status === 'verified' ? 'Evidence verified and assessment approved' : 'Awaiting independent approval or evidence verification'}</p>}
      <section id="review" className="mt-5 scroll-mt-4">
        <Card title="Review and approval" note={<Link href="/screening/review" className="underline">Screening review queue</Link>}>
          {rec.status === 'submitted' && <p className="mb-3 text-sm font-medium">Submitted by {rec.submittedBy ?? rec.by} · Awaiting independent review</p>}
          <ScreenReview id={rec.id} status={rec.status} canRun={user.can.includes('run' as never)} canApprove={user.can.includes('approve' as never)} isMaker={rec.by === user.name || rec.submittedBy === user.name} provided={provided}
            approvalBlock={R.esms.gate !== 'pass' ? 'The exclusion gate must pass before approval. Escalate or return this assessment.' : undefined}
            rulesWarning={!currentRules ? 'This assessment was screened under earlier rules. You can approve it; the approval is recorded as made under superseded rules, and its aligned exposure is not reported until it is re-screened.' : undefined} />
          {rec.reviewedBy && <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-600">{rec.status === 'returned' ? 'Returned by' : rec.status === 'submitted' ? 'Previously returned by' : 'Reviewed by'} {rec.reviewedBy} {rec.reviewedAt && `on ${when(rec.reviewedAt)}`}{rec.note ? ` · “${rec.note}”` : ''}{rec.status === 'approved' && rec.supersededRules ? ' · approved under superseded rules' : ''}</p>}
        </Card>
      </section>

      <section id="management-actions" className="mt-6 scroll-mt-4"><Card title="Management actions">
        {R.actions.length ? <Table head={['Action', 'Suggested owner', 'Criteria']} rows={R.actions.map((action) => [
          action.text, action.owner, action.rules.map((id) => <a key={id} href={`#rule-${id}`} className="mr-2 font-mono text-xs underline">{id}</a>),
        ])} /> : <p className="text-sm text-zinc-600">No follow-up actions identified from the information supplied.</p>}
        {input.site && <p className="mt-3 text-sm text-zinc-600">Loan purpose {input.site.purpose || 'unknown'} · Site {input.site.latitude ?? 'unknown'}, {input.site.longitude ?? 'unknown'}</p>}
      </Card></section>

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <Card title="ESMS" note={rec.versions.ESMS}>
          <p className="text-sm">Gate <Badge tone={R.esms.gate === 'pass' ? 'green' : R.esms.gate === 'review' ? 'amber' : 'red'}>{R.esms.gate}</Badge> · Risk <Badge tone={R.esms.tier === 'High' ? 'red' : R.esms.tier === 'Medium' ? 'amber' : 'green'}>{R.esms.tier}</Badge></p>
          <p className="mt-3 text-xs font-semibold uppercase text-zinc-500">Action plan</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">{R.esms.actions.length ? R.esms.actions.map((a) => <li key={a}>{a}</li>) : <li>None</li>}</ul>
        </Card>
        <Card title="Ghana NDC" note={rec.versions.NDC}>
          <ul className="space-y-2 text-sm">{R.ndc.map((n) => <li key={n.activityId}><b>{ghs(n.amount)}</b> {actName(n.code)}<br /><span className={n.programmes.length ? 'text-emerald-700' : 'text-zinc-500'}>{n.programmes.length ? `${n.programmes.map((p) => `${p.programme} (${p.objective})`).join('; ')}: ${n.status}` : 'No match'}</span></li>)}</ul>
        </Card>
        <Card title="Green Taxonomy" note={rec.versions.TAXONOMY}>
          <ul className="space-y-2 text-sm">{R.taxonomy.map((t) => <li key={t.activityId}><b>{ghs(t.amount)}</b> {actName(t.code)}<br /><Badge tone={TAX_TONE[t.status]}>{t.status === 'aligned' && !approved ? 'aligned · awaiting approval' : t.status}</Badge></li>)}</ul>
          <p className="mt-3 text-xs text-zinc-600">Reportable aligned exposure from this assessment: <b>{ghs(alignedCounted)}</b>{!currentRules ? ' · Re-screen under the current rules.' : ''}</p>
        </Card>
        <Card title="SDG" note={rec.versions.SDG}>
          <ul className="space-y-2 text-sm">{R.sdg.contributions.map((c) => <li key={c.activityId}><b>{ghs(c.amount)}</b> {actName(c.code)}<br /><span className={c.targets.length ? 'text-emerald-700' : 'text-zinc-500'}>{c.targets.length ? `Targets ${c.targets.join(', ')}: ${c.status}` : 'No contribution identified'}</span></li>)}</ul>
          <p className="mt-3 text-xs font-semibold uppercase text-zinc-500">Adverse-impact flags</p>
          <p className="text-sm">{R.sdg.adverse.length ? R.sdg.adverse.map((a) => <span key={a.target} className="mr-2 text-red-700">{a.target}</span>) : 'None'}{R.sdg.adverseUnknown.length ? <span className="text-amber-700"> · unknown: {R.sdg.adverseUnknown.join(', ')}</span> : null}</p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section id="evidence" className="scroll-mt-4"><Card title="Evidence" note="reviewers select verified items at approval">
          <Table head={['Evidence', 'Status', 'Reference', '']} rows={evidenceIds.map((k) => {
            const e = input.evidence[k] ?? { status: 'missing', ref: undefined, date: undefined };
            return [evidenceLabel(k), <Badge key="s" tone={e.status === 'verified' ? 'green' : e.status === 'provided' ? 'amber' : 'red'}>{e.status}</Badge>, <span key="r" className="font-mono text-xs">{e.ref ?? '—'}{e.date && <span className="block">{e.date}</span>}</span>,
              e.status !== 'verified' && user.can.includes('run' as never) ? <AttachEvidence key="a" id={rec.id} evidence={k} /> : ''];
          })} />
        </Card></section>
        <Card title="Assessment history">
          <p className="mt-4 text-xs font-semibold uppercase text-zinc-500">Runs for this facility</p>
          <ul className="mt-1 text-sm">{history.map((h) => <li key={h.id}><Link href={`/screening/${h.id}`} className={`font-mono text-xs underline ${h.id === rec.id ? 'font-bold' : ''}`}>{h.id}</Link> · {h.status} · {when(h.createdAt)}</li>)}</ul>
          <p className="mt-3 text-xs text-zinc-500">Rules fingerprint {rec.rulesHash.slice(0, 16)}… · {Object.entries(rec.versions).map(([k, v]) => `${k} ${v}`).join(' · ')}</p>
        </Card>
      </div>

      {(['ESMS', 'NDC', 'TAXONOMY', 'SDG'] as Framework[]).map((fw) => (
        <Card key={fw} title={`${FW_TITLE[fw]}: criteria, reasons and sources`} className="mt-6">
          <Table head={['Rule', 'Criterion', 'Activity', 'Result', 'Reason', 'Source']} align={['l', 'l', 'l', 'l', 'l', 'l']}
            rows={R.results.filter((r) => r.framework === fw && r.outcome !== 'na').map((r) => [
              <span key="i" id={R.results.find((item) => item.id === r.id && item.outcome !== 'na') === r ? `rule-${r.id}` : undefined} className="font-mono text-xs">{r.id}</span>, r.title, r.activityId ? `${r.activityId} · ${actName(input.activities.find((a) => a.id === r.activityId)?.code ?? '')}` : 'facility',
              <Badge key="o" tone={OUT[r.outcome][0]}>{OUT[r.outcome][1]}</Badge>, <span key="re" className="text-xs">{r.reason}{r.evidenceId && <span className="block text-zinc-500">{r.evidenceId} · {input.evidence[r.evidenceId]?.ref ?? 'No document reference'}</span>}</span>, <span key="s" className="text-xs">{r.source} · {r.ref}</span>,
            ])} />
          <p className="mt-2 text-xs text-zinc-500">{new Set(R.results.filter((c) => c.framework === fw).map((c) => c.id)).size} rules in this framework; rules not applicable to this sector or activity are hidden.</p>
        </Card>
      ))}
      <Illustrative>Provisional rules and synthetic evidence. The report supports, but does not replace, GCB’s credit and ESMS decisions; it does not claim regulatory compliance.</Illustrative>
    </>
  );
}
