export const STAGED_ECL_MODEL = 'staged-ecl-v1' as const;
export const MAX_ECL_MATURITY = 100;

export interface LossPeriod {
  year: number;
  time: number;
  defaultProbability: number;
  ead: number;
  discount: number;
  loss: number;
}

export function stagedEcl({ stage, pd, lgd, ead, maturity, rate }: {
  stage: number; pd: number; lgd: number; ead: number; maturity: number; rate: number;
}) {
  if (!Number.isFinite(maturity) || maturity <= 0 || maturity > MAX_ECL_MATURITY) throw new Error('Invalid remaining maturity for staged ECL');
  const life = maturity;
  const horizon = stage === 2 ? life : Math.min(1, life);
  const periods: LossPeriod[] = [];
  let survival = 1;
  for (let start = 0; start < horizon; start += 1) {
    const time = Math.min(start + 1, horizon);
    const conditional = stage === 3 ? 1 : 1 - (1 - pd) ** (time - start);
    const defaultProbability = survival * conditional;
    const outstanding = ead * (1 - start / life);
    const discount = (1 + rate) ** -time;
    periods.push({ year: start + 1, time, defaultProbability, ead: outstanding, discount, loss: defaultProbability * outstanding * lgd * discount });
    survival *= 1 - conditional;
  }
  return { periods, total: periods.reduce((sum, period) => sum + period.loss, 0) };
}
