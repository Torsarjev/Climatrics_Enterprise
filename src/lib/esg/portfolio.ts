import 'server-only';
import { REGIONS } from '../params';
import { physicalScore } from '../engine';
import { ghanaShocks } from '../calibration';
import type { Loan } from '../portfolio';
import { ScreenInput, ScreenResult, screen } from './engine';
import { CRITERIA } from './rules';
import { effectiveInput, type ScreenRunRecord } from '../store';
import { sha256 } from '../math';

const EXCLUSION_QS = ['Q_EX_LABOUR', 'Q_EX_WEAPONS', 'Q_EX_RADIOACTIVE', 'Q_EX_ASBESTOS', 'Q_EX_LOGGING', 'Q_EX_ILLEGAL'];

export function defaultActivity(l: Loan): string {
  const p = l.purpose.toLowerCase();
  if (p.includes('working capital')) return 'general';
  if (l.sector === 'renew') return p.includes('mini-grid') ? 'mini_grid' : p.includes('hydro') ? 'small_hydro' : 'solar_pv';
  return ({ agri: 'crop_production', mining: 'mining', oilgas: 'oil_gas', power: 'thermal_power', manuf: 'manufacturing', constr: 'construction', realestate: 'real_estate', trade: 'trade', transport: 'transport', services: 'general' } as Record<string, string>)[l.sector] ?? 'general';
}

export function facts(l: Loan) {
  const region = REGIONS.find((r) => r.name === l.region);
  return { droughtHazard: region?.hazard.drought ?? null, physical2050: physicalScore(l, ghanaShocks('current', 2050).physical).score };
}

export function defaultInput(l: Loan): ScreenInput {
  return {
    facilityId: l.id, borrower: l.borrower, sector: l.sector, region: l.region, ead: l.ead,
    activities: [{ id: 'A1', code: defaultActivity(l), amount: l.ead }],
    responses: { ...Object.fromEntries(EXCLUSION_QS.map((q) => [q, false])), Q_HAZMAT: ['mining', 'oilgas'].includes(l.sector) ? true : null },
    evidence: {}, facts: facts(l),
  };
}

export function voltaPreset(l: Loan): ScreenInput {
  return {
    facilityId: l.id, borrower: l.borrower, sector: l.sector, region: l.region, ead: l.ead,
    activities: [{ id: 'A1', code: 'solar_pv', amount: 20_000_000 }, { id: 'A2', code: 'agro_processing', amount: l.ead - 20_000_000 }],
    responses: { ...Object.fromEntries(EXCLUSION_QS.map((q) => [q, false])), Q_PERMIT: false, Q_WATER_STRESS: true, Q_WASTEWATER: true, Q_HAZMAT: false, Q_OHS: true, Q_LAND: false, Q_PROTECTED: false, Q_COMMUNITY: false, Q_SOLAR_GRID: true },
    evidence: { EV_SOLAR_TECH: { status: 'missing' }, EV_EPA_PERMIT: { status: 'missing' }, EV_WASTEWATER: { status: 'missing' } },
    facts: facts(l),
  };
}

type Bucket = { n: number; ead: number };
const add = (b: Bucket, ead: number) => { b.n += 1; b.ead += ead; };

export async function portfolioScreening(loans: Loan[], runs: ScreenRunRecord[], datasetId: string) {
  const latest = new Map<string, ScreenRunRecord>();
  const approved = new Map<string, ScreenRunRecord>();
  [...runs].reverse().forEach((r) => { latest.set(r.facilityId, r); if (r.status === 'approved') approved.set(r.facilityId, r); });

  const gate = { pass: { n: 0, ead: 0 }, review: { n: 0, ead: 0 }, excluded: { n: 0, ead: 0 } } as Record<string, Bucket>;
  const tier = { High: { n: 0, ead: 0 }, Medium: { n: 0, ead: 0 }, Low: { n: 0, ead: 0 } } as Record<string, Bucket>;
  const tax = { aligned: 0, pending: 0, 'not aligned': 0, unassessed: 0 } as Record<string, number>;
  const ndcProg = new Map<string, { programme: string; objective: string; potential: number; verified: number; facilities: Set<string> }>();
  const sdgTarget = new Map<string, { exposure: number; facilities: Set<string> }>();
  const adverse = new Map<string, { title: string; exposure: number; n: number }>();
  let ndcTotal = 0, sdgTotal = 0, screenedByAnalyst = 0;
  const alignedFrom: { facilityId: string; runId: string; amount: number }[] = [];

  for (const l of loans) {
    const run = approved.get(l.id) ?? latest.get(l.id);
    if (run) screenedByAnalyst += 1;
    const input = run ? effectiveInput(run) : defaultInput(l);
    const r: ScreenResult = screen(input);
    add(gate[r.esms.gate], l.ead); add(tier[r.esms.tier], l.ead);
    const isApproved = run?.status === 'approved';
    for (const t of r.taxonomy) {
      if (t.status === 'aligned' && isApproved) { tax.aligned += t.amount; alignedFrom.push({ facilityId: l.id, runId: run!.id, amount: t.amount }); }
      else if (t.status === 'aligned' || t.status === 'eligible pending') tax.pending += t.amount;
      else tax[t.status] += t.amount;
    }
    tax.unassessed += r.validation.unallocated;
    let ndcFacility = 0;
    for (const n of r.ndc) {
      if (!n.programmes.length) continue;
      ndcFacility += n.amount;
      for (const p of n.programmes) {
        const e = ndcProg.get(p.id) ?? { programme: p.programme, objective: p.objective, potential: 0, verified: 0, facilities: new Set<string>() };
        if (n.status === 'verified contribution' && isApproved) e.verified += n.amount; else e.potential += n.amount;
        e.facilities.add(l.id); ndcProg.set(p.id, e);
      }
    }
    ndcTotal += ndcFacility;
    let sdgFacility = 0;
    for (const c of r.sdg.contributions) {
      if (!c.targets.length) continue;
      sdgFacility += c.amount;
      for (const t of new Set(c.targets)) { const e = sdgTarget.get(t) ?? { exposure: 0, facilities: new Set<string>() }; e.exposure += c.amount; e.facilities.add(l.id); sdgTarget.set(t, e); }
    }
    sdgTotal += sdgFacility;
    for (const a of r.sdg.adverse) { const e = adverse.get(a.target) ?? { title: a.title, exposure: 0, n: 0 }; e.exposure += l.ead; e.n += 1; adverse.set(a.target, e); }
  }

  const ead = loans.reduce((a, l) => a + l.ead, 0);
  return {
    ead, facilities: loans.length, screenedByAnalyst,
    fingerprint: (await sha256(JSON.stringify({ datasetId, rules: CRITERIA.map((c) => c.id), runs: [...approved.values()].map((r) => r.id) }))).slice(0, 16),
    gate, tier, tax, alignedRatio: tax.aligned / ead, alignedFrom,
    ndc: [...ndcProg.entries()].map(([id, v]) => ({ id, programme: v.programme, objective: v.objective, potential: v.potential, verified: v.verified, facilities: v.facilities.size })),
    ndcTotal, sdg: [...sdgTarget.entries()].map(([t, v]) => ({ target: t, exposure: v.exposure, facilities: v.facilities.size })).sort((a, b) => b.exposure - a.exposure), sdgTotal,
    adverse: [...adverse.entries()].map(([t, v]) => ({ target: t, ...v })),
  };
}
