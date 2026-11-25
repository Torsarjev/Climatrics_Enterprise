import type { ScenarioKey } from './params';

export const ILAAP_MODEL = 'climate-ilaap-v1';
export const ILAAP_BUCKETS = [7, 30, 90, 180, 365] as const;
export interface TreasuryBond {
  id: string; currency: string; marketValue: number; faceValue: number; couponPct: number; maturityDays: number;
  duration: number; convexity: number; eligible: boolean; haircutPct: number; encumberedPct: number;
  yieldMultiplier: number; basisBps: number;
}
export interface TreasuryFlow {
  day: number; contractualIn: number; contractualOut: number; fundingMaturing: number; rolloverPct: number;
}
export interface TreasuryDeposit {
  segment: string; balance: number; day: number; runoffPct: number; gdpSensitivity: number; inflationSensitivity: number;
}
export interface TreasuryInputs {
  entity: string; currency: string; asOf: string; reference: string; mapping: string;
  openingCash: number; reportedMarketValue: number; reportedHqla: number; reportedDeposits: number;
  reportedInflows: number; reportedOutflows: number; reportedMaturingFunding: number;
  minimumLcrPct: number; minimumBuffer: number;
  inflowGdpSensitivity: number; rolloverGdpSensitivity: number; costInflationSensitivity: number;
  fundingSpreadBpsPerPp: number;
  bonds: TreasuryBond[]; flows: TreasuryFlow[]; deposits: TreasuryDeposit[];
}
export interface IlaapActions {
  funding: number; fundingDay: number; repaymentDay: number; fundingFeePct: number;
  salePct: number; saleDay: number; saleDiscountPct: number; additionalOutflow: number;
}
export interface IlaapMacro {
  scenario: ScenarioKey; year: number; horizon: string;
  gdp: number; inflation: number; rate: number;
  sources: { variable: string; source: string; regional: number; coefficient: number; method: string }[];
}

const sum = <T>(items: T[], amount: (item: T) => number) => items.reduce((total, item) => total + amount(item), 0);
const fraction = (pct: number) => pct / 100;
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const eligible = (bond: TreasuryBond) => bond.eligible ? 1 - fraction(bond.encumberedPct) : 0;
const close = (a: number, b: number) => Math.abs(a - b) <= 0.01;
const bucket = (day: number) => ILAAP_BUCKETS.find((end) => day <= end);

export function readTreasuryInputs(raw: unknown): TreasuryInputs {
  const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Use the Treasury JSON template structure.');
    return value as Record<string, unknown>;
  };
  const root = object(raw);
  const text = (row: Record<string, unknown>, key: string) => {
    const value = row[key];
    if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new Error(`Enter ${key} (up to 200 characters).`);
    return value.trim();
  };
  const number = (row: Record<string, unknown>, key: string, max = 1e15, min = 0) => {
    const value = row[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid Treasury field ${key}.`);
    return value;
  };
  const rows = (key: string) => {
    const value = root[key];
    if (!Array.isArray(value) || !value.length || value.length > 500) throw new Error(`Supply 1–500 Treasury ${key} rows.`);
    return value.map(object);
  };
  const currency = text(root, 'currency');
  const asOf = text(root, 'asOf');
  if (currency !== 'GHS') throw new Error('This assessment uses a GHS-only perimeter. Separate other currencies upstream.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf)) || new Date(asOf).toISOString().slice(0, 10) !== asOf) throw new Error('Enter an ISO Treasury reporting date.');
  const bonds = rows('bonds').map((row) => {
    const bond = {
      id: text(row, 'id'), currency: text(row, 'currency'), marketValue: number(row, 'marketValue'),
      faceValue: number(row, 'faceValue'), couponPct: number(row, 'couponPct', 100),
      maturityDays: number(row, 'maturityDays', 36500, 1), duration: number(row, 'duration', 100),
      convexity: number(row, 'convexity', 10000), eligible: row.eligible === true,
      haircutPct: number(row, 'haircutPct', 100), encumberedPct: number(row, 'encumberedPct', 100),
      yieldMultiplier: number(row, 'yieldMultiplier', 10), basisBps: number(row, 'basisBps', 2000, -2000),
    };
    if (bond.currency !== currency || typeof row.eligible !== 'boolean' || !Number.isInteger(bond.maturityDays) || !bond.faceValue || !bond.marketValue) {
      throw new Error(`Check currency, eligibility, maturity, face value and market value for ${bond.id}.`);
    }
    return bond;
  });
  const flows = rows('flows').map((row) => ({
    day: number(row, 'day', 365), contractualIn: number(row, 'contractualIn'), contractualOut: number(row, 'contractualOut'),
    fundingMaturing: number(row, 'fundingMaturing'), rolloverPct: number(row, 'rolloverPct', 100),
  }));
  const deposits = rows('deposits').map((row) => ({
    segment: text(row, 'segment'), balance: number(row, 'balance'), day: number(row, 'day', 365),
    runoffPct: number(row, 'runoffPct', 100), gdpSensitivity: number(row, 'gdpSensitivity', 100),
    inflationSensitivity: number(row, 'inflationSensitivity', 100),
  }));
  if (new Set(bonds.map(({ id }) => id)).size !== bonds.length || new Set(deposits.map(({ segment }) => segment)).size !== deposits.length ||
    flows.length !== ILAAP_BUCKETS.length || !ILAAP_BUCKETS.every((day) => flows.some((row) => row.day === day)) ||
    deposits.some(({ day }) => !ILAAP_BUCKETS.some((end) => end === day))) throw new Error('Use unique securities and deposit segments and one contractual flow row at each template bucket.');
  const inputs = {
    currency, asOf, entity: text(root, 'entity'), reference: text(root, 'reference'), mapping: text(root, 'mapping'), bonds, flows, deposits,
    openingCash: number(root, 'openingCash'), reportedMarketValue: number(root, 'reportedMarketValue'),
    reportedHqla: number(root, 'reportedHqla'), reportedDeposits: number(root, 'reportedDeposits'),
    reportedInflows: number(root, 'reportedInflows'), reportedOutflows: number(root, 'reportedOutflows'),
    reportedMaturingFunding: number(root, 'reportedMaturingFunding'), minimumLcrPct: number(root, 'minimumLcrPct', 1000, 1),
    minimumBuffer: number(root, 'minimumBuffer'), inflowGdpSensitivity: number(root, 'inflowGdpSensitivity', 100),
    rolloverGdpSensitivity: number(root, 'rolloverGdpSensitivity', 100), costInflationSensitivity: number(root, 'costInflationSensitivity', 100),
    fundingSpreadBpsPerPp: number(root, 'fundingSpreadBpsPerPp', 1000),
  };
  const controls = [
    ['bond market value', sum(bonds, (b) => b.marketValue), inputs.reportedMarketValue],
    ['eligible HQLA including cash', inputs.openingCash + sum(bonds, (b) => b.marketValue * eligible(b) * (1 - fraction(b.haircutPct))), inputs.reportedHqla],
    ['deposits', sum(deposits, (d) => d.balance), inputs.reportedDeposits],
    ['contractual inflows', sum(flows, (f) => f.contractualIn), inputs.reportedInflows],
    ['contractual outflows', sum(flows, (f) => f.contractualOut), inputs.reportedOutflows],
    ['maturing funding', sum(flows, (f) => f.fundingMaturing), inputs.reportedMaturingFunding],
  ] as const;
  const check = controls.find(([, actual, reported]) => !close(actual, reported));
  if (check) throw new Error(`Treasury reconciliation failed for ${check[0]}. Calculated ${check[1].toFixed(2)}, reported ${check[2].toFixed(2)}.`);
  return inputs;
}

export const DEMO_TREASURY: TreasuryInputs = {
  entity: 'Demo Bank Ghana', currency: 'GHS', asOf: '2026-09-30', reference: 'Illustrative Treasury data',
  mapping: 'Illustrative GHS tenor mapping v1', openingCash: 300e6, reportedMarketValue: 2600e6, reportedHqla: 2550e6,
  reportedDeposits: 8000e6, reportedInflows: 1800e6, reportedOutflows: 2850e6, reportedMaturingFunding: 3500e6,
  minimumLcrPct: 100, minimumBuffer: 400e6, inflowGdpSensitivity: 2, rolloverGdpSensitivity: 4,
  costInflationSensitivity: 3, fundingSpreadBpsPerPp: 30,
  bonds: [
    { id: 'DEMO-GHS-2Y', currency: 'GHS', marketValue: 1200e6, faceValue: 1250e6, couponPct: 14, maturityDays: 730, duration: 1.6, convexity: 4.1, eligible: true, haircutPct: 5, encumberedPct: 0, yieldMultiplier: 0.8, basisBps: 20 },
    { id: 'DEMO-GHS-5Y', currency: 'GHS', marketValue: 1000e6, faceValue: 1050e6, couponPct: 17, maturityDays: 1825, duration: 3.6, convexity: 17, eligible: true, haircutPct: 10, encumberedPct: 0, yieldMultiplier: 1, basisBps: 30 },
    { id: 'DEMO-GHS-9M', currency: 'GHS', marketValue: 400e6, faceValue: 415e6, couponPct: 12, maturityDays: 270, duration: 0.65, convexity: 1, eligible: true, haircutPct: 30, encumberedPct: 25, yieldMultiplier: 0.65, basisBps: 15 },
  ],
  deposits: [
    { segment: 'Retail', balance: 4500e6, day: 30, runoffPct: 5, gdpSensitivity: 0.4, inflationSensitivity: 0.2 },
    { segment: 'Corporate', balance: 3500e6, day: 7, runoffPct: 10, gdpSensitivity: 0.8, inflationSensitivity: 0.35 },
  ],
  flows: ILAAP_BUCKETS.map((day, index) => ({ day, contractualIn: [250, 350, 350, 400, 450][index] * 1e6,
    contractualOut: [300, 500, 550, 700, 800][index] * 1e6, fundingMaturing: [300, 500, 700, 900, 1100][index] * 1e6, rolloverPct: 75 })),
};

export function projectLiquidity(input: TreasuryInputs, macro: IlaapMacro, actions: IlaapActions) {
  const downside = Math.max(0, -macro.gdp), inflation = Math.max(0, macro.inflation);
  const bonds = input.bonds.map((bond) => {
    const yieldBps = macro.rate * 100 * bond.yieldMultiplier + bond.basisBps;
    const dy = yieldBps / 10000;
    const priceChange = -bond.duration * dy + 0.5 * bond.convexity * dy ** 2;
    if (Math.abs(dy) > 0.05 || priceChange <= -1 || Math.abs(priceChange) > 0.5) {
      throw new Error(`${bond.id} in ${macro.scenario} ${macro.year} exceeds the duration/convexity range. Review the yield mapping before running.`);
    }
    const available = eligible(bond);
    const stressedValue = bond.marketValue * (1 + priceChange);
    return { ...bond, yieldBps, priceChange, stressedValue, baseEligible: bond.marketValue * available * (1 - fraction(bond.haircutPct)),
      stressEligible: stressedValue * available * (1 - fraction(bond.haircutPct)) };
  });
  const deposits = input.deposits.map((row) => ({
    ...row, baseline: row.balance * fraction(row.runoffPct),
    stressed: row.balance * clamp(fraction(row.runoffPct + downside * row.gdpSensitivity + inflation * row.inflationSensitivity)),
  }));
  const ladder = (stress: boolean, act: boolean) => {
    const opening = input.openingCash + sum(bonds, (b) => stress ? b.stressEligible : b.baseEligible);
    let buffer = opening;
    let remainingHqla = opening;
    let firstDeficit: number | null = null;
    const rows = ILAAP_BUCKETS.map((day) => {
      const flow = input.flows.find((item) => item.day === day)!;
      const runoff = sum(deposits.filter((d) => d.day === day), (d) => stress ? d.stressed : d.baseline);
      const rollover = clamp(fraction(flow.rolloverPct - (stress ? downside * input.rolloverGdpSensitivity : 0)));
      const rolloverSpreadCost = stress ? flow.fundingMaturing * rollover * downside * input.fundingSpreadBpsPerPp / 10000 : 0;
      const fractionSold = (bond: TreasuryBond) => act && bond.maturityDays > actions.saleDay ? fraction(actions.salePct) : 0;
      const maturing = bonds.filter((b) => bucket(b.maturityDays) === day);
      const maturedHqla = sum(maturing, (bond) => (stress ? bond.stressEligible : bond.baseEligible) * (1 - fractionSold(bond)));
      const redemption = sum(maturing, (bond) => bond.faceValue * eligible(bond) * (1 - fractionSold(bond)));
      const sale = act && day === actions.saleDay ? bonds.filter((bond) => bond.maturityDays > actions.saleDay) : [];
      const soldHqla = sum(sale, (bond) => bond.stressEligible * fractionSold(bond));
      const saleProceeds = sum(sale, (bond) => bond.stressedValue * eligible(bond) * fractionSold(bond) * (1 - fraction(actions.saleDiscountPct)));
      const raised = act && day === actions.fundingDay ? actions.funding : 0;
      const repaid = act && day === actions.repaymentDay ? actions.funding : 0;
      const actionCosts = raised * fraction(actions.fundingFeePct) + (act && day === actions.saleDay ? actions.additionalOutflow : 0);
      const contractualIn = flow.contractualIn * (stress ? 1 - clamp(fraction(downside * input.inflowGdpSensitivity)) : 1);
      const contractualOut = flow.contractualOut * (1 + (stress ? fraction(inflation * input.costInflationSensitivity) : 0));
      const fundingOut = flow.fundingMaturing * (1 - rollover);
      const inflow = contractualIn + redemption + saleProceeds + raised;
      const outflow = contractualOut + runoff + fundingOut + rolloverSpreadCost + repaid + actionCosts;
      const gap = inflow - outflow;
      remainingHqla -= maturedHqla + soldHqla;
      buffer += gap - maturedHqla - soldHqla;
      if (buffer < 0 && firstDeficit === null) firstDeficit = day;
      return { day, contractualIn, contractualOut, runoff, rollover, fundingOut, rolloverSpreadCost, redemption, maturedHqla,
        raised, repaid, saleProceeds, soldHqla, actionCosts, inflow, outflow, gap, remainingHqla, buffer, headroom: buffer - input.minimumBuffer };
    });
    const regulatoryWindow = rows.filter(({ day }) => day <= 30);
    // The opening numerator already includes these assets. Redemption does not count again in the proxy inflow.
    const out30 = sum(regulatoryWindow, (r) => r.outflow);
    const in30 = sum(regulatoryWindow, (r) => r.contractualIn);
    const net30 = out30 - Math.min(in30, out30 * .75);
    return { opening, rows, firstDeficit, worstHeadroom: Math.min(opening - input.minimumBuffer, ...rows.map((r) => r.headroom)),
      in30, out30, net30, lcr: net30 > 0 ? opening / net30 : null };
  };
  return { macro, bonds, deposits, baseline: ladder(false, false), stressed: ladder(true, false), mitigated: ladder(true, true) };
}

export interface IlaapAssessment {
  id: string; version: string; by: string; at: string; status: 'draft' | 'submitted' | 'approved' | 'rejected';
  reviewer?: string; reviewedAt?: string; note?: string; approvalReference?: string;
  illustrative: boolean; weights: Record<string, number>; calibration: string; release: string; region: string; inputs: TreasuryInputs;
  actions: IlaapActions; hash: string; rows: ReturnType<typeof projectLiquidity>[];
}
