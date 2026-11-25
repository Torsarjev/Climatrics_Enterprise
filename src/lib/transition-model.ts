import { clamp } from './math';

export interface TransitionScoreInputs {
  sensitivity: number;
  sectorBenchmark: number;
  intensity: number;
  relief: number;
}

export function normalizeTransitionIntensity(emissionsIntensity: number, sectorBenchmark: number) {
  return clamp(emissionsIntensity / (sectorBenchmark * 1.4));
}

export function transitionScoreFromInputs({ sensitivity, intensity, relief }: TransitionScoreInputs, shock: number) {
  return clamp(sensitivity * shock * (0.6 + 0.4 * intensity) * (1 - relief));
}
