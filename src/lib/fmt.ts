export const ghs = (n: number, d = 1) => {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  if (a >= 1e9) return `${s}GHS ${(a / 1e9).toFixed(d + 1)}bn`;
  if (a >= 1e6) return `${s}GHS ${(a / 1e6).toFixed(d)}m`;
  if (a >= 1e3) return `${s}GHS ${(a / 1e3).toFixed(0)}k`;
  return `${s}GHS ${a.toFixed(0)}`;
};
export const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`;
export const pp = (n: number, d = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n * 100).toFixed(d)} pp`;
export const num = (n: number, d = 2) => n.toFixed(d);
export const to5 = (n: number) => 1 + 4 * Math.min(1, Math.max(0, n));
export const s5 = (n: number) => to5(n).toFixed(1);
export const delta = (a: number, b: number) => (a === 0 ? '—' : `${b >= a ? '+' : '−'}${Math.abs(((b - a) / a) * 100).toFixed(0)}%`);
export const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
