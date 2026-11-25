import { WORLD_BANK } from '@/data/worldbank';
import { NGFS } from '@/data/ngfs';
import { CCKP } from '@/data/cckp';
import { GCB_PATHWAYS } from './gcb-scenarios';
import { HORIZONS, ScenarioKey, scenarioOf } from './params';

export const CALIBRATION_VERSION = 'v2.1';
export const NGFS_RELEASE = `${NGFS.release} · ${NGFS.macroModel} · carbon price ${NGFS.carbonModel}`;
export const NGFS_REGION = `${NGFS.macroRegion.split('|')[1]} (macro) · ${NGFS.carbonRegion.split('|')[1]} (carbon price)`;
export const STRESS_WINDOW = 5;

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

// CMIP6 pathway used for the physical signal of each NGFS scenario (only SSP2-4.5 and SSP5-8.5 were supplied)
export const SSP_FOR: Record<ScenarioKey, 'ssp245' | 'ssp585'> = { nz2050: 'ssp245', b2c: 'ssp245', delayed: 'ssp245', ndc: 'ssp245', current: 'ssp585', fragmented: 'ssp585' };

const SSP_LABEL = { ssp245: 'SSP2-4.5', ssp585: 'SSP5-8.5' } as const;

export function hazardChange(series: keyof typeof CCKP.series, ssp: 'ssp245' | 'ssp585', year: number) {
  const s = CCKP.series[series];
  const avg = (y0: number, y1: number) => mean(s.years.map((y, i) => [y, s[ssp][i]] as const).filter(([y]) => y >= y0 && y <= y1).map(([, v]) => v));
  const base = avg(2015, 2024), future = avg(year - 5, year + 4);
  return { base, future, change: future / base - 1 };
}

function at(xs: readonly number[], year: number) {
  const end = NGFS.years.findIndex((point) => point >= year);
  if (end === -1) return xs[xs.length - 1];
  if (end === 0 || NGFS.years[end] === year) return xs[end];
  const start = end - 1;
  const fraction = (year - NGFS.years[start]) / (NGFS.years[end] - NGFS.years[start]);
  return xs[start] + fraction * (xs[end] - xs[start]);
}

function transitionAt(key: ScenarioKey, year: number) {
  const path = scenarioOf(key).transitionShock;
  const high = HORIZONS.findIndex((point) => point >= year);
  if (high === -1) return path[2050];
  if (high === 0) return path[2030];
  if (HORIZONS[high] === year) return path[HORIZONS[high]];
  const low = HORIZONS[high - 1], end = HORIZONS[high];
  return path[low] + (year - low) / (end - low) * (path[end] - path[low]);
}
const macroOf = (key: ScenarioKey, v: 'gdp' | 'inflation' | 'rate') => {
  const m = NGFS.macro[key][v] as Record<string, readonly number[]>;
  return { series: m.combined ?? m.physical, component: m.combined ? 'combined' : 'physical' };
};

export type Variable = 'gdp' | 'inflation' | 'rate' | 'carbon' | 'flood' | 'physical';

export const VARIABLES: Record<Variable, { label: string; unit: string; method: string; status: string; coefficient: () => number }> = {
  gdp: { label: 'GDP', unit: '% vs baseline', method: `NiGEM Africa GDP deviation, change over up to ${STRESS_WINDOW} years to the horizon, starting no earlier than 2025 × σ(Δ Ghana growth) ÷ σ(Δ SSA growth), World Bank 2000–2024`, status: 'NGFS data · coefficient pending validation', coefficient: () => evidence('gdp').coefficient },
  inflation: { label: 'Inflation', unit: 'pp vs baseline', method: 'NiGEM Africa inflation deviation at the horizon × σ(Δ Ghana CPI) ÷ σ(Δ SSA CPI), World Bank 2000–2024', status: 'NGFS data · coefficient pending validation', coefficient: () => evidence('inflation').coefficient },
  rate: { label: 'Long-term interest rate', unit: 'pp vs baseline', method: 'NiGEM Africa long-term rate deviation at the horizon × 1.5 for Ghana’s sovereign risk premium (expert judgement)', status: 'NGFS data · coefficient expert judgement', coefficient: () => 1.5 },
  carbon: { label: 'Carbon price', unit: 'US$2010/t', method: 'GCAM Western Africa carbon price at the horizon, passed through 1:1; coverage and pass-through applied per borrower', status: 'NGFS data', coefficient: () => 1 },
  flood: { label: 'Extreme rainfall (flood intensity)', unit: '× today', method: 'World Bank CCKP Ghana maximum 5-day rainfall, 10-year mean around the horizon ÷ 2015–2024 mean (SSP mapped to the NGFS scenario)', status: 'CCKP data', coefficient: () => 1 },
  physical: { label: 'Composite hazard intensity', unit: '× today', method: 'Mean change in CCKP Ghana maximum 5-day rainfall, days above 30°C and consecutive dry days', status: 'CCKP data', coefficient: () => 1 },
};

function regional(key: ScenarioKey, year: number, v: Variable): { value: number; source: string } {
  const ssp = SSP_FOR[key];
  if (v === 'gdp') {
    const { series, component } = macroOf(key, 'gdp');
    const referenceYear = Math.max(NGFS.years[0], year - STRESS_WINDOW);
    const a = at(series, referenceYear), b = at(series, year);
    return { value: b - a, source: `NiGEM Africa GDP (${component}) ${a.toFixed(2)}% (${referenceYear}) → ${b.toFixed(2)}% (${year})` };
  }
  if (v === 'inflation' || v === 'rate') {
    const { series, component } = macroOf(key, v);
    const x = at(series, year);
    return { value: x, source: `NiGEM Africa ${v === 'rate' ? 'long-term rate' : 'inflation'} (${component}) ${x >= 0 ? '+' : ''}${x.toFixed(2)} pp in ${year}` };
  }
  if (v === 'carbon') {
    const x = at(NGFS.carbon[key], year);
    return { value: x, source: `GCAM Western Africa ${x.toFixed(0)} US$2010/t in ${year}` };
  }
  if (v === 'flood') {
    const c = hazardChange('rx5day', ssp, year);
    return { value: 1 + c.change, source: `CCKP ${SSP_LABEL[ssp]} Rx5day ${c.base.toFixed(1)} → ${c.future.toFixed(1)} mm` };
  }
  const parts = (['rx5day', 'hd30', 'cdd'] as const).map((s) => hazardChange(s, ssp, year).change);
  return { value: 1 + mean(parts), source: `CCKP ${SSP_LABEL[ssp]}: Rx5day ${(parts[0] * 100).toFixed(1)}%, hot days ${(parts[1] * 100).toFixed(1)}%, dry days ${(parts[2] * 100).toFixed(1)}%` };
}

export function calibrate(key: ScenarioKey, year: number, v: Variable) {
  const r = regional(key, year, v), c = VARIABLES[v].coefficient();
  const ghana = v === 'flood' || v === 'physical' ? 1 + (r.value - 1) * c : r.value * c;
  return { regional: r.value, source: r.source, coefficient: c, ghana };
}

export interface GhanaShocks { gdp: number; inflation: number; rate: number; carbon: number; flood: number; physical: number; transition: number }

export function ghanaShocks(key: ScenarioKey, year: number): GhanaShocks {
  const g = (v: Variable) => calibrate(key, year, v).ghana;
  return { gdp: g('gdp'), inflation: g('inflation'), rate: g('rate'), carbon: g('carbon'), flood: g('flood'), physical: g('physical'), transition: transitionAt(key, year) };
}

export function calibrationRows(key?: ScenarioKey) {
  const pathways = key
    ? [{ key, years: GCB_PATHWAYS.find((pathway) => pathway.key === key)?.years ?? HORIZONS }]
    : GCB_PATHWAYS;
  return pathways.flatMap(({ key, years }) => years.flatMap((year) => (Object.keys(VARIABLES) as Variable[]).map((v) => {
    const c = calibrate(key, year, v);
    return {
      scenario: scenarioOf(key).name, scenarioKey: key, release: NGFS_RELEASE, region: NGFS_REGION, year, variable: VARIABLES[v].label, unit: VARIABLES[v].unit,
      regional: c.regional, source: c.source, coefficient: c.coefficient, ghana: c.ghana, method: VARIABLES[v].method, status: VARIABLES[v].status, version: CALIBRATION_VERSION,
    };
  })));
}
