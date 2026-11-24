import { sessionUser } from '@/lib/store';
import { calibrationRows } from '@/lib/calibration';

export async function GET() {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ['scenario', 'ngfs_model_and_version', 'region', 'projection_year', 'variable', 'unit', 'regional_scenario_shock', 'ghana_sensitivity_coefficient', 'calibrated_ghana_shock', 'calibration_methodology', 'validation_status', 'calibration_version'];
  const lines = calibrationRows().map((r) => [r.scenario, r.release, r.region, r.year, r.variable, r.unit, r.regional.toFixed(4), r.coefficient.toFixed(4), r.ghana.toFixed(4), r.method, r.status, r.version].map(esc).join(','));
  return new Response([head.join(','), ...lines].join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="ghana-scenario-calibration.csv"' } });
}
