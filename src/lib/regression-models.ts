export const BENCHMARKS = { SSF: 'Sub-Saharan Africa', NGA: 'Nigeria', KEN: 'Kenya' } as const;
export type Benchmark = keyof typeof BENCHMARKS;
export type MacroModel = 'gdp' | 'inflation' | 'rate' | 'energy';

export const REGRESSION_MODELS = {
  gdp: { label: 'Real GDP growth', variable: 'Δ real GDP growth (pp)', purpose: 'Estimate how Ghana’s growth responds to benchmark growth changes for borrower revenue and sector credit stress.' },
  inflation: { label: 'CPI inflation', variable: 'Δ annual CPI inflation (pp)', purpose: 'Estimate how Ghana’s inflation responds to benchmark inflation changes for operating-cost and sector credit stress.' },
  rate: { label: 'Long-term sovereign yield', variable: 'Δ long-term yield (pp)', purpose: 'Estimate Ghana’s sensitivity to comparable yield changes for floating-rate debt service and sector credit stress.' },
  energy: { label: 'Energy price', variable: 'Δ ln(energy price)', purpose: 'Estimate the relative response of Ghana energy prices for the energy-exposed share of operating costs.' },
} as const;

export function readBenchmark(value: FormDataEntryValue | null): Benchmark {
  if (value === null || value === 'SSF') return 'SSF';
  if (value === 'NGA' || value === 'KEN') return value;
  throw new Error('Choose a supported World Bank benchmark.');
}

export function regressionEquation(key: MacroModel, benchmark: string, fit: { alpha: number; beta: number }) {
  const { variable } = REGRESSION_MODELS[key];
  return `Ghana ${variable} = ${fit.alpha.toFixed(4)} ${fit.beta < 0 ? '−' : '+'} ${Math.abs(fit.beta).toFixed(4)} × ${benchmark} ${variable} + ε`;
}
