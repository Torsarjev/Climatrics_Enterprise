// Engine I rule catalogue. Rules are data: declarative conditions evaluated by lib/esg/engine.ts.
// Representative, provisional subset for the demo; each rule names its source. GCB's ESMS policy replaces the IFC rules.

export type Framework = 'ESMS' | 'NDC' | 'TAXONOMY' | 'SDG';

export type Cond =
  | { q: string; eq: boolean }
  | { fact: string; gte?: number; lt?: number }
  | { activity: string[] }
  | { sector: string[] }
  | { evidence: string; atLeast: 'provided' | 'verified' }
  | { exclusionGate: 'pass' }
  | { criterionNotFailed: string[] }
  | { all: Cond[] }
  | { any: Cond[] }
  | { not: Cond };

export interface Criterion {
  id: string; framework: Framework; kind: string; title: string;
  source: string; ref: string; scope: 'facility' | 'activity';
  appliesWhen?: Cond; failWhen?: Cond; passWhen: Cond;
  severity?: 'high' | 'medium' | 'low';
  action?: string; evidence?: string; questions?: string[];
  programme?: string; target?: string; objective?: string;
}

export const FRAMEWORK_VERSIONS: Record<Framework, { name: string; version: string; source: string; status: string }> = {
  ESMS: { name: 'Environmental & Social Management System', version: 'ifc-ps-2012+ifc-excl-2007 · provisional v0.1', source: 'IFC Exclusion List (2007), IFC Performance Standards (2012), Ghana Environmental Assessment Regulations 1999 (LI 1652)', status: 'Provisional, not GCB policy: replace with GCB’s approved ESMS policy and exclusion list' },
  NDC: { name: 'Ghana Nationally Determined Contribution', version: 'gh-ndc-2021 · representative v0.1', source: 'Ghana updated NDC (2021), EPA (gcr.epa.gov.gh/ndcs-2/)', status: 'Representative subset; programme labels to be verified against the official programmes of action' },
  TAXONOMY: { name: 'Ghana Green Finance Taxonomy', version: 'gh-gft · representative v0.1', source: 'Ministry of Finance, Ghana Green Finance Taxonomy (mofep.gov.gh)', status: 'Representative subset; technical thresholds to be verified against the official taxonomy' },
  SDG: { name: 'UN Sustainable Development Goals', version: 'un-sdg-targets · v0.1', source: 'United Nations, sdgs.un.org/goals (target wording)', status: 'Target mapping provisional pending GCB sustainability team review' },
};

export const ACTIVITIES: Record<string, { name: string; evidence?: string }> = {
  solar_pv: { name: 'Solar PV generation (rooftop or ground-mounted)', evidence: 'EV_SOLAR_TECH' },
  mini_grid: { name: 'Renewable mini-grid', evidence: 'EV_RE_TECH' },
  small_hydro: { name: 'Small hydropower', evidence: 'EV_RE_TECH' },
  energy_efficiency: { name: 'Industrial energy-efficiency upgrade', evidence: 'EV_EE_AUDIT' },
  e_mobility: { name: 'Electric or mass-transit vehicles', evidence: 'EV_RE_TECH' },
  flood_defence: { name: 'Flood protection and drainage', evidence: 'EV_RE_TECH' },
  agro_processing: { name: 'Agro-processing plant and working capital' },
  crop_production: { name: 'Crop production' },
  mining: { name: 'Mining operations' },
  oil_gas: { name: 'Oil and gas operations' },
  thermal_power: { name: 'Fossil-fuel power generation' },
  construction: { name: 'Construction and cement' },
  real_estate: { name: 'Real estate development' },
  manufacturing: { name: 'Manufacturing' },
  transport: { name: 'Conventional transport and logistics' },
  trade: { name: 'Trade finance' },
  general: { name: 'General working capital (use not specified)' },
};

export const EVIDENCE: Record<string, string> = {
  EV_SOLAR_TECH: 'Solar system technical specification, installed capacity and commissioning certificate',
  EV_RE_TECH: 'Project technical specification and commissioning evidence',
  EV_EE_AUDIT: 'Energy audit showing the efficiency gain',
  EV_EPA_PERMIT: 'EPA environmental permit for the financed site',
  EV_WASTEWATER: 'Wastewater treatment design and discharge monitoring results',
};

export interface Question { id: string; text: string; showWhen?: Cond }
export const QUESTIONS: Question[] = [
  { id: 'Q_EX_LABOUR', text: 'Does the borrower use forced labour or harmful child labour?' },
  { id: 'Q_EX_WEAPONS', text: 'Does the business produce or trade weapons and munitions?' },
  { id: 'Q_EX_RADIOACTIVE', text: 'Does it produce or trade radioactive materials?' },
  { id: 'Q_EX_ASBESTOS', text: 'Does it produce, trade or use unbonded asbestos fibres?' },
  { id: 'Q_EX_LOGGING', text: 'Does it carry out commercial logging in primary tropical moist forest?' },
  { id: 'Q_EX_ILLEGAL', text: 'Does it produce or trade anything illegal under Ghanaian law or international conventions (banned pesticides, ozone-depleting substances, CITES wildlife)?' },
  { id: 'Q_PERMIT', text: 'Does the financed site hold a valid EPA environmental permit?', showWhen: { sector: ['agri', 'mining', 'oilgas', 'power', 'manuf', 'constr', 'renew'] } },
  { id: 'Q_WATER_STRESS', text: 'Is the site in a water-stressed catchment or dependent on scarce water?', showWhen: { sector: ['agri', 'mining', 'manuf', 'power', 'constr'] } },
  { id: 'Q_WASTEWATER', text: 'Is process wastewater discharged without treatment?', showWhen: { sector: ['agri', 'mining', 'manuf', 'oilgas'] } },
  { id: 'Q_HAZMAT', text: 'Are hazardous materials used or stored (e.g. mercury, cyanide, fuels, agrochemicals)?', showWhen: { sector: ['agri', 'mining', 'oilgas', 'power', 'manuf'] } },
  { id: 'Q_OHS', text: 'Is there an occupational health and safety plan for the workforce?' },
  { id: 'Q_LAND', text: 'Does the project need land acquisition or involuntary resettlement?', showWhen: { sector: ['agri', 'mining', 'oilgas', 'power', 'renew', 'constr', 'realestate'] } },
  { id: 'Q_PROTECTED', text: 'Is the site in or next to a protected area, forest reserve or wetland?', showWhen: { sector: ['agri', 'mining', 'oilgas', 'power', 'renew', 'constr'] } },
  { id: 'Q_COMMUNITY', text: 'Could the project materially affect nearby communities (noise, dust, traffic, access to water)?' },
  { id: 'Q_SOLAR_GRID', text: 'Is the solar system connected to the site’s supply or grid (not a standby generator replacement only)?', showWhen: { activity: ['solar_pv'] } },
];

const IFC_EX = 'IFC Exclusion List (2007)';
const ex = (id: string, q: string, title: string): Criterion => ({
  id, framework: 'ESMS', kind: 'exclusion', title, source: IFC_EX, ref: 'Exclusion list item', scope: 'facility',
  failWhen: { q, eq: true }, passWhen: { q, eq: false }, severity: 'high', questions: [q], action: 'Exclusion hit: credit progression blocked',
});

export const CRITERIA: Criterion[] = [
  ex('EX-01', 'Q_EX_LABOUR', 'No forced labour or harmful child labour'),
  ex('EX-02', 'Q_EX_WEAPONS', 'No production or trade in weapons and munitions'),
  ex('EX-03', 'Q_EX_RADIOACTIVE', 'No production or trade in radioactive materials'),
  ex('EX-04', 'Q_EX_ASBESTOS', 'No unbonded asbestos fibres'),
  ex('EX-05', 'Q_EX_LOGGING', 'No commercial logging in primary tropical moist forest'),
  ex('EX-06', 'Q_EX_ILLEGAL', 'Nothing illegal under host-country law or international conventions'),

  { id: 'ES-PERMIT', framework: 'ESMS', kind: 'risk', title: 'Environmental permit in place', source: 'Ghana Environmental Assessment Regulations 1999 (LI 1652); IFC PS1', ref: 'Permit requirement', scope: 'facility',
    appliesWhen: { sector: ['agri', 'mining', 'oilgas', 'power', 'manuf', 'constr', 'renew'] }, failWhen: { q: 'Q_PERMIT', eq: false }, passWhen: { all: [{ q: 'Q_PERMIT', eq: true }, { evidence: 'EV_EPA_PERMIT', atLeast: 'provided' }] },
    severity: 'high', evidence: 'EV_EPA_PERMIT', questions: ['Q_PERMIT'], action: 'Obtain and file the EPA environmental permit before first drawdown' },
  { id: 'ES-WATER', framework: 'ESMS', kind: 'risk', title: 'Water availability', source: 'IFC Performance Standard 3 (2012)', ref: 'Resource efficiency: water', scope: 'facility',
    appliesWhen: { sector: ['agri', 'mining', 'manuf', 'power', 'constr'] }, failWhen: { any: [{ q: 'Q_WATER_STRESS', eq: true }, { fact: 'droughtHazard', gte: 0.6 }] }, passWhen: { q: 'Q_WATER_STRESS', eq: false },
    severity: 'medium', questions: ['Q_WATER_STRESS'], action: 'Water management plan: metering, recycling and a secure alternative supply' },
  { id: 'ES-WASTEWATER', framework: 'ESMS', kind: 'risk', title: 'Wastewater treated before discharge', source: 'IFC Performance Standard 3 (2012)', ref: 'Pollution prevention', scope: 'facility',
    appliesWhen: { sector: ['agri', 'mining', 'manuf', 'oilgas'] }, failWhen: { q: 'Q_WASTEWATER', eq: true }, passWhen: { q: 'Q_WASTEWATER', eq: false },
    severity: 'high', evidence: 'EV_WASTEWATER', questions: ['Q_WASTEWATER'], action: 'Install wastewater treatment and report discharge monitoring to EPA standards' },
  { id: 'ES-HAZMAT', framework: 'ESMS', kind: 'risk', title: 'Hazardous materials managed', source: 'IFC Performance Standard 3 (2012)', ref: 'Hazardous materials management', scope: 'facility',
    appliesWhen: { sector: ['agri', 'mining', 'oilgas', 'power', 'manuf'] }, failWhen: { q: 'Q_HAZMAT', eq: true }, passWhen: { q: 'Q_HAZMAT', eq: false },
    severity: 'medium', questions: ['Q_HAZMAT'], action: 'Hazardous materials management plan and annual monitoring' },
  { id: 'ES-OHS', framework: 'ESMS', kind: 'risk', title: 'Occupational health and safety plan', source: 'IFC Performance Standard 2 (2012)', ref: 'Labour and working conditions', scope: 'facility',
    failWhen: { q: 'Q_OHS', eq: false }, passWhen: { q: 'Q_OHS', eq: true }, severity: 'medium', questions: ['Q_OHS'], action: 'Adopt an OHS plan with incident reporting' },
  { id: 'ES-LAND', framework: 'ESMS', kind: 'risk', title: 'No involuntary resettlement', source: 'IFC Performance Standard 5 (2012)', ref: 'Land acquisition and involuntary resettlement', scope: 'facility',
    appliesWhen: { sector: ['agri', 'mining', 'oilgas', 'power', 'renew', 'constr', 'realestate'] }, failWhen: { q: 'Q_LAND', eq: true }, passWhen: { q: 'Q_LAND', eq: false },
    severity: 'high', questions: ['Q_LAND'], action: 'Resettlement action plan aligned with IFC PS5' },
  { id: 'ES-BIODIV', framework: 'ESMS', kind: 'risk', title: 'No protected-area impact', source: 'IFC Performance Standard 6 (2012)', ref: 'Biodiversity conservation', scope: 'facility',
    appliesWhen: { sector: ['agri', 'mining', 'oilgas', 'power', 'renew', 'constr'] }, failWhen: { q: 'Q_PROTECTED', eq: true }, passWhen: { q: 'Q_PROTECTED', eq: false },
    severity: 'high', questions: ['Q_PROTECTED'], action: 'Biodiversity assessment and mitigation hierarchy' },
  { id: 'ES-COMMUNITY', framework: 'ESMS', kind: 'risk', title: 'Community health, safety and security', source: 'IFC Performance Standard 4 (2012)', ref: 'Community health, safety and security', scope: 'facility',
    failWhen: { q: 'Q_COMMUNITY', eq: true }, passWhen: { q: 'Q_COMMUNITY', eq: false }, severity: 'medium', questions: ['Q_COMMUNITY'], action: 'Stakeholder engagement and grievance mechanism' },
  { id: 'ES-CLIMATE', framework: 'ESMS', kind: 'risk', title: 'Physical climate risk at the site', source: 'ClimaTRICs Engine II physical risk score', ref: 'Score ≥ 3.0 of 5 by 2050', scope: 'facility',
    failWhen: { fact: 'physical2050', gte: 0.5 }, passWhen: { fact: 'physical2050', lt: 0.5 }, severity: 'medium', action: 'Climate adaptation measures and insurance for the main hazard' },

  { id: 'NDC-RE', framework: 'NDC', kind: 'match', title: 'Scale up renewable energy (solar, mini-grids, small hydro)', source: 'Ghana updated NDC (2021)', ref: 'Energy sector, mitigation', scope: 'activity', programme: 'GH-NDC Energy · Renewable energy scale-up', objective: 'Mitigation',
    appliesWhen: { activity: ['solar_pv', 'mini_grid', 'small_hydro'] }, passWhen: { activity: ['solar_pv', 'mini_grid', 'small_hydro'] } },
  { id: 'NDC-EE', framework: 'NDC', kind: 'match', title: 'Energy efficiency in industry', source: 'Ghana updated NDC (2021)', ref: 'Energy sector, mitigation', scope: 'activity', programme: 'GH-NDC Energy · Industrial energy efficiency', objective: 'Mitigation',
    appliesWhen: { activity: ['energy_efficiency'] }, passWhen: { activity: ['energy_efficiency'] } },
  { id: 'NDC-TR', framework: 'NDC', kind: 'match', title: 'Clean and efficient transport', source: 'Ghana updated NDC (2021)', ref: 'Transport sector, mitigation', scope: 'activity', programme: 'GH-NDC Transport · Clean mobility', objective: 'Mitigation',
    appliesWhen: { activity: ['e_mobility'] }, passWhen: { activity: ['e_mobility'] } },
  { id: 'NDC-RES', framework: 'NDC', kind: 'match', title: 'Resilient infrastructure and flood protection', source: 'Ghana updated NDC (2021)', ref: 'Adaptation', scope: 'activity', programme: 'GH-NDC Adaptation · Resilient infrastructure', objective: 'Adaptation',
    appliesWhen: { activity: ['flood_defence'] }, passWhen: { activity: ['flood_defence'] } },

  { id: 'TX-ELIG', framework: 'TAXONOMY', kind: 'eligibility', title: 'Activity is listed in the taxonomy', source: 'Ghana Green Finance Taxonomy (MoF)', ref: 'Eligible activities (representative)', scope: 'activity',
    passWhen: { activity: ['solar_pv', 'mini_grid', 'small_hydro', 'energy_efficiency', 'e_mobility', 'flood_defence'] },
    failWhen: { activity: ['agro_processing', 'crop_production', 'mining', 'oil_gas', 'thermal_power', 'construction', 'real_estate', 'manufacturing', 'transport', 'trade'] } },
  { id: 'TX-SOLAR-TECH', framework: 'TAXONOMY', kind: 'technical', title: 'Solar PV technical screening criteria met', source: 'Ghana Green Finance Taxonomy (MoF)', ref: 'Solar PV: technical criteria (to verify)', scope: 'activity',
    appliesWhen: { activity: ['solar_pv'] }, failWhen: { q: 'Q_SOLAR_GRID', eq: false }, passWhen: { all: [{ q: 'Q_SOLAR_GRID', eq: true }, { evidence: 'EV_SOLAR_TECH', atLeast: 'verified' }] }, evidence: 'EV_SOLAR_TECH', questions: ['Q_SOLAR_GRID'] },
  { id: 'TX-RE-TECH', framework: 'TAXONOMY', kind: 'technical', title: 'Technical screening criteria met', source: 'Ghana Green Finance Taxonomy (MoF)', ref: 'Activity technical criteria (to verify)', scope: 'activity',
    appliesWhen: { activity: ['mini_grid', 'small_hydro', 'e_mobility', 'flood_defence'] }, passWhen: { evidence: 'EV_RE_TECH', atLeast: 'verified' }, evidence: 'EV_RE_TECH' },
  { id: 'TX-EE-TECH', framework: 'TAXONOMY', kind: 'technical', title: 'Efficiency gain evidenced by an energy audit', source: 'Ghana Green Finance Taxonomy (MoF)', ref: 'Energy efficiency: technical criteria (to verify)', scope: 'activity',
    appliesWhen: { activity: ['energy_efficiency'] }, passWhen: { evidence: 'EV_EE_AUDIT', atLeast: 'verified' }, evidence: 'EV_EE_AUDIT' },
  { id: 'TX-SAFE-EXCL', framework: 'TAXONOMY', kind: 'safeguard', title: 'No exclusion-list activity', source: 'Ghana Green Finance Taxonomy (MoF)', ref: 'Minimum safeguards', scope: 'activity',
    appliesWhen: { activity: ['solar_pv', 'mini_grid', 'small_hydro', 'energy_efficiency', 'e_mobility', 'flood_defence'] }, passWhen: { exclusionGate: 'pass' } },
  { id: 'TX-SAFE-SOCIAL', framework: 'TAXONOMY', kind: 'safeguard', title: 'Minimum social safeguards (labour, land)', source: 'Ghana Green Finance Taxonomy (MoF)', ref: 'Minimum safeguards', scope: 'activity',
    appliesWhen: { activity: ['solar_pv', 'mini_grid', 'small_hydro', 'energy_efficiency', 'e_mobility', 'flood_defence'] }, passWhen: { criterionNotFailed: ['ES-OHS', 'ES-LAND', 'EX-01'] } },

  { id: 'SDG-7.2', framework: 'SDG', kind: 'contribution', title: 'Increase the share of renewable energy', source: 'UN SDG target 7.2', ref: 'sdgs.un.org/goals/goal7', scope: 'activity', target: '7.2',
    appliesWhen: { activity: ['solar_pv', 'mini_grid', 'small_hydro'] }, passWhen: { activity: ['solar_pv', 'mini_grid', 'small_hydro'] } },
  { id: 'SDG-7.3', framework: 'SDG', kind: 'contribution', title: 'Improve energy efficiency', source: 'UN SDG target 7.3', ref: 'sdgs.un.org/goals/goal7', scope: 'activity', target: '7.3',
    appliesWhen: { activity: ['energy_efficiency'] }, passWhen: { activity: ['energy_efficiency'] } },
  { id: 'SDG-13', framework: 'SDG', kind: 'contribution', title: 'Climate action: mitigation or adaptation', source: 'UN SDG 13', ref: 'sdgs.un.org/goals/goal13', scope: 'activity', target: '13',
    appliesWhen: { activity: ['solar_pv', 'mini_grid', 'small_hydro', 'energy_efficiency', 'e_mobility', 'flood_defence'] }, passWhen: { activity: ['solar_pv', 'mini_grid', 'small_hydro', 'energy_efficiency', 'e_mobility', 'flood_defence'] } },
  { id: 'SDG-11.2', framework: 'SDG', kind: 'contribution', title: 'Sustainable transport systems', source: 'UN SDG target 11.2', ref: 'sdgs.un.org/goals/goal11', scope: 'activity', target: '11.2',
    appliesWhen: { activity: ['e_mobility'] }, passWhen: { activity: ['e_mobility'] } },
  { id: 'SDG-ADV-6.3', framework: 'SDG', kind: 'adverse', title: 'Adverse: untreated wastewater (water quality)', source: 'UN SDG target 6.3', ref: 'sdgs.un.org/goals/goal6', scope: 'facility', target: '6.3',
    failWhen: { q: 'Q_WASTEWATER', eq: true }, passWhen: { q: 'Q_WASTEWATER', eq: false }, questions: ['Q_WASTEWATER'] },
  { id: 'SDG-ADV-6.4', framework: 'SDG', kind: 'adverse', title: 'Adverse: pressure on scarce water', source: 'UN SDG target 6.4', ref: 'sdgs.un.org/goals/goal6', scope: 'facility', target: '6.4',
    failWhen: { q: 'Q_WATER_STRESS', eq: true }, passWhen: { q: 'Q_WATER_STRESS', eq: false }, questions: ['Q_WATER_STRESS'] },
  { id: 'SDG-ADV-8.7', framework: 'SDG', kind: 'adverse', title: 'Adverse: forced or child labour', source: 'UN SDG target 8.7', ref: 'sdgs.un.org/goals/goal8', scope: 'facility', target: '8.7',
    failWhen: { q: 'Q_EX_LABOUR', eq: true }, passWhen: { q: 'Q_EX_LABOUR', eq: false }, questions: ['Q_EX_LABOUR'] },
  { id: 'SDG-ADV-15.5', framework: 'SDG', kind: 'adverse', title: 'Adverse: habitat and biodiversity loss', source: 'UN SDG target 15.5', ref: 'sdgs.un.org/goals/goal15', scope: 'facility', target: '15.5',
    failWhen: { q: 'Q_PROTECTED', eq: true }, passWhen: { q: 'Q_PROTECTED', eq: false }, questions: ['Q_PROTECTED'] },
];
