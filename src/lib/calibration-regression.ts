export type Observation = { year: number; ghana: number; regional: number };

export function regressChanges(observations: Observation[]) {
  const changes = observations.slice(1).map((row, index) => ({
    year: row.year,
    ghana: row.ghana - observations[index].ghana,
    regional: row.regional - observations[index].regional,
  }));
  const n = changes.length;
  const mx = changes.reduce((sum, row) => sum + row.regional, 0) / n;
  const my = changes.reduce((sum, row) => sum + row.ghana, 0) / n;
  const xx = changes.reduce((sum, row) => sum + (row.regional - mx) ** 2, 0);
  const yy = changes.reduce((sum, row) => sum + (row.ghana - my) ** 2, 0);
  if (xx <= 1e-12) throw new Error('The regional annual changes have insufficient variation for a regression.');
  const xy = changes.reduce((sum, row) => sum + (row.regional - mx) * (row.ghana - my), 0);
  const beta = xy / xx;
  const alpha = my - beta * mx;
  const rss = changes.reduce((sum, row) => sum + (row.ghana - alpha - beta * row.regional) ** 2, 0);
  return { n, beta, alpha, r2: yy > 0 ? 1 - rss / yy : null, standardError: Math.sqrt(rss / (n - 2) / xx), changes };
}

export function readRateEvidence(csv: string, source: string, start: number, end: number) {
  if (!csv.trim()) {
    if (source.trim()) throw new Error('Provide matched rate observations with the rate source.');
    return undefined;
  }
  if (!source.trim() || source.length > 1000) throw new Error('Provide the Ghana and regional sources, geography, tenor and annual observation convention (up to 1,000 characters).');
  const [header, ...lines] = csv.trim().replace(/^\uFEFF/, '').split(/\r?\n/);
  if (header.trim() !== 'year,ghana,regional' || lines.length > 100) throw new Error('Use the CSV header year,ghana,regional and up to 100 annual rows.');
  const observations = lines.map((line) => {
    const fields = line.split(',').map((field) => field.trim());
    const [year, ghana, regional] = fields.map(Number);
    if (fields.length !== 3 || fields.some((field) => !field) || !Number.isInteger(year)
      || year < 1900 || year > 2100 || ![ghana, regional].every((value) => Number.isFinite(value) && Math.abs(value) <= 1000)) {
      throw new Error('Each rate row must contain a year and two finite percentage rates, such as 12.5 for 12.5%.');
    }
    return { year, ghana, regional };
  }).sort((a, b) => a.year - b.year);
  if (observations.some((row, index) => index > 0 && row.year === observations[index - 1].year)) throw new Error('Rate observations must have unique years.');
  const sample = observations.filter((row) => row.year >= start && row.year <= end);
  if (sample.length < 9 || sample.some((row, index) => index > 0 && row.year !== sample[index - 1].year + 1)) {
    throw new Error('Provide at least nine consecutive matched annual rate observations within the selected window.');
  }
  return { source: source.trim(), observations, sample, fit: regressChanges(sample) };
}
