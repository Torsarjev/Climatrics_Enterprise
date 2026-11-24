import Link from 'next/link';
import { activeLoans } from '@/lib/store';
import { dashboard } from '@/lib/dashboard';
import { BANK, LOSS_DIST, TRANSMISSION } from '@/lib/params';
import { CALIBRATION_VERSION, NGFS_RELEASE } from '@/lib/calibration';
import { PageHead, Table } from '@/components/ui';
import { ghs, pct } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const Formula = ({ children }: { children: React.ReactNode }) => <p className="rounded-md bg-zinc-50 px-3 py-2 font-mono text-sm">{children}</p>;
const Links = ({ items }: { items: [string, string][] }) => (
  <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">{items.map(([href, t]) => <Link key={href + t} href={href} className="text-[#3a5a45] underline">{t} →</Link>)}</p>
);
const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="mt-6 scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-5 target:ring-2 target:ring-[#5a8a3c]">
    <h2 className="text-lg font-semibold">{title}</h2>
    <div className="mt-3 space-y-3 text-sm text-zinc-700">{children}</div>
  </section>
);

export default async function MethodologyPage() {
  const { dataset, loans } = await activeLoans();
  const D = dashboard(dataset.id, loans);
  const c = dataset.control;
  const base = D.scenarios[0];
  const worst = D.scenarios.find((s) => s.key === D.worstKey)!;
  const loanRwa = base.rwaBefore - BANK.otherRwa;

  return (
    <>
      <PageHead area="How the numbers are produced" title="Methodology" intro="Each headline figure on the dashboard, with its formula, the inputs that produced it and links to the detailed screens. Every value on this page is computed live from the active dataset." />
      <nav className="flex flex-wrap gap-2 text-sm">
        {[['exposure', 'Portfolio exposure'], ['high-risk', 'High-risk exposure'], ['baseline-ecl', 'Baseline ECL'], ['stressed-ecl', 'Stressed ECL'], ['heatmap', 'Sector heatmap'], ['capital', 'Capital adequacy'], ['loss', 'VaR and economic capital'], ['liquidity', 'Liquidity']].map(([id, t]) => (
          <a key={id} href={`#${id}`} className="rounded-md px-2.5 py-1 ring-1 ring-zinc-300 hover:bg-zinc-100">{t}</a>
        ))}
      </nav>

      <Section id="exposure" title={`Portfolio exposure: ${ghs(D.ead)}`}>
        <Formula>Portfolio exposure = Σ exposure at default (EAD) of every accepted facility</Formula>
        <Table head={['Step', 'Value']} align={['l', 'r']} rows={[
          ['Rows read from the extract', `${c.rowsRead} · ${ghs(c.eadRead)}`],
          ['Rejected to the exception queue', `${c.rowsRejected} · ${ghs(c.eadRejected)}`],
          [<b key="a">Accepted facilities (used by every model)</b>, <b key="v">{c.rowsAccepted} · {ghs(c.eadAccepted)}</b>],
          ['Reconciliation (read = accepted + rejected)', c.reconciled ? 'Balanced ✓' : 'Break ✕'],
          ['Dataset version and fingerprint', `${dataset.id} · SHA-256 ${dataset.hash.slice(0, 16)}…`],
        ]} />
        <Links items={[['/data', 'Validation and exception queue'], ['/portfolio', 'Exposure by sector, region, collateral and maturity']]} />
      </Section>

      <Section id="high-risk" title={`High-risk exposure: ${pct(D.highRisk / D.ead)} (${ghs(D.highRisk)})`}>
        <Formula>High-risk = facilities with physical risk ≥ 3.0 of 5 today, OR in a sector with transition sensitivity ≥ 3.4 of 5 and no transition plan</Formula>
        <Table head={['Component', 'Exposure', 'Share of book']} align={['l', 'r', 'r']} rows={[
          ['Physical only (hazard × vulnerability at the collateral location)', ghs(D.highRiskParts.physicalOnly), pct(D.highRiskParts.physicalOnly / D.ead)],
          ['Transition only (oil and gas, thermal power, mining, transport without a plan)', ghs(D.highRiskParts.transitionOnly), pct(D.highRiskParts.transitionOnly / D.ead)],
          ['Both', ghs(D.highRiskParts.both), pct(D.highRiskParts.both / D.ead)],
          [<b key="t">High-risk total ({D.highRiskParts.count} facilities)</b>, <b key="e">{ghs(D.highRisk)}</b>, <b key="p">{pct(D.highRisk / D.ead)}</b>],
        ]} />
        <p>Physical score = 0.7 × worst (hazard × vulnerability) + 0.3 × average across flood, drought, heat and coastal, shown on a 1–5 scale. Counted once even when both conditions apply.</p>
        <Links items={[['/physical', 'Physical risk map and vulnerability matrix'], ['/transition', 'Transition sensitivity and watch-list']]} />
      </Section>

      <Section id="baseline-ecl" title={`Baseline ECL: ${ghs(base.ecl)}`}>
        <Formula>One-year ECL = PD × LGD × EAD, summed over all facilities (defaulted facilities: PD = 100%)</Formula>
        <p>PD and LGD are the bank’s own values from the loan extract; no climate stress is applied. This is the simplified one-year ECL required by the brief, not full IFRS 9 lifetime staging.</p>
        <Table head={['IFRS 9 stage in the extract', 'ECL']} align={['l', 'r']} rows={[
          ['Stage 1 (performing)', ghs(D.eclByStage[0])], ['Stage 2 (significant increase in credit risk)', ghs(D.eclByStage[1])], ['Stage 3 (defaulted)', ghs(D.eclByStage[2])],
          [<b key="t">Total baseline ECL</b>, <b key="v">{ghs(base.ecl)}</b>],
        ]} />
        <Links items={[['/portfolio', 'Facilities, PD and LGD by sector']]} />
      </Section>

      <Section id="stressed-ecl" title={`Stressed ECL: ${ghs(worst.eclStressed)} (most severe: ${worst.note} · 2050)`}>
        <Formula>Stressed ECL = Σ stressed PD × stressed LGD × EAD, bottom-up, for each NGFS scenario at 2050; the dashboard shows the most severe</Formula>
        <Table head={['Scenario (2050, bottom-up)', 'ECL before', 'ECL after', 'Additional provisions', 'Capital ratio after']} align={['l', 'r', 'r', 'r', 'r']}
          rows={D.scenarios.map((s) => [
            <Link key="s" href={`/compare?scenario=${s.key}&horizon=2050`} className="underline">{s.label} · {s.note}</Link>,
            ghs(s.ecl), <b key="e">{ghs(s.eclStressed)}</b>, `+${ghs(s.additionalProvisions)}`, pct(s.carAfter),
          ])} />
        <ol className="list-decimal space-y-1 pl-5">
          <li><b>Scenario:</b> {NGFS_RELEASE}. Regional shocks are converted to Ghana with documented coefficients (calibration {CALIBRATION_VERSION}).</li>
          <li><b>Borrower cash flow:</b> revenue moves with Ghana GDP × sector elasticity; {pct(TRANSMISSION.variableCostShare, 0)} of costs are variable; inflation raises costs; the carbon price adds a cost; the long-term rate raises debt service on floating debt.</li>
          <li><b>DSCR → PD:</b> stressed DSCR = CFADS ÷ debt service, mapped to a PD through the DSCR band table.</li>
          <li><b>Flood → LGD:</b> a 1-in-100-year flood at sites where the hazard is high damages the collateral through a depth–damage curve; lost recovery raises LGD.</li>
          <li>Chronic physical damage is already inside the NGFS GDP path, so only the acute flood is added at borrower level: nothing is counted twice.</li>
        </ol>
        <Links items={[['/calibration', 'Ghana-calibrated NGFS values and their sources'], [`/compare?scenario=${worst.key}&horizon=2050`, 'Top-down vs bottom-up for this scenario'], ['/stress', 'Run it and open the borrower-level Explain panel']]} />
      </Section>

      <Section id="heatmap" title="Sector climate risk heatmap">
        <Formula>Overall level = the higher of the physical level and the transition level</Formula>
        <Table head={['Sector', 'Physical score (1–5)', 'Level', 'Transition sensitivity (1–5)', 'Level', 'Overall']} align={['l', 'r', 'l', 'r', 'l', 'l']}
          rows={D.sectors.map((s) => [s.name, (1 + 4 * s.physScore).toFixed(1), s.physical, (1 + 4 * s.transScore).toFixed(1), s.transition, <b key="o">{s.overall}</b>])} />
        <p>Physical: High ≥ 2.5, Medium ≥ 2.0 (exposure-weighted average of facility scores today). Transition: High ≥ 3.4, Medium ≥ 2.2 (sector sensitivity to carbon price and policy).</p>
        <Links items={[['/physical', 'Physical risk by facility'], ['/transition', 'Transition risk by sector']]} />
      </Section>

      <Section id="capital" title={`Capital adequacy: ${pct(base.carBefore)} today`}>
        <Formula>Capital ratio = (CET1 + Tier 2 − additional climate provisions) ÷ risk-weighted assets</Formula>
        <Table head={['Input', 'Value']} align={['l', 'r']} rows={[
          ['CET1 capital', ghs(BANK.cet1)], ['Tier 2 capital', ghs(BANK.tier2)],
          ['Loan RWA (100% risk weight, defaulted loans excluded)', ghs(loanRwa)], ['Other RWA (market, operational, non-loan credit)', ghs(BANK.otherRwa)],
          [<b key="c">Capital ratio today</b>, <b key="v">{pct(base.carBefore)}</b>], ['Minimum (configurable; confirm against Bank of Ghana)', pct(BANK.carMinimum, 0)],
        ]} />
        <Table head={['Scenario (2050, bottom-up)', 'Additional provisions', 'Capital after', 'RWA after', 'Capital ratio']} align={['l', 'r', 'r', 'r', 'r']}
          rows={D.scenarios.map((s) => [s.note, ghs(s.additionalProvisions), ghs(s.capitalAfter), ghs(s.rwaAfter), <b key="r" className={s.carAfter < BANK.carMinimum ? 'text-red-600' : ''}>{pct(s.carAfter)}</b>])} />
        <p className="text-xs text-zinc-500">Capital figures belong to the synthetic “Demo Bank Ghana”.</p>
        <Links items={[['/capital', 'ICAAP capital bridge and all runs side by side']]} />
      </Section>

      <Section id="loss" title="Credit VaR, CVaR and economic capital">
        <Formula>Loss in year k = Σ EAD × LGD × 1[√ρ·Z + √(1−ρ)·εᵢ &lt; Φ⁻¹(PD)] · VaR = loss quantile · CVaR = mean loss beyond VaR · Economic capital = VaR 99.9% − expected loss</Formula>
        <p>One-factor (Vasicek) Monte Carlo with {LOSS_DIST.simulations.toLocaleString()} simulated years and a fixed seed ({LOSS_DIST.seed}), so the distribution is reproducible. Asset correlation ρ is set by sector. Run once with base PD and LGD, once with stressed values.</p>
        <Links items={[['/stress', 'Run a scenario to see its loss distribution']]} />
      </Section>

      <Section id="liquidity" title="Liquidity coverage">
        <Formula>LCR = high-quality liquid assets ÷ net cash outflows over 30 days (minimum 100%)</Formula>
        <p>Deposit run-off by segment (retail, SME, corporate) and drawdown of committed lines, increased under climate stress. An ILAAP independent of the credit stress (HQLA repriced from NGFS long-term rate moves; run-off driven by GDP and inflation) is being built as the brief requires.</p>
        <Links items={[['/capital', 'ILAAP table']]} />
      </Section>
    </>
  );
}
