import { scenarioOf } from './params';

const schedule = [
  { key: 'nz2050', label: 'Orderly transition', years: [2027, 2028, 2029] },
  { key: 'delayed', label: 'Disorderly transition', years: [2030, 2032, 2034] },
  { key: 'current', label: 'Current policies', years: [2035, 2040, 2045, 2050] },
] as const;

export const GCB_PATHWAYS = schedule.map(({ key, label, years }) => ({
  key, label, name: scenarioOf(key).name, years: [...years] as number[],
}));

export function isGcbScenarioYear(scenario: string, year: number) {
  return GCB_PATHWAYS.some((pathway) => pathway.key === scenario && pathway.years.includes(year));
}
