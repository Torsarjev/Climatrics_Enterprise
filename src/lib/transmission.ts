import { CollateralType, CREDIT, DEPTH_DAMAGE, REGIONS, SECTORS, TRANSMISSION as T, sectorOf } from './params';
import type { GhanaShocks } from './calibration';
import type { Loan } from './portfolio';
import { clamp, logit, sigmoid } from './math';

const regionOf = (name: string) => REGIONS.find((r) => r.name === name)!;
const interp = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

const logPd = T.dscrPd.map(([d, p]) => [d, Math.log(p)] as [number, number]);
export const pdFromDscr = (dscr: number) => Math.exp(interp(logPd, dscr));
export function dscrFromPd(pd: number) {
  const inv = [...logPd].map(([d, lp]) => [lp, d] as [number, number]).sort((a, b) => a[0] - b[0]);
  return interp(inv, Math.log(clamp(pd, T.dscrPd[T.dscrPd.length - 1][1], T.dscrPd[0][1])));
}

const curveFor = (c: CollateralType): keyof typeof DEPTH_DAMAGE | null =>
  c === 'property' ? 'commercial' : c === 'plant' || c === 'inventory' ? 'industrial' : c === 'land' ? 'agriculture' : null;

export function floodAtSite(loan: Loan, physical: number) {
  const hazard = clamp(regionOf(loan.region).hazard.flood * physical);
  const event = hazard >= T.floodEventThreshold;
  const depth = event ? hazard * T.floodDepthScale : 0;
  const curve = curveFor(loan.collateralType);
  const damage = curve && event ? interp(DEPTH_DAMAGE[curve], depth) : 0;
  return { hazard, event, depth, curve, damage, returnPeriod: 100 };
}

export function baseFinancials(loan: Loan) {
  const s = T.sector[loan.sector];
  const debtService = loan.ead / Math.max(1, loan.maturityYears) + loan.ead * T.lendingRate;
  const dscr = dscrFromPd(loan.pd);
  const cfads = dscr * debtService;
  const revenue = cfads / s.cfadsMargin;
  return { revenue, opex: revenue - cfads, cfads, debtService, dscr };
}

export interface BottomUpTrace {
  revenue: number; revenueS: number; opex: number; opexS: number; macroLoss: number; physicalLoss: number; carbonCost: number;
  cfads: number; cfadsS: number; debtService: number; debtServiceS: number; dscr: number; dscrS: number;
  floodDepth: number; floodDamage: number; floodCurve: string | null; lostRecovery: number;
}

export function bottomUp(loan: Loan, G: GhanaShocks) {
  const sec = sectorOf(loan.sector);
  const b = baseFinancials(loan);
  const macroLoss = b.revenue * -(T.sector[loan.sector].gdpElasticity * G.gdp) / 100;
  const revenueMacro = b.revenue - macroLoss;
  // chronic heat and rainfall damage is already in the NGFS GDP path; only the acute flood event is added here
  const flood = floodAtSite(loan, G.flood);
  const physicalLoss = revenueMacro * clamp(flood.damage * T.businessInterruption, 0, 0.9);
  const intensityRel = clamp(loan.emissionsIntensity / sec.carbonIntensity, 0.3, 2);
  const carbonCost = (revenueMacro - physicalLoss) * sec.transition * T.carbonCostPer100 * (G.carbon / 100) * intensityRel * (loan.transitionPlan ? 1 - T.planRelief : 1);
  const revenueS = revenueMacro - physicalLoss;
  const opexS = b.opex * (1 - T.variableCostShare + T.variableCostShare * (revenueS / b.revenue)) * (1 + (Math.max(0, G.inflation) / 100) * (1 - T.pricingPower));
  const debtServiceS = b.debtService + loan.ead * T.floatingShare * (Math.max(0, G.rate) / 100);
  const cfadsS = revenueS - opexS - carbonCost;
  const dscrS = cfadsS / debtServiceS;
  const pdS = loan.pd >= 1 ? 1 : clamp(Math.max(loan.pd, pdFromDscr(dscrS)), 0, 0.999);
  const covered = Math.min(loan.collateralValue, loan.ead);
  const lostRecovery = loan.ead > 0 ? (covered * flood.damage * T.recoveryShare) / loan.ead : 0;
  const lgdS = clamp(Math.max(CREDIT.lgdFloor, loan.lgd + lostRecovery));
  const trace: BottomUpTrace = {
    revenue: b.revenue, revenueS, opex: b.opex, opexS, macroLoss, physicalLoss, carbonCost,
    cfads: b.cfads, cfadsS, debtService: b.debtService, debtServiceS, dscr: b.dscr, dscrS,
    floodDepth: flood.depth, floodDamage: flood.damage, floodCurve: flood.curve, lostRecovery,
  };
  return { pdS, lgdS, trace };
}

export interface SectorStress { key: string; name: string; ead: number; pd: number; pdS: number; uplift: number; lgdUplift: number; physical: number; parts: { gdp: number; inflation: number; rate: number; carbon: number; physical: number } }

export function topDownSectors(loans: Loan[], G: GhanaShocks, physicalScoreOf: (l: Loan) => number): SectorStress[] {
  const c = T.topDown, added = Math.max(0, G.physical - 1) / 0.75;
  return SECTORS.map((s) => {
    const xs = loans.filter((l) => l.sector === s.key && l.pd < 1);
    const ead = xs.reduce((a, l) => a + l.ead, 0) || 1;
    const pd = xs.reduce((a, l) => a + l.pd * l.ead, 0) / ead;
    const physical = xs.reduce((a, l) => a + physicalScoreOf(l) * l.ead, 0) / ead;
    const parts = {
      gdp: c.bGdp * T.sector[s.key].gdpElasticity * Math.max(0, -G.gdp),
      inflation: c.bInflation * Math.max(0, G.inflation),
      rate: c.bRate * Math.max(0, G.rate),
      carbon: c.bCarbon * s.transition * (G.carbon / 100),
      physical: c.bPhysical * physical * added,
    };
    const uplift = parts.gdp + parts.inflation + parts.rate + parts.carbon + parts.physical;
    return { key: s.key, name: s.name, ead, pd, pdS: sigmoid(logit(pd) + uplift), uplift, lgdUplift: c.lgdPhysical * physical * added, physical, parts };
  });
}

