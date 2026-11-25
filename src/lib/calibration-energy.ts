import { GCB_PATHWAYS } from './gcb-scenarios';
import type { ScenarioKey } from './params';

export interface EnergyCalibration {
  source: string;
  beta: number;
  opexShare: number;
  points: { scenario: ScenarioKey; year: number; shockPct: number }[];
}

export function readEnergyPath(csv: string, source: string) {
  if (!source.trim() || source.length > 1000) throw new Error('Document the NGFS energy series, release, model, region, product and baseline.');
  const [header, ...lines] = csv.trim().replace(/^\uFEFF/, '').split(/\r?\n/);
  if (header.trim() !== 'scenario,year,shock_pct' || lines.length > 100) throw new Error('Use the NGFS energy CSV header scenario,year,shock_pct and up to 100 observations.');
  const points = lines.map((line) => {
    const [key, annual, shock, ...extra] = line.split(',').map((value) => value.trim());
    const pathway = GCB_PATHWAYS.find(({ key: candidate }) => candidate === key);
    const year = Number(annual), shockPct = Number(shock);
    if (!pathway || !annual || !shock || extra.length || !Number.isInteger(year) || year < 2025 || year > 2050
        || !Number.isFinite(shockPct) || shockPct <= -100) throw new Error('Use a GCB scenario key, year from 2025 to 2050, and a finite energy price deviation above −100%.');
    return { scenario: pathway.key, year, shockPct };
  }).sort((a, b) => a.year - b.year);
  if (new Set(points.map(({ scenario, year }) => `${scenario}:${year}`)).size !== points.length) throw new Error('The NGFS energy path contains a duplicate scenario and year.');
  if (GCB_PATHWAYS.some(({key, years}) => years.some((year) => energyShock(points, key, year) === undefined))) {
    throw new Error('The energy path must cover or bracket every GCB reporting year in all three scenarios. Values within the range are interpolated.');
  }
  return { source: source.trim(), points };
}

function energyShock(points: EnergyCalibration['points'], scenario: ScenarioKey, year: number) {
  const path = points.filter((point) => point.scenario === scenario);
  const next = path.findIndex((point) => point.year >= year);
  if (next < 0) return undefined;
  const upper = path[next];
  if (upper.year === year) return upper.shockPct;
  const lower = path[next - 1];
  return lower ? lower.shockPct + (upper.shockPct - lower.shockPct) * ((year - lower.year) / (upper.year - lower.year)) : undefined;
}

export function calibratedEnergy(energy: EnergyCalibration | undefined, scenario: ScenarioKey, year: number) {
  if (!energy) return undefined;
  const regional = energyShock(energy.points, scenario, year);
  if (regional === undefined) return undefined;
  const ghana = 100 * Math.expm1(energy.beta * Math.log1p(regional / 100));
  return { regional, ghana, opexShare: energy.opexShare };
}
