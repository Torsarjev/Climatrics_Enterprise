import type { CalibrationExecution } from './store';
import { scenarioOf } from './params';

export function calibrationReview(execution: CalibrationExecution) {
  const { profile, comparison, dataset, decision, createdAt, createdBy, modelFingerprint, preview, evidence, rateEvidence } = execution;
  const diagnostics = !Array.isArray(evidence.diagnostics) ? evidence.diagnostics : undefined;
  const coefficientRows = [
    ['GDP', profile.coefficients.gdp, diagnostics?.gdp.fit],
    ['Inflation', profile.coefficients.inflation, diagnostics?.inflation.fit],
    ['Long-term interest rate', profile.coefficients.rate, rateEvidence?.fit],
  ] as const;
  return [
    `# Ghana calibration review · ${profile.id}`,
    '',
    `Executed by ${createdBy} at ${createdAt} using ${profile.method}.`,
    `Loan book ${dataset.name} · ${dataset.id} · ${dataset.facilities} facilities · SHA-256 ${dataset.hash}.`,
    `Parameter fingerprint ${modelFingerprint}. Compared with ${comparison.id}.`,
    decision ? `Decision ${decision.action} by ${decision.by} at ${decision.at}.` : 'Awaiting an activation decision.',
    decision?.note ? `Decision note — ${decision.note}` : '',
    '',
    '## Regression and source data',
    '',
    `WDI sample ${profile.settings.start}–${profile.settings.end}. GDP growth and inflation use Ghana and Sub-Saharan Africa annual observations.`,
    'Ordinary least squares fits annual Ghana changes on annual regional changes with an intercept. The fitted slope scales the NGFS shock. The intercept is reported for fit assessment.',
    `Long-term rate basis — ${rateEvidence ? rateEvidence.source : 'regional NGFS rate at ×1; no local sensitivity estimated'}.`,
    'Carbon price uses the regional scenario value. Physical multipliers use Ghana CCKP projections and the documented pathway mappings.',
    '',
    '| Variable | Applied slope or factor | Intercept | R² | Slope std. error | Annual changes |',
    '|---|---:|---:|---:|---:|---:|',
    ...coefficientRows.map(([label, coefficient, fit]) => `| ${label} | ${coefficient.toFixed(4)} | ${fit?.alpha.toFixed(4) ?? '—'} | ${fit?.r2?.toFixed(3) ?? '—'} | ${fit?.standardError.toFixed(4) ?? '—'} | ${fit?.n ?? '—'} |`),
    '',
    '## Scenario and ECL preview',
    '',
    '| Pathway | Year | Approach | GDP active → candidate (%) | Inflation active → candidate (pp) | Rate active → candidate (pp) | Unstressed ECL (GHS) | Active stress (GHS) | Candidate stress (GHS) | Change (GHS) |',
    '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|',
    ...preview.map((row) => {
      const shocks = (['gdp', 'inflation', 'rate'] as const).map((key) => `${row.activeShocks[key].toFixed(4)} → ${row.candidateShocks[key].toFixed(4)}`);
      const losses = [row.baselineEcl, row.activeEcl, row.candidateEcl, row.candidateEcl - row.activeEcl].map((amount) => amount.toFixed(2));
      return `| ${[scenarioOf(row.scenario).name, row.year, row.approach, ...shocks, ...losses].join(' | ')} |`;
    }),
    '',
    '## Review limitations',
    '',
    'Historical co-movement is a proxy for scenario transmission. Review sample sensitivity, structural breaks, slope sign, benchmark comparability and model fit. National physical projections can miss site-level extremes. ECL is conditional on the saved loan book and credit model, and reporting years are evaluated independently. The evidence JSON contains the source extracts, matched observations, fitted diagnostics and full scenario inputs.',
    '',
  ].join('\n');
}
