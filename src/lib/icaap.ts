import { GCB_PATHWAYS } from './gcb-scenarios';
import type { ScenarioKey } from './params';

export const ICAAP_VERSION = 'climate-icaap-v1';
export const FINANCE_FIELDS = [
  'income', 'writeoffs', 'recoveries', 'dividends', 'adjustments', 'creditRwa', 'marketRwa', 'operationalRwa', 'otherRwa',
  'stressCreditRwaDelta', 'injection', 'dividendRestraint', 'rwaReduction',
] as const;
type FinanceField = typeof FINANCE_FIELDS[number];
export type FinancePeriod = Record<FinanceField, number> & { scenario: ScenarioKey; year: number };
export interface IcaapSource {
  scenario: ScenarioKey; year: number; runId: string; status: string; version: string; asOf: string; batchId: string;
  outputHash: string; baseline: number; stressed: number; borrowers: number | null; facilities: number;
  sectors: { name: string; baseline: number; stressed: number }[];
}
export interface IcaapOpening {
  entity: string; portfolio: string; asOf: string; source: string; illustrative: boolean;
  cet1: number; at1: number; tier2: number; reportedCapital: number; provisions: number;
  tax: number; cet1Min: number; tier1Min: number; totalMin: number;
}
export const financeHeader = ['scenario', 'year', ...FINANCE_FIELDS].join(',');
export function readFinanceCsv(csv: string, sources: IcaapSource[]): FinancePeriod[] {
  const [header, ...lines] = csv.trim().replace(/^\uFEFF/, '').split(/\r?\n/);
  if (header !== financeHeader || lines.length !== sources.length) {
    throw new Error('Use the finance template columns and one row for each selected scenario and reporting year.');
  }
  const seen = new Set<string>();
  return lines.map((line) => {
    const [key, yearField, ...cells] = line.split(',').map((cell) => cell.trim());
    const year = Number(yearField);
    const source = sources.find((item) => item.scenario === key && item.year === year);
    const id = `${key}:${year}`;
    if (!source || seen.has(id) || cells.length !== FINANCE_FIELDS.length) throw new Error('Each source scenario and year must appear exactly once.');
    seen.add(id);
    const fields = Object.fromEntries(FINANCE_FIELDS.map((field, index) => {
      const number = Number(cells[index]);
      const signed = field === 'income' || field === 'adjustments' || field === 'stressCreditRwaDelta';
      if (!cells[index] || !Number.isFinite(number) || Math.abs(number) > 1e15 || (!signed && number < 0)) {
        throw new Error(`Invalid GHS amount for ${field} in ${key} ${year}.`);
      }
      return [field, number];
    })) as Record<FinanceField, number>;
    return { scenario: source.scenario, year, ...fields };
  });
}

export function projectCapital(opening: IcaapOpening, sources: IcaapSource[], finance: FinancePeriod[]) {
  return GCB_PATHWAYS.flatMap(({ key, label }) => {
    let previousBase = opening.provisions, previousStress = opening.provisions;
    let baseCet1 = opening.cet1, stressCet1 = opening.cet1, unmitigatedCet1 = opening.cet1;
    return sources.filter((source) => source.scenario === key).sort((a, b) => a.year - b.year).map((source) => {
      const F = finance.find((row) => row.scenario === key && row.year === source.year)!;
      const rwa = F.creditRwa + F.marketRwa + F.operationalRwa + F.otherRwa;
      const stressCreditRwa = F.creditRwa + F.stressCreditRwaDelta - F.rwaReduction;
      const stressedRwa = stressCreditRwa + F.marketRwa + F.operationalRwa + F.otherRwa;
      if (rwa <= 0 || stressedRwa <= 0 || stressCreditRwa < 0 || F.dividendRestraint > F.dividends) {
        throw new Error(`Check positive RWA, stressed credit RWA and dividend restraint for ${key} ${source.year}.`);
      }
      const baselineExpense = source.baseline - previousBase + F.writeoffs - F.recoveries;
      const stressedExpense = source.stressed - previousStress + F.writeoffs - F.recoveries;
      const postTax = (profit: number) => profit - Math.max(0, profit) * opening.tax;
      const baseOpeningCet1 = baseCet1, stressOpeningCet1 = stressCet1;
      const baselineProfit = postTax(F.income - baselineExpense);
      const stressedProfit = postTax(F.income - stressedExpense);
      baseCet1 += baselineProfit - F.dividends + F.adjustments;
      stressCet1 += stressedProfit - F.dividends + F.adjustments + F.injection + F.dividendRestraint;
      unmitigatedCet1 += stressedProfit - F.dividends + F.adjustments;
      const path = (cet1: number, rwa: number) => {
        const tier1 = cet1 + opening.at1, total = tier1 + opening.tier2;
        const headroom = {
          cet1: cet1 - opening.cet1Min * rwa,
          tier1: tier1 - opening.tier1Min * rwa,
          total: total - opening.totalMin * rwa,
        };
        const binding = Math.min(headroom.cet1, headroom.tier1, headroom.total);
        return { cet1, tier1, total, rwa, cet1Ratio: cet1 / rwa, tier1Ratio: tier1 / rwa, totalRatio: total / rwa,
          headroom, shortfall: Math.max(0, -binding), reverseStress: Math.max(0, binding) };
      };
      const row = {
        source, pathway: label, finance: F, baseOpeningCet1, stressOpeningCet1,
        previousBase, previousStress, baselineExpense, stressedExpense,
        incrementalExpense: stressedExpense - baselineExpense, baselineProfit, stressedProfit,
        baseline: path(baseCet1, rwa), stressed: path(stressCet1, stressedRwa),
        unmitigated: path(unmitigatedCet1, rwa + F.stressCreditRwaDelta),
      };
      previousBase = source.baseline;
      previousStress = source.stressed;
      return row;
    });
  });
}
export type IcaapProjection = ReturnType<typeof projectCapital>[number];
export interface IcaapAssessment {
  id: string; version: string; createdAt: string; by: string; datasetId: string; datasetHash: string; evidenceHash: string;
  opening: IcaapOpening; rows: IcaapProjection[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected'; reviewer?: string; reviewedAt?: string; note?: string;
}
