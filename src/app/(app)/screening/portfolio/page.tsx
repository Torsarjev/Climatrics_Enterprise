import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser, db } from '@/lib/store';
import { currentPortfolioScreening, getPortfolioScreening } from '@/lib/esg/portfolio';
import { portfolioScreenAction } from '@/app/actions';
import { Bars, btnClass, Card, Illustrative, PageHead, Table } from '@/components/ui';
import { ghs, pct, when } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

export default async function PortfolioScreeningPage({ searchParams }: { searchParams: Promise<{ run_id?: string; action?: string; page?: string }> }) {
  const { run_id, action, page } = await searchParams;
  const user = await currentUser();
  const snapshot = run_id ? await getPortfolioScreening(run_id) : null;
  if (run_id && !snapshot) notFound();
  const P = snapshot?.report ?? await currentPortfolioScreening();
  const savedRuns = snapshot ? [] : (await db()).audit.filter((event) => event.action === 'screening.portfolio_saved').slice(0, 5);
  const fraction = (amount: number) => P.ead > 0 ? amount / P.ead : 0;
  const ratio = (amount: number) => pct(fraction(amount));
  const risk = [
    { label: 'High risk', exposure: P.tier.High.ead, color: 'bg-red-700 text-white' },
    { label: 'Medium risk', exposure: P.tier.Medium.ead, color: 'bg-amber-400 text-amber-950' },
    { label: 'Low risk', exposure: P.tier.Low.ead, color: 'bg-green-700 text-white' },
    { label: 'Unassessed', exposure: P.tier.Unassessed.ead, color: 'bg-slate-500 text-white' },
  ];
  const alignment = [
    { label: 'SDG contribution', exposure: P.sdgTotal, color: 'bg-green-700' },
    { label: 'Ghana NDC contribution', exposure: P.ndcTotal, color: 'bg-green-700' },
    { label: 'Verified Green Taxonomy alignment', exposure: P.tax.aligned, color: 'bg-green-700' },
    { label: 'Taxonomy pending evidence or approval', exposure: P.tax.pending, color: 'bg-amber-500' },
  ];
  const share = (n: number) => `${ratio(n)} · ${ghs(n)}`;
  const rows = P.facilityResults.filter((row) => !action || row.actionCodes.includes(action));
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageNumber = Math.max(1, Math.min(pageCount, Number.parseInt(page ?? '1', 10) || 1));
  const portfolioHref = (filter?: string, page?: number) => ({
    pathname: '/screening/portfolio',
    hash: 'facility-drill-down',
    query: { ...(run_id ? { run_id } : {}), ...(filter ? { action: filter } : {}), ...(page ? { page } : {}) },
  });
  return (
    <>
      <PageHead area="Engine I · Portfolio screening" title="Integrated portfolio screening dashboard" intro="Exposure, environmental and social risk, and sustainable finance results for the screened portfolio.">
        <Link href="/screening" className="text-sm text-[#3a5a45] underline">Screen a facility</Link>
        {!snapshot && user.can.includes('run' as never) && <form action={portfolioScreenAction}><button className={btnClass}>Save portfolio screening</button></form>}
        {snapshot && <Link href="/screening/portfolio" className="text-sm underline">Open current portfolio</Link>}
      </PageHead>
      {savedRuns.length > 0 && <details className="mb-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm">
        <summary className="cursor-pointer font-medium">Recent saved portfolio screenings</summary>
        <ul className="mt-2 space-y-1">{savedRuns.map((event) => <li key={event.target}><Link href={{ pathname: '/screening/portfolio', query: { run_id: event.target } }} className="underline">{when(event.at)} · {event.by} · {event.detail}</Link></li>)}</ul>
      </details>}
      {snapshot && <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm">Saved by {snapshot.by} · {when(snapshot.createdAt)} · <span className="font-mono">{snapshot.id}</span></p>}

      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white px-5 shadow-sm sm:px-7">
        <dl className="grid gap-5 py-6 sm:grid-cols-2">
          <div>
            <dt className="text-slate-600">Facilities screened</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-950">{P.facilities.toLocaleString('en-GB')}</dd>
            <dd className="mt-1 text-sm text-slate-600">{P.screenedByAnalyst.toLocaleString('en-GB')} with an analyst assessment</dd>
          </div>
          <div>
            <dt className="text-slate-600">Portfolio exposure</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-950">{ghs(P.ead)}</dd>
            <dd className="mt-1 text-sm text-slate-600">Total outstanding exposure</dd>
          </div>
        </dl>

        <section aria-labelledby="esms-distribution" className="py-6">
          <h2 id="esms-distribution" className="text-xl font-semibold text-slate-950">ESMS risk distribution by exposure</h2>
          {P.ead > 0 ? (
            <div aria-hidden="true" className="mt-4 flex h-11 overflow-hidden rounded-lg bg-slate-100">
              {risk.filter(({ exposure }) => exposure > 0).map(({ label, exposure, color }) => (
                <div key={label} className={`flex min-w-0 items-center justify-center overflow-hidden text-sm font-semibold tabular-nums ${color}`} style={{ width: `${fraction(exposure) * 100}%` }}>
                  {fraction(exposure) >= 0.18 && ratio(exposure)}
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-slate-600">The screened portfolio has no outstanding exposure.</p>}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {risk.map(({ label, exposure, color }) => (
              <li key={label} className="text-sm text-slate-600">
                <span className="flex items-center gap-2 font-medium text-slate-900"><span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />{label}</span>
                <span className="mt-1 block pl-[1.125rem] tabular-nums">{ratio(exposure)} · {ghs(exposure)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-600">Exclusion gate · {P.gate.excluded.n.toLocaleString('en-GB')} excluded · {P.gate.review.n.toLocaleString('en-GB')} require review</p>
        </section>

        <section aria-labelledby="sustainable-finance-alignment" className="py-6">
          <h2 id="sustainable-finance-alignment" className="text-xl font-semibold text-slate-950">Sustainable finance alignment</h2>
          <dl className="mt-4 space-y-4">
            {alignment.map(({ label, exposure, color }) => (
              <div key={label} className="grid gap-x-4 gap-y-1 sm:grid-cols-[1fr_auto]">
                <dt className="font-medium text-slate-900">{label}</dt>
                <dd className="whitespace-nowrap font-semibold tabular-nums text-slate-950">{ghs(exposure)}</dd>
                <dd className="sm:col-span-2">
                  <div aria-hidden="true" className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full ${color}`} style={{ width: `${Math.min(1, fraction(exposure)) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-sm tabular-nums text-slate-600">{ratio(exposure)} of total portfolio exposure</p>
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-5 text-sm text-slate-600">SDG and NDC totals include potential and evidenced contributions. Frameworks can classify the same exposure, so summing these rows would double-count it.</p>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <Card title="Credit decision guidance" note="one screening decision per facility">
          <Table head={['Decision', 'Facilities', 'Outstanding']} rows={P.decisions.map((row) => [row.label, row.n, share(row.ead)])} />
        </Card>
        <Card title="Management action queue" note="a facility can need several actions">
          <Table head={['Action', 'Suggested owner', 'Facilities', 'Outstanding']} rows={P.actions.map((row) => [
            <Link key={row.code} href={portfolioHref(row.code)} className="underline">{row.text}</Link>, row.owner, row.n, share(row.ead),
          ])} />
        </Card>
      </div>

      <section id="facility-drill-down" className="mt-6 scroll-mt-4"><Card title="Facility drill-down" note={`${rows.length.toLocaleString()} facilities`}>
        {action && <p className="mb-3 text-sm">{P.actions.find((item) => item.code === action)?.text ?? 'Action unavailable'} · <Link href={portfolioHref()} className="underline">Show all facilities</Link></p>}
        <Table head={['Facility', 'Borrower', 'Outstanding', 'Decision', 'Screening']} rows={rows.slice((pageNumber - 1) * pageSize, pageNumber * pageSize).map((row) => [
          row.facilityId, row.borrower, ghs(row.ead), row.decision,
          row.runId ? <Link key="run" href={`/screening/${row.runId}`} className="underline">{row.runId}</Link>
            : !snapshot && user.can.includes('run' as never) ? <Link key="screen" href={{ pathname: '/screening', query: { facility: row.facilityId } }} className="underline">Open questionnaire</Link> : 'Loan extract only',
        ])} />
        {pageCount > 1 && <nav aria-label="Facility pages" className="mt-3 flex gap-4 text-sm">
          {pageNumber > 1 && <Link href={portfolioHref(action, pageNumber - 1)} className="underline">Previous</Link>}
          <span>Page {pageNumber} of {pageCount}</span>
          {pageNumber < pageCount && <Link href={portfolioHref(action, pageNumber + 1)} className="underline">Next</Link>}
        </nav>}
      </Card></section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Green Taxonomy (reported separately, never netted)">
          <Bars rows={[{ label: 'Aligned (approved)', value: P.tax.aligned }, { label: 'Eligible pending', value: P.tax.pending }, { label: 'Not aligned', value: P.tax['not aligned'] }, { label: 'Unassessed', value: P.tax.unassessed }]} format={share} />
          {P.alignedFrom.length > 0 && <p className="mt-3 text-xs text-zinc-600">Aligned exposure comes from: {P.alignedFrom.map((a) => <Link key={`${a.runId}-${a.activityId}`} href={`/screening/${a.runId}`} className="mr-2 underline">{a.facilityId} ({ghs(a.amount)}, {a.runId})</Link>)}</p>}
          <p className="mt-2 text-xs text-zinc-500">Aligned ratio = aligned exposure from distinct approved activity allocations ÷ total outstanding.</p>
        </Card>
        <Card title="ESMS">
          <Table head={['', 'Facilities', 'Exposure']} align={['l', 'r', 'r']} rows={[
            ['Exclusion gate: pass', P.gate.pass.n, share(P.gate.pass.ead)], ['Exclusion gate: review', P.gate.review.n, share(P.gate.review.ead)], ['Exclusion gate: excluded', P.gate.excluded.n, share(P.gate.excluded.ead)],
            ['Risk: High (enhanced due diligence)', P.tier.High.n, share(P.tier.High.ead)], ['Risk: Medium', P.tier.Medium.n, share(P.tier.Medium.ead)], ['Risk: Low', P.tier.Low.n, share(P.tier.Low.ead)], ['Risk: Unassessed', P.tier.Unassessed.n, share(P.tier.Unassessed.ead)],
          ]} />
        </Card>
        <Card title="Ghana NDC contribution" note={`${ghs(P.ndcTotal)} in total, counted once per financed activity`}>
          <Table head={['Programme', 'Objective', 'Facilities', 'Potential', 'Verified']} align={['l', 'l', 'r', 'r', 'r']}
            rows={P.ndc.map((n) => [n.programme, n.objective, n.facilities, ghs(n.potential), ghs(n.verified)])} />
        </Card>
        <Card title="SDG contribution" note={`${ghs(P.sdgTotal)} in total, counted once per financed activity`}>
          <Table head={['Target', 'Facilities', 'Potential', 'Evidenced']} align={['l', 'r', 'r', 'r']} rows={P.sdg.map((s) => [`SDG ${s.target}`, s.facilities, ghs(s.potential), ghs(s.evidenced)])} />
          <p className="mt-3 text-xs font-semibold uppercase text-zinc-500">Adverse-impact flags</p>
          {P.adverse.length ? <Table head={['Target', 'Flag', 'Facilities', 'Exposure']} align={['l', 'l', 'r', 'r']} rows={P.adverse.map((a) => [a.target, a.title, a.n, ghs(a.exposure)])} /> : <p className="text-sm text-zinc-500">None identified from the data available.</p>}
        </Card>
      </div>

      <Card title="Method and audit details" className="mt-6" note={<a className="underline" href={run_id ? `/api/screening/portfolio?run_id=${run_id}` : '/api/screening/portfolio'}>Open JSON report</a>}>
        <p className="mb-2 text-sm">Dataset <span className="font-mono">{P.datasetId}</span> · {Object.entries(P.versions).map(([key, version]) => `${key} ${version.version}`).join(' · ')}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Every facility is evaluated with the same rule versions; the run fingerprint <span className="font-mono">{P.fingerprint.slice(0, 16)}</span> identifies the dataset, rules and facility assessment inputs used for this report.</li>
          <li>{P.screenedByAnalyst} facilit{P.screenedByAnalyst === 1 ? 'y has' : 'ies have'} an analyst screening; the latest applicable assessment is used. A new assessment requires its own approval before aligned allocations count. The rest use the loan extract: sector, region, purpose and exposure.</li>
          <li>One financed activity per facility is inferred from sector and purpose; “working capital” is unassessed because the use of funds is not specified.</li>
          <li>Unknown answers stay unknown; they are reported as gaps and never counted as compliant.</li>
          <li>The JSON report includes facility decisions and action codes for downstream use.</li>
        </ul>
        <Illustrative>Provisional rules and synthetic borrowers. Figures are produced from the rules on every load; none are hard-coded.</Illustrative>
      </Card>
    </>
  );
}
