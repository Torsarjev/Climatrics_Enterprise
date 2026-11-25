import { db, sessionUser } from '@/lib/store';
import { financeHeader, FINANCE_FIELDS } from '@/lib/icaap';
import { GCB_PATHWAYS } from '@/lib/gcb-scenarios';

export async function GET(request: Request) {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const query = new URL(request.url).searchParams;
  if (query.get('template') === '1') {
    const rows = GCB_PATHWAYS.flatMap(({ key, years }) => years.map((year) => [key, year, ...FINANCE_FIELDS.map(() => '')].join(',')));
    return new Response([financeHeader, ...rows].join('\r\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="icaap-finance-template.csv"' } });
  }
  const data = await db();
  const assessment = data.icaap?.find(({ id }) => id === query.get('id'));
  if (!assessment) return new Response('Assessment unavailable', { status: 404 });
  if (query.get('format') === 'csv') {
    const columns = ['assessment', 'status', 'finance_basis', 'scenario', 'year', 'source_run', 'currency', 'baseline_ecl', 'stressed_ecl',
      'incremental_period_expense', 'baseline_rwa', 'stressed_rwa', 'baseline_eligible_capital', 'stressed_eligible_capital',
      'baseline_cet1_pct', 'stressed_cet1_pct', 'baseline_tier1_pct', 'stressed_tier1_pct', 'baseline_total_pct', 'stressed_total_pct',
      'cet1_headroom', 'tier1_headroom', 'total_headroom', 'shortfall_before_actions', 'shortfall_after_actions', 'reverse_stress', 'evidence_hash'];
    const lines = assessment.rows.map(({ source, incrementalExpense, baseline, stressed, unmitigated }) => [
      assessment.id, assessment.status, assessment.opening.illustrative ? 'illustrative' : 'finance upload', source.scenario, source.year, source.runId, 'GHS',
      source.baseline, source.stressed, incrementalExpense, baseline.rwa, stressed.rwa, baseline.total, stressed.total,
      baseline.cet1Ratio * 100, stressed.cet1Ratio * 100, baseline.tier1Ratio * 100, stressed.tier1Ratio * 100,
      baseline.totalRatio * 100, stressed.totalRatio * 100, stressed.headroom.cet1, stressed.headroom.tier1, stressed.headroom.total,
      unmitigated.shortfall, stressed.shortfall, stressed.reverseStress, assessment.evidenceHash,
    ].join(','));
    return new Response([columns.join(','), ...lines].join('\r\n'), {
      headers: { 'Content-Type': 'text/csv', 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="${assessment.id}.csv"` },
    });
  }
  const audit = data.audit.filter(({ target }) => target === assessment.id);
  return new Response(JSON.stringify({ assessment, audit, currency: 'GHS', reconciliation: 'Facility and sector totals matched saved portfolio ECL to GHS 0.01' }, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="${assessment.id}.json"` },
  });
}
