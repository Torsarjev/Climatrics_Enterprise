import { db, sessionUser } from '@/lib/store';
import { calibrationCoefficients, calibrationEvidence, calibrationRows, readCalibration } from '@/lib/calibration';

export async function GET(request: Request) {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const query = new URL(request.url).searchParams;
  const data = await db();
  const id = query.get('run');
  const run = id ? data.runs.find((entry) => entry.id === id) : undefined;
  if (id && !run) return new Response('Scenario run unavailable', { status: 404 });
  let profile = run ? run.input.calibration : data.calibration;
  if (!run && query.get('preview') === '1') {
    try {
      const settings = readCalibration((key) => query.get(key));
      profile = { id: 'Preview', settings, coefficients: calibrationCoefficients(settings), activatedAt: '', activatedBy: '' };
    } catch (cause) {
      return new Response((cause as Error).message, { status: 400 });
    }
  }
  if (query.get('format') === 'json') {
    return new Response(JSON.stringify(calibrationEvidence(profile), null, 2), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="ghana-calibration-evidence.json"' },
    });
  }
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ['scenario', 'ngfs_model_and_version', 'region', 'projection_year', 'variable', 'unit', 'regional_scenario_shock', 'ghana_sensitivity_coefficient', 'calibrated_ghana_shock', 'calibration_methodology', 'validation_status', 'calibration_version', 'source_value'];
  const lines = calibrationRows(undefined, profile).map((r) => [r.scenario, r.release, r.region, r.year, r.variable, r.unit, r.regional.toFixed(4), r.coefficient.toFixed(4), r.ghana.toFixed(4), r.method, r.status, r.version, r.source].map(esc).join(','));
  return new Response([head.join(','), ...lines].join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="ghana-scenario-calibration.csv"' } });
}
