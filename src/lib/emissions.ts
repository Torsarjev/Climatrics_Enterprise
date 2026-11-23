import { rng } from './math';
import type { Loan } from './portfolio';

export const DQ_SHORT: Record<number, string> = { 1: 'Verified reported', 2: 'Reported', 3: 'Activity-based', 4: 'Revenue-based', 5: 'Asset-based' };

export const DQ_LABEL: Record<number, string> = {
  1: 'Verified reported emissions',
  2: 'Unverified reported emissions',
  3: 'Physical activity data × emission factor',
  4: 'Revenue × sector emission factor',
  5: 'Asset or exposure × sector emission factor',
};

const seedOf = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function financed(l: Loan) {
  const r = rng(seedOf(l.id));
  const revenueM = (l.ead / 1e6) * (0.9 + r() * 1.8);
  const companyValueM = (l.ead / 1e6) / (0.12 + r() * 0.48);
  const attribution = l.ead / 1e6 / companyValueM;
  const companyEmissions = l.emissionsIntensity * revenueM;
  const u = r();
  const dq = l.transitionPlan ? 2 : u < 0.25 ? 3 : u < 0.75 ? 4 : 5;
  return { attribution, companyEmissions, financed: attribution * companyEmissions, dq };
}

export function financedBook(loans: Loan[]) {
  const rows = loans.map((l) => ({ l, ...financed(l) }));
  const total = rows.reduce((a, x) => a + x.financed, 0);
  const ead = loans.reduce((a, l) => a + l.ead, 0);
  const dqWeighted = rows.reduce((a, x) => a + x.dq * x.l.ead, 0) / ead;
  return { rows, total, ead, intensity: total / (ead / 1e6), dqWeighted };
}
