import Link from 'next/link';
import { scenarioOf } from '@/lib/params';
import type { AuditEvent, RunRecord, User } from '@/lib/store';
import { Badge, Btn } from './ui';
import { when } from '@/lib/fmt';

const runLine = (r: RunRecord, extra?: string) => (
  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
    <span><Link href={`/runs/${r.id}`} className="font-mono text-xs underline">{r.id}</Link> · {scenarioOf(r.input.scenario).name} · {r.input.horizon}</span>
    <span className="text-xs text-zinc-500">{extra ?? `${r.by} · ${when(r.createdAt)}`}</span>
  </li>
);

export function MyWork({ user, runs, audit }: { user: User; runs: RunRecord[]; audit: AuditEvent[] }) {
  const head = (title: string, sub: string, actions?: React.ReactNode) => (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Your work · {user.role}</p><h2 className="mt-1 text-lg font-semibold">{title}</h2><p className="text-sm text-zinc-600">{sub}</p></div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
  const box = (children: React.ReactNode) => <section className="mb-6 rounded-lg border-2 border-emerald-600/30 bg-white p-4">{children}</section>;

  if (user.id === 'ama') {
    const queue = runs.filter((r) => r.status === 'submitted');
    const mine = runs.filter((r) => r.reviewedBy === user.name).slice(0, 4);
    return box(<>
      {head(`Good day, ${user.name.split(' ')[0]}. ${queue.length} run${queue.length === 1 ? '' : 's'} awaiting your approval.`, 'You review and approve stress runs. You cannot approve a run you created or submitted (maker-checker).')}
      {queue.length ? <ul className="divide-y divide-zinc-100">{queue.map((r) => runLine(r, `submitted by ${r.submittedBy}`))}</ul> : <p className="text-sm text-zinc-500">Nothing waiting. Analysts submit runs from the run page.</p>}
      {mine.length > 0 && <><p className="mt-4 text-xs font-semibold text-zinc-500">Recently reviewed by you</p><ul className="divide-y divide-zinc-100">{mine.map((r) => runLine(r, r.status))}</ul></>}
    </>);
  }

  if (user.id === 'yaw') {
    return box(<>
      {head('Audit view: everything that happened, by whom and when', 'Read-only. Every data load, run, submission, approval and re-run is recorded and cannot be edited.', <><Btn href="/governance">Full audit trail</Btn><a href="/api/audit" className="rounded-md px-3 py-1.5 text-sm text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-100">Export CSV</a></>)}
      <ul className="divide-y divide-zinc-100">
        {audit.slice(0, 6).map((a, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
            <span><span className="font-mono text-xs">{a.action}</span> · <span className="font-mono text-xs">{a.target}</span> · <span className="text-zinc-600">{a.by}</span></span>
            <span className="text-xs text-zinc-500">{when(a.at)}</span>
          </li>
        ))}
      </ul>
    </>);
  }

  const drafts = runs.filter((r) => r.by === user.name && r.status === 'draft');
  const rejected = runs.filter((r) => r.by === user.name && r.status === 'rejected');
  const waiting = runs.filter((r) => r.by === user.name && r.status === 'submitted');
  return box(<>
    {head(`Good day, ${user.name.split(' ')[0]}. ${drafts.length} draft${drafts.length === 1 ? '' : 's'} to submit.`, 'You load data and run stress tests. Runs need an approver’s sign-off before they reach the regulatory pack.', <><Btn href="/data">Load data</Btn><Btn href="/stress" primary>Run a stress test</Btn></>)}
    <div className="grid gap-4 md:grid-cols-3">
      <div><p className="text-xs font-semibold text-zinc-500">Drafts <Badge>{drafts.length}</Badge></p><ul className="divide-y divide-zinc-100">{drafts.slice(0, 4).map((r) => runLine(r, when(r.createdAt)))}</ul></div>
      <div><p className="text-xs font-semibold text-zinc-500">Waiting for approval <Badge tone="amber">{waiting.length}</Badge></p><ul className="divide-y divide-zinc-100">{waiting.slice(0, 4).map((r) => runLine(r, 'with approver'))}</ul></div>
      <div><p className="text-xs font-semibold text-zinc-500">Sent back <Badge tone="red">{rejected.length}</Badge></p><ul className="divide-y divide-zinc-100">{rejected.slice(0, 4).map((r) => runLine(r, r.note ? `“${r.note}”` : 'rejected'))}</ul></div>
    </div>
  </>);
}
