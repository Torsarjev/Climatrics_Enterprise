import { CollateralType, REGIONS, SECTORS, SectorKey } from './params';
import { rng } from './math';

export interface Loan {
  id: string; borrower: string; sector: SectorKey; region: string;
  lat: number; lon: number; geoConfidence: 'gps' | 'address' | 'region';
  ead: number; collateralType: CollateralType; collateralValue: number;
  maturityYears: number; pd: number; lgd: number; stage: 1 | 2 | 3;
  transitionPlan: boolean; emissionsIntensity: number; purpose: string;
}

const NAMES = ['Asante', 'Mensah', 'Owusu', 'Boateng', 'Addo', 'Ofori', 'Agyeman', 'Darko', 'Tetteh', 'Quaye', 'Amoah', 'Badu', 'Danquah', 'Nkrumah', 'Sarpong', 'Yeboah', 'Kuffour', 'Appiah', 'Osei', 'Fosu', 'Ansah', 'Bonsu', 'Gyasi', 'Atta', 'Larbi', 'Abdulai', 'Iddrisu', 'Mahama', 'Seidu', 'Zakaria'];
const SUFFIX: Record<SectorKey, string[]> = {
  agri: ['Cocoa Farms', 'Agro Ltd', 'Cashew Co.', 'Rice Growers', 'Shea Cooperative'],
  mining: ['Gold Mines', 'Mining Ltd', 'Minerals'],
  oilgas: ['Petroleum', 'Energy Ltd', 'Oil Services', 'Gas Distribution'],
  power: ['Power Ltd', 'Thermal Gen.', 'IPP Ltd'],
  renew: ['Solar Ltd', 'Hydro', 'Green Power', 'Solar Mini-Grids'],
  manuf: ['Manufacturing', 'Industries', 'Steel Works', 'Plastics'],
  constr: ['Construction', 'Cement Ltd', 'Builders'],
  realestate: ['Estates', 'Properties', 'Homes Ltd'],
  trade: ['Trading', 'Enterprises', 'Imports & Exports'],
  transport: ['Logistics', 'Transport Co.', 'Haulage'],
  services: ['Telecoms', 'Services Ltd', 'Hospitality'],
};
const PURPOSE: Record<SectorKey, string[]> = {
  agri: ['Seasonal crop finance', 'Farm expansion', 'Irrigation equipment'],
  mining: ['Mine development', 'Equipment finance', 'Working capital'],
  oilgas: ['Upstream services', 'Fuel import finance', 'Gas pipeline'],
  power: ['Thermal plant upgrade', 'Working capital'],
  renew: ['Solar IPP', 'Mini-grid roll-out', 'Small hydro'],
  manuf: ['Plant expansion', 'Working capital', 'Equipment finance'],
  constr: ['Project finance', 'Cement kiln', 'Working capital'],
  realestate: ['Commercial property', 'Residential development', 'Mortgage book'],
  trade: ['Trade finance', 'Inventory finance', 'Working capital'],
  transport: ['Fleet finance', 'Warehouse', 'Working capital'],
  services: ['Network expansion', 'Hotel refurbishment', 'Working capital'],
};
const COLL_BY_SECTOR: Record<SectorKey, CollateralType[]> = {
  agri: ['land', 'land', 'inventory', 'plant'], mining: ['plant', 'plant', 'land'], oilgas: ['plant', 'inventory', 'cash'],
  power: ['plant', 'plant'], renew: ['plant', 'land'], manuf: ['plant', 'property', 'inventory'], constr: ['plant', 'property'],
  realestate: ['property', 'property', 'land'], trade: ['inventory', 'property', 'none', 'cash'], transport: ['plant', 'property', 'none'], services: ['property', 'none', 'cash'],
};
// regional tilt so the book looks like Ghana: cocoa in the forest belt, mining in the west, oil in Western, grains in the north
const REGION_TILT: Partial<Record<SectorKey, string[]>> = {
  agri: ['Ashanti', 'Western North', 'Bono', 'Ahafo', 'Northern', 'Upper East', 'Eastern', 'Bono East'],
  mining: ['Western', 'Ashanti', 'Western North', 'Ahafo'],
  oilgas: ['Western', 'Greater Accra'],
  power: ['Greater Accra', 'Western'],
  renew: ['Northern', 'Upper West', 'Greater Accra', 'Bono East', 'Oti'],
  realestate: ['Greater Accra', 'Ashanti', 'Central'],
};

const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];

export const BOOK_TARGET = 10_000_000_000;
export const VOLTA_AGRO: Loan = {
  id: 'GH-200001', borrower: 'Volta Agro Processing Ltd', sector: 'agri', region: 'Volta',
  lat: 6.0985, lon: 0.6006, geoConfidence: 'gps',
  ead: 80_000_000, collateralType: 'plant', collateralValue: 96_000_000,
  maturityYears: 6, pd: 0.025, lgd: 0.35, stage: 1,
  transitionPlan: false, emissionsIntensity: 460, purpose: 'Cassava and grain processing plant expansion',
};

export function generatePortfolio(n = 999, seed = 7): Loan[] {
  const r = rng(seed);
  const loans: Loan[] = [];
  const cum = SECTORS.reduce<number[]>((a, s) => [...a, (a.at(-1) ?? 0) + s.weight], []);
  for (let i = 0; i < n; i++) {
    const u = r() * cum.at(-1)!;
    const sector = SECTORS[cum.findIndex((c) => u <= c)];
    const tilt = REGION_TILT[sector.key];
    const tiltName = tilt && r() < 0.8 ? pick(r, tilt) : null;
    const region = tiltName ? REGIONS.find((x) => x.name === tiltName)! : pick(r, REGIONS);
    const big = r() < 0.04;
    const ead = Math.round((big ? 60e6 + r() * 120e6 : 1.2e6 + Math.exp(r() * 3) * 1e6) / 1000) * 1000;
    const collateralType = pick(r, COLL_BY_SECTOR[sector.key]);
    const cover = collateralType === 'none' ? 0 : 0.5 + r() * 0.9;
    const pd = Math.min(0.2, Math.exp(Math.log(0.003) + r() * 3.2 + sector.transition * 0.5));
    const sr = r();
    const stage: 1 | 2 | 3 = sr < 0.06 ? 3 : pd > 0.04 && sr < 0.45 ? 2 : 1;
    const geo = r();
    loans.push({
      id: `GH-${String(100001 + i)}`,
      borrower: `${pick(r, NAMES)} ${pick(r, SUFFIX[sector.key])}`,
      sector: sector.key, region: region.name,
      lat: +(region.lat + (r() - 0.5) * 0.7).toFixed(4), lon: +(region.lon + (r() - 0.5) * 0.7).toFixed(4),
      geoConfidence: geo < 0.7 ? 'gps' : geo < 0.92 ? 'address' : 'region',
      ead, collateralType, collateralValue: Math.round(ead * cover / 1000) * 1000,
      maturityYears: +(0.5 + r() * (sector.key === 'realestate' || sector.key === 'renew' || sector.key === 'power' ? 14 : 6)).toFixed(1),
      pd: stage === 3 ? 1 : +pd.toFixed(4), lgd: +(collateralType === 'none' ? 0.65 + r() * 0.15 : 0.25 + r() * 0.3).toFixed(3), stage,
      transitionPlan: sector.transition > 0.4 ? r() < 0.3 : r() < 0.15,
      emissionsIntensity: Math.round(sector.carbonIntensity * (0.6 + r() * 0.8)),
      purpose: pick(r, PURPOSE[sector.key]),
    });
  }
  const k = (BOOK_TARGET - VOLTA_AGRO.ead) / loans.reduce((a, l) => a + l.ead, 0);
  loans.forEach((l) => { l.ead = Math.round((l.ead * k) / 1000) * 1000; l.collateralValue = Math.round((l.collateralValue * k) / 1000) * 1000; });
  loans[loans.length - 1].ead += BOOK_TARGET - VOLTA_AGRO.ead - loans.reduce((a, l) => a + l.ead, 0);
  return [...loans, { ...VOLTA_AGRO }];
}

export const COLUMNS: (keyof Loan)[] = ['id', 'borrower', 'sector', 'region', 'lat', 'lon', 'geoConfidence', 'ead', 'collateralType', 'collateralValue', 'maturityYears', 'pd', 'lgd', 'stage', 'transitionPlan', 'emissionsIntensity', 'purpose'];

export function toCsv(loans: Loan[]) {
  const esc = (v: unknown) => (typeof v === 'string' && /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v));
  return [COLUMNS.join(','), ...loans.map((l) => COLUMNS.map((c) => esc(l[c])).join(','))].join('\n');
}

// The demo extract includes a handful of deliberately broken rows so validation has something to catch.
export function demoExtract() {
  const loans = generatePortfolio();
  const rows = toCsv(loans).split('\n');
  const bad = [
    'GH-100002,Duplicate Holdings,trade,Ashanti,6.7,-1.6,gps,5000000,inventory,3000000,3,0.02,0.4,1,false,90,Working capital',
    'GH-900001,Unknown Sector Co.,fintech,Greater Accra,5.6,-0.18,gps,2000000,none,0,2,0.03,0.7,1,false,50,Working capital',
    'GH-900002,Negative Exposure Ltd,manuf,Eastern,6.1,-0.25,gps,-1500000,plant,800000,4,0.02,0.35,1,false,300,Plant expansion',
    'GH-900003,No Location Ltd,realestate,,,,region,9000000,property,12000000,10,0.015,0.3,1,false,140,Commercial property',
    'GH-900004,Bad PD Ltd,agri,Northern,9.4,-0.84,gps,3000000,land,2500000,2,1.7,0.4,1,false,400,Seasonal crop finance',
  ];
  return [...rows, ...bad].join('\n');
}
