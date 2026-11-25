import type { RunRecord } from './store';

export type ReportingRun = RunRecord & { batchId: string; reporting: NonNullable<RunRecord['reporting']> };
export interface ReportingBatch {
  id: string;
  first: ReportingRun;
  records: ReportingRun[];
  approved: boolean;
}

export function reportingBatches(runs: RunRecord[]): ReportingBatch[] {
  const groups = new Map<string, ReportingRun[]>();
  for (const rec of runs) {
    if (!rec.batchId || !rec.reporting) continue;
    const group = groups.get(rec.batchId) ?? [];
    group.push({ ...rec, batchId: rec.batchId, reporting: rec.reporting });
    groups.set(rec.batchId, group);
  }
  return [...groups].map(([id, records]) => {
    records.sort((a, b) => a.input.horizon - b.input.horizon);
    return { id, first: records[0], records, approved: records.every((item) => item.status === 'approved') };
  }).sort((a, b) => b.first.createdAt.localeCompare(a.first.createdAt));
}

export function latestByPathway(batches: ReportingBatch[]) {
  const pick = new Map<string, ReportingBatch>();
  for (const batch of batches) {
    const scenario = batch.first.input.scenario;
    const existing = pick.get(scenario);
    if (!existing || (!existing.approved && batch.approved)) pick.set(scenario, batch);
  }
  return [...pick.values()];
}
