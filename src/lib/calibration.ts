import { WORLD_BANK } from '@/data/worldbank';
import { HORIZONS, Horizon, SCENARIOS, ScenarioKey, scenarioOf } from './params';

export const CALIBRATION_VERSION = 'v1.0';
export const NGFS_RELEASE = 'NGFS Phase V (placeholder paths, official IIASA values pending)';
export const NGFS_REGION = 'Sub-Saharan Africa model region (proxy for Ghana)';

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: readonly number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)); };
const diffs = (xs: readonly number[]) => xs.slice(1).map((v, i) => v - xs[i]);

export function evidence(key: 'gdp' | 'inflation') {
  const s = WORLD_BANK.series[key];
  const x = s.ssa, y = s.ghana, n = x.length;
  const mx = mean(x), my = mean(y);
  const sxx = x.reduce((a, v) => a + (v - mx) ** 2, 0);
  const sxy = x.reduce((a, v, i) => a + (v - mx) * (y[i] - my), 0);
  const syy = y.reduce((a, v) => a + (v - my) ** 2, 0);
  const beta = sxy / sxx;
  return {
    key, indicator: s.indicator, label: s.label, url: s.url, lastUpdated: s.lastUpdated,
    from: s.years[0], to: s.years[n - 1], n,
    coefficient: sd(diffs(y)) / sd(diffs(x)),
    sdGhana: sd(diffs(y)), sdRegion: sd(diffs(x)),
    regression: { beta, alpha: my - beta * mx, r2: (sxy * sxy) / (sxx * syy) },
  };
}

export type Variable = 'gdp' | 'inflation' | 'rate' | 'carbon' | 'physical';

export const VARIABLES: Record<Variable, { label: string; unit: string; method: string; status: string; coefficient: () => number }> = {
  gdp: { label: 'GDP', unit: '% vs baseline', method: 'Sensitivity-based: σ(Δ Ghana growth) ÷ σ(Δ SSA growth), World Bank 2000–2024', status: 'Illustrative, pending validation', coefficient: () => evidence('gdp').coefficient },
  inflation: { label: 'Inflation', unit: 'pp vs baseline', method: 'Sensitivity-based: σ(Δ Ghana CPI inflation) ÷ σ(Δ SSA CPI inflation), World Bank 2000–2024', status: 'Illustrative, pending validation', coefficient: () => evidence('inflation').coefficient },
  rate: { label: 'Long-term interest rate', unit: 'pp vs baseline', method: 'Expert judgement: 1.5× regional move for Ghana’s sovereign risk premium', status: 'Expert judgement, pending validation', coefficient: () => 1.5 },
  carbon: { label: 'Carbon price', unit: 'USD/tCO₂e', method: 'Global price passed through 1:1; coverage and pass-through applied per borrower', status: 'Illustrative, pending validation', coefficient: () => 1 },
  physical: { label: 'Physical hazard intensity', unit: '× today', method: 'Regional multiplier applied 1:1; Ghana location detail comes from the hazard grid at each site', status: 'Illustrative, pending validation', coefficient: () => 1 },
};

function regional(key: ScenarioKey, year: Horizon, v: Variable) {
  const s = scenarioOf(key);
  return { gdp: s.gdpShock, inflation: s.inflationShock, rate: s.rateShock, carbon: s.carbonPrice, physical: s.physical }[v][year];
}

export function calibrate(key: ScenarioKey, year: Horizon, v: Variable) {
  const r = regional(key, year, v), c = VARIABLES[v].coefficient();
  const ghana = v === 'physical' ? 1 + (r - 1) * c : r * c;
  return { regional: r, coefficient: c, ghana };
}

export interface GhanaShocks { gdp: number; inflation: number; rate: number; carbon: number; physical: number; transition: number }

export function ghanaShocks(key: ScenarioKey, year: Horizon): GhanaShocks {
  const g = (v: Variable) => calibrate(key, year, v).ghana;
  return { gdp: g('gdp'), inflation: g('inflation'), rate: g('rate'), carbon: g('carbon'), physical: g('physical'), transition: scenarioOf(key).transitionShock[year] };
}

export function calibrationRows(key?: ScenarioKey) {
  return SCENARIOS.filter((s) => !key || s.key === key).flatMap((s) => HORIZONS.flatMap((year) => (Object.keys(VARIABLES) as Variable[]).map((v) => {
    const c = calibrate(s.key, year, v);
    return {
      scenario: s.name, scenarioKey: s.key, release: NGFS_RELEASE, region: NGFS_REGION, year, variable: VARIABLES[v].label, unit: VARIABLES[v].unit,
      regional: c.regional, coefficient: c.coefficient, ghana: c.ghana, method: VARIABLES[v].method, status: VARIABLES[v].status, version: CALIBRATION_VERSION,
    };
  })));
}
