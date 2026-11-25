import Link from 'next/link';
import { notFound } from 'next/navigation';
import { currentUser, getRun } from '@/lib/store';
import { CREDIT, TRANSMISSION, scenarioOf, sectorOf } from '@/lib/params';
import { GRADES, runCredit } from '@/lib/engine';
import { Badge, Btn, Card, Illustrative, PageHead, Stat, Table } from '@/components/ui';
import { LossChart } from '@/components/loss-chart';
import { ReproduceButton, ReviewPanel } from '@/components/review-panel';
import { delta, ghs, pct, pp, when, s5 } from '@/lib/fmt';
import { Explain } from '@/components/explain';
import { GCB_PATHWAYS } from '@/lib/gcb-scenarios';
import { stagedEcl } from '@/lib/staged-ecl';
import { baseFinancials } from '@/lib/transmission';
import { ScenarioAnnualResults } from '@/components/scenario-annual-results';
import { VOLTA_AGRO } from '@/lib/portfolio';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ loan?: string }> }) {
  const { id } = await params;
  const { loan: loanId } = await searchParams;
  const found = await getRun(id, true);
  if (!found) notFound();
  const { rec, run, loans = [] } = found;
  const user = await currentUser();
  const S = run.summary, L = run.lossDist;
  const sc = scenarioOf(rec.input.scenario);
  const top = [...run.results].sort((a, b) => b.eclStressed - b.ecl - (a.eclStressed - a.ecl)).slice(0, 10);
  const worked = run.results.find((r) => r.id === VOLTA_AGRO.id);
  const pick = run.results.find((r) => r.id === loanId) ?? worked ?? top[0];
  if (!pick) notFound();
  const pickLoan = loans.find((l) => l.id === pick.id);
  const newModel = !!rec.input.eclModel;
  const borrowerFacilities = new Set(loans.filter((loan) => pickLoan?.borrowerId ? loan.borrowerId === pickLoan.borrowerId : loan.id === pick.id).map((loan) => loan.id));
  const annual = newModel ? [...GCB_PATHWAYS].sort((a, b) => Number(b.key === rec.input.scenario) - Number(a.key === rec.input.scenario)).map((pathway) => ({
    key: pathway.key, label: pathway.name, points: pathway.years.map((year) => {
      const projection = year === rec.input.horizon && pathway.key === rec.input.scenario ? run :
        runCredit(loans, { ...rec.input, scenario: pathway.key, horizon: year });
      const facility = projection.results.find((item) => item.id === pick.id)!;
      return { year, portfolioEcl: projection.summary.eclStressed, borrowerEcl: projection.results.reduce((sum, item) => sum + (borrowerFacilities.has(item.id) ? item.eclStressed : 0), 0), pd: facility.pdStressed, lgd: facility.lgdStressed, stage: facility.stageStressed };
    }),
  })) : [];
  const financials = pickLoan ? baseFinancials(pickLoan) : undefined;
  const lossPeriods = newModel && pickLoan ? stagedEcl({ stage: pick.stageStressed, pd: pick.pdStressed,
    lgd: pick.lgdStressed, ead: pick.ead, maturity: pickLoan.maturityYears, rate: TRANSMISSION.lendingRate }).periods : [];

  return (
    <>
      <PageHead area={`Stress run · ${rec.id}`} title={`${sc.name} · ${rec.input.horizon}`} intro={`${sc.family} scenario, ${rec.input.approach} approach. Run by ${rec.by} on ${when(rec.createdAt)} against dataset ${rec.datasetId}.`}>
        <div className="flex items-center gap-2">
          <Badge tone={rec.status === 'approved' ? 'green' : rec.status === 'submitted' ? 'amber' : rec.status === 'rejected' ? 'red' : 'zinc'}>{rec.status}</Badge>
          <Btn href={`/reports?run=${rec.id}`}>Regulatory pack</Btn>
          <Link href={`/capital?run=${rec.id}`} className="underline">ICAAP</Link>
          <Link href={`/liquidity?run=${rec.id}`} className="underline">ILAAP</Link>
        </div>
      </PageHead>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat href="#ecl-method" label={newModel ? 'Staged ECL' : 'Legacy one-year ECL'} value={`${ghs(S.ecl)} → ${ghs(S.eclStressed)}`} sub={`${delta(S.ecl, S.eclStressed)} · +${ghs(S.eclStressed - S.ecl)} provisions`} tone="bad" />
        <Stat href="/methodology#stressed-ecl" label="Weighted PD (performing)" value={`${pct(S.pd, 2)} → ${pct(S.pdStressed, 2)}`} sub={pp(S.pdStressed - S.pd, 2)} tone="warn" />
        <Stat href="/methodology#stressed-ecl" label="Weighted LGD" value={`${pct(S.lgd)} → ${pct(S.lgdStressed)}`} sub="lost recovery on flood-damaged collateral" tone="warn" />
        <Stat href="/methodology#loss" label="Credit VaR 99.9% (1y)" value={`${ghs(L.base.var999)} → ${ghs(L.stressed.var999)}`} sub={`CVaR ${ghs(L.stressed.cvar999)}`} />
        <Stat href="/methodology#baseline-ecl" label="Stage 2 + 3 exposure" value={`${pct((S.stages[1].before + S.stages[2].before) / S.ead)} → ${pct((S.stages[1].after + S.stages[2].after) / S.ead)}`} sub="significant increase in credit risk" tone="warn" />
      </div>

      <Card title="Ghana-calibrated shocks used in this run" className="mt-6" note={<Link href={`/calibration?scenario=${rec.input.scenario}`} className="underline">calibration method</Link>}>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 xl:grid-cols-6">
          {[['GDP', `${run.shocks.gdp.toFixed(1)}%`], ['Inflation', `${run.shocks.inflation >= 0 ? '+' : ''}${run.shocks.inflation.toFixed(1)} pp`], ['Long-term rate', `${run.shocks.rate >= 0 ? '+' : ''}${run.shocks.rate.toFixed(1)} pp`], ['Carbon price', `$${run.shocks.carbon.toFixed(0)}/t`], ['Extreme rainfall', `×${run.shocks.flood.toFixed(2)}`], ['Composite physical hazard', `×${run.shocks.physical.toFixed(2)}`]].map(([k, v]) => (
            <div key={k} className="rounded-md bg-zinc-50 px-3 py-2"><p className="text-xs text-zinc-500">{k}</p><p className="font-semibold tabular-nums">{v}</p></div>
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-500">{rec.input.approach === 'bottom-up' ? 'Bottom-up: these shocks move each borrower’s revenue, costs, debt service and collateral, then DSCR sets the PD band.' : 'Top-down: these shocks move each sector’s PD and LGD through sector sensitivities; borrowers inherit their sector’s stress.'} <Link href={`/compare?scenario=${rec.input.scenario}&horizon=${rec.input.horizon}`} className="underline">Compare both approaches</Link>.</p>
      </Card>

      <Card title="Impact by sector" className="mt-6">
        <Table head={['Sector', 'EAD', 'PD before → after', 'LGD before → after', 'ECL before', 'ECL after', 'Change', 'Transition', 'Physical']} align={['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r']}
          rows={S.bySector.filter((s) => s.ead > 0).sort((a, b) => b.eclStressed - b.ecl - (a.eclStressed - a.ecl)).map((s) => [
            s.name, ghs(s.ead), `${pct(s.pd, 2)} → ${pct(s.pdStressed, 2)}`, `${pct(s.lgd, 2)} → ${pct(s.lgdStressed, 2)}`, ghs(s.ecl), ghs(s.eclStressed), <span key="d" className="text-red-600">{delta(s.ecl, s.eclStressed)}</span>, s5(s.transition), s5(s.physical),
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
          <Table head={['Stage', 'Baseline EAD', 'Stressed EAD', 'Baseline ECL', 'Stressed ECL']} rows={S.stages.map((s) => [`Stage ${s.stage}`, ghs(s.before), ghs(s.after), ghs(s.ecl), ghs(s.eclStressed)])} />
          <p className="mt-3 text-xs text-zinc-500">Stage 2 uses the baseline PD as the SICR reference. Stage 3 reflects existing credit impairment or the configured stressed PD threshold. See the calculation method below.</p>
        </Card>
      </div>

      {newModel && <Card title="Annual borrower and portfolio ECL" className="mt-6" note={pick.borrower}>
        <ScenarioAnnualResults pathways={annual} />
        <p className="mt-2 text-sm text-zinc-600">Borrower ECL sums {borrowerFacilities.size} linked {borrowerFacilities.size === 1 ? 'facility' : 'facilities'}. PD, LGD and stage refer to the selected facility ({pick.id}).</p>
      </Card>}

      <Card title="One-year loss distribution" className="mt-6" note={`${L.simulations.toLocaleString()} Monte Carlo draws · performing exposures · seed ${L.seed}`}>
        <LossChart base={L.base.sample} stressed={L.stressed.sample} varBase={L.base.var999} varStressed={L.stressed.var999} />
        <Table head={['Measure', 'Base', 'Stressed']} align={['l', 'r', 'r']} rows={[
          ['Expected loss', ghs(L.base.el), ghs(L.stressed.el)], ['VaR 99%', ghs(L.base.var99), ghs(L.stressed.var99)], ['VaR 99.9%', ghs(L.base.var999), ghs(L.stressed.var999)],
          ['CVaR 99%', ghs(L.base.cvar99), ghs(L.stressed.cvar99)], ['CVaR 99.9%', ghs(L.base.cvar999), ghs(L.stressed.cvar999)], ['Economic capital (VaR 99.9 − EL)', ghs(L.base.economicCapital), ghs(L.stressed.economicCapital)],
        ]} />
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <Card title="Largest ECL increases" note="click to explain">
          {worked && <p className="mb-3 text-sm"><Link href={`/runs/${rec.id}?loan=${worked.id}#explain`} className={`underline ${pick.id === worked.id ? 'font-semibold' : ''}`}>{worked.borrower}</Link> <span className="text-zinc-500">· worked example for the single workflow</span></p>}
          <Table head={['Borrower', 'Sector', 'ECL change']} align={['l', 'l', 'r']} rows={top.map((r) => [
            <Link key="l" href={`/runs/${rec.id}?loan=${r.id}#explain`} className={`underline ${r.id === pick.id ? 'font-semibold' : ''}`}>{r.borrower}</Link>, sectorOf(r.sector as never).name, `+${ghs(r.eclStressed - r.ecl)}`,
          ])} />
        </Card>
        <Card title={`Explain: ${pick.borrower} (${pick.id})`} className="scroll-mt-4" note={pickLoan ? `${pickLoan.region} · ${pickLoan.purpose}` : undefined}>
          <div id="explain">
            <form className="mb-4 flex flex-wrap items-end gap-2" method="get" action={`/runs/${rec.id}#explain`}>
              <label className="min-w-0 text-sm">Borrower or facility
                <select name="loan" defaultValue={pick.id} className="mt-1 block max-w-full rounded border border-zinc-300 bg-white p-2">
                  {[...run.results].sort((a, b) => a.borrower.localeCompare(b.borrower)).map((r) => <option key={r.id} value={r.id}>{r.borrower} · {r.id}</option>)}
                </select>
              </label>
              <button className="rounded bg-lime-200 px-3 py-2 text-sm font-semibold">Review facility</button>
            </form>
          </div>
          {financials && <div className="mb-4">
            <Table head={['Borrower financials', 'Baseline', 'Stressed']} rows={[
              ['Revenue', ghs(financials.revenue), pick.trace ? ghs(pick.trace.revenueS) : 'Sector approach'],
              ['Operating costs', ghs(financials.opex), pick.trace ? ghs(pick.trace.opexS) : 'Sector approach'],
              ['Cash flow available for debt service', ghs(financials.cfads), pick.trace ? ghs(pick.trace.cfadsS) : 'Sector approach'],
              ['Debt service', ghs(financials.debtService), pick.trace ? ghs(pick.trace.debtServiceS) : 'Sector approach'],
              ['Debt service coverage', financials.dscr.toFixed(2), pick.trace ? pick.trace.dscrS.toFixed(2) : 'Sector approach'],
              ['PD', pct(pick.pd, 2), pct(pick.pdStressed, 2)], ['LGD', pct(pick.lgd, 2), pct(pick.lgdStressed, 2)],
              ['Exposure at assessment date', ghs(pick.ead), ghs(pick.ead)], ['Stage', pick.stage, pick.stageStressed],
              ['ECL', ghs(pick.ecl), ghs(pick.eclStressed)],
            ]} />
            <p className="mt-2 text-sm text-zinc-600">The model reconstructs baseline financials from the saved loan extract, using synthetic sector margins and the PD-to-DSCR mapping.</p>
          </div>}
          <Explain r={pick} loan={pickLoan} staged={newModel} sector={run.sectors.find((x) => x.key === pick.sector)} />
        </Card>
      </div>

      {lossPeriods.length > 0 && <Card title="Stressed ECL cash-flow calculation" className="mt-6" note={pick.borrower}>
        <Table head={['Period', 'Years to discount', 'Marginal probability of default', 'Exposure at default', 'Discount factor', 'Discounted ECL']}
          rows={lossPeriods.map((period) => [period.year, period.time.toFixed(2), pct(period.defaultProbability, 2), ghs(period.ead), period.discount.toFixed(4), ghs(period.loss)])} />
      </Card>}

      <section id="ecl-method" className="mt-6 scroll-mt-4">
        <Card title="IFRS 9 staging and ECL methodology">
          {newModel ? <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
            <li>Stage 1 covers defaults possible within 12 months, capped at remaining maturity. Stage 2 uses default probabilities over the remaining term. For Stage 3, the demo models the account as already impaired and discounts the LGD-based shortfall over the first year or the remaining term if shorter.</li>
            <li>The demo moves Stage 1 to Stage 2 when stressed PD is at least {CREDIT.sicrMultiple} times baseline and at least {(CREDIT.sicrAbsolute * 100).toFixed(0)} percentage points higher. Existing Stage 2 classifications are retained. Stage 3 applies to existing credit-impaired exposures or stressed PD of at least {pct(CREDIT.stage3Pd, 0)}.</li>
            <li>Period ECL = marginal PD × LGD × EAD at period start × discount factor. Marginal PD combines a flat annual conditional PD, scaled for partial periods, with survival to that period. The exposure schedule uses straight-line amortisation. The demo discounts at {pct(TRANSMISSION.lendingRate, 0)} annually as a proxy for the effective interest rate.</li>
            <li>Bottom-up applies Ghana GDP, inflation, interest rates, carbon and acute flood channels to borrower cash flow and recoveries. Top-down applies a sector PD multiplier and LGD uplift to facilities before staging and aggregation. Sector PD is exposure-weighted over performing exposures. Sector LGD covers all exposures.</li>
            <li>These are conditional stress results for the selected pathway and year. A production IFRS 9 allowance requires validated cash-flow and recovery schedules, effective interest rates, and probability-weighted outcomes at a common reporting date. FX and facility-specific contractual cash flows are unavailable in the supplied data.</li>
            <li><a className="underline" href="https://www.ifrs.org/content/dam/ifrs/project/fi-impairment/ifrs-standard/published-documents/project-summary-july-2014.pdf">IFRS 9 impairment project summary</a></li>
          </ul> : <p className="text-sm text-zinc-700">This saved run retains its original one-year PD × LGD × EAD methodology. New scenario runs calculate discounted ECL using the applicable stage.</p>}
        </Card>
      </section>

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
