import { COLUMNS, Loan } from './portfolio';
import { COLLATERAL, REGIONS, SECTORS } from './params';

export interface Rejection { row: number; id: string; reasons: string[] }

export const VALIDATION_RULES: { code: string; rule: string; field: string; match: RegExp }[] = [
  { code: 'V01', rule: 'Facility id present and unique', field: 'id', match: /facility id/i },
  { code: 'V02', rule: 'Sector is in the sector dictionary', field: 'sector', match: /Unknown sector/ },
  { code: 'V03', rule: 'Region is one of Ghana’s 16 regions', field: 'region', match: /region/i },
  { code: 'V04', rule: 'Exposure (EAD) is a positive amount', field: 'ead', match: /EAD/ },
  { code: 'V05', rule: 'PD is between 0 and 1', field: 'pd', match: /^PD/ },
  { code: 'V06', rule: 'LGD is between 0 and 1', field: 'lgd', match: /^LGD/ },
  { code: 'V07', rule: 'Collateral type is in the dictionary', field: 'collateralType', match: /collateral type/i },
  { code: 'V08', rule: 'Coordinates present and inside Ghana', field: 'lat, lon', match: /Location/ },
];
export interface IngestResult {
  accepted: Loan[]; rejected: Rejection[];
  control: { rowsRead: number; rowsAccepted: number; rowsRejected: number; eadRead: number; eadAccepted: number; eadRejected: number; reconciled: boolean };
  warnings: { geoApproximate: number; noTransitionPlanHighSector: number };
}

const splitCsv = (line: string) => {
  const out: string[] = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch;
  }
  out.push(cur);
  return out;
};

export function ingestCsv(text: string, strict = true): IngestResult {
  const lines = text.trim().split(/\r?\n/);
  const head = splitCsv(lines[0]);
  if (strict && new Set(head).size !== head.length) throw new Error('Duplicate column headings in the CSV.');
  const missingCols = COLUMNS.filter((c) => !head.includes(c));
  if (missingCols.length) throw new Error(`Missing columns: ${missingCols.join(', ')}`);
  const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  const seen = new Set<string>();
  const accepted: Loan[] = [], rejected: Rejection[] = [];
  let eadRead = 0, eadRejected = 0;

  lines.slice(1).forEach((line, i) => {
    const v = splitCsv(line);
    const g = (c: string) => v[idx[c]]?.trim() ?? '';
    const num = (c: string) => Number(g(c));
    const reasons: string[] = [];
    if (strict && v.length !== head.length) reasons.push('Field count differs from header');
    const id = g('id');
    const ead = num('ead');
    eadRead += Number.isFinite(ead) ? ead : 0;

    if (!id) reasons.push('Missing facility id');
    else if (seen.has(id)) reasons.push('Duplicate facility id');
    if (!SECTORS.some((s) => s.key === g('sector'))) reasons.push(`Unknown sector "${g('sector')}"`);
    if (!REGIONS.some((r) => r.name === g('region'))) reasons.push('Missing or unknown region');
    if ((strict && !Number.isFinite(ead)) || !(ead > 0)) reasons.push('Exposure (EAD) must be positive');
    const pd = num('pd'), lgd = num('lgd');
    if (!(pd > 0 && pd <= 1)) reasons.push('PD must be between 0 and 1');
    if ((strict && !g('lgd')) || !(lgd >= 0 && lgd <= 1)) reasons.push('LGD must be between 0 and 1');
    if (!Object.hasOwn(COLLATERAL, g('collateralType'))) reasons.push('Unknown collateral type');
    const lat = num('lat'), lon = num('lon');
    if (!g('lat') || !g('lon') || !(lat > 4.5 && lat < 11.3 && lon > -3.4 && lon < 1.3)) reasons.push('Location outside Ghana or missing');

    if (strict) {
      for (const field of ['collateralValue', 'emissionsIntensity', 'maturityYears']) {
        if (!g(field) || !Number.isFinite(num(field)) || num(field) < 0) reasons.push('Invalid ' + field);
      }
      if (!['1','2','3'].includes(g('stage'))) reasons.push('Invalid IFRS 9 stage');
      if (!['true','false'].includes(g('transitionPlan'))) reasons.push('Invalid transition plan indicator');
      if (!['gps','address','region'].includes(g('geoConfidence'))) reasons.push('Invalid location confidence');
      if (!g('borrower')) reasons.push('Missing borrower name');
    }

    const readSite = (prefix: 'facility' | 'collateral') => {
      const fields = ['Lat', 'Lon', 'Region', 'LocationRef'].map((suffix) => g(prefix + suffix));
      if (fields.every((value) => !value)) return undefined;
      const [latitude, longitude, region, reference] = fields;
      const lat = Number(latitude), lon = Number(longitude);
      if (!latitude || !longitude || !reference || !(lat > 4.5 && lat < 11.3 && lon > -3.4 && lon < 1.3) || !REGIONS.some((r) => r.name === region)) {
        reasons.push(`Location for ${prefix} requires Ghana coordinates, region and a verification reference`);
        return undefined;
      }
      return { lat, lon, region, reference };
    };
    const facilitySite = readSite('facility');
    const collateralSite = readSite('collateral');

    if (reasons.length) { rejected.push({ row: i + 2, id: id || '—', reasons }); eadRejected += Number.isFinite(ead) ? ead : 0; return; }
    seen.add(id);
    accepted.push({
      id, borrowerId: g('borrowerId') || undefined, facilitySite, collateralSite, borrower: g('borrower'), sector: g('sector') as Loan['sector'], region: g('region'), lat, lon,
      geoConfidence: g('geoConfidence') as Loan['geoConfidence'], ead, collateralType: g('collateralType') as Loan['collateralType'],
      collateralValue: num('collateralValue'), maturityYears: num('maturityYears'), pd, lgd, stage: num('stage') as Loan['stage'],
      transitionPlan: g('transitionPlan') === 'true', emissionsIntensity: num('emissionsIntensity'), purpose: g('purpose'),
    });
  });

  const eadAccepted = accepted.reduce((a, l) => a + l.ead, 0);
  return {
    accepted, rejected,
    control: { rowsRead: lines.length - 1, rowsAccepted: accepted.length, rowsRejected: rejected.length, eadRead, eadAccepted, eadRejected, reconciled: Math.abs(eadRead - eadAccepted - eadRejected) < 1 && accepted.length + rejected.length === lines.length - 1 },
    warnings: {
      geoApproximate: accepted.filter((l) => l.geoConfidence !== 'gps').length,
      noTransitionPlanHighSector: accepted.filter((l) => !l.transitionPlan && SECTORS.find((s) => s.key === l.sector)!.transition > 0.5).length,
    },
  };
}
