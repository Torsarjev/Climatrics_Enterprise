import { ACTIVITIES, CRITERIA, Cond, Criterion, EVIDENCE, FRAMEWORK_VERSIONS, Framework, QUESTIONS } from './rules';

export type Tri = boolean | null;
export type Outcome = 'pass' | 'fail' | 'unknown' | 'na';
export type EvidenceStatus = 'missing' | 'provided' | 'verified';

export interface Activity { id: string; code: string; amount: number }
export interface ScreenInput {
  facilityId: string; borrower: string; sector: string; region: string; ead: number;
  activities: Activity[];
  responses: Record<string, boolean | null>;
  evidence: Record<string, { status: EvidenceStatus; ref?: string }>;
  facts: { droughtHazard: number | null; physical2050: number | null };
}

export interface CriterionResult { id: string; framework: Framework; kind: string; title: string; source: string; ref: string; activityId?: string; outcome: Outcome; reason: string }

const RANK: Record<EvidenceStatus, number> = { missing: 0, provided: 1, verified: 2 };

interface Ctx { input: ScreenInput; activity?: Activity; gate?: 'pass' | 'review' | 'excluded'; facilityResults?: Map<string, Outcome> }

function evalCond(c: Cond, x: Ctx): Tri {
  if ('q' in c) { const r = x.input.responses[c.q]; return r == null ? null : r === c.eq; }
  if ('fact' in c) {
    const v = x.input.facts[c.fact as keyof ScreenInput['facts']];
    if (v == null) return null;
    if (c.gte != null) return v >= c.gte;
    if (c.lt != null) return v < c.lt;
    return null;
  }
  if ('activity' in c) return x.activity ? c.activity.includes(x.activity.code) : false;
  if ('sector' in c) return c.sector.includes(x.input.sector);
  if ('evidence' in c) return RANK[x.input.evidence[c.evidence]?.status ?? 'missing'] >= RANK[c.atLeast];
  if ('exclusionGate' in c) return x.gate === 'pass' ? true : x.gate === 'excluded' ? false : null;
  if ('criterionNotFailed' in c) {
    const os = c.criterionNotFailed.map((id) => x.facilityResults?.get(id) ?? 'na');
    if (os.includes('fail')) return false;
    return os.includes('unknown') ? null : true;
  }
  if ('all' in c) { const vs = c.all.map((k) => evalCond(k, x)); return vs.includes(false) ? false : vs.includes(null) ? null : true; }
  if ('any' in c) { const vs = c.any.map((k) => evalCond(k, x)); return vs.includes(true) ? true : vs.includes(null) ? null : false; }
  if ('not' in c) { const v = evalCond(c.not, x); return v == null ? null : !v; }
  return null;
}

function judge(cr: Criterion, x: Ctx): { outcome: Outcome; reason: string } {
  if (cr.appliesWhen) {
    const a = evalCond(cr.appliesWhen, x);
    if (a === false) return { outcome: 'na', reason: 'Not applicable to this sector or activity' };
    if (a === null) return { outcome: 'unknown', reason: 'Applicability cannot be determined from the data provided' };
  }
  const fail = cr.failWhen ? evalCond(cr.failWhen, x) : false;
  if (fail === true) return { outcome: 'fail', reason: cr.action ?? (cr.kind === 'eligibility' ? 'Activity is not listed in the taxonomy' : cr.kind === 'adverse' ? 'Adverse impact flagged from the questionnaire' : 'Criterion not met') };
  const pass = evalCond(cr.passWhen, x);
  if (pass === true) return { outcome: 'pass', reason: 'Criterion met' };
  const ev = cr.evidence && RANK[x.input.evidence[cr.evidence]?.status ?? 'missing'] < 2 ? `Evidence ${x.input.evidence[cr.evidence]?.status ?? 'missing'}: ${EVIDENCE[cr.evidence]}` : null;
  const qs = (cr.questions ?? []).filter((q) => x.input.responses[q] == null);
  return { outcome: 'unknown', reason: ev ?? (qs.length ? `Unanswered: ${qs.map((q) => QUESTIONS.find((k) => k.id === q)?.text).join('; ')}` : 'Insufficient information') };
}

export function validate(input: ScreenInput) {
  const errors: string[] = [];
  const total = input.activities.reduce((a, b) => a + b.amount, 0);
  if (input.activities.some((a) => !(a.amount > 0))) errors.push('Every activity allocation must be a positive amount');
  if (total > input.ead + 1) errors.push(`Allocation overflow: activities total GHS ${(total / 1e6).toFixed(1)}m but the facility outstanding is GHS ${(input.ead / 1e6).toFixed(1)}m`);
  input.activities.forEach((a) => { if (!ACTIVITIES[a.code]) errors.push(`Unknown activity code ${a.code}`); });
  return { ok: errors.length === 0, errors, allocated: total, unallocated: Math.max(0, input.ead - total) };
}

export function screen(input: ScreenInput) {
  const v = validate(input);
  const results: CriterionResult[] = [];
  const push = (cr: Criterion, x: Ctx) => { const j = judge(cr, x); results.push({ id: cr.id, framework: cr.framework, kind: cr.kind, title: cr.title, source: cr.source, ref: cr.ref, activityId: x.activity?.id, ...j }); return j.outcome; };

  // 1. exclusion gate
  const base: Ctx = { input };
  const exOutcomes = CRITERIA.filter((c) => c.framework === 'ESMS' && c.kind === 'exclusion').map((c) => push(c, base));
  const gate: 'pass' | 'review' | 'excluded' = exOutcomes.includes('fail') ? 'excluded' : exOutcomes.includes('unknown') ? 'review' : 'pass';

  // 2. facility-level criteria
  const facilityResults = new Map<string, Outcome>(results.map((r) => [r.id, r.outcome]));
  CRITERIA.filter((c) => c.scope === 'facility' && c.kind !== 'exclusion').forEach((c) => facilityResults.set(c.id, push(c, { input, gate })));

  // 3. activity-level criteria
  for (const a of input.activities) CRITERIA.filter((c) => c.scope === 'activity').forEach((c) => push(c, { input, activity: a, gate, facilityResults }));

  const of = (fw: Framework, act?: string) => results.filter((r) => r.framework === fw && (act === undefined || r.activityId === act));
  const crit = (id: string) => CRITERIA.find((c) => c.id === id)!;

  // ESMS
  const risk = of('ESMS').filter((r) => r.kind === 'risk');
  const failed = risk.filter((r) => r.outcome === 'fail');
  const tier: 'High' | 'Medium' | 'Low' = failed.some((r) => crit(r.id).severity === 'high') ? 'High' : failed.length ? 'Medium' : 'Low';
  const esms = {
    gate, tier,
    actions: [...(gate === 'excluded' ? ['Exclusion hit: credit progression blocked'] : []), ...failed.map((r) => crit(r.id).action!)],
    gaps: of('ESMS').filter((r) => r.outcome === 'unknown').map((r) => `${r.title}: ${r.reason}`),
  };

  // NDC, Taxonomy, SDG per activity
  const evOk = (a: Activity) => { const e = ACTIVITIES[a.code]?.evidence; return !!e && input.evidence[e]?.status === 'verified'; };
  const ndc = input.activities.map((a) => {
    const m = of('NDC', a.id).filter((r) => r.outcome === 'pass').map((r) => crit(r.id));
    return { activityId: a.id, code: a.code, amount: a.amount, programmes: m.map((c) => ({ id: c.id, programme: c.programme!, objective: c.objective! })), status: !m.length ? 'no match' : evOk(a) ? 'verified contribution' : 'potential contribution' };
  });
  const taxonomy = input.activities.map((a) => {
    const rs = of('TAXONOMY', a.id).filter((r) => r.outcome !== 'na');
    const elig = rs.find((r) => r.id === 'TX-ELIG')!;
    const rest = rs.filter((r) => r.id !== 'TX-ELIG');
    const status: 'aligned' | 'eligible pending' | 'not aligned' | 'unassessed' =
      elig.outcome === 'fail' ? 'not aligned' : elig.outcome === 'unknown' ? 'unassessed'
        : rest.some((r) => r.outcome === 'fail') ? 'not aligned' : rest.some((r) => r.outcome === 'unknown') ? 'eligible pending' : 'aligned';
    return { activityId: a.id, code: a.code, amount: a.amount, status, reasons: rs.filter((r) => r.outcome !== 'pass').map((r) => `${r.title}: ${r.reason}`) };
  });
  const sdg = {
    contributions: input.activities.map((a) => ({ activityId: a.id, code: a.code, amount: a.amount, targets: of('SDG', a.id).filter((r) => r.kind === 'contribution' && r.outcome === 'pass').map((r) => crit(r.id).target!), status: evOk(a) ? 'evidenced' : 'potential' })),
    adverse: of('SDG').filter((r) => r.kind === 'adverse' && r.outcome === 'fail').map((r) => ({ target: crit(r.id).target!, title: r.title })),
    adverseUnknown: of('SDG').filter((r) => r.kind === 'adverse' && r.outcome === 'unknown').map((r) => crit(r.id).target!),
  };

  const decision = gate === 'excluded' ? { label: 'Blocked: exclusion-list hit', tone: 'red' as const }
    : gate === 'review' ? { label: 'Manual review: exclusion status uncertain', tone: 'amber' as const }
      : tier === 'High' ? { label: 'Refer for enhanced due diligence (high ESMS risk)', tone: 'red' as const }
        : tier === 'Medium' ? { label: 'Proceed with ESMS conditions', tone: 'amber' as const } : { label: 'Standard process', tone: 'green' as const };

  const evidenceGaps = [...new Set(results.filter((r) => r.outcome === 'unknown' && r.reason.startsWith('Evidence')).map((r) => r.reason))];
  return { validation: v, results, esms, ndc, taxonomy, sdg, decision, evidenceGaps };
}

export type ScreenResult = ReturnType<typeof screen>;

export const visibleQuestions = (input: Pick<ScreenInput, 'sector' | 'activities' | 'responses' | 'evidence' | 'facts'>) =>
  QUESTIONS.filter((q) => {
    if (!q.showWhen) return true;
    const x: Ctx = { input: { ...input, facilityId: '', borrower: '', region: '', ead: 0 } as ScreenInput };
    if ('activity' in q.showWhen) return input.activities.some((a) => q.showWhen && 'activity' in q.showWhen && q.showWhen.activity.includes(a.code));
    return evalCond(q.showWhen, x) === true;
  });

export const neededEvidence = (input: Pick<ScreenInput, 'sector' | 'activities'>) => {
  const ids = new Set<string>();
  input.activities.forEach((a) => { const e = ACTIVITIES[a.code]?.evidence; if (e) ids.add(e); });
  if (['agri', 'mining', 'oilgas', 'power', 'manuf', 'constr', 'renew'].includes(input.sector)) ids.add('EV_EPA_PERMIT');
  if (['agri', 'mining', 'manuf', 'oilgas'].includes(input.sector)) ids.add('EV_WASTEWATER');
  return [...ids];
};

export const RULESET = { frameworks: FRAMEWORK_VERSIONS, criteria: CRITERIA.length, questions: QUESTIONS.length };
