import 'server-only';
import type { Loan } from '../portfolio';
import { ScreenInput, screen, type ManagementAction } from './engine';
import { FRAMEWORK_VERSIONS } from './rules';
import { activeLoans, audit, currentUser, effectiveInput, rulesHash, screeningFacts, screenRuns, type ScreenRunRecord } from '../store';
import { sha256 } from '../math';
import { readText, writeText } from '../kv';

const EXCLUSION_QS = ['Q_EX_LABOUR', 'Q_EX_WEAPONS', 'Q_EX_ASBESTOS', 'Q_EX_LOGGING', 'Q_EX_ILLEGAL'];

export function defaultActivity(l: Loan): string {
  const p = l.purpose.toLowerCase();
  if (p.includes('working capital')) return 'general';
  if (l.sector === 'renew') return p.includes('mini-grid') ? 'mini_grid' : p.includes('hydro') ? 'small_hydro' : 'solar_pv';
  return ({ agri: 'crop_production', mining: 'mining', oilgas: 'oil_gas', power: 'thermal_power', manuf: 'manufacturing', constr: 'construction', realestate: 'real_estate', trade: 'trade', transport: 'transport', services: 'general' } as Record<string, string>)[l.sector] ?? 'general';
}

export function defaultInput(l: Loan): ScreenInput {
  return {
    facilityId: l.id, borrower: l.borrower, sector: l.sector, region: l.region, ead: l.ead,
    activities: l.ead > 0 ? [{ id: 'A1', code: defaultActivity(l), amount: l.ead }] : [],
    responses: {},
    evidence: {}, facts: screeningFacts(l), site: { latitude: l.lat, longitude: l.lon, purpose: l.purpose },
  };
}

export function voltaPreset(l: Loan): ScreenInput {
  return {
    facilityId: l.id, borrower: l.borrower, sector: l.sector, region: l.region, ead: l.ead,
    activities: [{ id: 'A1', code: 'solar_pv', amount: 20_000_000 }, { id: 'A2', code: 'agro_processing', amount: l.ead - 20_000_000 }],
    responses: { ...Object.fromEntries(EXCLUSION_QS.map((q) => [q, false])), Q_PERMIT: false, Q_WATER_STRESS: true, Q_WASTEWATER: true, Q_HAZMAT: false, Q_OHS: true, Q_LAND: false, Q_PROTECTED: false, Q_COMMUNITY: false, Q_SOLAR_GRID: true },
    evidence: { 'A1:EV_SOLAR_TECH': { status: 'missing' }, EV_EPA_PERMIT: { status: 'missing' }, EV_WASTEWATER: { status: 'missing' } },
    facts: screeningFacts(l), site: { latitude: l.lat, longitude: l.lon, purpose: l.purpose },
  };
}

type Bucket = { n: number; ead: number };
const add = (b: Bucket, ead: number) => { b.n += 1; b.ead += ead; };

export async function portfolioScreening(loans: Loan[], runs: ScreenRunRecord[], datasetId: string) {
  const latest = new Map<string, ScreenRunRecord>();
  const catalogHash = await rulesHash();
  for (const run of runs) {
    if ((!run.datasetId || run.datasetId === datasetId) && !latest.has(run.facilityId)) latest.set(run.facilityId, run);
  }

  const gate = { pass: { n: 0, ead: 0 }, review: { n: 0, ead: 0 }, excluded: { n: 0, ead: 0 } } as Record<string, Bucket>;
  const tier = { High: { n: 0, ead: 0 }, Medium: { n: 0, ead: 0 }, Low: { n: 0, ead: 0 }, Unassessed: { n: 0, ead: 0 } } as Record<string, Bucket>;
  const tax = { aligned: 0, pending: 0, 'not aligned': 0, unassessed: 0 } as Record<string, number>;
  const ndcProg = new Map<string, { programme: string; objective: string; potential: number; verified: number; facilities: Set<string> }>();
  const sdgTarget = new Map<string, { potential: number; evidenced: number; facilities: Set<string> }>();
  const adverse = new Map<string, { title: string; exposure: number; n: number }>();
  let ndcTotal = 0, sdgTotal = 0, screenedByAnalyst = 0;
  const actions = new Map<string, ManagementAction & Bucket>();
  const decisions = new Map<string, { label: string } & Bucket>();
  const facilities: { facilityId: string; borrower: string; runId?: string; ead: number; decision: string; actionCodes: string[] }[] = [];
  const priority = (code: string) => {
    const order = ['exclusion-hit', 'enhanced-due-diligence', 'exclusion-review'];
    const rank = order.indexOf(code);
    return rank === -1 ? order.length : rank;
  };
  const fingerprintInputs: unknown[] = [];
  const alignedFrom: { facilityId: string; runId: string; activityId: string; amount: number }[] = [];

  for (const l of loans) {
    const stored = latest.get(l.id);
    const run = stored && (stored.datasetId ? stored.datasetId === datasetId : stored.input.borrower === l.borrower && stored.input.ead === l.ead && stored.input.sector === l.sector && stored.input.region === l.region) ? stored : undefined;
    if (run) screenedByAnalyst += 1;
    const input = run ? effectiveInput(run) : defaultInput(l);
    const r = screen(input);
    fingerprintInputs.push({ input, run: run ? { id: run.id, status: run.status } : null });
    add(gate[r.esms.gate], l.ead); add(tier[r.esms.tier], l.ead);
    const isApproved = run?.status === 'approved' && run.rulesHash === catalogHash && r.validation.ok && r.esms.gate === 'pass';
    const decision = decisions.get(r.decision.code) ?? { label: r.decision.label, n: 0, ead: 0 };
    add(decision, l.ead);
    decisions.set(r.decision.code, decision);
    const facilityActions = [...r.actions];
    if (!isApproved && r.taxonomy.some((t) => t.status === 'aligned')) {
      facilityActions.push({ code: 'taxonomy-review', owner: 'Credit Risk', text: 'Obtain independent review under the current rule set before reporting aligned exposure', rules: ['TX-ELIG'] });
    }
    for (const action of facilityActions) {
      const row = actions.get(action.code) ?? { ...action, n: 0, ead: 0 };
      row.rules = [...new Set([...row.rules, ...action.rules])];
      add(row, l.ead);
      actions.set(action.code, row);
    }
    facilities.push({ facilityId: l.id, borrower: l.borrower, runId: run?.id, ead: l.ead, decision: r.decision.label, actionCodes: facilityActions.map((a) => a.code) });
    if (!r.validation.ok) {
      tax.unassessed += l.ead;
      continue;
    }
    for (const t of r.taxonomy) {
      if (t.status === 'aligned' && isApproved) { tax.aligned += t.amount; alignedFrom.push({ facilityId: l.id, runId: run!.id, activityId: t.activityId, amount: t.amount }); }
      else if (t.status === 'aligned' || t.status === 'eligible pending') tax.pending += t.amount;
      else tax[t.status] += t.amount;
    }
    tax.unassessed += r.validation.unallocated;
    let ndcFacility = 0;
    for (const n of r.ndc) {
      if (!n.programmes.length) continue;
      ndcFacility += n.amount;
      for (const p of new Map(n.programmes.map((programme) => [programme.id, programme])).values()) {
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
      for (const t of new Set(c.targets)) {
        const e = sdgTarget.get(t) ?? { potential: 0, evidenced: 0, facilities: new Set<string>() };
        if (c.status === 'evidenced' && isApproved) e.evidenced += c.amount; else e.potential += c.amount;
        e.facilities.add(l.id);
        sdgTarget.set(t, e);
      }
    }
    sdgTotal += sdgFacility;
    for (const a of new Map(r.sdg.adverse.map((flag) => [flag.target, flag])).values()) { const e = adverse.get(a.target) ?? { title: a.title, exposure: 0, n: 0 }; e.exposure += l.ead; e.n += 1; adverse.set(a.target, e); }
  }

  const ead = loans.reduce((a, l) => a + l.ead, 0);
  return {
    ead, facilities: loans.length, screenedByAnalyst,
    fingerprint: await sha256(JSON.stringify({ datasetId, catalogHash, facilities: fingerprintInputs })),
    datasetId, versions: FRAMEWORK_VERSIONS,
    decisions: [...decisions].map(([code, value]) => ({ code, ...value })),
    actions: [...actions.values()].sort((a, b) => priority(a.code) - priority(b.code) || b.ead - a.ead),
    facilityResults: facilities.sort((a, b) => b.ead - a.ead),
    gate, tier, tax, alignedRatio: ead ? tax.aligned / ead : 0, alignedFrom,
    ndc: [...ndcProg.entries()].map(([id, v]) => ({ id, programme: v.programme, objective: v.objective, potential: v.potential, verified: v.verified, facilities: v.facilities.size })),
    ndcTotal, sdg: [...sdgTarget.entries()].map(([t, v]) => ({ target: t, exposure: v.potential + v.evidenced, potential: v.potential, evidenced: v.evidenced, facilities: v.facilities.size })).sort((a, b) => b.exposure - a.exposure), sdgTotal,
    adverse: [...adverse.entries()].map(([t, v]) => ({ target: t, ...v })),
  };
}

export async function currentPortfolioScreening() {
  const { dataset, loans } = await activeLoans();
  return portfolioScreening(loans, await screenRuns(), dataset.id);
}

type PortfolioSnapshot = { id: string; createdAt: string; by: string; report: Awaited<ReturnType<typeof portfolioScreening>> };

export async function getPortfolioScreening(id: string): Promise<PortfolioSnapshot | null> {
  if (!/^PS-[a-f0-9]{32}$/.test(id)) return null;
  const saved = await readText(`screening-${id}.json`);
  return saved ? JSON.parse(saved) : null;
}

export async function savePortfolioScreening() {
  const user = await currentUser();
  if (!user.can.includes('run' as never)) throw new Error('Only an analyst can save a portfolio screening');
  const report = await currentPortfolioScreening();
  const id = `PS-${report.fingerprint.slice(0, 32)}`;
  if (await getPortfolioScreening(id)) return id;
  const snapshot: PortfolioSnapshot = { id, createdAt: new Date().toISOString(), by: user.name, report };
  await writeText(`screening-${id}.json`, JSON.stringify(snapshot));
  await audit(user.name, 'screening.portfolio_saved', id, report.datasetId);
  return id;
}
