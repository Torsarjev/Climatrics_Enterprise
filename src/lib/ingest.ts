import { COLUMNS, Loan } from './portfolio';
import { COLLATERAL, REGIONS, SECTORS } from './params';

export interface Rejection { row: number; id: string; reasons: string[] }
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

export function ingestCsv(text: string): IngestResult {
  const lines = text.trim().split(/\r?\n/);
  const head = splitCsv(lines[0]);
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
    const id = g('id');
    const ead = num('ead');
    eadRead += Number.isFinite(ead) ? ead : 0;

    if (!id) reasons.push('Missing facility id');
    else if (seen.has(id)) reasons.push('Duplicate facility id');
    if (!SECTORS.some((s) => s.key === g('sector'))) reasons.push(`Unknown sector "${g('sector')}"`);
    if (!REGIONS.some((r) => r.name === g('region'))) reasons.push('Missing or unknown region');
    if (!(ead > 0)) reasons.push('Exposure (EAD) must be positive');
    const pd = num('pd'), lgd = num('lgd');
    if (!(pd > 0 && pd <= 1)) reasons.push('PD must be between 0 and 1');
    if (!(lgd >= 0 && lgd <= 1)) reasons.push('LGD must be between 0 and 1');
    if (!(g('collateralType') in COLLATERAL)) reasons.push('Unknown collateral type');
    const lat = num('lat'), lon = num('lon');
    if (!g('lat') || !g('lon') || !(lat > 4.5 && lat < 11.3 && lon > -3.4 && lon < 1.3)) reasons.push('Location outside Ghana or missing');

    if (reasons.length) { rejected.push({ row: i + 2, id: id || '—', reasons }); eadRejected += Number.isFinite(ead) ? ead : 0; return; }
    seen.add(id);
    accepted.push({
      id, borrower: g('borrower'), sector: g('sector') as Loan['sector'], region: g('region'), lat, lon,
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
