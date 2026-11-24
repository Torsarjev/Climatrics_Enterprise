import { REGIONS, SectorKey, scenarioOf, sectorOf } from './params';
import { physicalScore, transitionScore } from './engine';
import type { Loan } from './portfolio';
import { ghanaShocks } from './calibration';

export const EXCLUSIONS = [
  ['forced', 'Forced or harmful child labour'],
  ['banned', 'Production or trade in banned products (e.g. banned pesticides, ozone-depleting substances)'],
  ['logging', 'Illegal logging or unsustainable harvesting of forest reserves'],
  ['wildlife', 'Trade in wildlife regulated under CITES'],
] as const;

export const ES_FLAGS = [
  ['land', 'Land acquisition or involuntary resettlement'],
  ['protected', 'In or near a protected area, forest reserve or wetland'],
  ['hazardous', 'Uses or discharges hazardous materials (e.g. mercury, cyanide)'],
  ['labour', 'Large workforce, labour camps or significant contractor use'],
  ['community', 'Material impact on local communities or cultural heritage'],
] as const;

const HIGH_ES: SectorKey[] = ['mining', 'oilgas', 'power', 'constr', 'agri'];

export interface Application {
  borrower: string; sector: SectorKey; region: string; amountM: number; purpose: string;
  transitionPlan: boolean; exclusions: string[]; flags: string[];
}

export type Decision = 'Proceed' | 'Proceed with conditions' | 'Refer to E&S committee' | 'Decline';

export function screen(a: Application) {
  const sec = sectorOf(a.sector), reg = REGIONS.find((r) => r.name === a.region)!;
  const loan: Loan = {
    id: 'APP', borrower: a.borrower, sector: a.sector, region: a.region, lat: reg.lat, lon: reg.lon, geoConfidence: 'region',
    ead: a.amountM * 1e6, collateralType: 'none', collateralValue: 0, maturityYears: 5, pd: 0.03, lgd: 0.45, stage: 1,
    transitionPlan: a.transitionPlan, emissionsIntensity: sec.carbonIntensity, purpose: a.purpose,
  };
  const physicalToday = physicalScore(loan, 1);
  const physical2050 = physicalScore(loan, ghanaShocks('current', 2050).physical);
  const transition = transitionScore(loan, scenarioOf('delayed').transitionShock[2040]);
  const topHazard = Object.entries(physical2050.drivers).sort((x, y) => y[1] - x[1])[0][0];

  const highSector = HIGH_ES.includes(a.sector);
  const severe = a.flags.includes('land') || a.flags.includes('protected');
  const category: 'A' | 'B' | 'C' = (severe && highSector) || (highSector && a.amountM >= 50 && a.flags.length > 0) ? 'A' : highSector || a.flags.length > 0 ? 'B' : 'C';

  const conditions: string[] = [];
  if (category !== 'C') conditions.push('Environmental and Social Action Plan (ESAP) agreed before first drawdown');
  if (a.flags.includes('land')) conditions.push('Resettlement action plan aligned with IFC Performance Standard 5');
  if (a.flags.includes('hazardous')) conditions.push('Hazardous materials management plan and annual monitoring report');
  if (physical2050.score >= 0.5) conditions.push(`Climate adaptation measures and insurance for ${topHazard} risk at the site`);
  if (transition >= 0.4 && !a.transitionPlan) conditions.push('Credible transition plan within 12 months (covenant)');

  const excluded = a.exclusions.length > 0;
  const decision: Decision = excluded ? 'Decline' : category === 'A' ? 'Refer to E&S committee' : conditions.length ? 'Proceed with conditions' : 'Proceed';
  const reasons = excluded
    ? [`On the exclusion list: ${a.exclusions.map((x) => EXCLUSIONS.find(([k]) => k === x)?.[1]).join('; ')}`]
    : [`E&S category ${category}${category === 'A' ? ': potentially significant, irreversible impacts' : category === 'B' ? ': limited, site-specific impacts' : ': minimal impacts'}`];

  return {
    category, decision, reasons, conditions, topHazard,
    physicalToday: physicalToday.score, physical2050: physical2050.score, transition,
    sdg: sec.sdg, ndc: sec.ndc,
    taxonomy: sec.taxonomy === 'green' ? 'Green / aligned' : sec.taxonomy === 'transition' ? (a.transitionPlan ? 'Transition (eligible)' : 'Transition (not eligible without a plan)') : 'Not eligible',
  };
}

export type ScreeningResult = ReturnType<typeof screen>;

export function bookCategory(l: Loan): 'A' | 'B' | 'C' {
  const high = HIGH_ES.includes(l.sector);
  return high && l.ead >= 50e6 ? 'A' : high ? 'B' : 'C';
}
