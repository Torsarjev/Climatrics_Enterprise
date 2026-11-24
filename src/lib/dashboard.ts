import 'server-only';
import { BANK, SECTORS, sectorOf } from './params';
import { physicalScore, runCredit } from './engine';
import type { Loan } from './portfolio';

export type Level = 'High' | 'Med' | 'Low';
const physLevel = (s: number): Level => (s >= 0.38 ? 'High' : s >= 0.26 ? 'Med' : 'Low');
const transLevel = (s: number): Level => (s >= 0.6 ? 'High' : s >= 0.3 ? 'Med' : 'Low');
const rank = { Low: 0, Med: 1, High: 2 } as const;

export const STRESS_VIEW = [
  { label: 'Orderly', note: 'Net Zero 2050', scenario: 'nz2050' },
  { label: 'Disorderly', note: 'Delayed Transition', scenario: 'delayed' },
  { label: 'Hot house', note: 'Current Policies', scenario: 'current' },
] as const;

const cache = new Map<string, ReturnType<typeof compute>>();

function compute(loans: Loan[]) {
  const ead = loans.reduce((a, l) => a + l.ead, 0);
  const phys = new Map(loans.map((l) => [l.id, physicalScore(l, 1).score]));
  const sectors = SECTORS.map((s) => {
    const xs = loans.filter((l) => l.sector === s.key);
    const e = xs.reduce((a, l) => a + l.ead, 0);
    const p = xs.reduce((a, l) => a + phys.get(l.id)! * l.ead, 0) / e;
    const physical = physLevel(p), transition = transLevel(s.transition);
    return { name: s.name, ead: e, physical, transition, overall: rank[physical] >= rank[transition] ? physical : transition };
  }).sort((a, b) => rank[b.overall] - rank[a.overall] || b.ead - a.ead);
  const highRisk = loans.filter((l) => phys.get(l.id)! >= 0.5 || (sectorOf(l.sector).transition >= 0.6 && !l.transitionPlan)).reduce((a, l) => a + l.ead, 0);
  const runs = STRESS_VIEW.map((v) => ({ ...v, run: runCredit(loans, { scenario: v.scenario, horizon: 2050, approach: 'bottom-up' }) }));
  const base = runs[0].run;
  return {
    ead, highRisk, sectors,
    eclBase: base.summary.ecl,
    eclStressed: runs[2].run.summary.eclStressed,
    car: [{ label: 'Baseline', note: 'before climate stress', value: base.capital.carBefore }, ...runs.map((x) => ({ label: x.label, note: `${x.note} · 2050`, value: x.run.capital.carAfter }))],
    minimum: BANK.carMinimum,
  };
}

export function dashboard(datasetId: string, loans: Loan[]) {
  if (!cache.has(datasetId)) {
    const t = Date.now();
    cache.set(datasetId, compute(loans));
    console.log(`[dashboard] computed ${datasetId} in ${Date.now() - t}ms`);
  }
  return cache.get(datasetId)!;
}
