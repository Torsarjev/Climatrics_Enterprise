import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser, getRun, activeLoans } from '@/lib/store';
import { scenarioOf, sectorOf } from '@/lib/params';
import { GRADES } from '@/lib/engine';
import { Badge, Btn, Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { LossChart } from '@/components/loss-chart';
import { ReproduceButton, ReviewPanel } from '@/components/review-panel';
import { delta, ghs, pct, pp, when, s5 } from '@/lib/fmt';
import { Explain } from '@/components/explain';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ loan?: string }> }) {
  const { id } = await params;
  const { loan: loanId } = await searchParams;
  const found = await getRun(id);
  if (!found) notFound();
  const { rec, run } = found;
  const user = await currentUser();
  const { loans } = await activeLoans();
  const S = run.summary, L = run.lossDist, C = run.capital, Q = run.liquidity;
  const sc = scenarioOf(rec.input.scenario);
  const top = [...run.results].sort((a, b) => b.eclStressed - b.ecl - (a.eclStressed - a.ecl)).slice(0, 10);
  const pick = run.results.find((r) => r.id === (loanId ?? top[0].id))!;
  const pickLoan = loans.find((l) => l.id === pick.id);

  return (
    <>
      <PageHead area={`Stress run · ${rec.id}`} title={`${sc.name} · ${rec.input.horizon}`} intro={`${sc.family} scenario, ${rec.input.approach} approach. Run by ${rec.by} on ${when(rec.createdAt)} against dataset ${rec.datasetId}.`}>
        <div className="flex items-center gap-2">
          <Badge tone={rec.status === 'approved' ? 'green' : rec.status === 'submitted' ? 'amber' : rec.status === 'rejected' ? 'red' : 'zinc'}>{rec.status}</Badge>
          <Btn href={`/reports?run=${rec.id}`}>Regulatory pack</Btn>
        </div>
      </PageHead>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="One-year ECL (simplified)" value={`${ghs(S.ecl)} → ${ghs(S.eclStressed)}`} sub={`${delta(S.ecl, S.eclStressed)} · +${ghs(S.eclStressed - S.ecl)} provisions`} tone="bad" />
        <Stat label="Weighted PD (performing)" value={`${pct(S.pd, 2)} → ${pct(S.pdStressed, 2)}`} sub={pp(S.pdStressed - S.pd, 2)} tone="warn" />
        <Stat label="Weighted LGD" value={`${pct(S.lgd)} → ${pct(S.lgdStressed)}`} sub="lost recovery on flood-damaged collateral" tone="warn" />
        <Stat label="Capital adequacy ratio" value={`${pct(C.carBefore)} → ${pct(C.carAfter)}`} sub={`minimum ${pct(C.minimum, 0)} (configurable)`} tone={C.carAfter < C.minimum ? 'bad' : 'good'} />
        <Stat label="Credit VaR 99.9% (1y)" value={`${ghs(L.base.var999)} → ${ghs(L.stressed.var999)}`} sub={`CVaR ${ghs(L.stressed.cvar999)}`} />
        <Stat label="Economic capital" value={`${ghs(L.base.economicCapital)} → ${ghs(L.stressed.economicCapital)}`} sub="VaR 99.9 − expected loss" />
        <Stat label="Stage 2 + 3 exposure" value={`${pct((S.stages[1].before + S.stages[2].before) / S.ead)} → ${pct((S.stages[1].after + S.stages[2].after) / S.ead)}`} sub="significant increase in credit risk" tone="warn" />
        <Stat label="Liquidity coverage" value={`${pct(Q.lcrBefore, 0)} → ${pct(Q.lcrAfter, 0)}`} sub={`minimum ${pct(Q.minimum, 0)}`} tone={Q.lcrAfter < Q.minimum ? 'bad' : 'good'} />
      </div>

      <Card title="Ghana-calibrated shocks used in this run" className="mt-6" note={<Link href={`/calibration?scenario=${rec.input.scenario}`} className="underline">calibration method</Link>}>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
          {[['GDP', `${run.shocks.gdp.toFixed(1)}%`], ['Inflation', `${run.shocks.inflation >= 0 ? '+' : ''}${run.shocks.inflation.toFixed(1)} pp`], ['Long-term rate', `${run.shocks.rate >= 0 ? '+' : ''}${run.shocks.rate.toFixed(1)} pp`], ['Carbon price', `$${run.shocks.carbon.toFixed(0)}/t`], ['Extreme rainfall', `×${run.shocks.flood.toFixed(2)}`]].map(([k, v]) => (
            <div key={k} className="rounded-md bg-zinc-50 px-3 py-2"><p className="text-xs text-zinc-500">{k}</p><p className="font-semibold tabular-nums">{v}</p></div>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">{rec.input.approach === 'bottom-up' ? 'Bottom-up: these shocks move each borrower’s revenue, costs, debt service and collateral, then DSCR sets the PD band.' : 'Top-down: these shocks move each sector’s PD and LGD through sector sensitivities; borrowers inherit their sector’s stress.'} <Link href={`/compare?scenario=${rec.input.scenario}&horizon=${rec.input.horizon}`} className="underline">Compare both approaches</Link>.</p>
      </Card>

      <Card title="Impact by sector" className="mt-6">
        <Table head={['Sector', 'EAD', 'PD before → after', 'ECL before', 'ECL after', 'Change', 'Transition', 'Physical']} align={['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r']}
          rows={S.bySector.filter((s) => s.ead > 0).sort((a, b) => b.eclStressed - b.ecl - (a.eclStressed - a.ecl)).map((s) => [
            s.name, ghs(s.ead), `${pct(s.pd, 2)} → ${pct(s.pdStressed, 2)}`, ghs(s.ecl), ghs(s.eclStressed), <span key="d" className="text-red-600">{delta(s.ecl, s.eclStressed)}</span>, s5(s.transition), s5(s.physical),
          ])} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Rating migration" note="EAD (GHS m), rows = before, columns = after">
          <div className="overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead><tr><th className="p-1 text-left text-zinc-500">from \ to</th>{GRADES.map((g) => <th key={g} className="p-1 text-right text-zinc-500">{g}</th>)}</tr></thead>
              <tbody>
                {S.migration.map((row, i) => (
                  <tr key={i} className="border-t border-zinc-100">
                    <td className="p-1 font-medium">{GRADES[i]}</td>
                    {row.map((v, j) => <td key={j} className={`p-1 text-right ${v === 0 ? 'text-zinc-300' : j > i ? 'bg-red-50 text-red-700' : j === i ? 'bg-zinc-50' : ''}`}>{v ? (v / 1e6).toFixed(0) : '·'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="IFRS 9 staging" note="EAD before → after">
          <Table head={['Stage', 'Before', 'After', 'Change']} align={['l', 'r', 'r', 'r']} rows={S.stages.map((s) => [`Stage ${s.stage}`, ghs(s.before), ghs(s.after), ghs(s.after - s.before)])} />
          <p className="mt-3 text-xs text-zinc-500">Stage 2 when stressed PD ≥ 2× and +2pp above origination (SICR). Stage 3 at PD ≥ 30%. Stage 2/3 ECL uses lifetime PD.</p>
        </Card>
      </div>

      <Card title="Portfolio loss distribution" className="mt-6" note={`${L.simulations.toLocaleString()} Monte Carlo scenarios · one-factor model · seed ${L.seed}`}>
        <LossChart base={L.base.sample} stressed={L.stressed.sample} varBase={L.base.var999} varStressed={L.stressed.var999} />
        <Table head={['Measure', 'Base', 'Stressed']} align={['l', 'r', 'r']} rows={[
          ['Expected loss', ghs(L.base.el), ghs(L.stressed.el)], ['VaR 99%', ghs(L.base.var99), ghs(L.stressed.var99)], ['VaR 99.9%', ghs(L.base.var999), ghs(L.stressed.var999)],
          ['CVaR 99%', ghs(L.base.cvar99), ghs(L.stressed.cvar99)], ['CVaR 99.9%', ghs(L.base.cvar999), ghs(L.stressed.cvar999)], ['Economic capital (VaR 99.9 − EL)', ghs(L.base.economicCapital), ghs(L.stressed.economicCapital)],
        ]} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card title="Largest ECL increases" note="click to explain">
          <Table head={['Borrower', 'Sector', 'ECL change']} align={['l', 'l', 'r']} rows={top.map((r) => [
            <Link key="l" href={`/runs/${rec.id}?loan=${r.id}#explain`} className={`underline ${r.id === pick.id ? 'font-semibold' : ''}`}>{r.borrower}</Link>, sectorOf(r.sector as never).name, `+${ghs(r.eclStressed - r.ecl)}`,
          ])} />
        </Card>
        <Card title={`Explain: ${pick.borrower} (${pick.id})`} className="scroll-mt-4" note={pickLoan ? `${pickLoan.region} · ${pickLoan.purpose}` : undefined}>
          <div id="explain" />
          <Explain r={pick} loan={pickLoan} sector={run.sectors.find((x) => x.key === pick.sector)} />
        </Card>
      </div>

      <Card title="Governance" className="mt-6">
        <div className="grid gap-4 md:grid-cols-2">
          <dl className="grid grid-cols-[9rem_1fr] gap-y-1 text-sm">
            <dt className="text-zinc-500">Dataset</dt><dd className="font-mono text-xs">{rec.datasetId} · {rec.datasetHash.slice(0, 16)}…</dd>
            <dt className="text-zinc-500">Model version</dt><dd className="font-mono text-xs">{rec.modelVersion}</dd>
            <dt className="text-zinc-500">Hazard data</dt><dd className="font-mono text-xs">{rec.hazardVersion}</dd>
            <dt className="text-zinc-500">Parameters hash</dt><dd className="font-mono text-xs">{rec.paramsHash.slice(0, 16)}…</dd>
            <dt className="text-zinc-500">Output hash</dt><dd className="font-mono text-xs">{rec.outputHash.slice(0, 16)}…</dd>
            <dt className="text-zinc-500">Maker</dt><dd>{rec.by}</dd>
            <dt className="text-zinc-500">Checker</dt><dd>{rec.reviewedBy ? `${rec.reviewedBy} · ${rec.status} ${rec.reviewedAt ? when(rec.reviewedAt) : ''}` : '—'}{rec.note ? ` · “${rec.note}”` : ''}</dd>
          </dl>
          <div className="space-y-4">
            <ReviewPanel id={rec.id} status={rec.status} canApprove={user.can.includes('approve' as never)} canSubmit={user.can.includes('run' as never)} isMaker={rec.by === user.name} />
            <ReproduceButton id={rec.id} expected={rec.outputHash} />
          </div>
        </div>
      </Card>
      <Illustrative />
    </>
  );
}
