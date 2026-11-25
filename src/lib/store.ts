import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, readSession } from './auth';
import { demoExtract, Loan } from './portfolio';
import { ingestCsv, IngestResult } from './ingest';
import { physicalScore, runCredit, runStress, RunInput, StressRun } from './engine';
import { ScreenInput, type ScreenResult, neededEvidence, screen, validate } from './esg/engine';
import { CRITERIA, FRAMEWORK_VERSIONS, QUESTIONS } from './esg/rules';
import * as P from './params';
import { sha256 } from './math';
import { CALIBRATION_VERSION, REGRESSION_VERSION, activeCalibration, calibrate, calibrationMethod, CalibrationProfile, calibrationEvidence, ghanaShocks, readRegressionWindow, wdiRegression } from './calibration';
import { ICAAP_VERSION, icaapBatchMismatch, projectCapital, readFinanceCsv, type FinancePeriod, type IcaapAssessment, type IcaapOpening, type IcaapSource } from './icaap';
import { DEMO_TREASURY, ILAAP_BUCKETS, ILAAP_MODEL, projectLiquidity, readTreasuryInputs, type IlaapActions, type IlaapAssessment } from './ilaap';
import { scenarioReporting } from './scenario-report';
import { readBenchmark } from './regression-models';
import { readMatchedEvidence } from './calibration-regression';
import { calibratedEnergy, readEnergyPath } from './calibration-energy';
import { GCB_PATHWAYS, isGcbScenarioYear } from './gcb-scenarios';
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
  verifiedEvidence?: string[]; submittedBy?: string; reviewedBy?: string; reviewedAt?: string; note?: string; supersededRules?: boolean;
}
interface CalibrationPreviewRow {
  scenario: P.ScenarioKey;
  year: number;
  approach: RunInput['approach'];
  baselineEcl: number;
  activeEcl: number;
  candidateEcl: number;
  activeShocks: ReturnType<typeof ghanaShocks>;
  candidateShocks: ReturnType<typeof ghanaShocks>;
}

export interface CalibrationExecution {
  profile: CalibrationProfile;
  comparison: CalibrationProfile;
  createdAt: string;
  createdBy: string;
  dataset: { id: string; name: string; hash: string; facilities: number };
  modelFingerprint: string;
  evidence: ReturnType<typeof calibrationEvidence>;
  rateEvidence?: ReturnType<typeof readMatchedEvidence>;
  energyEvidence?: ReturnType<typeof readMatchedEvidence>;
  preview: CalibrationPreviewRow[];
  decision?: { action: 'activate' | 'decline'; by: string; at: string; note: string };
}

interface Db { ilaap?: IlaapAssessment[]; icaap?: IcaapAssessment[]; calibration?: CalibrationProfile; calibrationExecutions?: CalibrationExecution[]; datasets: Dataset[]; activeDataset: string; runs: RunRecord[]; audit: AuditEvent[]; screenRuns?: ScreenRunRecord[]; mfa?: Record<string, string> }

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

async function updateCalibrationStore(apply: (current: Db) => Db) {
  const current = await db();
  if (onNetlify) {
    await updateExistingBlob('store.json', (data) => JSON.stringify(apply(JSON.parse(data) as Db), null, 1));
  } else {
    await save(apply(current));
  }
}

export async function executeCalibration(form: FormData) {
  const user = await currentUser();
  if (!user.can.includes('run' as never)) throw new Error('Your role cannot execute calibrations.');
  const { start, end } = readRegressionWindow(form);
  const csv = async (key: string) => {
    const file = form.get(key);
    if (file instanceof File && file.size > 20000) throw new Error('Upload CSV files under 20 KB each.');
    return file instanceof File ? file.text() : '';
  };
  const useRegionalRate = form.get('runWithoutYields') === 'yes' || form.get('rateModel') === 'regional';
  const [rates, energyHistory, energyPath] = await Promise.all([useRegionalRate ? '' : csv('rates'), csv('energyHistory'), csv('energyPath')]);
  const rateEvidence = useRegionalRate ? undefined : readMatchedEvidence(rates, String(form.get('rateSource') ?? ''), start, end, 'rate');
  const energyEvidence = readMatchedEvidence(energyHistory, String(form.get('energySource') ?? ''), start, end, 'energy');
  if (!useRegionalRate && form.get('rateModel') === 'matched' && !rateEvidence) {
    throw new Error('Upload matched sovereign yields to fit the interest-rate model, or select Run without a yield file.');
  }
  if (form.get('energyModel') === 'matched' && !energyEvidence) throw new Error('Supply matched historical energy prices for the energy regression.');
  const pathSource = String(form.get('energyPathSource') ?? '').trim();
  const shareInput = String(form.get('energyShare') ?? '').trim();
  if (Boolean(energyEvidence) !== Boolean(energyPath.trim()) || (!energyEvidence && (pathSource || shareInput))) {
    throw new Error('Supply both matched historical energy prices and an NGFS energy path, or leave the energy fields empty.');
  }
  const share = Number(shareInput);
  if (energyEvidence && (!shareInput || !Number.isFinite(share) || share < 0 || share > 100)) {
    throw new Error('Enter the share of operating costs exposed to the energy price shock as a percentage from 0 to 100.');
  }
  const energy = energyEvidence ? { ...readEnergyPath(energyPath, pathSource), beta: energyEvidence.fit.beta, opexShare: share / 100 } : undefined;
  if (energy && GCB_PATHWAYS.some(({key, years}) => years.some((year) => !Number.isFinite(calibratedEnergy(energy, key, year)?.ghana)))) {
    throw new Error('The fitted energy sensitivity produces a non-finite scenario shock. Review the historical and scenario inputs.');
  }
  const data = await db();
  const comparison = activeCalibration(data.calibration);
  const dataset = data.datasets.find((item) => item.id === data.activeDataset)!;
  const loans = await loadDataset(data, dataset.id);
  validateScenarioLoans(loans);

  const benchmarks = { gdp: readBenchmark(form.get('gdpBenchmark')), inflation: readBenchmark(form.get('inflationBenchmark')) };
  const settings = { start, end, rate: rateEvidence?.fit.beta ?? 1, carbon: 1 };
  const profile: CalibrationProfile = {
    id: `GH-${randomUUID()}`, method: REGRESSION_VERSION, rateBasis: rateEvidence ? 'regression' : 'regional',
    ...(energy ? { energy } : {}), benchmarks, settings, coefficients: { gdp: wdiRegression('gdp', start, end, benchmarks.gdp).fit.beta, inflation: wdiRegression('inflation', start, end, benchmarks.inflation).fit.beta, rate: settings.rate, carbon: settings.carbon },
    activatedBy: '', activatedAt: '',
  };
  const preview = GCB_PATHWAYS.flatMap(({ key: scenario, years }) => years.flatMap((year) =>
    (['top-down', 'bottom-up'] as const).map((approach) => {
      const input = { scenario, horizon: year, approach, eclModel: STAGED_ECL_MODEL };
      const active = runCredit(loans, { ...input, calibration: comparison });
      const candidate = runCredit(loans, { ...input, calibration: profile });
      return { scenario, year, approach, baselineEcl: candidate.summary.ecl, activeEcl: active.summary.eclStressed,
        candidateEcl: candidate.summary.eclStressed, activeShocks: active.shocks, candidateShocks: candidate.shocks };
    })));
  if (preview.some((row) => ![row.baselineEcl, row.activeEcl, row.candidateEcl].every(Number.isFinite))) throw new Error('The credit model did not produce finite ECL for every reporting year.');
  const createdAt = now();
  const execution: CalibrationExecution = {
    profile, comparison, createdAt, createdBy: user.name,
    dataset: { id: dataset.id, name: dataset.name, hash: dataset.hash, facilities: loans.length },
    modelFingerprint: await runParamsHash({ scenario: 'current', horizon: 2050, approach: 'top-down', eclModel: STAGED_ECL_MODEL, calibration: profile }),
    evidence: calibrationEvidence(profile), rateEvidence, energyEvidence, preview,
  };
  await updateCalibrationStore((current) => ({
    ...current, calibrationExecutions: [execution, ...(current.calibrationExecutions ?? [])],
    audit: [{ at: createdAt, by: user.name, action: 'calibration.executed', target: profile.id,
      detail: `Dataset ${dataset.id} · compared with ${comparison.id} · parameters ${execution.modelFingerprint}` }, ...current.audit],
  }));
  return profile.id;
}

export async function decideCalibration(id: string, action: 'activate' | 'decline', note: string) {
  const user = await currentUser();
  if (!user.can.includes('run' as never)) throw new Error('Your role cannot decide on calibrations.');
  if (note.length > 1000) throw new Error('Limit decision notes to 1,000 characters.');
  const at = now();
  await updateCalibrationStore((current) => {
    const execution = current.calibrationExecutions?.find((entry) => entry.profile.id === id);
    if (!execution || execution.decision) throw new Error('This calibration is unavailable or already decided.');
    if (action === 'activate' && (current.activeDataset !== execution.dataset.id || activeCalibration(current.calibration).id !== execution.comparison.id)) {
      throw new Error('The active calibration or loan book changed since this preview. Execute a new calibration to review the latest comparison.');
    }
    return {
      ...current,
      calibration: action === 'activate' ? { ...execution.profile, activatedBy: user.name, activatedAt: at } : current.calibration,
      calibrationExecutions: current.calibrationExecutions?.map((entry) => entry.profile.id === id
        ? { ...entry, decision: { action, by: user.name, at, note } } : entry),
      audit: [{ at, by: user.name, action: action === 'activate' ? 'calibration.activated' : 'calibration.declined',
        target: id, detail: note }, ...current.audit],
    };
  });
}

function validateScenarioLoans(loans: Loan[]) {
  if (!loans.length) throw new Error('Load a loan book before running a scenario');
  const invalidExposure = loans.find((loan) => !Number.isFinite(loan.ead) || loan.ead <= 0);
  if (invalidExposure) throw new Error(`Review outstanding exposure for facility ${invalidExposure.id}`);
  const invalid = loans.find((loan) => !Number.isFinite(loan.maturityYears) || loan.maturityYears <= 0 || loan.maturityYears > MAX_ECL_MATURITY || ![1, 2, 3].includes(loan.stage));
  if (invalid) throw new Error(`Review remaining maturity (0 < years ≤ ${MAX_ECL_MATURITY}) and IFRS 9 stage for facility ${invalid.id}`);
}

async function runParamsHash(input: RunInput) {
  const base = await paramsHash();
  const calibration = input.calibration;
  const profile = calibration?.method ? {
    id: calibration.id, method: calibration.method, rateBasis: calibration.rateBasis,
    settings: calibration.settings, coefficients: calibration.coefficients, energy: calibration.energy, benchmarks: calibration.benchmarks,
  } : calibration;
  return input.eclModel ? sha256(JSON.stringify({ base, eclModel: input.eclModel, transmission: P.TRANSMISSION, damage: P.DEPTH_DAMAGE, calibration: CALIBRATION_VERSION, CCKP, NGFS, WORLD_BANK, profile })) : base;
}

export async function createScenarioBatch(request: Pick<RunInput, 'scenario' | 'approach'>, years: number[], expectedCalibration?: string, expectedDataset?: string) {
  const user = await currentUser();
  if (!user.can.includes('run' as never)) throw new Error('Your role cannot run stress tests');
  const horizons = [...new Set(years)].sort((a, b) => a - b);
  if (!horizons.length || horizons.some((year) => !isGcbScenarioYear(request.scenario, year)) || !['bottom-up', 'top-down'].includes(request.approach)) {
    throw new Error('Select eligible reporting years for the GCB pathway and an assessment approach');
  }

  const calibration = activeCalibration((await db()).calibration);
  if (expectedCalibration !== undefined && expectedCalibration !== calibration.id) {
    throw new Error('The active Ghana calibration changed. Reload Scenario Analysis to review the new shocks.');
  }
  const { dataset, loans } = await activeLoans();
  if (expectedDataset !== undefined && expectedDataset !== dataset.id) {
    throw new Error('The active loan book changed. Prepare scenario batches again using the current loan book.');
  }
  validateScenarioLoans(loans);

  const batchId = `BATCH-${randomUUID()}`;
  const createdAt = now();
  const input = { ...request, eclModel: STAGED_ECL_MODEL, calibration };
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
        detail: `${P.scenarioOf(input.scenario).name} · ${horizons.join(', ')} · ${input.approach} · dataset ${dataset.id} · calibration ${calibration.id}` },
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

export async function prepareIcaapBatches(approach: RunInput['approach']) {
  const user = await currentUser();
  if (!user.can.includes('run' as never)) throw new Error('Only an analyst can prepare ICAAP source batches.');
  if (approach !== 'bottom-up' && approach !== 'top-down') throw new Error('Choose a credit approach.');
  const d = await db();
  const dataset = d.datasets.find((item) => item.id === d.activeDataset);
  if (!dataset?.control.reconciled) throw new Error('Load a reconciled loan book first.');
  const calibration = activeCalibration(d.calibration);
  const fingerprint = await runParamsHash({ scenario: 'nz2050', horizon: 2027, approach, eclModel: STAGED_ECL_MODEL, calibration });
  const selected: Record<string, string> = {};
  for (const { key, years } of GCB_PATHWAYS) {
    const candidates = (await db()).runs.filter((run) => run.input.scenario === key && run.batchId);
    const matching = [...new Set(candidates.map((run) => run.batchId!))].flatMap((id) => {
      const rows = candidates.filter((run) => run.batchId === id);
      if (rows.length !== years.length || years.some((year) => !rows.some((run) => run.input.horizon === year)) ||
        rows.some((run) => run.status === 'rejected' || !run.reporting || run.datasetHash !== dataset.hash ||
          run.paramsHash !== fingerprint || run.input.approach !== approach)) return [];
      return [{ id, approved: rows.every((run) => run.status === 'approved') }];
    });
    const existing = matching.find((candidate) => candidate.approved) ?? matching[0];
    const id = existing?.id ?? await createScenarioBatch({ scenario: key, approach }, years, calibration.id, dataset.id);
    selected[key] = id;
  }
  const current = await db();
  if (current.activeDataset !== dataset.id || activeCalibration(current.calibration).id !== calibration.id) {
    throw new Error('The loan book or active calibration changed during setup. Prepare batches again.');
  }
  return selected;
}

export async function createIcaap(form: FormData) {
  const user = await currentUser();
  if (!user.can.includes('run' as never)) throw new Error('Only an analyst can run ICAAP projections.');
  const approach = form.get('approach');
  if (form.get('batchMode') === 'automatic' && approach !== 'bottom-up' && approach !== 'top-down') {
    throw new Error('Choose a credit approach.');
  }
  const prepared = form.get('batchMode') === 'automatic' && (approach === 'bottom-up' || approach === 'top-down')
    ? await prepareIcaapBatches(approach) : undefined;
  const d = await db();
  const runs = GCB_PATHWAYS.flatMap(({ key, years, name }) => {
    const batch = prepared?.[key] ?? String(form.get(key) ?? '');
    const selected = d.runs.filter((run) => run.batchId === batch && run.input.scenario === key && run.reporting);
    if (selected.length !== years.length || years.some((year) => !selected.some((run) => run.input.horizon === year))) {
      throw new Error(`Select a complete Engine III batch for ${name}, or switch to automatic batch selection.`);
    }
    return selected;
  });
  const first = runs[0];
  for (const run of runs) {
    const name = P.scenarioOf(run.input.scenario).name;
    if (run.status === 'rejected') throw new Error(`${name} source run ${run.id} was rejected. Select a different batch or use automatic selection.`);
    const mismatches = icaapBatchMismatch({ ...first, approach: first.input.approach }, { ...run, approach: run.input.approach });
    if (mismatches.length) throw new Error(`${name} (${run.id}) differs from ${P.scenarioOf(first.input.scenario).name} (${first.id}) in ${mismatches.join(', ')}. Select matching batches or use automatic selection.`);
  }
  const dataset = d.datasets.find(({ id }) => id === first.datasetId);
  if (!dataset || dataset.hash !== first.datasetHash || !dataset.control.reconciled) throw new Error('The source loan book failed reconciliation.');
  const loans = await loadDataset(d, dataset.id);
  validateScenarioLoans(loans);
  const requiredText = (key: string) => {
    const value = String(form.get(key) ?? '').trim();
    if (!value || value.length > 200) throw new Error(`Complete ${key} (up to 200 characters).`);
    return value;
  };
  const amount = (key: string, max = 1e15) => {
    const value = requiredText(key);
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > max) throw new Error(`Invalid ${key}.`);
    return number;
  };
  const illustrative = form.get('financeMode') === 'demo';
  const opening: IcaapOpening = {
    entity: requiredText('entity'), portfolio: requiredText('portfolio'), asOf: requiredText('asOf'),
    source: illustrative ? 'Illustrative finance assumptions' : requiredText('source'), illustrative,
    cet1: amount('cet1'), at1: amount('at1'), tier2: amount('tier2'), reportedCapital: amount('reportedCapital'),
    provisions: amount('provisions'), tax: amount('tax', 100) / 100,
    cet1Min: amount('cet1Min', 100) / 100, tier1Min: amount('tier1Min', 100) / 100, totalMin: amount('totalMin', 100) / 100,
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opening.asOf) || !Number.isFinite(Date.parse(opening.asOf))
    || new Date(opening.asOf).toISOString().slice(0, 10) !== opening.asOf || opening.asOf >= `${Math.min(...runs.map((run) => run.input.horizon))}-12-31`) {
    throw new Error('Enter a valid opening date before the first reporting year-end.');
  }
  if (Math.abs(opening.cet1 + opening.at1 + opening.tier2 - opening.reportedCapital) > 0.01
    || !(opening.totalMin >= opening.tier1Min && opening.tier1Min >= opening.cet1Min && opening.cet1Min > 0)) {
    throw new Error('Opening capital must reconcile to reported capital. Enter positive, ordered CET1, Tier 1 and total requirements.');
  }
  const sources: IcaapSource[] = runs.map((rec) => {
    const { summary } = runCredit(loans, rec.input);
    const sectors = summary.bySector.filter((row) => row.ead > 0).map((row) => ({ name: row.name, baseline: row.ecl, stressed: row.eclStressed }));
    const same = (a: number, b: number) => Math.abs(a - b) <= 0.01;
    if (!same(summary.ecl, rec.headline.ecl) || !same(summary.eclStressed, rec.headline.eclStressed)
      || !same(sectors.reduce((sum, row) => sum + row.baseline, 0), summary.ecl)
      || !same(sectors.reduce((sum, row) => sum + row.stressed, 0), summary.eclStressed)) {
      throw new Error(`Facility, sector and saved ECL failed reconciliation in ${rec.id}.`);
    }
    return { scenario: rec.input.scenario, year: rec.input.horizon, runId: rec.id, status: rec.status,
      version: rec.modelVersion, asOf: opening.asOf, batchId: rec.batchId!, outputHash: rec.outputHash,
      baseline: summary.ecl, stressed: summary.eclStressed, facilities: summary.loans,
      borrowers: loans.every((loan) => loan.borrowerId) ? new Set(loans.map((loan) => loan.borrowerId)).size : null, sectors };
  });
  const file = form.get('finance');
  let finance: FinancePeriod[];
  if (illustrative) {
    finance = sources.map(({ scenario, year }) => ({ scenario, year, income: 0, writeoffs: 0, recoveries: 0,
      dividends: 0, adjustments: 0, creditRwa: loans.reduce((sum, loan) => sum + loan.ead, 0),
      marketRwa: 0, operationalRwa: 0, otherRwa: P.BANK.otherRwa, stressCreditRwaDelta: 0, injection: 0, dividendRestraint: 0, rwaReduction: 0 }));
  } else {
    if (!(file instanceof File) || !file.size || file.size > 50000) throw new Error('Upload the completed GHS finance CSV (up to 50 KB).');
    finance = readFinanceCsv(await file.text(), sources);
  }
  const rows = projectCapital(opening, sources, finance);
  const id = `ICAAP-${randomUUID()}`;
  const record: IcaapAssessment = {
    id, version: ICAAP_VERSION, createdAt: now(), by: user.name, datasetId: dataset.id, datasetHash: dataset.hash,
    evidenceHash: await sha256(JSON.stringify({ opening, rows, version: ICAAP_VERSION, datasetHash: dataset.hash })),
    opening, rows, status: 'draft',
  };
  await updateCalibrationStore((current) => ({
    ...current, icaap: [record, ...(current.icaap ?? [])],
    audit: [{ at: record.createdAt, by: user.name, action: 'icaap.created', target: id, detail: record.evidenceHash }, ...current.audit],
  }));
  return id;
}

export async function reviewIcaap(id: string, action: string, note: string) {
  const user = await currentUser();
  const at = now();
  if (!['submit', 'approve', 'reject'].includes(action) || note.length > 1000) throw new Error('Invalid ICAAP review decision.');
  await updateCalibrationStore((current) => {
    const record = current.icaap?.find((entry) => entry.id === id);
    if (!record) throw new Error('ICAAP assessment unavailable.');
    if (action === 'submit') {
      if (!user.can.includes('run' as never) || record.by !== user.name || record.status !== 'draft') throw new Error('The maker can submit their draft.');
    } else if (!user.can.includes('approve' as never) || record.by === user.name || record.status !== 'submitted') {
      throw new Error('An independent approver must review a submitted assessment.');
    }
    if (action === 'approve' && !record.rows.every(({ source }) => current.runs.some((run) =>
      run.id === source.runId && run.outputHash === source.outputHash && run.status === 'approved'))) {
      throw new Error('Every source Engine III run must be approved before ICAAP approval.');
    }
    const status = action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : 'rejected';
    return {
      ...current, icaap: current.icaap?.map((entry) => entry.id === id ? {
        ...record, status, ...(action === 'submit' ? {} : { reviewer: user.name, reviewedAt: at, note }),
      } : entry),
      audit: [{ at, by: user.name, action: `icaap.${status}`, target: id, detail: note }, ...current.audit],
    };
  });
}

export async function createIlaap(form: FormData) {
  const user = await currentUser();
  if (!user.can.includes('run' as never)) throw new Error('Only an analyst can run liquidity stress tests.');
  const d = await db();
  const profile = activeCalibration(d.calibration);
  const selected = new Set(form.getAll('scenario'));
  const pathways = GCB_PATHWAYS.filter(({ key }) => selected.has(key));
  if (!pathways.length || selected.size !== pathways.length) throw new Error('Select supported NGFS pathways.');
  const mode = form.get('mode');
  if (mode !== 'demo' && mode !== 'upload') throw new Error('Choose the Treasury input source.');
  const illustrative = mode === 'demo';
  const file = form.get('treasury');
  let raw: unknown = DEMO_TREASURY;
  if (!illustrative) {
    if (!(file instanceof File) || !file.size || file.size > 250000) throw new Error('Upload a Treasury JSON file under 250 KB.');
    try { raw = JSON.parse(await file.text()); } catch { throw new Error('The Treasury file could not be read as JSON.'); }
  }
  const inputs = readTreasuryInputs(raw);
  if (inputs.asOf >= `${Math.min(...pathways.flatMap(({ years }) => years))}-12-31`) {
    throw new Error('The Treasury snapshot must precede the earliest selected scenario year-end.');
  }
  const number = (key: string, max: number) => {
    const value = form.get(key);
    const amount = Number(value);
    if (typeof value !== 'string' || !value.trim() || !Number.isFinite(amount) || amount < 0 || amount > max) throw new Error(`Invalid ${key}.`);
    return amount;
  };
  const actions: IlaapActions = {
    funding: number('funding', 1e15), fundingDay: number('fundingDay', 365), repaymentDay: number('repaymentDay', 365),
    fundingFeePct: number('fundingFeePct', 100), salePct: number('salePct', 100), saleDay: number('saleDay', 365),
    saleDiscountPct: number('saleDiscountPct', 100), additionalOutflow: number('additionalOutflow', 1e15),
  };
  if (![actions.fundingDay, actions.repaymentDay, actions.saleDay].every((day) => ILAAP_BUCKETS.some((end) => end === day)) ||
    (actions.funding > 0 && actions.repaymentDay <= actions.fundingDay)) throw new Error('Use valid action buckets and repay funding after it is raised.');
  const rows = pathways.flatMap(({ key, years }) => years.map((year) => {
    const variables = (['gdp', 'inflation', 'rate'] as const).map((variable) => {
      const result = calibrate(key, year, variable, profile);
      return { variable, ...result, method: calibrationMethod(variable, profile) };
    });
    const [gdp, inflation, rate] = variables;
    if (![gdp.ghana, inflation.ghana, rate.ghana].every(Number.isFinite)) throw new Error(`Required macro data unavailable for ${key} ${year}.`);
    return projectLiquidity(inputs, { scenario: key, year, horizon: key === 'nz2050' ? 'Short' : key === 'delayed' ? 'Medium' : 'Long',
      gdp: gdp.ghana, inflation: inflation.ghana, rate: rate.ghana, sources: variables }, actions);
  }));
  const evidence = { version: ILAAP_MODEL, illustrative, weights: profile.coefficients, calibration: profile.id,
    release: `${NGFS.release} · ${NGFS.macroModel}`, region: NGFS.macroRegion, inputs, actions, rows };
  const record: IlaapAssessment = { id: `ILAAP-${randomUUID()}`, by: user.name, at: now(), status: 'draft',
    hash: await sha256(JSON.stringify(evidence)), ...evidence };
  await updateCalibrationStore((current) => ({ ...current, ilaap: [record, ...(current.ilaap ?? [])],
    audit: [{ at: record.at, by: user.name, action: 'ilaap.created', target: record.id, detail: record.hash }, ...current.audit] }));
  return record.id;
}

export async function reviewIlaap(id: string, decision: string, note: string, approvalReference: string) {
  const user = await currentUser();
  const at = now();
  if (!['submit', 'approve', 'reject'].includes(decision) || note.length > 1000 || approvalReference.length > 200) throw new Error('Invalid review details.');
  await updateCalibrationStore((current) => {
    const record = current.ilaap?.find((entry) => entry.id === id);
    if (!record) throw new Error('ILAAP assessment unavailable.');
    if (decision === 'submit') {
      if (!user.can.includes('run' as never) || record.status !== 'draft' || record.by !== user.name) throw new Error('Only the maker can submit this draft.');
    } else if (!user.can.includes('approve' as never) || record.status !== 'submitted' || record.by === user.name) {
      throw new Error('An independent checker must review the submitted assessment.');
    }
    if (decision === 'approve' && (!approvalReference || record.illustrative)) {
      throw new Error('Approval requires reconciled uploaded Treasury data and a Treasury/ALCO sign-off reference.');
    }
    const status = decision === 'submit' ? 'submitted' : decision === 'approve' ? 'approved' : 'rejected';
    return { ...current, ilaap: current.ilaap?.map((entry) => entry.id === id ? {
      ...entry, status, ...(decision === 'submit' ? {} : { reviewer: user.name, reviewedAt: at, note, approvalReference }),
    } : entry), audit: [{ at, by: user.name, action: `ilaap.${status}`, target: id, detail: approvalReference || note }, ...current.audit] };
  });
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
      rec.supersededRules = rec.rulesHash !== await rulesHash();
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
  d.audit.unshift({ at: now(), by: u.name, action: `screening.${action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : action === 'escalate' ? 'escalated' : 'returned'}`, target: id, detail: [note, action === 'approve' && rec.verifiedEvidence?.length ? `evidence verified: ${rec.verifiedEvidence.join(', ')}` : '', action === 'approve' && rec.supersededRules ? 'approved under superseded screening rules' : ''].filter(Boolean).join(' · ') || undefined });
  await save(d);
}
