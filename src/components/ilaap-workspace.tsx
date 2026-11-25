import Link from 'next/link';
import { IlaapForm, IlaapReview } from './ilaap-form';
import { EvidenceCards } from './evidence-cards';
import { Badge, Card, PageHead, Table } from './ui';
import { GCB_PATHWAYS } from '@/lib/gcb-scenarios';
import { ghs, pct, when } from '@/lib/fmt';
import type { IlaapAssessment } from '@/lib/ilaap';
import type { User } from '@/lib/store';

const ratio = (value: number | null) => value === null ? 'No net outflows' : pct(value, 2);
const survival = (day: number | null) => day === null ? 'Through day 365' : `Deficit by day ${day}`;

type LiquidityResult = IlaapAssessment['rows'][number];

function DepositEvidence({ result }: { result: LiquidityResult }) {
  const slowdown = Math.max(0, -result.macro.gdp);
  const inflation = Math.max(0, result.macro.inflation);
  return <Table head={['Segment / bucket', 'Starting deposits', 'Baseline runoff', 'GDP / CPI sensitivity', 'GDP / CPI uplift before cap (pp)', 'Stressed runoff', 'Additional withdrawals']}
    rows={result.deposits.map((row) => [
      `${row.segment} · day ${row.day}`, ghs(row.balance), `${row.runoffPct.toFixed(2)}% · ${ghs(row.baseline)}`,
      `${row.gdpSensitivity} / ${row.inflationSensitivity}`,
      `${(slowdown * row.gdpSensitivity).toFixed(2)} / ${(inflation * row.inflationSensitivity).toFixed(2)}`,
      `${row.balance ? pct(row.stressed / row.balance, 2) : '—'} · ${ghs(row.stressed)}`,
      ghs(row.stressed - row.baseline),
    ])} />;
}

function MethodologyBrief() {
  return <Card title="Methodology brief" className="mb-6">
    <div className="grid gap-4 text-sm text-zinc-700 lg:grid-cols-3">
      <section className="rounded-lg bg-lime-50 p-4">
        <h3 className="font-semibold text-zinc-900">1. Reprice liquid assets</h3>
        <p className="mt-2">The Ghana-calibrated NGFS long-rate shock is mapped to each bond’s tenor using its multiplier and basis spread. Convert the mapped yield change to a decimal, then estimate the bond price change as <b>−modified duration × Δyield + ½ × convexity × Δyield²</b>.</p>
        <p className="mt-2">Stressed HQLA is opening cash plus the repriced value of eligible bonds after removing encumbered portions and applying liquidity haircuts.</p>
      </section>
      <section className="rounded-lg bg-lime-50 p-4">
        <h3 className="font-semibold text-zinc-900">2. Stress retail and corporate withdrawals</h3>
        <p className="mt-2">Climate-related GDP weakness can tighten household budgets and corporate working capital. Higher inflation can increase household living costs and business operating expenses. The model translates these pressures into higher withdrawals using each segment’s own sensitivities.</p>
        <p className="mt-2"><b>Stressed runoff %</b> = baseline runoff % + GDP downside × GDP sensitivity + positive inflation shock × inflation sensitivity, capped at 100%. Apply the resulting rate to the segment balance in its assigned bucket.</p>
      </section>
      <section className="rounded-lg bg-lime-50 p-4">
        <h3 className="font-semibold text-zinc-900">3. Calculate the 30-day LCR proxy</h3>
        <p className="mt-2">Divide stressed opening HQLA by net 30-day outflows. Deposit runoff, weaker funding rollover, rollover spread costs and higher operating outflows can increase the denominator. Contractual inflows can weaken and are capped at 75% of gross outflows.</p>
        <p className="mt-2">Withdrawal estimates are conditional on the supplied behavioural assumptions. The proxy is shown before contingency actions.</p>
      </section>
    </div>
  </Card>;
}

export function IlaapWorkspace({ assessment, history, view, user }: { assessment?: IlaapAssessment; history: IlaapAssessment[]; view?: string; user: User }) {
  const mayRun = user.can.includes('run' as never);
  const mayApprove = user.can.includes('approve' as never);
  const pathName = (key: string) => GCB_PATHWAYS.find((path) => path.key === key)?.name ?? key;
  const keyOf = (row: IlaapAssessment['rows'][number]) => `${row.macro.scenario}-${row.macro.year}`;
  const result = assessment?.rows.find((row) => keyOf(row) === view) ?? assessment?.rows[0];
  const a = assessment;
  return <>
    <PageHead area="Climate ILAAP · Treasury and ALM" title="Climate liquidity adequacy" intro="Revalue liquid assets and stress funding and cash flows under NGFS macro pathways. Compare the baseline, climate stress and contingency actions." />
    <MethodologyBrief />
    {a && <div className="mb-6">
      <Card title="LCR scenario summary">
        <p className="mb-3 text-sm text-zinc-600">Each card shows the lowest stressed 30-day LCR proxy across the reporting years in that scenario, before contingency actions.</p>
        <EvidenceCards key={a.id} label="Scenario LCR summary" columns={3} items={GCB_PATHWAYS.map(({ key, label, name }) => {
          const rows = a.rows.filter((row) => row.macro.scenario === key);
          const lowest = rows.reduce<LiquidityResult | undefined>((worst, row) =>
            row.stressed.lcr !== null && (!worst || row.stressed.lcr < worst.stressed.lcr!) ? row : worst, undefined);
          const evidence = lowest ?? rows[0];
          return {
            id: key, label: key === 'current' ? 'Current Policies' : label,
            tone: lowest ? (lowest.stressed.lcr! < a.inputs.minimumLcrPct / 100 ? 'red' : 'green') : undefined,
            value: lowest ? ratio(lowest.stressed.lcr) : rows.length ? 'No net outflows' : 'Not run',
            sub: lowest ? `${lowest.macro.year} · Baseline ${ratio(lowest.baseline.lcr)} · ${lowest.stressed.lcr! < a.inputs.minimumLcrPct / 100 ? 'Below' : 'Meets'} model minimum ${pct(a.inputs.minimumLcrPct / 100)}` : undefined,
            evidence: evidence ? <>
              <p>{name} · {a.release} · Ghana calibration {a.calibration} · Yield mapping {a.inputs.mapping}. {a.illustrative ? 'Treasury and behavioural inputs are illustrative.' : `Treasury reference ${a.inputs.reference}.`}</p>
              <Table head={['Year', 'Baseline LCR', 'Stressed LCR', 'HQLA baseline → stressed', 'Stressed 30-day net outflows']} rows={rows.map((row) => [
                <Link key={keyOf(row)} href={`/liquidity?assessment=${a.id}&view=${keyOf(row)}#liquidity-detail`} className="underline">{row.macro.year}</Link>,
                ratio(row.baseline.lcr), ratio(row.stressed.lcr), `${ghs(row.baseline.opening)} → ${ghs(row.stressed.opening)}`, ghs(row.stressed.net30),
              ])} />
              <h3 className="font-semibold">{evidence.macro.year} assumptions</h3>
              <p>Ghana GDP {evidence.macro.gdp.toFixed(2)}% · inflation {evidence.macro.inflation.toFixed(2)} pp · long rate {evidence.macro.rate.toFixed(2)} pp. Stressed gross outflows {ghs(evidence.stressed.out30)} less capped inflows {ghs(evidence.stressed.out30 - evidence.stressed.net30)}.</p>
              <DepositEvidence result={evidence} />
              <Link href={`/liquidity?assessment=${a.id}&view=${keyOf(evidence)}#liquidity-detail`} className="inline-block underline">Open bond repricing and cash-flow evidence for {evidence.macro.year}</Link>
            </> : <p>This pathway was excluded from the saved assessment. Select it when running a liquidity assessment to see its LCR.</p>,
          };
        })} />
      </Card>
    </div>}
    {a && result && <div className="mb-6 space-y-4">
      <Card title="Assessment evidence" note={<Badge tone={a.status === 'approved' ? 'green' : a.status === 'rejected' ? 'red' : 'amber'}>{a.status}</Badge>}>
        <p className="break-words text-sm">{a.id} · {a.version} · {a.inputs.entity} · {a.inputs.currency} · Treasury date {a.inputs.asOf}</p>
        <p className="mt-2 text-sm">{a.illustrative ? 'Illustrative assumptions · ' : ''}{a.inputs.reference} · prepared by {a.by} · {when(a.at)}</p>
        <p className="mt-2 text-sm">{a.release} · {a.region} · calibration {a.calibration} · {a.inputs.mapping}</p>
        <p className="mt-2 break-all text-xs text-zinc-600">Evidence SHA-256 {a.hash}</p>
        {a.reviewer && <p className="mt-2 text-sm">Decision by {a.reviewer} · {when(a.reviewedAt!)} · {a.approvalReference || 'No sign-off reference'} {a.note && `· ${a.note}`}</p>}
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <a href={`/api/ilaap?id=${a.id}`} className="underline">Download inputs, model results and audit evidence</a>
          <a href={`/api/ilaap?id=${a.id}&format=csv`} className="underline">Download cash-flow ladders (CSV)</a>
        </div>
        {a.status === 'draft' && mayRun && a.by === user.name && <IlaapReview id={a.id} checker={false} illustrative={a.illustrative} />}
        {a.status === 'submitted' && mayApprove && a.by !== user.name && <IlaapReview id={a.id} checker illustrative={a.illustrative} />}
      </Card>
      <Card title="Pathways and reporting years">
        <Table head={['Pathway and year', 'Horizon', 'Baseline → stressed LCR proxy', 'Stress minimum buffer headroom', 'Limit status', 'Before → after actions survival']} rows={a.rows.map((row) => [
          <Link key={keyOf(row)} href={`/liquidity?assessment=${a.id}&view=${keyOf(row)}#liquidity-detail`} className="underline">{pathName(row.macro.scenario)} · {row.macro.year}</Link>,
          row.macro.horizon, `${ratio(row.baseline.lcr)} → ${ratio(row.stressed.lcr)}`, ghs(row.stressed.worstHeadroom),
          row.stressed.worstHeadroom < 0 || (row.stressed.lcr !== null && row.stressed.lcr < a.inputs.minimumLcrPct / 100)
            ? <Badge key="breach" tone="red">Limit breach</Badge> : <Badge key="clear" tone="green">Within model limits</Badge>,
          `${survival(row.stressed.firstDeficit)} → ${survival(row.mitigated.firstDeficit)}`,
        ])} />
      </Card>
      <div id="liquidity-detail" className="scroll-mt-5 space-y-4">
        <h2 className="text-lg font-semibold">{pathName(result.macro.scenario)} · {result.macro.year}</h2>
        <EvidenceCards key={keyOf(result)} label="Liquidity stress results" items={[
          { id: 'hqla', label: 'Stressed opening HQLA', value: ghs(result.stressed.opening), sub: `Baseline ${ghs(result.baseline.opening)}`,
            evidence: <p>Opening cash {ghs(a.inputs.openingCash)} plus each eligible, unencumbered bond at its stressed price after haircuts. The bond table shows each contribution.</p> },
          { id: 'lcr', label: 'Stressed 30-day LCR proxy', value: ratio(result.stressed.lcr), sub: `Model minimum ${pct(a.inputs.minimumLcrPct / 100)}`,
            evidence: <p>Opening HQLA {ghs(result.stressed.opening)} ÷ net 30-day outflows {ghs(result.stressed.net30)}. Gross outflows {ghs(result.stressed.out30)} less contractual inflows of {ghs(result.stressed.in30)}, capped at 75% of outflows. Bond redemptions are excluded from this proxy to avoid counting both HQLA and its proceeds.</p> },
          { id: 'headroom', label: 'Stressed minimum buffer headroom', value: ghs(result.stressed.worstHeadroom), sub: `After actions ${ghs(result.mitigated.worstHeadroom)}`,
            evidence: <p>The lowest buffer across the opening position and cash-flow buckets minus the configured minimum of {ghs(a.inputs.minimumBuffer)}. A negative value flags a limit breach.</p> },
          { id: 'survival', label: 'Survival after actions', value: survival(result.mitigated.firstDeficit), sub: `Before actions · ${survival(result.stressed.firstDeficit)}`,
            evidence: <p>The first bucket ending with a negative buffer identifies depletion. Intra-bucket failure dates cannot be inferred from aggregated cash flows.</p> },
        ]} />
        <Card title="Cash-flow ladder and contingency actions">
          <p className="mb-2 text-sm">The gap is inflows minus outflows. The buffer also removes any HQLA converted to cash, so sale or redemption proceeds are counted once.</p>
          <Table head={['Bucket', 'Baseline buffer', 'Stress inflows', 'Stress outflows', 'Stress gap', 'Stress buffer', 'After actions buffer', 'Action inflows / outflows']} rows={result.stressed.rows.map((row, index) => {
            const after = result.mitigated.rows[index];
            return [`Day ${row.day}`, ghs(result.baseline.rows[index].buffer), ghs(row.inflow), ghs(row.outflow), ghs(row.gap), ghs(row.buffer), ghs(after.buffer),
              `${ghs(after.raised + after.saleProceeds)} / ${ghs(after.repaid + after.actionCosts)}`];
          })} />
          <details className="mt-3 text-sm"><summary className="cursor-pointer font-medium">Trace runoff, rollover and cash flows</summary>
            <Table head={['Bucket', 'Contractual inflows', 'Contractual outflows', 'Runoff', 'Unrolled funding', 'Rollover spread costs', 'Redemptions']} rows={result.stressed.rows.map((row) => [
              row.day, ghs(row.contractualIn), ghs(row.contractualOut), ghs(row.runoff), ghs(row.fundingOut), ghs(row.rolloverSpreadCost), ghs(row.redemption),
            ])} />
            <DepositEvidence result={result} />
          </details>
        </Card>
        <Card title="HQLA bond repricing and macro evidence">
          <Table head={['Security', 'Maturity days / coupon', 'Duration / convexity', 'Yield mapping', 'Yield shock (bp)', 'Haircut / encumbrance', 'Market value base → stress', 'Eligible HQLA base → stress']} rows={result.bonds.map((bond) => [
            `${bond.id} · ${bond.currency}`, `${bond.maturityDays} / ${bond.couponPct}%`, `${bond.duration} / ${bond.convexity}`, `×${bond.yieldMultiplier} · ${bond.basisBps} bp basis`, bond.yieldBps.toFixed(2),
            `${bond.eligible ? 'Eligible' : 'Ineligible'} · ${bond.haircutPct}% / ${bond.encumberedPct}%`, `${ghs(bond.marketValue)} → ${ghs(bond.stressedValue)}`, `${ghs(bond.baseEligible)} → ${ghs(bond.stressEligible)}`,
          ])} />
          <p className="my-3 text-sm">Ghana inputs · GDP {result.macro.gdp.toFixed(2)}% · inflation {result.macro.inflation.toFixed(2)} pp · long rate {result.macro.rate.toFixed(2)} pp.</p>
          <Table head={['Macro variable', 'Regional input', 'Coefficient', 'Source and calibration method']} rows={result.macro.sources.map((source) => [
            source.variable, source.regional.toFixed(4), source.coefficient.toFixed(4), `${source.source} · ${source.method}`,
          ])} />
        </Card>
      </div>
    </div>}
    {mayRun && <Card title="Run a liquidity assessment" className="mb-6"><IlaapForm pathways={GCB_PATHWAYS} /></Card>}
    <Card title="Saved ILAAP assessments" className="mb-6">
      {history.length ? <Table head={['Assessment', 'Entity', 'Status', 'Created']} rows={history.map((item) => [
        <Link key={item.id} href={`/liquidity?assessment=${item.id}`} className="underline">{item.id}</Link>, item.inputs.entity, item.status, when(item.at),
      ])} /> : <p className="text-sm">No saved portfolio liquidity assessments.</p>}
    </Card>
    <Card title="Method and Treasury input guide">
      <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
        <li>Use one GHS entity and Treasury reporting date. Reported HQLA, market value, deposits, funding maturities and contractual flows must reconcile to the uploaded records. The worked template shows the required fields and units.</li>
        <li>Each NGFS reporting year stresses the same representative Treasury snapshot independently. Engine III’s Ghana macro calibration supplies GDP, inflation and long-rate deviations. The evidence identifies the exact NiGEM Africa macro proxy and the applied coefficients. Interpolation follows the calibration engine’s NGFS year grid. GDP uses the change in deviation over up to five years, with 2025 as its earliest reference.</li>
        <li>Per-security yield shock in basis points equals the Ghana long-rate deviation in percentage points × 100 × the tenor multiplier plus the documented basis overlay. Relative price change equals −duration × yield change + ½ × convexity × yield change squared. Yield change is expressed as a decimal. Large shifts outside the approximation range require revised mapping or full repricing.</li>
        <li>Contractual flows are incremental bucket amounts. Exclude deposit runoff, separately modelled funding maturities and the available principal of HQLA bonds. Include expected coupon receipts in contractual inflows. Deposit sensitivities and rollover effects are percentage points per percentage point of macro shock. Contractual cash sensitivities are percentage changes per percentage point.</li>
        <li>Contingency funding adds cash on draw, with fees and principal repayment in their selected buckets. Liquidation converts available HQLA to cash after the sale discount and removes the sold securities from the buffer. A separate outflow models second-round stress, including any foregone coupons after sale that are material to the assessment.</li>
        <li>Thresholds and the LCR proxy are assessment inputs. Formal filing requires Treasury and ALCO confirmation of the assumptions, eligibility rules and applicable Bank of Ghana indicators. Uploaded assessments require independent review and a sign-off reference.</li>
      </ul>
    </Card>
  </>;
}
