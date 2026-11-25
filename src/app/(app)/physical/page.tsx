import Link from 'next/link';
import { activeLoans, screenRuns } from '@/lib/store';
import { COLLATERAL, CREDIT, REGIONS, sectorOf } from '@/lib/params';
import { assessPortfolio, hazardEvidence, hazardSource, HIGH_PHYSICAL_RISK, MATERIAL_HAZARD, remediationShortlist, SITE_EXPOSURE_REFERENCE } from '@/lib/physical-risk';
import { Card, PageHead, Table } from '@/components/ui';
import { RiskMap } from '@/components/risk-map-lazy';
import { PhysicalPortfolioDashboard } from '@/components/physical-portfolio-dashboard';
import { BorrowerSelector } from '@/components/borrower-selector';
import { transitionScore, transitionScoreInputs } from '@/lib/engine';
import { ghs, pct, to5 } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const scoreLabel = (score: number | null) => score === null ? 'Pending' : `${score.toFixed(2)} / 5`;

export default async function PhysicalPage({ searchParams }: { searchParams: Promise<{ borrower?: string }> }) {
  const { dataset, loans } = await activeLoans();
  const { policy, facilities, borrowers } = assessPortfolio(loans, await screenRuns(), dataset.id);
  const requested = (await searchParams).borrower;
  const selected = requested ? borrowers.find((item) => item.id === requested) : borrowers[0];
  const transitionForDisplay = selected?.facilities.map(({ loan, transition }) => transition?.score ?? to5(transitionScore(loan, 1))) ?? [];
  const displayedTransition = selected ? Math.max(...transitionForDisplay) : 1;
  const displayedOverall = selected?.overall ?? Math.max(selected?.physical ?? 1, displayedTransition);
  const actions = selected ? remediationShortlist(selected) : [];
  const ead = borrowers.reduce((sum, item) => sum + item.ead, 0);
  const sumExposure = (profiles: typeof borrowers) => profiles.reduce((sum, profile) => sum + profile.ead, 0);
  const highEad = facilities.filter((item) => item.physical >= HIGH_PHYSICAL_RISK).reduce((sum, item) => sum + item.loan.ead, 0);
  const approvedTransition = borrowers.filter((item) => item.transition !== null);
  const highTransition = approvedTransition.filter((item) => item.transition! >= 3);
  const combined = borrowers.filter((item) => item.overall !== null);
  const highCombined = combined.filter((item) => item.overall! >= 3);
  const portfolioRows = facilities.map(({ loan, sites, physical }) => {
    const site = sites.reduce((highest, candidate) => candidate.score > highest.score ? candidate : highest);
    const driver = site.hazards[0];
    return {
      id: loan.id, borrower: loan.borrower, borrowerId: loan.borrowerId ? `borrower:${loan.borrowerId}` : `facility:${loan.id}`,
      region: site.region, sector: sectorOf(loan.sector).name, driver: driver.impact > 0 ? driver.hazard[0].toUpperCase() + driver.hazard.slice(1) : 'None modelled',
      ead: loan.ead, score: physical, verified: sites.every((location) => !!location.reference),
    };
  });

  return (
    <>
      <PageHead area="Engine II · Physical risk & GIS" title="Borrower climate risk" intro="Review facility and collateral exposure, the approved Engine I transition assessment, and borrower-specific remediation. Portfolio views use the active loan book.">
        <a href="#engine-ii-methodology" className="text-sm font-medium text-lime-900 underline">Score methodology</a>
      </PageHead>
      <PhysicalPortfolioDashboard rows={portfolioRows} />

      <section id="borrower-risk" className="mt-6 scroll-mt-4">
        <Card title="Borrower risk profile">
          <BorrowerSelector selected={selected?.id ?? ''} options={[...borrowers].sort((a, b) => a.name.localeCompare(b.name)).map((item) => ({
            id: item.id, label: `${item.name} · ${item.facilities.map((facility) => facility.loan.id).join(', ')}`,
          }))} />
          {selected ? (
            <>
              <h3 className="text-lg font-semibold">{selected.name}</h3>
              <p className="mt-1 text-sm text-zinc-600">{ghs(selected.ead)} outstanding · {selected.facilities.length} {selected.facilities.length === 1 ? 'facility' : 'facilities'}{selected.id.startsWith('facility:') ? ' · facility-level profile' : ''}</p>
              <div className="my-4 grid gap-3 sm:grid-cols-3" aria-live="polite">
                {[
                  { label: 'Physical risk', score: selected.physical, source: selected.fullyLocated ? 'Modelled hazards at verified locations' : 'Indicative · location proxies used' },
                  { label: 'Transition risk', score: displayedTransition, source: selected.transition === null ? 'Demo estimate · calculated from loan data and available verified scores' : 'Approved · verified Engine I assessment' },
                  { label: 'Overall climate risk', score: displayedOverall, source: selected.overall === null ? 'Demo estimate · higher of physical and transition scores' : `GCB policy · ${policy?.reference}` },
                ].map(({ label, score, source }) => (
                  <div key={label} className="rounded-xl border border-lime-300 bg-lime-50 p-4 shadow-sm">
                    <p className="text-sm font-semibold text-lime-950">{label}</p>
                    <p className="my-2 text-2xl font-semibold tabular-nums text-slate-950">{scoreLabel(score)}</p>
                    <div aria-hidden="true" className="mb-3 h-2 overflow-hidden rounded-full bg-lime-200">
                      <div className="h-full rounded-full bg-lime-600 transition-[width] motion-reduce:transition-none" style={{ width: `${score * 20}%` }} />
                    </div>
                    <p className="text-sm text-lime-950">{source}</p>
                  </div>
                ))}
              </div>
              <p className="mb-4 text-sm text-zinc-600">The physical score uses the highest applicable site score. The transition score uses the highest facility score. Where verified transition scores are unavailable, the demo uses the loan’s sector sensitivity, emissions intensity and transition plan to calculate an estimate. Portfolio approval coverage counts verified scores.</p>
              <Table head={['Facility', 'Outstanding', 'Physical risk', 'Transition risk', 'Transition score source']} rows={selected.facilities.map((facility, index) => [
                facility.loan.id, ghs(facility.loan.ead), scoreLabel(facility.physical), `${scoreLabel(transitionForDisplay[index])}${facility.transition ? ' · verified' : ' · demo estimate'}`,
                facility.transition ? <Link key="source" href={`/screening/${facility.transition.runId}#review`} className="underline">{facility.transition.runId} · {facility.transition.evidence}</Link>
                  : <div key="source"><a href="#transition-method" className="underline">Demo loan data and sector parameters</a><br />
                    {facility.latestRun ? <Link href={`/screening/${facility.latestRun}`} className="text-sm underline">Open Engine I assessment {facility.latestRun}</Link>
                      : <Link href={{ pathname: '/screening', query: { facility: facility.loan.id } }} className="text-sm underline">Open Engine I questionnaire</Link>}</div>,
              ])} />
              <div className="mt-4">
                <Table head={['Facility and site', 'Region and coordinates', 'Location evidence', 'Financial exposure', 'Site score', 'Hazard × exposure × vulnerability']} rows={selected.facilities.flatMap((facility) => facility.sites.map((site) => [
                  `${facility.loan.id} · ${site.kind}`, `${site.region} · ${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}`,
                  site.reference ?? site.quality,
                  <div key="exposure" className="whitespace-nowrap">{ghs(site.exposureAmount)} {site.kind === 'Facility' ? 'EAD' : 'collateral'}<p className="text-xs text-zinc-600">Exposure factor {site.exposure.toFixed(3)}</p></div>,
                  scoreLabel(site.score),
                  <ul key="hazards" className="whitespace-nowrap">{site.hazards.map((item) => <li key={item.hazard}><span className="capitalize">{item.hazard}</span> · {item.intensity.toFixed(3)} × {site.exposure.toFixed(3)} × {item.vulnerability.toFixed(3)} ≈ {item.impact.toFixed(3)}<span className="block text-xs text-zinc-600">Hazard input {item.regionalBaseline.toFixed(3)} × {item.multiplier.toFixed(3)} · {site.kind === 'Facility' ? sectorOf(facility.loan.sector).name : COLLATERAL[facility.loan.collateralType].name} vulnerability</span></li>)}</ul>,
                ]))} />
              </div>
            </>
          ) : <p className="text-sm text-zinc-600">Select an available borrower to view the risk profile.</p>}
        </Card>
      </section>

      {selected && <Card title="Remediation shortlist" className="mt-6" note="For relationship manager and Risk review">
        <p className="mb-4 text-sm text-zinc-600">Discuss feasibility and site evidence with the borrower, confirm an owner and timeframe, then submit the agreed actions to GCB Risk for approval. These advisory actions have no modelled impact on PD, LGD or ECL.</p>
        {actions.length ? <Table head={['Priority / driver', 'Proposed action', 'Responsible party', 'Horizon', 'Supporting evidence', 'Monitoring KRI']} rows={actions.map((item, index) => [
          <span key="driver" className="font-medium capitalize">{index + 1}. {item.driver}<span className="block text-xs font-normal text-zinc-600">{item.facility}</span></span>,
          item.action, item.owner, item.horizon, item.evidence, item.kri,
        ])} /> : <p className="text-sm text-zinc-600">The current assessment identified no material drivers or evidence gaps for this shortlist.</p>}
      </Card>}

      <Card title="Portfolio climate risk coverage" className="mt-6" note="High risk threshold ≥ 3.0 / 5">
        <Table head={['Component', 'Exposure with a score', 'High risk exposure', 'Pending exposure']} rows={[
          ['Physical (includes location proxies)', ghs(ead), ghs(highEad), ghs(0)],
          ['Approved transition', ghs(sumExposure(approvedTransition)), ghs(sumExposure(highTransition)), ghs(ead - sumExposure(approvedTransition))],
          ['Overall climate risk', ghs(sumExposure(combined)), ghs(sumExposure(highCombined)), ghs(ead - sumExposure(combined))],
        ]} />
      </Card>

      <Card title="Facility and collateral hazard map" className="mt-6">
        <RiskMap
          points={facilities.flatMap(({ loan, sites }) => sites.map((site) => ({ id: `${loan.id} · ${site.kind}`, borrower: loan.borrower,
            lat: site.lat, lon: site.lon, ead: site.exposureAmount, score: (site.score - 1) / 4,
            haz: Object.fromEntries(site.hazards.map((hazard) => [hazard.hazard, hazard.intensity])), geo: site.reference ? 'verified' : site.quality,
          })))}
          regions={REGIONS.map((region) => ({ name: region.name, lat: region.lat, lon: region.lon,
            hazard: Object.fromEntries(Object.entries(region.hazard).map(([name, value]) => [name, Math.min(1, value * (1 + (hazardEvidence.find((item) => item.hazard === name)?.change ?? 0)))])),
          }))}
        />
      </Card>

      <section id="engine-ii-methodology" className="mt-6 scroll-mt-4">
      <Card title="Engine II score methodology">
        <div className="space-y-6 text-sm text-zinc-700">
        <section aria-labelledby="physical-method">
        <h3 id="physical-method" className="mb-2 text-base font-semibold text-zinc-900">Physical risk · Current Policies 2050</h3>
        <p className="mb-3 text-sm text-zinc-600">{hazardSource}. Ghana-wide signals adjust illustrative regional hazard intensities. Coordinates identify the site on the map. Site-level hazard layers and observed flood depths are unavailable in this environment. Coastal intensity uses the regional baseline proxy.</p>
        <Table head={['Risk driver', 'Modelled indicator', '2015–2024', '2045–2054', '2050 multiplier']} rows={hazardEvidence.map((item) => [
          item.hazard, item.label, `${item.base.toFixed(1)} ${item.unit}`, `${item.future.toFixed(1)} ${item.unit}`, (1 + item.change).toFixed(3),
        ])} />
        <p className="mt-3 text-sm text-zinc-600">Engine II follows the IPCC risk framework by combining hazard, exposure and vulnerability. The demo uses facility outstanding exposure (EAD) or pledged collateral value as a financial proxy for what is exposed at the mapped site. The exposure factor is the site amount divided by {ghs(SITE_EXPOSURE_REFERENCE)}, capped at 1. The reference and weights are illustrative model choices. <a className="underline" href="https://www.ipcc.ch/report/ar6/wg2/chapter/annex-ii/">IPCC AR6 WGII glossary</a></p>
        <p className="mt-3 text-sm text-zinc-600">Each hazard contribution multiplies the three inputs. The site score weights the largest contribution at 70% and the average at 30%, then scales the result to 1–5. The highest applicable site score drives the borrower profile. The portfolio score is the sum of each facility’s physical score multiplied by its outstanding exposure, divided by total outstanding exposure in the selected view. Portfolio risk bands and concentrations count each facility’s exposure once. The remediation shortlist uses contributions of {MATERIAL_HAZARD.toFixed(2)} or higher.</p>
        <dl className="mt-3 space-y-2">
          <div><dt className="inline font-semibold">Hazard intensity </dt><dd className="inline">The illustrative regional baseline from the model’s Ghana region table is multiplied by the CCKP ratio (2045–2054 mean ÷ 2015–2024 mean, SSP5-8.5), then capped at 1. Coastal hazard uses the regional baseline with a multiplier of 1.</dd></div>
          <div><dt className="inline font-semibold">Exposure </dt><dd className="inline">Facility EAD and pledged collateral value come from the active loan extract ({dataset.id}). They are scaled separately against the demo reference.</dd></div>
          <div><dt className="inline font-semibold">Vulnerability </dt><dd className="inline">Facility coefficients come from the model’s sector table. Collateral coefficients come from the collateral-type table. These are illustrative 0–1 parameters.</dd></div>
        </dl>
        <p className="mt-3"><strong>Worked example from the screenshot.</strong> Bono East’s illustrative heat baseline of 0.600 × the CCKP multiplier of 1.161 gives 0.697. The facility exposure factor of 0.031 represents about GHS 3.1m of outstanding exposure. Heat vulnerability for trade is 0.400. The resulting heat contribution is about 0.009. Combining it with flood (0.007), drought (0.005) and coastal (0.000) gives a site score of about <strong>1.03 / 5</strong>. The collateral row uses its own exposure and the property vulnerability coefficients, yielding about <strong>1.02 / 5</strong>. The model calculates with unrounded inputs.</p>
        </section>

        <section aria-labelledby="transition-method">
          <h3 id="transition-method" className="mb-2 scroll-mt-4 text-base font-semibold text-zinc-900">Transition risk</h3>
          <p>When the latest Engine I assessment for the facility and active dataset is approved and its supporting evidence is verified, Engine II uses the recorded 1–5 score. Open the linked assessment to see its reference. The questionnaire link is the entry point for recording evidence.</p>
          <p className="mt-2">For other facilities, the demo calculates an estimate using emissions intensity and transition-plan status from the active loan extract, and illustrative sector sensitivity and emissions benchmarks from the model’s sector table. Emissions intensity is in tonnes of CO₂e per GHS million of revenue.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>Normalize emissions intensity by dividing by 1.4 × the sector benchmark and limiting the result to 0–1.</li>
            <li>Multiply sector sensitivity by (0.6 + 0.4 × normalized intensity) and then by (1 − plan relief). The model uses {pct(CREDIT.transitionReadinessRelief, 0)} relief when the loan extract flags a transition plan and 0% otherwise. Engine II sets the transition shock multiplier to 1.</li>
            <li>Limit this result to 0–1 and convert it to the 1–5 scale using 1 + 4 × the result.</li>
          </ol>
          {selected && <div className="mt-3"><Table head={['Selected facility', 'Sector sensitivity', 'Emissions intensity', 'Sector benchmark', 'Normalized intensity', 'Plan relief', 'Displayed transition score']}
            rows={selected.facilities.map(({ loan, transition }, index) => {
              if (transition) return [loan.id, '—', '—', '—', '—', '—', `${scoreLabel(transition.score)} · ${transition.runId}`];
              const inputs = transitionScoreInputs(loan);
              return [loan.id, inputs.sensitivity.toFixed(3), loan.emissionsIntensity, inputs.sectorBenchmark, inputs.intensity.toFixed(3), pct(inputs.relief, 0), scoreLabel(transitionForDisplay[index])];
            })} /></div>}
        </section>

        <section aria-labelledby="overall-method">
          <h3 id="overall-method" className="mb-2 text-base font-semibold text-zinc-900">Overall climate risk</h3>
          <p>For a borrower with multiple facilities, the physical component is the highest applicable site score and the transition component is the highest facility transition score. The demo overall score is the higher of these two components.</p>
          <p className="mt-2">When every applicable site is verified, every facility has a verified Engine I score, and a GCB policy is configured, the overall score uses that policy. The available methods are the higher component or a weighted average using the configured physical weight and the remaining weight for transition risk.</p>
          {selected && <p className="mt-2 font-medium">Selected profile · physical {scoreLabel(selected.physical)} · transition {scoreLabel(displayedTransition)} · overall {scoreLabel(displayedOverall)} · {selected.overall === null ? 'Demo maximum' : policy?.label}</p>}
        </section>
        </div>
      </Card>
      </section>
    </>
  );
}
