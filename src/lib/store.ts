import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, readSession } from './auth';
import { demoExtract, Loan } from './portfolio';
import { ingestCsv, IngestResult } from './ingest';
import { physicalScore, runStress, RunInput, StressRun } from './engine';
import { ScreenInput, type ScreenResult, neededEvidence, screen, validate } from './esg/engine';
import { CRITERIA, FRAMEWORK_VERSIONS, QUESTIONS } from './esg/rules';
import * as P from './params';
import { sha256 } from './math';
import { CALIBRATION_VERSION, CalibrationProfile, CalibrationSettings, calibrationCoefficients, ghanaShocks } from './calibration';
import { scenarioReporting } from './scenario-report';
import { isGcbScenarioYear } from './gcb-scenarios';
import { MAX_ECL_MATURITY, STAGED_ECL_MODEL } from './staged-ecl';
import { onNetlify, readText, updateExistingBlob, writeText } from './kv';
import { CCKP } from '@/data/cckp';
import { NGFS } from '@/data/ngfs';
import { WORLD_BANK } from '@/data/worldbank';

export const USERS = [
  { id: 'kofi', name: 'Kofi Mensah', role: 'Climate Risk Analyst', can: ['run', 'ingest'] },
  { id: 'ama', name: 'Ama Owusu', role: 'Head of Credit Risk (Approver)', can: ['approve'] },
  { id: 'yaw', name: 'Yaw Boateng', role: 'Internal Audit (read-only)', can: [] as string[] },
] as const;
export type User = (typeof USERS)[number];

export interface Dataset { id: string; name: string; hash: string; uploadedAt: string; by: string; control: IngestResult['control']; rejected: IngestResult['rejected']; warnings: IngestResult['warnings'] }
export interface RunRecord {
  id: string; createdAt: string; by: string; input: RunInput; datasetId: string; datasetHash: string;
  modelVersion: string; hazardVersion: string; paramsHash: string; outputHash: string; seed: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected'; submittedBy?: string; reviewedBy?: string; reviewedAt?: string; note?: string;
  batchId?: string;
  reporting?: ReturnType<typeof scenarioReporting>;
  headline: { ecl: number; eclStressed: number; carBefore: number; carAfter: number; lcrAfter: number; var999: number };
}
export interface AuditEvent { at: string; by: string; action: string; target: string; detail?: string }
export interface ScreenRunRecord {
  id: string; createdAt: string; by: string; facilityId: string; borrower: string; parent?: string;
  input: ScreenInput; datasetId?: string; result?: ScreenResult; reviewedResult?: ScreenResult; rulesHash: string; versions: Record<string, string>;
  status: 'draft' | 'submitted' | 'approved' | 'escalated' | 'returned';
  verifiedEvidence?: string[]; submittedBy?: string; reviewedBy?: string; reviewedAt?: string; note?: string;
}
interface Db { calibration?: CalibrationProfile; datasets: Dataset[]; activeDataset: string; runs: RunRecord[]; audit: AuditEvent[]; screenRuns?: ScreenRunRecord[]; mfa?: Record<string, string> }

const g = globalThis as unknown as { __db?: Db; __loans?: Map<string, Loan[]>; __runs?: Map<string, StressRun> };
g.__loans ??= new Map();
g.__runs ??= new Map();

const save = async (db: Db) => { if (!onNetlify) g.__db = db; await writeText('store.json', JSON.stringify(db, null, 1)); };
const now = () => new Date().toISOString();

export const paramsHash = () => sha256(JSON.stringify({ v: P.MODEL_VERSION, h: P.HAZARD_DATA_VERSION, R: P.REGIONS, S: P.SECTORS, C: P.COLLATERAL, SC: P.SCENARIOS, CR: P.CREDIT, L: P.LOSS_DIST, B: P.BANK }));

async function loadDataset(db: Db, id: string, csv?: string) {
  if (g.__loans!.has(id)) return g.__loans!.get(id)!;
  const text = csv ?? (await readText(`${id}.csv`));
  if (text == null) throw new Error(`Dataset ${id} is missing from storage`);
  const loans = ingestCsv(text).accepted;
  g.__loans!.set(id, loans);
  return loans;
}

async function addDataset(db: Db, name: string, csv: string, by: string) {
  const res = ingestCsv(csv);
  const hash = await sha256(csv);
  const id = `DS-${hash.slice(0, 8)}`;
  await writeText(`${id}.csv`, csv);
  if (!db.datasets.some((d) => d.id === id)) db.datasets.unshift({ id, name, hash, uploadedAt: now(), by, control: res.control, rejected: res.rejected, warnings: res.warnings });
  db.activeDataset = id;
  g.__loans!.set(id, res.accepted);
  db.audit.unshift({ at: now(), by, action: 'dataset.ingested', target: id, detail: `${res.control.rowsAccepted} accepted, ${res.control.rowsRejected} rejected · sha256 ${hash.slice(0, 12)}…` });
  return id;
}

export async function db(): Promise<Db> {
  if (!onNetlify && g.__db) return g.__db;
  const text = await readText('store.json');
  if (text) {
    const loaded = JSON.parse(text) as Db;
    if (!onNetlify) g.__db = loaded;
    return loaded;
  }
  const fresh: Db = { datasets: [], activeDataset: '', runs: [], audit: [] };
  await addDataset(fresh, 'Loan book extract · 30 Sep 2026 (synthetic)', demoExtract(), 'system');
  await save(fresh);
  return fresh;
}

export async function sessionUser(): Promise<User | null> {
  const id = readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return USERS.find((u) => u.id === id) ?? null;
}

export async function currentUser(): Promise<User> {
  const u = await sessionUser();
  if (!u) redirect('/login');
  return u;
}

export async function audit(by: string, action: string, target: string, detail?: string) {
  const d = await db();
  d.audit.unshift({ at: now(), by, action, target, detail });
  await save(d);
}

export async function activeLoans() {
  const d = await db();
  return { dataset: d.datasets.find((x) => x.id === d.activeDataset)!, loans: await loadDataset(d, d.activeDataset) };
}

export async function ingest(name: string, csv: string) {
  const d = await db(), u = await currentUser();
  if (!u.can.includes('ingest' as never)) throw new Error('Your role cannot load data');
  const id = await addDataset(d, name, csv, u.name);
  await save(d);
  return id;
}

export async function getRun(id: string, includeLoans = false) {
  const d = await db();
  const rec = d.runs.find((r) => r.id === id);
  if (!rec) return null;
  if (!g.__runs!.has(id)) g.__runs!.set(id, runStress(await loadDataset(d, rec.datasetId), rec.input));
  return { rec, run: g.__runs!.get(id)!, loans: includeLoans ? await loadDataset(d, rec.datasetId) : undefined };
}

const outHash = (run: StressRun) => sha256(JSON.stringify(run.results.map((r) => [r.id, r.pdStressed.toFixed(8), r.lgdStressed.toFixed(8), r.eclStressed.toFixed(2)])) + JSON.stringify(run.lossDist.stressed.var999));

export async function activateCalibration(settings: CalibrationSettings) {
  const user = await currentUser();
  if (!user.can.includes('run' as never)) throw new Error('Your role cannot activate a Ghana calibration.');
  const profile: CalibrationProfile = {
    id: `GH-${randomUUID()}`, settings, coefficients: calibrationCoefficients(settings),
    activatedBy: user.name, activatedAt: now(),
  };
  const apply = (current: Db): Db => ({
    ...current, calibration: profile,
    audit: [{ at: profile.activatedAt, by: user.name, action: 'calibration.activated', target: profile.id,
      detail: JSON.stringify({ settings, coefficients: profile.coefficients }) }, ...current.audit],
  });
  const current = await db();
  if (onNetlify) {
    await updateExistingBlob('store.json', (data) => JSON.stringify(apply(JSON.parse(data) as Db), null, 1));
  } else {
    await save(apply(current));
  }
}

async function runParamsHash(input: RunInput) {
  const base = await paramsHash();
  return input.eclModel ? sha256(JSON.stringify({ base, eclModel: input.eclModel, transmission: P.TRANSMISSION, damage: P.DEPTH_DAMAGE, calibration: CALIBRATION_VERSION, CCKP, NGFS, WORLD_BANK, profile: input.calibration })) : base;
}

export async function createScenarioBatch(request: Pick<RunInput, 'scenario' | 'approach'>, years: number[], expectedCalibration?: string) {
  const user = await currentUser();
  if (!user.can.includes('run' as never)) throw new Error('Your role cannot run stress tests');
  const horizons = [...new Set(years)].sort((a, b) => a - b);
  if (!horizons.length || horizons.some((year) => !isGcbScenarioYear(request.scenario, year)) || !['bottom-up', 'top-down'].includes(request.approach)) {
    throw new Error('Select eligible reporting years for the GCB pathway and an assessment approach');
  }

  const calibration = (await db()).calibration;
  if (expectedCalibration !== undefined && expectedCalibration !== (calibration?.id ?? CALIBRATION_VERSION)) {
    throw new Error('The active Ghana calibration changed. Reload Scenario Analysis to review the new shocks.');
  }
  const { dataset, loans } = await activeLoans();
  if (!loans.length) throw new Error('Load a loan book before running a scenario');
  const invalidExposure = loans.find((loan) => !Number.isFinite(loan.ead) || loan.ead <= 0);
  if (invalidExposure) throw new Error(`Review outstanding exposure for facility ${invalidExposure.id}`);
  const invalid = loans.find((loan) => !Number.isFinite(loan.maturityYears) || loan.maturityYears <= 0 || loan.maturityYears > MAX_ECL_MATURITY || ![1, 2, 3].includes(loan.stage));
  if (invalid) throw new Error(`Review remaining maturity (0 < years ≤ ${MAX_ECL_MATURITY}) and IFRS 9 stage for facility ${invalid.id}`);

  const batchId = `BATCH-${randomUUID()}`;
  const createdAt = now();
  const input = { ...request, eclModel: STAGED_ECL_MODEL, ...(calibration ? { calibration } : {}) };
  const fingerprint = await runParamsHash({ ...input, horizon: horizons[0] });
  const calculated = await Promise.all(horizons.map(async (horizon) => {
    const run = runStress(loans, { ...input, horizon });
    const reporting = scenarioReporting(run);
    const headline = { ecl: run.summary.ecl, eclStressed: run.summary.eclStressed, carBefore: run.capital.carBefore,
      carAfter: run.capital.carAfter, lcrAfter: run.liquidity.lcrAfter, var999: run.lossDist.stressed.var999 };
    const rec: Omit<RunRecord, 'id'> = {
      batchId, createdAt, by: user.name, input: run.input, datasetId: dataset.id, datasetHash: dataset.hash,
      modelVersion: run.modelVersion, hazardVersion: P.HAZARD_DATA_VERSION, paramsHash: fingerprint,
      outputHash: await reportingHash(run), seed: P.LOSS_DIST.seed, status: 'draft', reporting, headline,
    };
    return { rec, run };
  }));

  const insert = (current: Db) => {
    const records = calculated.map(({ rec }, index) => ({
      ...rec, id: `RUN-${String(current.runs.length + index + 1).padStart(4, '0')}`,
    }));
    current.runs.unshift(...[...records].reverse());
    current.audit.unshift(
      { at: createdAt, by: user.name, action: 'scenario.batch_created', target: batchId,
        detail: `${P.scenarioOf(input.scenario).name} · ${horizons.join(', ')} · ${input.approach} · dataset ${dataset.id} · calibration ${calibration?.id ?? CALIBRATION_VERSION}` },
      ...records.map((rec) => ({ at: createdAt, by: user.name, action: 'run.created', target: rec.id,
        detail: `${rec.input.horizon} · ${batchId} · dataset ${dataset.id}` })),
    );
    return records;
  };

  if (onNetlify) {
    await updateExistingBlob('store.json', (text) => {
      const current = JSON.parse(text) as Db;
      insert(current);
      return JSON.stringify(current, null, 1);
    });
  } else {
    const current = await db();
    const updated = { ...current, runs: [...current.runs], audit: [...current.audit] };
    const records = insert(updated);
    await save(updated);
    records.forEach((rec, index) => g.__runs!.set(rec.id, calculated[index].run));
  }
  return batchId;
}

async function reportingHash(run: StressRun) {
  return sha256(JSON.stringify({ credit: await outHash(run), reporting: scenarioReporting(run),
    input: run.input, ecl: run.summary.ecl, eclStressed: run.summary.eclStressed, capital: run.capital, liquidity: run.liquidity }));
}

export async function scenarioBatchRuns(id: string) {
  const { runs } = await db();
  return runs.filter((rec) => rec.batchId === id && rec.reporting).sort((a, b) => a.input.horizon - b.input.horizon);
}

export async function reproduce(id: string) {
  const d = await db(), u = await currentUser();
  const rec = d.runs.find((r) => r.id === id)!;
  const run = runStress(await loadDataset(d, rec.datasetId), rec.input);
  const [o, p] = [await (rec.reporting ? reportingHash(run) : outHash(run)), await runParamsHash(rec.input)];
  const ok = o === rec.outputHash && p === rec.paramsHash;
  d.audit.unshift({ at: now(), by: u.name, action: 'run.reproduced', target: id, detail: ok ? 'Output hash matches: result reproduced exactly' : 'MISMATCH: inputs or parameters have changed' });
  await save(d);
  return { ok, outputHash: o, paramsHash: p };
}

export async function review(id: string, action: 'submit' | 'approve' | 'reject', note?: string) {
  const d = await db(), u = await currentUser();
  const rec = d.runs.find((r) => r.id === id)!;
  if (action === 'submit') {
    if (!u.can.includes('run' as never)) throw new Error('Only an analyst can submit runs');
    if (rec.status !== 'draft') throw new Error('Only drafts can be submitted');
    rec.status = 'submitted'; rec.submittedBy = u.name;
  } else {
    if (!u.can.includes('approve' as never)) throw new Error('Only an approver can review runs');
    if (rec.status !== 'submitted') throw new Error('Run must be submitted first');
    if (rec.by === u.name || rec.submittedBy === u.name) throw new Error('Maker-checker: you cannot approve your own run');
    rec.status = action === 'approve' ? 'approved' : 'rejected'; rec.reviewedBy = u.name; rec.reviewedAt = now(); rec.note = note;
  }
  d.audit.unshift({ at: now(), by: u.name, action: `run.${action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : 'rejected'}`, target: id, detail: note });
  await save(d);
}

export async function logView(action: string, target: string, detail?: string) {
  const d = await db(), u = await currentUser();
  d.audit.unshift({ at: now(), by: u.name, action, target, detail });
  await save(d);
}

export const rulesHash = () => sha256(JSON.stringify({ CRITERIA, QUESTIONS, FRAMEWORK_VERSIONS }));

export const effectiveInput = (r: ScreenRunRecord): ScreenInput => ({
  ...r.input,
  evidence: Object.fromEntries(Object.entries(r.input.evidence).map(([k, v]) => [k, r.verifiedEvidence?.includes(k) && v.status !== 'missing' ? { ...v, status: 'verified' as const } : v])),
});

export async function mfaEnrolledAt(id: string) { return (await db()).mfa?.[id] ?? null; }
export async function setMfaEnrolled(id: string) { const d = await db(); d.mfa = { ...(d.mfa ?? {}), [id]: now() }; await save(d); }

export async function screenRuns() { return (await db()).screenRuns ?? []; }
export const resultForScreenRun = (r: ScreenRunRecord) => r.reviewedResult ?? r.result ?? screen(effectiveInput(r));

export async function getScreenRun(id: string) {
  const r = (await screenRuns()).find((x) => x.id === id);
  return r ? { rec: r, result: resultForScreenRun(r) } : null;
}

export function screeningFacts(loan: Loan): ScreenInput['facts'] {
  const region = P.REGIONS.find((item) => item.name === loan.region);
  return { droughtHazard: region?.hazard.drought ?? null, physical2050: region ? physicalScore(loan, ghanaShocks('current', 2050).physical).score : null };
}

export async function createScreenRun(input: ScreenInput, parent?: string) {
  const d = await db(), u = await currentUser();
  if (!u.can.includes('run' as never)) throw new Error('Only an analyst can run a screening');
  const { dataset, loans } = await activeLoans();
  const loan = loans.find((l) => l.id === input?.facilityId);
  if (!loan) throw new Error('Facility must exist in the active portfolio');
  if (parent && !d.screenRuns?.some((run) => run.id === parent && run.facilityId === loan.id)) throw new Error('Previous screening must belong to this facility');
  input = { ...input, facts: screeningFacts(loan), borrower: loan.borrower, sector: loan.sector, region: loan.region, ead: loan.ead,
    site: { latitude: loan.lat, longitude: loan.lon, purpose: loan.purpose } };
  if (Object.values(input.responses).some((value) => value !== null && typeof value !== 'boolean')) throw new Error('Questionnaire answers must be Yes, No or Unknown');
  const validEvidence = neededEvidence(input);
  input.evidence = Object.fromEntries(Object.entries(input.evidence).filter(([id]) => validEvidence.includes(id)));
  for (const evidence of Object.values(input.evidence)) {
    if (!['missing', 'provided', 'verified'].includes(evidence.status)) throw new Error('Invalid evidence status');
    if (evidence.status !== 'missing' && !evidence.ref?.trim()) throw new Error('Each provided item requires a document reference');
  }
  const v = validate(input);
  if (!v.ok) throw new Error(v.errors.join('; '));
  const catalogHash = await rulesHash();
  d.screenRuns ??= [];
  const id = `SCR-${String(d.screenRuns.length + 1).padStart(4, '0')}`;
  const rec: ScreenRunRecord = {
    id, createdAt: now(), by: u.name, facilityId: input.facilityId, borrower: input.borrower, parent, datasetId: dataset.id,
    input: { ...input, evidence: Object.fromEntries(Object.entries(input.evidence).map(([k, e]) => [k, { ...e, status: e.status === 'verified' ? 'provided' as const : e.status }])) },
    rulesHash: catalogHash, versions: Object.fromEntries(Object.entries(FRAMEWORK_VERSIONS).map(([k, f]) => [k, f.version])), status: 'draft',
  };
  const r = screen(rec.input);
  rec.result = r;
  d.screenRuns.unshift(rec);
  d.audit.unshift({ at: now(), by: u.name, action: parent ? 'screening.rescreened' : 'screening.run', target: id, detail: `${input.borrower} (${input.facilityId}) · ESMS ${r.esms.gate}/${r.esms.tier} · ${r.decision.label}${parent ? ` · replaces ${parent}` : ''}` });
  await save(d);
  return id;
}

export async function attachEvidence(id: string, evidenceId: string, ref: string) {
  const found = (await screenRuns()).find((x) => x.id === id);
  if (!found) throw new Error('Screening run not found');
  if (!ref.trim() || !neededEvidence(found.input).includes(evidenceId)) throw new Error('Provide a reference for an applicable evidence item');
  const input: ScreenInput = { ...found.input, evidence: { ...found.input.evidence, [evidenceId]: { status: 'provided', ref } } };
  return createScreenRun(input, id);
}

export async function reviewScreenRun(id: string, action: 'submit' | 'approve' | 'escalate' | 'return', note?: string, verifiedEvidence: string[] = []) {
  const d = await db(), u = await currentUser();
  if (!['submit', 'approve', 'escalate', 'return'].includes(action)) throw new Error('Invalid review action');
  const rec = (d.screenRuns ?? []).find((x) => x.id === id);
  if (!rec) throw new Error('Screening run not found');
  if (action === 'submit') {
    if (!u.can.includes('run' as never)) throw new Error('Only an analyst can submit a screening');
    if (rec.status !== 'draft' && rec.status !== 'returned') throw new Error('Only drafts can be submitted');
    rec.status = 'submitted'; rec.submittedBy = u.name;
  } else {
    if (!u.can.includes('approve' as never)) throw new Error('Only an approver can review screenings');
    if (rec.status !== 'submitted') throw new Error('The screening must be submitted first');
    if (rec.by === u.name || rec.submittedBy === u.name) throw new Error('Maker-checker: you cannot review your own screening');
    if (action === 'approve') {
      if (rec.rulesHash !== await rulesHash()) throw new Error('Re-screen with the current rules before approving');
      if (rec.status !== 'submitted') throw new Error('The screening has already been reviewed');
      if (!Array.isArray(verifiedEvidence) || verifiedEvidence.some((id) => rec.input.evidence[id]?.status !== 'provided' || !rec.input.evidence[id].ref?.trim())) throw new Error('Select only provided evidence with a document reference');
      const reviewed = { ...rec, verifiedEvidence: [...new Set(verifiedEvidence)] };
      const result = screen(effectiveInput(reviewed));
      if (result.esms.gate !== 'pass') throw new Error('Resolve the exclusion gate or escalate before approval');
      rec.verifiedEvidence = reviewed.verifiedEvidence;
      rec.reviewedResult = result;
    }
    rec.status = action === 'approve' ? 'approved' : action === 'escalate' ? 'escalated' : 'returned';
    rec.reviewedBy = u.name; rec.reviewedAt = now(); rec.note = note;
  }
  d.audit.unshift({ at: now(), by: u.name, action: `screening.${action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : action === 'escalate' ? 'escalated' : 'returned'}`, target: id, detail: [note, action === 'approve' && rec.verifiedEvidence?.length ? `evidence verified: ${rec.verifiedEvidence.join(', ')}` : ''].filter(Boolean).join(' · ') || undefined });
  await save(d);
}
