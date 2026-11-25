import { clamp } from './math';

export interface TransitionScoreInputs {
  sensitivity: number;
  sectorBenchmark: number;
  intensity: number;
  relief: number;
}

export function transitionScoreFromInputs({ sensitivity, intensity, relief }: TransitionScoreInputs, shock: number) {
  return clamp(sensitivity * shock * (0.6 + 0.4 * intensity) * (1 - relief));
}
