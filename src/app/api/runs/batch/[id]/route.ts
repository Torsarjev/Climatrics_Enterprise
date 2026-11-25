import { scenarioBatchRuns, sessionUser } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const { id } = await params;
  const records = await scenarioBatchRuns(id);
  if (!records.length) return new Response('Batch not found', { status: 404 });
  const headers = [
    'batch_id', 'run_id', 'scenario', 'reporting_year', 'approach', 'created_at_utc', 'analyst', 'status', 'reviewer', 'reviewed_at_utc',
    'dataset_id', 'dataset_hash', 'model_version', 'parameters_hash', 'output_hash',
    'gdp_pct', 'inflation_pp', 'rate_pp', 'carbon_usd2010_per_t', 'rainfall_multiplier', 'physical_multiplier',
    'baseline_ecl_ghs', 'stressed_ecl_ghs', 'incremental_ecl_ghs', 'pretax_provision_profit_impact_ghs', 'baseline_capital_ghs', 'stressed_capital_ghs',
    'baseline_car_pct', 'stressed_car_pct', 'car_change_pp', 'baseline_lcr_pct', 'stressed_lcr_pct', 'lcr_change_pp',
  ];
  const escape = (value: string | number = '') => `"${String(value).replace(/"/g, '""')}"`;
  const lines = records.map((rec) => {
    const report = rec.reporting!;
    const h = rec.headline, s = report.shocks;
    return [id, rec.id, rec.input.scenario, rec.input.horizon, rec.input.approach, rec.createdAt, rec.by, rec.status, rec.reviewedBy, rec.reviewedAt,
      rec.datasetId, rec.datasetHash, rec.modelVersion, rec.paramsHash, rec.outputHash,
      s.gdp, s.inflation, s.rate, s.carbon, s.flood, s.physical,
      h.ecl, h.eclStressed, report.incrementalEcl, report.profitBeforeTaxImpact, report.capitalBefore, report.capitalAfter,
      h.carBefore * 100, h.carAfter * 100, (h.carAfter - h.carBefore) * 100,
      report.lcrBefore * 100, h.lcrAfter * 100, (h.lcrAfter - report.lcrBefore) * 100].map(escape).join(',');
  });
  return new Response([headers.join(','), ...lines].join('\r\n'), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="scenario-${records[0].batchId}.csv"`, 'Cache-Control': 'private, no-store' },
  });
}
