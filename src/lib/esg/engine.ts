import { ACTIVITIES, CRITERIA, Cond, Criterion, EVIDENCE, FRAMEWORK_VERSIONS, Framework, QUESTIONS } from './rules';

export type Tri = boolean | null;
export type Outcome = 'pass' | 'fail' | 'unknown' | 'na';
export type EvidenceStatus = 'missing' | 'provided' | 'verified';

export interface Activity { id: string; code: string; amount: number; efficiencyGainPct?: number | null }
export interface ScreenInput {
  transitionRiskScore?: number;
  facilityId: string; borrower: string; sector: string; region: string; ead: number;
  activities: Activity[];
  responses: Record<string, boolean | null>;
  evidence: Record<string, { status: EvidenceStatus; ref?: string; date?: string }>;
  site?: { latitude: number | null; longitude: number | null; purpose: string };
  facts: { droughtHazard: number | null; physical2050: number | null };
}

export interface CriterionResult { evidenceId?: string; id: string; framework: Framework; kind: string; title: string; source: string; ref: string; activityId?: string; outcome: Outcome; reason: string }

const RANK: Record<EvidenceStatus, number> = { missing: 0, provided: 1, verified: 2 };

export function activityEvidenceId(activityId: string, evidenceId: string) {
  return `${activityId}:${evidenceId}`;
}

export function evidenceLabel(id: string) {
  const [activityId, evidenceId] = id.split(':');
  return evidenceId ? `${activityId} · ${EVIDENCE[evidenceId] ?? evidenceId}` : EVIDENCE[id] ?? id;
}

function criterionEvidenceId(input: Pick<ScreenInput, 'activities' | 'evidence'>, evidenceId: string, activity?: Activity) {
  if (!activity || ACTIVITIES[activity.code]?.evidence !== evidenceId) return evidenceId;
  const scopedId = activityEvidenceId(activity.id, evidenceId);
  if (input.evidence[scopedId] || input.activities.filter((a) => ACTIVITIES[a.code]?.evidence === evidenceId).length !== 1 || !input.evidence[evidenceId]) return scopedId;
  return evidenceId;
}

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
  if ('efficiencyGainPct' in c) {
    const measured = x.activity?.efficiencyGainPct;
    if (measured == null) return null;
    const { gte, lt } = c.efficiencyGainPct;
    return gte != null ? measured >= gte : lt != null ? measured < lt : null;
  }
  if ('activity' in c) return x.activity ? c.activity.includes(x.activity.code) : false;
  if ('sector' in c) return c.sector.includes(x.input.sector);
  if ('evidence' in c) return RANK[x.input.evidence[criterionEvidenceId(x.input, c.evidence, x.activity)]?.status ?? 'missing'] >= RANK[c.atLeast];
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
  const evidenceId = cr.evidence && criterionEvidenceId(x.input, cr.evidence, x.activity);
  const status = evidenceId ? x.input.evidence[evidenceId]?.status ?? 'missing' : 'missing';
  const ev = evidenceId && status !== 'verified' ? `Evidence ${status}: ${evidenceLabel(evidenceId)}` : null;
  if (cr.id === 'TX-EE-TECH' && x.activity?.efficiencyGainPct == null) return { outcome: 'unknown', reason: 'Energy savings percentage is missing' };
  const qs = (cr.questions ?? []).filter((q) => x.input.responses[q] == null);
  return { outcome: 'unknown', reason: ev ?? (qs.length ? `Unanswered: ${qs.map((q) => QUESTIONS.find((k) => k.id === q)?.text).join('; ')}` : 'Insufficient information') };
}

export function validate(input: ScreenInput) {
  const errors: string[] = [];
  const total = input.activities.reduce((a, b) => a + b.amount, 0);
  if (input.transitionRiskScore !== undefined && (!Number.isFinite(input.transitionRiskScore) || input.transitionRiskScore < 1 || input.transitionRiskScore > 5)) errors.push('Transition risk score must be between 1 and 5');
  if (!Number.isFinite(input.ead) || input.ead < 0) errors.push('Facility outstanding must be a finite non-negative amount');
  if (input.activities.some((a) => !Number.isFinite(a.amount) || !(a.amount > 0))) errors.push('Every activity allocation must be a positive amount');
  if (new Set(input.activities.map((a) => a.id)).size !== input.activities.length || input.activities.some((a) => !/^[a-zA-Z0-9_-]+$/.test(a.id))) errors.push('Activity IDs must be unique and use letters, digits, hyphens or underscores');
  if (input.activities.some((a) => a.efficiencyGainPct != null && (!Number.isFinite(a.efficiencyGainPct) || a.efficiencyGainPct < 0 || a.efficiencyGainPct > 100))) errors.push('Energy savings must be between 0 and 100 percent');
  if (total > input.ead) errors.push(`Allocation overflow: activities total GHS ${(total / 1e6).toFixed(1)}m but the facility outstanding is GHS ${(input.ead / 1e6).toFixed(1)}m`);
  input.activities.forEach((a) => { if (!Object.hasOwn(ACTIVITIES, a.code)) errors.push(`Unknown activity code ${a.code}`); });
  return { ok: errors.length === 0, errors, allocated: total, unallocated: Math.max(0, input.ead - total) };
}

export function screen(input: ScreenInput) {
  const v = validate(input);
  const results: CriterionResult[] = [];
  const push = (cr: Criterion, x: Ctx) => { const j = judge(cr, x); results.push({ id: cr.id, framework: cr.framework, kind: cr.kind, title: cr.title, source: cr.source, ref: cr.ref, activityId: x.activity?.id, evidenceId: cr.evidence && criterionEvidenceId(input, cr.evidence, x.activity), ...j }); return j.outcome; };

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
  const tier = failed.some((r) => crit(r.id).severity === 'high') ? 'High' as const
    : risk.some((r) => r.outcome === 'unknown') ? 'Unassessed' as const
      : failed.length ? 'Medium' as const : 'Low' as const;
  const esms = {
    gate, tier,
    actions: [...(gate === 'excluded' ? ['Exclusion hit: credit progression blocked'] : []), ...failed.map((r) => crit(r.id).action!)],
    gaps: of('ESMS').filter((r) => r.outcome === 'unknown').map((r) => `${r.title}: ${r.reason}`),
  };

  // NDC, Taxonomy, SDG per activity
  const evOk = (a: Activity) => { const e = ACTIVITIES[a.code]?.evidence; return !!e && input.evidence[criterionEvidenceId(input, e, a)]?.status === 'verified'; };
  const ndc = input.activities.map((a) => {
    const m = [...new Set(of('NDC', a.id).filter((r) => r.outcome === 'pass').map((r) => r.id))].map(crit);
    return { activityId: a.id, code: a.code, amount: a.amount, programmes: m.map((c) => ({ id: c.id, programme: c.programme!, objective: c.objective! })), status: !m.length ? 'not aligned' : evOk(a) ? 'verified contribution' : 'potential contribution' };
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
    contributions: input.activities.map((a) => ({ activityId: a.id, code: a.code, amount: a.amount, targets: [...new Set(of('SDG', a.id).filter((r) => r.kind === 'contribution' && r.outcome === 'pass').map((r) => crit(r.id).target!))], status: evOk(a) ? 'evidenced' : 'potential' })),
    adverse: of('SDG').filter((r) => r.kind === 'adverse' && r.outcome === 'fail').map((r) => ({ target: crit(r.id).target!, title: r.title })),
    adverseUnknown: of('SDG').filter((r) => r.kind === 'adverse' && r.outcome === 'unknown').map((r) => crit(r.id).target!),
  };

  const decision = !v.ok ? { code: 'invalid', label: 'Correct the facility data before screening', tone: 'red' as const }
    : gate === 'excluded' ? { code: 'blocked', label: 'Blocked by the exclusion gate', tone: 'red' as const }
      : gate === 'review' ? { code: 'review', label: 'Manual review required for uncertain exclusions', tone: 'amber' as const }
        : tier === 'High' ? { code: 'edd', label: 'Refer for enhanced due diligence', tone: 'red' as const }
          : tier === 'Unassessed' ? { code: 'incomplete', label: 'Complete the ESMS assessment before progressing', tone: 'amber' as const }
            : tier === 'Medium' ? { code: 'conditions', label: 'Proceed with ESMS conditions', tone: 'amber' as const }
              : { code: 'standard', label: 'Standard credit process', tone: 'green' as const };

  const actions: ManagementAction[] = [];
  if (gate === 'excluded') actions.push({ code: 'exclusion-hit', owner: 'Credit Risk', text: 'Block credit progression and document the exclusion decision', rules: of('ESMS').filter((r) => r.kind === 'exclusion' && r.outcome === 'fail').map((r) => r.id) });
  if (gate === 'review') actions.push({ code: 'exclusion-review', owner: 'Relationship Management', text: 'Confirm missing exclusion answers with the borrower', rules: of('ESMS').filter((r) => r.kind === 'exclusion' && r.outcome === 'unknown').map((r) => r.id) });
  if (tier === 'High') actions.push({ code: 'enhanced-due-diligence', owner: 'ESMS', text: 'Refer for enhanced due diligence before credit progression', rules: failed.filter((r) => crit(r.id).severity === 'high').map((r) => r.id) });
  for (const finding of failed) {
    actions.push({ code: finding.id, owner: 'ESMS', text: crit(finding.id).action!, rules: [finding.id] });
  }
  const unknownRisk = risk.filter((r) => r.outcome === 'unknown');
  if (unknownRisk.length) actions.push({ code: 'esms-gaps', owner: 'Relationship Management', text: 'Complete missing ESMS answers and obtain supporting evidence', rules: unknownRisk.map((r) => r.id) });
  const taxonomyGaps = of('TAXONOMY').filter((r) => r.kind !== 'eligibility' && r.outcome === 'unknown');
  if (taxonomy.some((t) => t.status === 'eligible pending')) actions.push({ code: 'taxonomy-evidence', owner: 'Sustainable Finance', text: 'Resolve taxonomy criteria and verify evidence before reporting aligned exposure', rules: [...new Set(taxonomyGaps.map((r) => r.id))] });
  const failedTechnical = of('TAXONOMY').filter((r) => r.kind === 'technical' && r.outcome === 'fail');
  if (failedTechnical.length) actions.push({ code: 'taxonomy-technical-failure', owner: 'Sustainable Finance', text: 'Record failed technical criteria and withhold the aligned classification', rules: [...new Set(failedTechnical.map((r) => r.id))] });
  const noUseOfProceeds = taxonomy.filter((t) => t.status === 'unassessed');
  if (v.unallocated || noUseOfProceeds.length) actions.push({ code: 'use-of-proceeds', owner: 'Relationship Management', text: 'Confirm and allocate outstanding exposure to financed activities', rules: ['TX-ELIG'] });
  if (ndc.some((n) => n.status === 'potential contribution') || sdg.contributions.some((c) => c.targets.length && c.status === 'potential')) {
    actions.push({ code: 'contribution-evidence', owner: 'Sustainable Finance', text: 'Collect evidence for potential NDC and SDG contributions', rules: [...new Set(results.filter((r) => (r.kind === 'match' || r.kind === 'contribution') && r.outcome === 'pass').map((r) => r.id))] });
  }
  if (sdg.adverse.length) actions.push({ code: 'sdg-adverse', owner: 'ESMS', text: 'Record and mitigate adverse SDG impacts', rules: of('SDG').filter((r) => r.kind === 'adverse' && r.outcome === 'fail').map((r) => r.id) });

  const evidenceGaps = [...new Set(results.filter((r) => r.outcome === 'unknown' && r.reason.startsWith('Evidence')).map((r) => r.reason))];
  return { validation: v, results, esms, ndc, taxonomy, sdg, decision, actions, evidenceGaps };
}

export interface ManagementAction { code: string; owner: string; text: string; rules: string[] }

export type ScreenResult = ReturnType<typeof screen>;

export const visibleQuestions = (input: Pick<ScreenInput, 'sector' | 'activities' | 'responses' | 'evidence' | 'facts'>) =>
  QUESTIONS.filter((q) => {
    if (!q.showWhen) return true;
    const x: Ctx = { input: { ...input, facilityId: '', borrower: '', region: '', ead: 0 } as ScreenInput };
    if ('activity' in q.showWhen) return input.activities.some((a) => q.showWhen && 'activity' in q.showWhen && q.showWhen.activity.includes(a.code));
    return evalCond(q.showWhen, x) === true;
  });

export const neededEvidence = (input: Pick<ScreenInput, 'sector' | 'activities' | 'evidence' | 'transitionRiskScore'>) => {
  const ids = new Set<string>();
  if (input.transitionRiskScore !== undefined) ids.add('EV_TRANSITION_SCORE');
  input.activities.forEach((a) => { const e = ACTIVITIES[a.code]?.evidence; if (e) ids.add(criterionEvidenceId(input, e, a)); });
  if (['agri', 'mining', 'oilgas', 'power', 'manuf', 'constr', 'renew'].includes(input.sector)) ids.add('EV_EPA_PERMIT');
  if (['agri', 'mining', 'manuf', 'oilgas'].includes(input.sector)) ids.add('EV_WASTEWATER');
  return [...ids];
};

export const RULESET = { frameworks: FRAMEWORK_VERSIONS, criteria: CRITERIA.length, questions: QUESTIONS.length };
