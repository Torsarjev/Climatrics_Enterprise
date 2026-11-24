import { BANK, COLLATERAL, CREDIT, HAZARDS, Hazard, Horizon, LOSS_DIST, MODEL_VERSION, REGIONS, SECTORS, ScenarioKey, sectorOf, scenarioOf } from './params';
import { Loan } from './portfolio';
import { clamp, logit, normCdf, normInv, normal, rng, sigmoid } from './math';

export type Approach = 'bottom-up' | 'top-down';
export interface RunInput { scenario: ScenarioKey; horizon: Horizon; approach: Approach }

export interface LoanResult {
  id: string; borrower: string; sector: string; region: string; ead: number;
  physical: number; physicalDrivers: Record<Hazard, number>; transition: number;
  pd: number; pdStressed: number; lgd: number; lgdStressed: number; haircut: number;
  stage: number; stageStressed: number; ecl: number; eclStressed: number;
  drivers: { transition: number; physical: number; macro: number };
}

const regionOf = (name: string) => REGIONS.find((r) => r.name === name)!;
export const GRADES = ['A', 'BBB', 'BB', 'B', 'CCC', 'CC', 'D'] as const;
export const gradeOf = (pd: number) => (pd >= 1 ? 6 : pd < 0.005 ? 0 : pd < 0.015 ? 1 : pd < 0.04 ? 2 : pd < 0.09 ? 3 : pd < 0.18 ? 4 : 5);

const lifetimePd = (pd: number, years: number) => 1 - Math.pow(1 - pd, Math.max(1, years));
const ecl = (pd: number, lgd: number, ead: number, stage: number, years: number) =>
  ead * lgd * (stage === 3 ? 1 : stage === 2 ? lifetimePd(pd, years) : pd);

export const intensification = (multiplier: number) => clamp((multiplier - 1) / 0.75, 0, 1.5);

export function physicalScore(loan: Loan, multiplier: number) {
  const reg = regionOf(loan.region), sec = sectorOf(loan.sector);
  const drivers = Object.fromEntries(HAZARDS.map((h) => [h, clamp(reg.hazard[h] * multiplier) * sec.vuln[h]])) as Record<Hazard, number>;
  return { score: clamp(Math.max(...Object.values(drivers)) * 0.7 + (Object.values(drivers).reduce((a, b) => a + b, 0) / 4) * 0.3), drivers };
}

export function collateralHaircut(loan: Loan, multiplier: number) {
  const reg = regionOf(loan.region), v = COLLATERAL[loan.collateralType].vuln;
  return clamp(Math.max(...HAZARDS.map((h) => clamp(reg.hazard[h] * multiplier) * v[h])) * 0.35 * intensification(multiplier), 0, 0.5);
}

export function transitionScore(loan: Loan, shock: number) {
  const sec = sectorOf(loan.sector);
  const intensity = clamp(loan.emissionsIntensity / (sec.carbonIntensity * 1.4));
  const relief = loan.transitionPlan ? CREDIT.transitionReadinessRelief : 0;
  return clamp(sec.transition * shock * (0.6 + 0.4 * intensity) * (1 - relief));
}

export function runStress(loans: Loan[], input: RunInput) {
  const c = runCredit(loans, input);
  return { ...c, lossDist: lossDistribution(loans, c.results) };
}

export function runCredit(loans: Loan[], input: RunInput) {
  const sc = scenarioOf(input.scenario);
  const shock = sc.transitionShock[input.horizon], phys = sc.physical[input.horizon], gdp = sc.gdpShock[input.horizon];

  let perLoan = loans.map((l) => {
    const p = physicalScore(l, phys);
    return { l, p, t: transitionScore(l, shock), h: collateralHaircut(l, phys) };
  });

  if (input.approach === 'top-down') {
    const bySector = new Map<string, { p: number; t: number; w: number }>();
    perLoan.forEach(({ l, p, t }) => {
      const s = bySector.get(l.sector) ?? { p: 0, t: 0, w: 0 };
      bySector.set(l.sector, { p: s.p + p.score * l.ead, t: s.t + t * l.ead, w: s.w + l.ead });
    });
    perLoan = perLoan.map((x) => {
      const s = bySector.get(x.l.sector)!;
      return { ...x, p: { ...x.p, score: s.p / s.w }, t: s.t / s.w };
    });
  }

  const results: LoanResult[] = perLoan.map(({ l, p, t, h }) => {
    const dT = CREDIT.betaTransition * t, dP = CREDIT.betaPhysical * p.score * intensification(phys), dM = CREDIT.betaMacro * -gdp;
    const pdS = l.pd >= 1 ? 1 : clamp(sigmoid(logit(l.pd) + dT + dP + dM), l.pd, 0.999);
    const covered = Math.min(l.collateralValue * CREDIT.collateralRecovery, l.ead);
    const baseRecovery = 1 - l.lgd;
    const lostRecovery = l.ead > 0 ? (covered * h) / l.ead : 0;
    const lgdS = clamp(Math.max(CREDIT.lgdFloor, 1 - baseRecovery + lostRecovery));
    const stageS = l.stage === 3 || pdS >= CREDIT.stage3Pd ? 3 : l.stage === 2 || (pdS >= l.pd * CREDIT.sicrMultiple && pdS - l.pd >= CREDIT.sicrAbsolute) ? 2 : 1;
    return {
      id: l.id, borrower: l.borrower, sector: l.sector, region: l.region, ead: l.ead,
      physical: p.score, physicalDrivers: p.drivers, transition: t,
      pd: l.pd, pdStressed: pdS, lgd: l.lgd, lgdStressed: lgdS, haircut: h,
      stage: l.stage, stageStressed: stageS,
      ecl: ecl(l.pd, l.lgd, l.ead, l.stage, l.maturityYears),
      eclStressed: ecl(pdS, lgdS, l.ead, stageS, l.maturityYears),
      drivers: { transition: dT, physical: dP, macro: dM },
    };
  });

  return { input, modelVersion: MODEL_VERSION, results, summary: summarise(results), capital: capitalImpact(results), liquidity: liquidityImpact(results, phys) };
}

function summarise(rs: LoanResult[]) {
  const sum = (f: (r: LoanResult) => number) => rs.reduce((a, r) => a + f(r), 0);
  const ead = sum((r) => r.ead);
  const migration = GRADES.map(() => GRADES.map(() => 0));
  rs.forEach((r) => { migration[gradeOf(r.pd)][gradeOf(r.pdStressed)] += r.ead; });
  const stages = [1, 2, 3].map((s) => ({ stage: s, before: sum((r) => (r.stage === s ? r.ead : 0)), after: sum((r) => (r.stageStressed === s ? r.ead : 0)) }));
  const perf = (xs: LoanResult[], f: (r: LoanResult) => number) => { const p = xs.filter((r) => r.pd < 1), w = p.reduce((a, r) => a + r.ead, 0); return w ? p.reduce((a, r) => a + f(r) * r.ead, 0) / w : 0; };
  const bySector = SECTORS.map((s) => {
    const xs = rs.filter((r) => r.sector === s.key);
    const e = xs.reduce((a, r) => a + r.ead, 0) || 1;
    return {
      key: s.key, name: s.name, ead: xs.reduce((a, r) => a + r.ead, 0),
      ecl: xs.reduce((a, r) => a + r.ecl, 0), eclStressed: xs.reduce((a, r) => a + r.eclStressed, 0),
      pd: perf(xs, (r) => r.pd), pdStressed: perf(xs, (r) => r.pdStressed),
      physical: xs.reduce((a, r) => a + r.physical * r.ead, 0) / e, transition: xs.reduce((a, r) => a + r.transition * r.ead, 0) / e,
    };
  });
  const byRegion = REGIONS.map((g) => {
    const xs = rs.filter((r) => r.region === g.name);
    const e = xs.reduce((a, r) => a + r.ead, 0) || 1;
    return { name: g.name, ead: xs.reduce((a, r) => a + r.ead, 0), ecl: xs.reduce((a, r) => a + r.ecl, 0), eclStressed: xs.reduce((a, r) => a + r.eclStressed, 0), physical: xs.reduce((a, r) => a + r.physical * r.ead, 0) / e };
  });
  return {
    ead, loans: rs.length,
    ecl: sum((r) => r.ecl), eclStressed: sum((r) => r.eclStressed),
    pd: sum((r) => (r.pd < 1 ? r.pd * r.ead : 0)) / sum((r) => (r.pd < 1 ? r.ead : 0)),
    pdStressed: sum((r) => (r.pd < 1 ? r.pdStressed * r.ead : 0)) / sum((r) => (r.pd < 1 ? r.ead : 0)),
    lgd: sum((r) => r.lgd * r.ead) / ead, lgdStressed: sum((r) => r.lgdStressed * r.ead) / ead,
    migration, stages, bySector, byRegion,
  };
}

// One-factor Vasicek simulation of 1-year portfolio losses, before and after stress
function lossDistribution(loans: Loan[], rs: LoanResult[]) {
  const live = rs.map((r, i) => ({ r, rho: sectorOf(loans[i].sector).rho })).filter((x) => x.r.pd < 1);
  const sim = (pdOf: (r: LoanResult) => number, lgdOf: (r: LoanResult) => number) => {
    const rand = rng(LOSS_DIST.seed);
    const k = live.map(({ r, rho }) => ({ t: normInv(pdOf(r)), a: Math.sqrt(rho), b: Math.sqrt(1 - rho), loss: r.ead * lgdOf(r) }));
    const losses = new Float64Array(LOSS_DIST.simulations);
    for (let s = 0; s < losses.length; s++) {
      const z = normal(rand);
      let L = 0;
      for (const x of k) if (rand() < normCdf((x.t - x.a * z) / x.b)) L += x.loss;
      losses[s] = L;
    }
    losses.sort();
    const el = losses.reduce((a, b) => a + b, 0) / losses.length;
    const q = (c: number) => losses[Math.min(losses.length - 1, Math.floor(c * losses.length))];
    const tail = (c: number) => { const from = Math.floor(c * losses.length); let a = 0; for (let i = from; i < losses.length; i++) a += losses[i]; return a / (losses.length - from); };
    return { el, var99: q(0.99), var999: q(0.999), cvar99: tail(0.99), cvar999: tail(0.999), economicCapital: q(0.999) - el, sample: Array.from({ length: 1000 }, (_, i) => Math.round(losses[i * 10])) };
  };
  return { simulations: LOSS_DIST.simulations, seed: LOSS_DIST.seed, base: sim((r) => r.pd, (r) => r.lgd), stressed: sim((r) => r.pdStressed, (r) => r.lgdStressed) };
}

function capitalImpact(rs: LoanResult[]) {
  const loanRwa = rs.reduce((a, r) => a + (r.stage === 3 ? 0 : r.ead * BANK.riskWeight), 0);
  const loanRwaS = rs.reduce((a, r) => a + (r.stageStressed === 3 ? 0 : r.ead * BANK.riskWeight), 0);
  const eclBase = rs.reduce((a, r) => a + r.ecl, 0), eclS = rs.reduce((a, r) => a + r.eclStressed, 0);
  const extra = (eclS - eclBase) * (1 - BANK.taxRate);
  const capBefore = BANK.cet1 + BANK.tier2, capAfter = capBefore - extra;
  const rwaBefore = loanRwa + BANK.otherRwa, rwaAfter = loanRwaS + BANK.otherRwa;
  return {
    capitalBefore: capBefore, capitalAfter: capAfter, rwaBefore, rwaAfter, additionalProvisions: eclS - eclBase,
    carBefore: capBefore / rwaBefore, carAfter: capAfter / rwaAfter,
    cet1Before: BANK.cet1 / rwaBefore, cet1After: (BANK.cet1 - extra) / rwaAfter,
    minimum: BANK.carMinimum,
  };
}

function liquidityImpact(rs: LoanResult[], physMult: number) {
  const severity = clamp((physMult - 1) / 0.75);
  const segs = (['retail', 'sme', 'corporate'] as const).map((k) => ({
    segment: k, balance: BANK.deposits[k],
    outBase: BANK.deposits[k] * BANK.baseRunOff[k],
    outClimate: BANK.deposits[k] * (BANK.baseRunOff[k] + BANK.climateRunOff[k] * severity),
  }));
  const drawBase = BANK.undrawnLines * BANK.baseDrawdown, drawS = BANK.undrawnLines * (BANK.baseDrawdown + BANK.climateDrawdown * severity);
  const outBase = segs.reduce((a, s) => a + s.outBase, 0) + drawBase, outS = segs.reduce((a, s) => a + s.outClimate, 0) + drawS;
  const inflows = rs.reduce((a, r) => a + (r.stageStressed === 1 ? r.ead * 0.04 : 0), 0);
  const netBase = Math.max(outBase - Math.min(inflows, outBase * 0.75), 1), netS = Math.max(outS - Math.min(inflows, outS * 0.75), 1);
  return { hqla: BANK.hqla, segments: segs, drawBase, drawStressed: drawS, inflows, lcrBefore: BANK.hqla / netBase, lcrAfter: BANK.hqla / netS, minimum: BANK.lcrMinimum, severity };
}

export type StressRun = ReturnType<typeof runStress>;
