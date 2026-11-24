// Every model parameter lives here. All values are ILLUSTRATIVE placeholders pending methodology sign-off.

export const MODEL_VERSION = 'climate-credit-0.2.0-illustrative';
export const HAZARD_DATA_VERSION = 'hazard-grid-demo-2026.11';

export type Hazard = 'flood' | 'drought' | 'heat' | 'coastal';
export const HAZARDS: Hazard[] = ['flood', 'drought', 'heat', 'coastal'];

export interface Region { name: string; town: string; lat: number; lon: number; hazard: Record<Hazard, number> }

// Illustrative 0–1 hazard scores. Production: CCKP, ERA5, NASA POWER, Fathom flood maps at collateral level.
export const REGIONS: Region[] = [
  { name: 'Greater Accra', town: 'Accra', lat: 5.6037, lon: -0.187, hazard: { flood: 0.82, drought: 0.25, heat: 0.5, coastal: 0.8 } },
  { name: 'Ashanti', town: 'Kumasi', lat: 6.6885, lon: -1.6244, hazard: { flood: 0.55, drought: 0.3, heat: 0.45, coastal: 0 } },
  { name: 'Western', town: 'Takoradi', lat: 4.934, lon: -1.7137, hazard: { flood: 0.6, drought: 0.12, heat: 0.4, coastal: 0.72 } },
  { name: 'Western North', town: 'Sefwi Wiawso', lat: 6.2056, lon: -2.4859, hazard: { flood: 0.45, drought: 0.25, heat: 0.4, coastal: 0 } },
  { name: 'Central', town: 'Cape Coast', lat: 5.1053, lon: -1.2466, hazard: { flood: 0.5, drought: 0.2, heat: 0.45, coastal: 0.75 } },
  { name: 'Eastern', town: 'Koforidua', lat: 6.094, lon: -0.2591, hazard: { flood: 0.5, drought: 0.3, heat: 0.45, coastal: 0 } },
  { name: 'Volta', town: 'Ho', lat: 6.6008, lon: 0.4713, hazard: { flood: 0.62, drought: 0.35, heat: 0.5, coastal: 0.55 } },
  { name: 'Oti', town: 'Dambai', lat: 8.067, lon: 0.1797, hazard: { flood: 0.55, drought: 0.5, heat: 0.65, coastal: 0 } },
  { name: 'Northern', town: 'Tamale', lat: 9.4008, lon: -0.8393, hazard: { flood: 0.55, drought: 0.75, heat: 0.82, coastal: 0 } },
  { name: 'Savannah', town: 'Damongo', lat: 9.0833, lon: -1.8167, hazard: { flood: 0.45, drought: 0.75, heat: 0.8, coastal: 0 } },
  { name: 'North East', town: 'Nalerigu', lat: 10.5274, lon: -0.3698, hazard: { flood: 0.5, drought: 0.8, heat: 0.85, coastal: 0 } },
  { name: 'Upper East', town: 'Bolgatanga', lat: 10.7856, lon: -0.8514, hazard: { flood: 0.58, drought: 0.85, heat: 0.88, coastal: 0 } },
  { name: 'Upper West', town: 'Wa', lat: 10.0601, lon: -2.5099, hazard: { flood: 0.4, drought: 0.85, heat: 0.86, coastal: 0 } },
  { name: 'Bono', town: 'Sunyani', lat: 7.3349, lon: -2.3123, hazard: { flood: 0.4, drought: 0.45, heat: 0.55, coastal: 0 } },
  { name: 'Bono East', town: 'Techiman', lat: 7.5833, lon: -1.9333, hazard: { flood: 0.42, drought: 0.5, heat: 0.6, coastal: 0 } },
  { name: 'Ahafo', town: 'Goaso', lat: 6.8036, lon: -2.5172, hazard: { flood: 0.42, drought: 0.3, heat: 0.45, coastal: 0 } },
];

export type SectorKey = 'agri' | 'mining' | 'oilgas' | 'power' | 'renew' | 'manuf' | 'constr' | 'realestate' | 'trade' | 'transport' | 'services';

export interface Sector {
  key: SectorKey; name: string;
  transition: number;              // 0–1 sensitivity to carbon price / policy
  carbonIntensity: number;         // tCO2e per GHS m revenue (illustrative)
  vuln: Record<Hazard, number>;    // 0–1 vulnerability of operations to each hazard
  rho: number;                     // asset correlation for the loss distribution
  sdg: number[]; ndc: string | null; taxonomy: 'green' | 'transition' | 'none';
  weight: number;                  // share of synthetic book
}

export const SECTORS: Sector[] = [
  { key: 'agri', name: 'Agriculture & cocoa', transition: 0.2, carbonIntensity: 420, vuln: { flood: 0.6, drought: 0.95, heat: 0.85, coastal: 0.2 }, rho: 0.16, sdg: [2, 13, 15], ndc: 'AFOLU', taxonomy: 'transition', weight: 0.13 },
  { key: 'mining', name: 'Gold mining', transition: 0.6, carbonIntensity: 610, vuln: { flood: 0.55, drought: 0.5, heat: 0.45, coastal: 0.1 }, rho: 0.2, sdg: [8, 12], ndc: 'Industry', taxonomy: 'none', weight: 0.11 },
  { key: 'oilgas', name: 'Oil & gas', transition: 0.95, carbonIntensity: 980, vuln: { flood: 0.4, drought: 0.2, heat: 0.35, coastal: 0.6 }, rho: 0.24, sdg: [7], ndc: 'Energy', taxonomy: 'none', weight: 0.1 },
  { key: 'power', name: 'Thermal power', transition: 0.85, carbonIntensity: 1450, vuln: { flood: 0.45, drought: 0.6, heat: 0.6, coastal: 0.4 }, rho: 0.2, sdg: [7], ndc: 'Energy', taxonomy: 'transition', weight: 0.07 },
  { key: 'renew', name: 'Renewable energy', transition: 0.05, carbonIntensity: 30, vuln: { flood: 0.35, drought: 0.4, heat: 0.3, coastal: 0.2 }, rho: 0.12, sdg: [7, 13], ndc: 'Energy', taxonomy: 'green', weight: 0.04 },
  { key: 'manuf', name: 'Manufacturing', transition: 0.55, carbonIntensity: 380, vuln: { flood: 0.5, drought: 0.3, heat: 0.4, coastal: 0.3 }, rho: 0.16, sdg: [9], ndc: 'Industry', taxonomy: 'transition', weight: 0.11 },
  { key: 'constr', name: 'Construction & cement', transition: 0.5, carbonIntensity: 520, vuln: { flood: 0.55, drought: 0.25, heat: 0.5, coastal: 0.4 }, rho: 0.18, sdg: [9, 11], ndc: 'Industry', taxonomy: 'transition', weight: 0.08 },
  { key: 'realestate', name: 'Real estate', transition: 0.3, carbonIntensity: 140, vuln: { flood: 0.85, drought: 0.15, heat: 0.35, coastal: 0.9 }, rho: 0.18, sdg: [11], ndc: null, taxonomy: 'transition', weight: 0.1 },
  { key: 'trade', name: 'Trade & commerce', transition: 0.2, carbonIntensity: 90, vuln: { flood: 0.5, drought: 0.2, heat: 0.3, coastal: 0.35 }, rho: 0.14, sdg: [8], ndc: null, taxonomy: 'none', weight: 0.13 },
  { key: 'transport', name: 'Transport & logistics', transition: 0.6, carbonIntensity: 560, vuln: { flood: 0.6, drought: 0.15, heat: 0.4, coastal: 0.45 }, rho: 0.16, sdg: [9, 11], ndc: 'Transport', taxonomy: 'transition', weight: 0.07 },
  { key: 'services', name: 'Services & telecoms', transition: 0.12, carbonIntensity: 60, vuln: { flood: 0.3, drought: 0.1, heat: 0.25, coastal: 0.2 }, rho: 0.12, sdg: [8, 9], ndc: null, taxonomy: 'none', weight: 0.06 },
];
export const sectorOf = (k: SectorKey) => SECTORS.find((s) => s.key === k)!;

export type CollateralType = 'property' | 'land' | 'plant' | 'inventory' | 'cash' | 'none';
export const COLLATERAL: Record<CollateralType, { name: string; vuln: Record<Hazard, number> }> = {
  property: { name: 'Commercial / residential property', vuln: { flood: 0.9, drought: 0.05, heat: 0.15, coastal: 1 } },
  land: { name: 'Agricultural land', vuln: { flood: 0.5, drought: 0.85, heat: 0.6, coastal: 0.8 } },
  plant: { name: 'Plant & equipment', vuln: { flood: 0.7, drought: 0.1, heat: 0.25, coastal: 0.6 } },
  inventory: { name: 'Inventory / stock', vuln: { flood: 0.6, drought: 0.3, heat: 0.3, coastal: 0.4 } },
  cash: { name: 'Cash / deposits', vuln: { flood: 0, drought: 0, heat: 0, coastal: 0 } },
  none: { name: 'Unsecured', vuln: { flood: 0, drought: 0, heat: 0, coastal: 0 } },
};

export type ScenarioKey = 'nz2050' | 'b2c' | 'delayed' | 'ndc' | 'current' | 'fragmented';
export const HORIZONS = [2030, 2040, 2050] as const;
export type Horizon = (typeof HORIZONS)[number];

export interface Scenario {
  key: ScenarioKey; name: string; family: 'Orderly' | 'Disorderly' | 'Hot house world' | 'Too little, too late';
  transitionShock: Record<Horizon, number>; // 0–1 policy intensity used for screening and transition scores
}

// Scenario names follow NGFS Phase V. Macro, carbon and hazard paths come from src/data (NGFS, CCKP) via lib/calibration.
export const SCENARIOS: Scenario[] = [
  { key: 'nz2050', name: 'Net Zero 2050', family: 'Orderly', transitionShock: { 2030: 0.55, 2040: 0.7, 2050: 0.75 } },
  { key: 'b2c', name: 'Below 2°C', family: 'Orderly', transitionShock: { 2030: 0.4, 2040: 0.55, 2050: 0.6 } },
  { key: 'delayed', name: 'Delayed Transition', family: 'Disorderly', transitionShock: { 2030: 0.15, 2040: 0.9, 2050: 0.95 } },
  { key: 'ndc', name: 'Nationally Determined Contributions (NDCs)', family: 'Hot house world', transitionShock: { 2030: 0.25, 2040: 0.3, 2050: 0.35 } },
  { key: 'current', name: 'Current Policies', family: 'Hot house world', transitionShock: { 2030: 0.05, 2040: 0.08, 2050: 0.1 } },
  { key: 'fragmented', name: 'Fragmented World', family: 'Too little, too late', transitionShock: { 2030: 0.3, 2040: 0.6, 2050: 0.7 } },
];
export const scenarioOf = (k: ScenarioKey) => SCENARIOS.find((s) => s.key === k)!;

// Credit translation (illustrative): logit(PD_stressed) = logit(PD) + bT·T + bP·P + bM·(−GDP shock)
export const CREDIT = {
  betaTransition: 1.4,
  betaPhysical: 2.0,                // applied to physical score × scenario intensification (multiplier − 1) / 0.75
  betaMacro: 0.06,
  transitionReadinessRelief: 0.6, // a credible transition plan reduces transition score by up to 60%
  sicrMultiple: 2,                // stage 1 → 2 when stressed PD ≥ 2× origination PD…
  sicrAbsolute: 0.02,             // …and has risen by at least 2 percentage points
  stage3Pd: 0.3,                  // stage 2 → 3 when stressed PD ≥ 30%
  collateralRecovery: 0.7,        // share of collateral value realised on default
  lgdFloor: 0.1,
  topDownSectorShrink: 1,         // top-down applies sector average scores to every obligor
};

export const LOSS_DIST = { simulations: 10000, seed: 20261123, confidence: [0.99, 0.999] as const };

// Bank capital & liquidity (synthetic "Demo Bank Ghana"). The regulatory minimum is configurable.
export const BANK = {
  cet1: 1_900_000_000,
  tier2: 400_000_000,
  otherRwa: 3_150_000_000,     // market + operational + non-loan credit RWA
  riskWeight: 1,               // standardised 100% on loans (illustrative)
  carMinimum: 0.13,            // configurable; confirm the current BoG requirement
  taxRate: 0,
  hqla: 3_150_000_000,
  deposits: { retail: 9_450_000_000, sme: 3_400_000_000, corporate: 4_450_000_000 },
  baseRunOff: { retail: 0.05, sme: 0.1, corporate: 0.25 },
  climateRunOff: { retail: 0.04, sme: 0.08, corporate: 0.06 }, // extra outflow from affected regions/sectors under severe physical stress
  undrawnLines: 1_450_000_000, baseDrawdown: 0.1, climateDrawdown: 0.15,
  lcrMinimum: 1,
};

// Climate-to-credit transmission (illustrative, pending methodology sign-off)
export const TRANSMISSION = {
  // Bottom-up: borrower cash flows → DSCR → PD band
  lendingRate: 0.22,              // Ghana lending rate used to build base debt service
  floatingShare: 0.5,             // share of debt repricing with the long-term rate
  variableCostShare: 0.6,         // share of operating costs that moves with revenue
  pricingPower: 0.7,              // share of cost inflation passed on to customers
  carbonCostPer100: 0.012,         // revenue share lost per USD 100/t for a sector with transition sensitivity 1
  planRelief: 0.4,                // a credible transition plan cuts carbon cost by 40%
  floodDepthScale: 2.5,           // metres of 1-in-100-year flood depth at hazard score 1 (until JRC rasters are sampled)
  floodEventThreshold: 0.6,       // stress applies the 1-in-100-year event where flood hazard × intensity ≥ this
  businessInterruption: 0.08,     // revenue lost per unit of flood damage fraction
  recoveryShare: 0.5,             // share of damaged collateral value that would have been recovered
  // DSCR → PD bands (log-linear between anchors)
  dscrPd: [[0.5, 0.6], [0.8, 0.3], [1.0, 0.15], [1.1, 0.08], [1.25, 0.04], [1.5, 0.02], [2.0, 0.008], [3.0, 0.003]] as [number, number][],
  sector: {
    agri: { gdpElasticity: 1.0, cfadsMargin: 0.2 }, mining: { gdpElasticity: 0.8, cfadsMargin: 0.3 }, oilgas: { gdpElasticity: 1.2, cfadsMargin: 0.3 },
    power: { gdpElasticity: 0.6, cfadsMargin: 0.3 }, renew: { gdpElasticity: 0.5, cfadsMargin: 0.35 }, manuf: { gdpElasticity: 1.3, cfadsMargin: 0.18 },
    constr: { gdpElasticity: 1.6, cfadsMargin: 0.15 }, realestate: { gdpElasticity: 1.5, cfadsMargin: 0.35 }, trade: { gdpElasticity: 1.4, cfadsMargin: 0.12 },
    transport: { gdpElasticity: 1.2, cfadsMargin: 0.18 }, services: { gdpElasticity: 1.0, cfadsMargin: 0.25 },
  } as Record<SectorKey, { gdpElasticity: number; cfadsMargin: number }>,
  // Top-down: sector satellite model, logit(PD sector stressed) = logit(PD sector) + Σ b·shock
  topDown: { bGdp: 0.1, bInflation: 0.03, bRate: 0.08, bCarbon: 0.25, bPhysical: 1.6, lgdPhysical: 0.25 },
};

// JRC-style flood depth–damage curves (depth m → damage fraction). Shaped like the JRC global curves for Africa;
// replace with the licensed JRC tables before production use.
export const DEPTH_DAMAGE: Record<'residential' | 'commercial' | 'industrial' | 'agriculture', [number, number][]> = {
  residential: [[0, 0], [0.5, 0.22], [1, 0.38], [1.5, 0.53], [2, 0.64], [3, 0.82], [4, 0.91], [5, 0.96], [6, 1]],
  commercial: [[0, 0], [0.5, 0.18], [1, 0.32], [1.5, 0.46], [2, 0.58], [3, 0.76], [4, 0.88], [5, 0.96], [6, 1]],
  industrial: [[0, 0], [0.5, 0.2], [1, 0.37], [1.5, 0.5], [2, 0.6], [3, 0.76], [4, 0.88], [5, 0.96], [6, 1]],
  agriculture: [[0, 0], [0.5, 0.24], [1, 0.47], [1.5, 0.74], [2, 0.92], [3, 1]],
};
