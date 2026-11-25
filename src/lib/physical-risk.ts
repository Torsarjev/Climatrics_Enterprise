import 'server-only';
import { CCKP } from '@/data/cckp';
import { hazardChange, SSP_FOR } from './calibration';
import { clamp } from './math';
import { COLLATERAL, HAZARDS, REGIONS, sectorOf, type Hazard } from './params';
import type { Loan, VerifiedSite } from './portfolio';
import type { ScreenRunRecord } from './store';

export const HIGH_PHYSICAL_RISK = 3;
export const MATERIAL_HAZARD = 0.4;
export const SITE_EXPOSURE_REFERENCE = 100_000_000;

export const hazardEvidence = [
  { hazard: 'flood', label: 'Maximum 5-day rainfall', unit: 'mm', ...hazardChange('rx5day', SSP_FOR.current, 2050) },
  { hazard: 'drought', label: 'Consecutive dry days', unit: 'days', ...hazardChange('cdd', SSP_FOR.current, 2050) },
  { hazard: 'heat', label: 'Days above 30°C', unit: 'days', ...hazardChange('hd30', SSP_FOR.current, 2050) },
] as const;
export const hazardSource = CCKP.source;

export function climateAggregationPolicy() {
  const method = process.env.GCB_CLIMATE_AGGREGATION_METHOD;
  const reference = process.env.GCB_CLIMATE_AGGREGATION_REFERENCE?.trim();
  const weight = Number(process.env.GCB_CLIMATE_PHYSICAL_WEIGHT ?? NaN);
  if (reference && method === 'max') return { label: 'Highest component score', reference, combine: Math.max };
  if (reference && method === 'weighted' && weight > 0 && weight < 1) {
    return { label: `Weighted average · ${(weight * 100).toFixed(1)}% physical · ${((1 - weight) * 100).toFixed(1)}% transition`, reference,
      combine: (physical: number, transition: number) => physical * weight + transition * (1 - weight) };
  }
  return null;
}

function assessSite(loan: Loan, kind: 'Facility' | 'Collateral', verifiedSite?: VerifiedSite) {
  const region = REGIONS.find((item) => item.name === (verifiedSite?.region ?? loan.region))!;
  const vulnerability = kind === 'Facility' ? sectorOf(loan.sector).vuln : COLLATERAL[loan.collateralType].vuln;
  const exposureAmount = kind === 'Facility' ? loan.ead : loan.collateralValue;
  const exposure = clamp(exposureAmount / SITE_EXPOSURE_REFERENCE);
  const hazards = HAZARDS.map((hazard) => {
    const signal = hazardEvidence.find((item) => item.hazard === hazard);
    const intensity = clamp(region.hazard[hazard] * (signal ? 1 + signal.change : 1));
    return { hazard, intensity, regionalBaseline: region.hazard[hazard], multiplier: signal ? 1 + signal.change : 1, vulnerability: vulnerability[hazard], impact: intensity * exposure * vulnerability[hazard] };
  }).sort((a, b) => b.impact - a.impact);
  const score = 1 + 4 * (0.7 * hazards[0].impact + 0.3 * hazards.reduce((sum, item) => sum + item.impact, 0) / hazards.length);
  return {
    kind, score, hazards, exposureAmount, exposure, region: region.name,
    lat: verifiedSite?.lat ?? loan.lat, lon: verifiedSite?.lon ?? loan.lon,
    reference: verifiedSite?.reference, quality: verifiedSite ? 'Verified in loan extract' : `Legacy ${loan.geoConfidence || 'location'} proxy`,
  };
}

export function assessPortfolio(loans: Loan[], runs: ScreenRunRecord[], datasetId: string) {
  const latest = new Map<string, ScreenRunRecord>();
  for (const run of runs) {
    if (run.datasetId === datasetId && !latest.has(run.facilityId)) latest.set(run.facilityId, run);
  }
  const policy = climateAggregationPolicy();
  const borrowers = new Map<string, ReturnType<typeof assessFacility>[]>();
  const facilities = loans.map((loan) => {
    const assessment = assessFacility(loan, latest.get(loan.id));
    const key = loan.borrowerId ? `borrower:${loan.borrowerId}` : `facility:${loan.id}`;
    const group = borrowers.get(key) ?? [];
    group.push(assessment);
    borrowers.set(key, group);
    return assessment;
  });
  return {
    policy, facilities,
    borrowers: [...borrowers].map(([id, sites]) => {
      const physical = Math.max(...sites.map((site) => site.physical));
      const transition = sites.every((site) => site.transition !== null) ? Math.max(...sites.map((site) => site.transition!.score)) : null;
      const fullyLocated = sites.every((site) => site.sites.every((location) => !!location.reference));
      return {
        id, name: sites[0].loan.borrower, physical, transition, fullyLocated, facilities: sites,
        overall: policy && fullyLocated && transition !== null ? policy.combine(physical, transition) : null,
        ead: sites.reduce((total, site) => total + site.loan.ead, 0),
      };
    }).sort((a, b) => b.physical - a.physical || b.ead - a.ead),
  };
}

function assessFacility(loan: Loan, run?: ScreenRunRecord) {
  const sites = [assessSite(loan, 'Facility', loan.facilitySite)];
  if (loan.collateralType !== 'none' && loan.collateralType !== 'cash' && loan.collateralValue > 0) {
    sites.push(assessSite(loan, 'Collateral', loan.collateralSite));
  }
  const evidence = run?.input.evidence.EV_TRANSITION_SCORE?.ref;
  const score = run?.input.transitionRiskScore;
  const transition = run?.status === 'approved' && run.verifiedEvidence?.includes('EV_TRANSITION_SCORE') && evidence && score != null && score >= 1 && score <= 5
    ? { score, evidence, runId: run.id, reviewer: run.reviewedBy } : null;
  return { loan, sites, transition, physical: Math.max(...sites.map((site) => site.score)), latestRun: run?.id };
}

const physicalActions: Record<Hazard, { action: string; horizon: string; kri: string }> = {
  flood: { action: 'Survey drainage and access routes. Assess barriers, drainage improvements or elevation of critical equipment.', horizon: '3–12 months', kri: 'Flood-related downtime hours per quarter' },
  drought: { action: 'Audit water use and assess recycling, storage and alternative water supplies.', horizon: '3–12 months', kri: 'Water withdrawn per unit of output and days of backup supply' },
  heat: { action: 'Assess heat-resilient equipment, cooling and a heat response plan for staff and operations.', horizon: '3–9 months', kri: 'Heat-related interruptions per quarter' },
  coastal: { action: 'Commission a coastal inundation survey and assess protection or relocation of vulnerable assets.', horizon: '6–18 months', kri: 'Critical assets exposed to coastal inundation' },
};

type Profile = ReturnType<typeof assessPortfolio>['borrowers'][number];

export function remediationShortlist(profile: Profile) {
  const actions = profile.facilities.flatMap(({ loan, sites, transition }) => {
    const physical = sites.flatMap((site) => site.hazards.filter(({ impact }) => impact >= MATERIAL_HAZARD).map(({ hazard, impact }) => ({
      priority: impact, driver: `${hazard} · ${site.kind.toLowerCase()}`, facility: loan.id,
      owner: site.kind === 'Collateral' ? 'Collateral owner with relationship manager' : 'Borrower operations with relationship manager',
      evidence: `${site.region} hazard proxy × ${site.kind.toLowerCase()} exposure factor ${site.exposure.toFixed(3)} × site vulnerability${site.reference ? ` · ${site.reference}` : ''}`,
      ...physicalActions[hazard],
    })));
    const transitionActions = [];
    if (transition && transition.score >= HIGH_PHYSICAL_RISK) {
      transitionActions.push({
        priority: (transition.score - 1) / 4, facility: loan.id, driver: 'Approved transition exposure',
        action: sectorOf(loan.sector).transition >= 0.6
          ? 'Assess energy efficiency and fuel switching. Compare phased technology investment and renewable-power procurement.'
          : 'Assess energy-saving equipment and renewable-power procurement against the borrower’s operating needs.',
        owner: 'Borrower finance and operations with relationship manager', horizon: '6–18 months',
        evidence: `${transition.runId} · ${transition.evidence}`, kri: 'Energy intensity and milestones completed against the transition plan',
      });
    }
    if (!transition || !loan.transitionPlan || !(loan.emissionsIntensity > 0)) {
      transitionActions.push({
        priority: 0.3, facility: loan.id, driver: 'Transition evidence gap',
        action: [!transition && 'Obtain a verified Engine I transition assessment', !loan.transitionPlan && 'agree dated transition-plan milestones', !(loan.emissionsIntensity > 0) && 'establish a measured emissions baseline'].filter(Boolean).join(' · '),
        owner: 'Relationship manager and borrower sustainability lead', horizon: '0–3 months',
        evidence: 'Engine I assessment and active loan extract', kri: 'Emissions data coverage and milestones with dated evidence',
      });
    }
    if (sites.some((site) => !site.reference)) {
      physical.push({ priority: 0.35, driver: 'Location evidence gap', facility: loan.id, action: 'Confirm operating and collateral locations with the borrower and obtain site-level hazard evidence.', owner: 'Relationship manager and collateral team', horizon: '0–3 months', evidence: 'Legacy location used as a proxy', kri: 'Share of material locations with a verification reference' });
    }
    return [...physical, ...transitionActions];
  });
  return actions.sort((a, b) => b.priority - a.priority).slice(0, 8);
}
