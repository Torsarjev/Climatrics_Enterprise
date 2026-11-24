import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, readSession } from './auth';
import { demoExtract, Loan } from './portfolio';
import { ingestCsv, IngestResult } from './ingest';
import { runStress, RunInput, StressRun } from './engine';
import { Application, ScreeningResult, screen } from './screening';
import * as P from './params';
import { sha256 } from './math';
import { onNetlify, readText, writeText } from './kv';

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
  headline: { ecl: number; eclStressed: number; carBefore: number; carAfter: number; lcrAfter: number; var999: number };
}
export interface AuditEvent { at: string; by: string; action: string; target: string; detail?: string }
export interface ScreeningRecord { id: string; at: string; by: string; app: Application; result: ScreeningResult }
interface Db { datasets: Dataset[]; activeDataset: string; runs: RunRecord[]; audit: AuditEvent[]; screenings?: ScreeningRecord[] }

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

export async function getRun(id: string) {
  const d = await db();
  const rec = d.runs.find((r) => r.id === id);
  if (!rec) return null;
  if (!g.__runs!.has(id)) g.__runs!.set(id, runStress(await loadDataset(d, rec.datasetId), rec.input));
  return { rec, run: g.__runs!.get(id)! };
}

const outHash = (run: StressRun) => sha256(JSON.stringify(run.results.map((r) => [r.id, r.pdStressed.toFixed(8), r.lgdStressed.toFixed(8), r.eclStressed.toFixed(2)])) + JSON.stringify(run.lossDist.stressed.var999));

export async function createRun(input: RunInput) {
  const d = await db(), u = await currentUser();
  if (!u.can.includes('run' as never)) throw new Error('Your role cannot run stress tests');
  const { dataset, loans } = await activeLoans();
  const run = runStress(loans, input);
  const id = `RUN-${String(d.runs.length + 1).padStart(4, '0')}`;
  const rec: RunRecord = {
    id, createdAt: now(), by: u.name, input, datasetId: dataset.id, datasetHash: dataset.hash,
    modelVersion: P.MODEL_VERSION, hazardVersion: P.HAZARD_DATA_VERSION, paramsHash: await paramsHash(), outputHash: await outHash(run), seed: P.LOSS_DIST.seed,
    status: 'draft',
    headline: { ecl: run.summary.ecl, eclStressed: run.summary.eclStressed, carBefore: run.capital.carBefore, carAfter: run.capital.carAfter, lcrAfter: run.liquidity.lcrAfter, var999: run.lossDist.stressed.var999 },
  };
  d.runs.unshift(rec);
  g.__runs!.set(id, run);
  d.audit.unshift({ at: now(), by: u.name, action: 'run.created', target: id, detail: `${P.scenarioOf(input.scenario).name} · ${input.horizon} · ${input.approach} · dataset ${dataset.id}` });
  await save(d);
  return id;
}

export async function reproduce(id: string) {
  const d = await db(), u = await currentUser();
  const rec = d.runs.find((r) => r.id === id)!;
  const run = runStress(await loadDataset(d, rec.datasetId), rec.input);
  const [o, p] = [await outHash(run), await paramsHash()];
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

export async function recordScreening(app: Application) {
  const d = await db(), u = await currentUser();
  if (!u.can.includes('run' as never)) throw new Error('Only an analyst can record a screening');
  d.screenings ??= [];
  const result = screen(app);
  const id = `SCR-${String(d.screenings.length + 1).padStart(4, '0')}`;
  d.screenings.unshift({ id, at: now(), by: u.name, app, result });
  d.audit.unshift({ at: now(), by: u.name, action: 'screening.recorded', target: id, detail: `${app.borrower} · category ${result.category} · ${result.decision}` });
  await save(d);
  return id;
}
