import Link from 'next/link';
import { auditRegister, currentUser, db, type AuditKind } from '@/lib/store';
import { Badge, Card, PageHead, Stat, Table } from '@/components/ui';
import { AuditReviewForm } from '@/components/audit-review';
import { when } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const KIND: Record<AuditKind, string> = { icaap: 'Climate ICAAP', ilaap: 'Climate ILAAP', run: 'Stress run', screening: 'Screening' };
const OPINION = { satisfactory: 'green', 'needs improvement': 'amber', unsatisfactory: 'red' } as const;

export default async function InternalAuditPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const [d, user] = await Promise.all([db(), currentUser()]);
  const all = auditRegister(d);
  const items = kind && kind in KIND ? all.filter((i) => i.kind === kind) : all;
  const canAudit = user.can.includes('audit' as never);
  const pending = all.filter((i) => !i.review).length;
  const flagged = all.filter((i) => i.exceptions.length).length;
  const qualified = all.filter((i) => i.review && i.review.opinion !== 'satisfactory').length;

  return (
    <>
      <PageHead area="Third line of defence" title="Internal audit" intro="Independent review of approved Climate ICAAP and ILAAP assessments, stress runs and screenings. Internal Audit sees every record, its maker-checker trail and any exceptions, and records an audit opinion. It cannot create, change or approve figures." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Decided items" value={String(all.length)} sub="approved, rejected, returned or escalated" />
        <Stat label="Awaiting audit review" value={String(pending)} tone={pending ? 'warn' : 'good'} />
        <Stat label="Approved with exceptions" value={String(flagged)} sub="recorded at approval" tone={flagged ? 'warn' : 'good'} />
        <Stat label="Qualified opinions" value={String(qualified)} sub="needs improvement or unsatisfactory" tone={qualified ? 'bad' : 'good'} />
      </div>

      <Card title="Audit register" className="mt-6" note={<span className="space-x-3 text-xs">{[['', 'All'], ...Object.entries(KIND)].map(([k, l]) => <Link key={k} href={k ? `/internal-audit?kind=${k}` : '/internal-audit'} className={(kind ?? '') === k ? 'font-semibold underline' : 'underline text-zinc-500'}>{l}</Link>)}</span>}>
        {items.length === 0 ? <p className="text-sm text-zinc-600">Nothing decided yet. Items appear here once an approver approves, rejects, returns or escalates them.</p> : (
          <Table head={['Item', 'Decision', 'Maker → checker', 'Exceptions', 'Audit opinion']} rows={items.map((i) => [
            <div key="i" className="min-w-[14rem]"><Badge tone="blue">{KIND[i.kind]}</Badge> <Link href={i.href} className="underline">{i.title}</Link><p className="mt-0.5 break-all font-mono text-[11px] text-zinc-500">{i.id}</p></div>,
            <div key="s"><Badge tone={i.status === 'approved' ? 'green' : i.status === 'rejected' ? 'red' : 'amber'}>{i.status}</Badge>{i.approvedAt && <p className="mt-0.5 text-xs text-zinc-500">{when(i.approvedAt)}</p>}</div>,
            <span key="m" className="text-xs">{i.preparedBy} → {i.approvedBy ?? '—'}</span>,
            i.exceptions.length ? <ul key="e" className="space-y-0.5 text-xs text-amber-800">{i.exceptions.map((x) => <li key={x}>⚠ {x}</li>)}</ul> : <span key="e" className="text-xs text-emerald-700">none</span>,
            <div key="o" className="min-w-[12rem]">
              {i.review && <p className="text-xs"><Badge tone={OPINION[i.review.opinion]}>{i.review.opinion}</Badge> {i.review.by} · {when(i.review.at)}{i.review.reference ? ` · ${i.review.reference}` : ''}{i.review.findings ? <span className="mt-0.5 block text-zinc-600">{i.review.findings}</span> : null}</p>}
              {!i.review && !canAudit && <span className="text-xs text-zinc-500">not yet reviewed</span>}
              {canAudit && <div className={i.review ? 'mt-1' : ''}><AuditReviewForm kind={i.kind} target={i.id} /></div>}
            </div>,
          ])} />
        )}
      </Card>

      <Card title="What Internal Audit can and cannot do" className="mt-6">
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          <li><b>Can:</b> view every screen, dataset version, run, assessment and the full audit trail; download evidence; reproduce runs; record an audit opinion with findings.</li>
          <li><b>Cannot:</b> load data, run models, submit, approve or reject. Audit opinions never change a figure or an approval; they sit alongside them in the audit log.</li>
        </ul>
        <p className="mt-3 text-xs text-zinc-500">Every review is logged as <span className="font-mono">audit.reviewed</span> in <Link href="/governance#audit-trail" className="underline">the audit trail</Link>. Exceptions shown here are the ones recorded at approval time, such as approval under superseded rules or on illustrative data.</p>
      </Card>
    </>
  );
}
