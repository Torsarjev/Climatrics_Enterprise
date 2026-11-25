import { calibrationReview } from '@/lib/calibration-review';
import { db, sessionUser } from '@/lib/store';
import { activeCalibration, calibrationEvidence, calibrationRows } from '@/lib/calibration';

export async function GET(request: Request) {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const query = new URL(request.url).searchParams;
  const data = await db();
  const id = query.get('run');
  const version = query.get('version');
  const run = id ? data.runs.find((entry) => entry.id === id) : undefined;
  const active = activeCalibration(data.calibration);
  const profileId = run ? run.input.calibration?.id : version ?? active.id;
  const execution = data.calibrationExecutions?.find((entry) => entry.profile.id === profileId);
  if ((id && !run) || (version && !execution)) return new Response('Calibration record unavailable', { status: 404 });
  const profile = run ? run.input.calibration : execution?.profile ?? active;
  if (query.get('format') === 'review') {
    if (!execution) return new Response('Saved calibration required', { status: 404 });
    return new Response(calibrationReview(execution), {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${execution.profile.id}-review.md"`, 'Cache-Control': 'private, no-store' },
    });
  }
  if (query.get('format') === 'json') {
    return new Response(JSON.stringify(execution ?? calibrationEvidence(profile), null, 2), {
      headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="ghana-calibration-evidence.json"', 'Cache-Control': 'private, no-store' },
    });
  }
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ['scenario', 'ngfs_model_and_version', 'region', 'projection_year', 'variable', 'unit', 'regional_scenario_shock', 'ghana_sensitivity_coefficient', 'calibrated_ghana_shock', 'calibration_methodology', 'validation_status', 'calibration_version', 'source_value'];
  const lines = (execution?.evidence.calibratedResults ?? calibrationRows(undefined, profile)).map((r) => [r.scenario, r.release, r.region, r.year, r.variable, r.unit, r.regional.toFixed(4), r.coefficient.toFixed(4), r.ghana.toFixed(4), r.method, r.status, r.version, r.source].map(esc).join(','));
  return new Response([head.join(','), ...lines].join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="ghana-scenario-calibration.csv"' } });
}
