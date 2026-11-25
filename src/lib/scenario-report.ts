import type { StressRun } from './engine';

export function scenarioReporting(run: StressRun) {
  return {
    incrementalEcl: run.capital.additionalProvisions,
    profitBeforeTaxImpact: -run.capital.additionalProvisions,
    capitalBefore: run.capital.capitalBefore,
    capitalAfter: run.capital.capitalAfter,
    lcrBefore: run.liquidity.lcrBefore,
    shocks: run.shocks,
  };
}
