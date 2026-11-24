import Link from 'next/link';
import { activeLoans, screenRuns } from '@/lib/store';
import { REGIONS, sectorOf } from '@/lib/params';
import { assessPortfolio, hazardEvidence, hazardSource, HIGH_PHYSICAL_RISK, MATERIAL_HAZARD, remediationShortlist } from '@/lib/physical-risk';
import { Bars, btnClass, Card, PageHead, Stat, Table } from '@/components/ui';
import { RiskMap } from '@/components/risk-map-lazy';
import { ghs, pct } from '@/lib/fmt';

export const dynamic = 'force-dynamic';

const scoreLabel = (score: number | null) => score === null ? 'Pending' : `${score.toFixed(2)} / 5`;
const profileHref = (id: string) => ({ pathname: '/physical', query: { borrower: id }, hash: 'borrower-risk' });

export default async function PhysicalPage({ searchParams }: { searchParams: Promise<{ borrower?: string }> }) {
  const { dataset, loans } = await activeLoans();
  const { policy, facilities, borrowers } = assessPortfolio(loans, await screenRuns(), dataset.id);
  const requested = (await searchParams).borrower;
  const selected = requested ? borrowers.find((item) => item.id === requested) : borrowers[0];
  const actions = selected ? remediationShortlist(selected) : [];
  const ead = borrowers.reduce((sum, item) => sum + item.ead, 0);
  const sumExposure = (profiles: typeof borrowers) => profiles.reduce((sum, profile) => sum + profile.ead, 0);
  const high = borrowers.filter((item) => item.physical >= HIGH_PHYSICAL_RISK);
  const highEad = sumExposure(high);
  const approvedTransition = borrowers.filter((item) => item.transition !== null);
  const highTransition = approvedTransition.filter((item) => item.transition! >= 3);
  const combined = borrowers.filter((item) => item.overall !== null);
  const highCombined = combined.filter((item) => item.overall! >= 3);
  const verifiedSites = borrowers.filter((item) => item.fullyLocated);
  const highFacilities = facilities.filter((item) => item.physical >= HIGH_PHYSICAL_RISK);
  const concentration = (key: (facility: typeof facilities[number]) => string) => {
    const groups = new Map<string, number>();
    for (const facility of highFacilities) {
      const label = key(facility);
      groups.set(label, (groups.get(label) ?? 0) + facility.loan.ead);
    }
    return [...groups].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  };
  const regional = concentration((facility) => facility.sites.reduce((a, b) => b.score > a.score ? b : a).region);
  const sector = concentration((facility) => sectorOf(facility.loan.sector).name);
  const share = (amount: number) => pct(ead ? amount / ead : 0);

  return (
    <>
      <PageHead area="Engine II · Physical risk & GIS" title="Borrower climate risk" intro="Review facility and collateral exposure, the approved Engine I transition assessment, and borrower-specific remediation. Portfolio views use the active loan book." />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Portfolio exposure" value={ghs(ead)} sub={`${facilities.length.toLocaleString('en-GB')} facilities`} />
        <Stat label="High physical risk exposure" value={share(highEad)} sub={`${ghs(highEad)} across borrower groups scoring ≥ 3.0`} tone="warn" />
        <Stat label="Verified location coverage" value={share(sumExposure(verifiedSites))} sub="Borrower exposure with every applicable site referenced" />
        <Stat label="Approved transition coverage" value={share(sumExposure(approvedTransition))} sub="Borrower exposure with verified scores for every facility" />
      </div>

      <section id="borrower-risk" className="mt-6 scroll-mt-4">
        <Card title="Borrower risk profile">
          <form action="/physical#borrower-risk" method="get" className="mb-5 flex flex-wrap items-end gap-3">
            <label className="min-w-0 text-sm font-medium">Borrower or facility
              <select name="borrower" defaultValue={selected?.id ?? ''} className="mt-1 block max-w-full rounded-md border border-zinc-300 bg-white px-3 py-2">
                {!selected && <option value="" disabled>Select a borrower</option>}
                {[...borrowers].sort((a, b) => a.name.localeCompare(b.name)).map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {item.facilities.map((facility) => facility.loan.id).join(', ')}</option>
                ))}
              </select>
            </label>
            <button className={btnClass} disabled={!borrowers.length}>Open profile</button>
          </form>
          {selected ? (
            <>
              <h3 className="text-lg font-semibold">{selected.name}</h3>
              <p className="mt-1 text-sm text-zinc-600">{ghs(selected.ead)} outstanding · {selected.facilities.length} {selected.facilities.length === 1 ? 'facility' : 'facilities'}{selected.id.startsWith('facility:') ? ' · facility-level profile pending a borrower ID' : ''}</p>
              <div className="my-4 grid gap-3 sm:grid-cols-3">
                <Stat label="Physical risk" value={scoreLabel(selected.physical)} sub={selected.fullyLocated ? 'Sites verified in the extract · modelled hazards' : 'Indicative · location proxies used'} />
                <Stat label="Approved transition risk" value={scoreLabel(selected.transition)} sub="Engine I · requires approval and verified supporting evidence" />
                <Stat label="Overall climate risk" value={scoreLabel(selected.overall)} sub={policy ? policy.label : 'GCB aggregation policy reference required'} />
              </div>
              <p className="mb-4 text-sm text-zinc-600">The highest applicable site score determines the physical component. The highest approved facility transition score determines the transition component. Overall scoring requires both components, verified locations, and a configured GCB policy{policy ? ` · ${policy.reference}` : ''}.</p>
              <Table head={['Facility', 'Outstanding', 'Physical risk', 'Approved transition', 'Engine I source']} rows={selected.facilities.map((facility) => [
                facility.loan.id, ghs(facility.loan.ead), scoreLabel(facility.physical), scoreLabel(facility.transition?.score ?? null),
                facility.transition ? <Link key="source" href={`/screening/${facility.transition.runId}#review`} className="underline">{facility.transition.runId} · {facility.transition.evidence}</Link>
                  : facility.latestRun ? <Link key="source" href={`/screening/${facility.latestRun}`} className="underline">Open assessment {facility.latestRun}</Link>
                    : <Link key="source" href={{ pathname: '/screening', query: { facility: facility.loan.id } }} className="underline">Open Engine I questionnaire</Link>,
              ])} />
              <div className="mt-4">
                <Table head={['Facility and site', 'Region and coordinates', 'Location evidence', 'Site score', 'Modelled hazard × vulnerability']} rows={selected.facilities.flatMap((facility) => facility.sites.map((site) => [
                  `${facility.loan.id} · ${site.kind}`, `${site.region} · ${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}`,
                  site.reference ?? site.quality, scoreLabel(site.score),
                  <ul key="hazards" className="whitespace-nowrap">{site.hazards.map((item) => <li key={item.hazard} className="capitalize">{item.hazard} · {item.intensity.toFixed(2)} × {item.vulnerability.toFixed(2)} = {item.impact.toFixed(2)}</li>)}</ul>,
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

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="High physical risk exposure by region" note="Region of each facility’s highest-scoring site">
          {regional.length ? <Bars rows={regional} format={(amount) => ghs(amount)} color="bg-orange-600" /> : <p className="text-sm text-zinc-600">No facilities meet the high-risk threshold.</p>}
        </Card>
        <Card title="High physical risk exposure by sector" note="Facility physical score ≥ 3.0">
          {sector.length ? <Bars rows={sector} format={(amount) => ghs(amount)} color="bg-orange-600" /> : <p className="text-sm text-zinc-600">No facilities meet the high-risk threshold.</p>}
        </Card>
      </div>
      <Card title="Portfolio climate risk coverage" className="mt-6" note="High risk threshold ≥ 3.0 / 5">
        <Table head={['Component', 'Exposure with a score', 'High risk exposure', 'Pending exposure']} rows={[
          ['Physical (includes location proxies)', ghs(ead), ghs(highEad), ghs(0)],
          ['Approved transition', ghs(sumExposure(approvedTransition)), ghs(sumExposure(highTransition)), ghs(ead - sumExposure(approvedTransition))],
          ['Overall climate risk', ghs(sumExposure(combined)), ghs(sumExposure(highCombined)), ghs(ead - sumExposure(combined))],
        ]} />
      </Card>

      <Card title="Largest borrower physical risk concentrations" className="mt-6" note="Ranked by exposure × physical score">
        <Table head={['Borrower', 'Outstanding', 'Physical', 'Approved transition', 'Overall']} rows={borrowers.slice(0, 12).map((item) => [
          <Link key="borrower" href={profileHref(item.id)} className="font-medium underline">{item.name} · {item.facilities[0].loan.id}</Link>,
          ghs(item.ead), scoreLabel(item.physical), scoreLabel(item.transition), scoreLabel(item.overall),
        ])} />
      </Card>

      <Card title="Facility and collateral hazard map" className="mt-6">
        <RiskMap
          points={facilities.flatMap(({ loan, sites }) => sites.map((site) => ({ id: `${loan.id} · ${site.kind}`, borrower: loan.borrower,
            lat: site.lat, lon: site.lon, ead: site.kind === 'Collateral' ? loan.collateralValue : loan.ead, score: (site.score - 1) / 4,
            haz: Object.fromEntries(site.hazards.map((hazard) => [hazard.hazard, hazard.intensity])), geo: site.reference ? 'verified' : site.quality,
          })))}
          regions={REGIONS.map((region) => ({ name: region.name, lat: region.lat, lon: region.lon,
            hazard: Object.fromEntries(Object.entries(region.hazard).map(([name, value]) => [name, Math.min(1, value * (1 + (hazardEvidence.find((item) => item.hazard === name)?.change ?? 0)))])),
          }))}
        />
      </Card>

      <Card title="Hazard evidence and scoring method" className="mt-6" note="Current Policies · 2050 · SSP5-8.5">
        <p className="mb-3 text-sm text-zinc-600">{hazardSource}. Ghana-wide signals adjust illustrative regional hazard intensities. Coordinates identify the site on the map. Site-level hazard layers and observed flood depths are unavailable in this environment. Coastal intensity uses the regional baseline proxy.</p>
        <Table head={['Risk driver', 'Modelled indicator', '2015–2024', '2045–2054']} rows={hazardEvidence.map((item) => [
          item.hazard, item.label, `${item.base.toFixed(1)} ${item.unit}`, `${item.future.toFixed(1)} ${item.unit}`,
        ])} />
        <p className="mt-3 text-sm text-zinc-600">Site scores weight the largest hazard × vulnerability result at 70% and the mean at 30%, converted to a 1–5 scale. Regional and sector concentration tables count each high-risk facility’s outstanding exposure once. The remediation shortlist considers site hazard × vulnerability values of {MATERIAL_HAZARD.toFixed(2)} or higher.</p>
      </Card>
    </>
  );
}
