import { scenarioOf } from './params';

const windows = [
  { key: 'nz2050', label: 'Orderly transition', first: 2027, last: 2030 },
  { key: 'delayed', label: 'Disorderly transition', first: 2031, last: 2035 },
  { key: 'current', label: 'Current policies', first: 2036, last: 2050 },
] as const;

export const GCB_PATHWAYS = windows.map(({ key, label, first, last }) => ({
  key, label, name: scenarioOf(key).name, years: Array.from({ length: last - first + 1 }, (_, index) => first + index),
}));

export function isGcbScenarioYear(scenario: string, year: number) {
  return GCB_PATHWAYS.some((pathway) => pathway.key === scenario && pathway.years.includes(year));
}
