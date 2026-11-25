import { db, sessionUser } from '@/lib/store';
import { disclosureGaps } from '@/lib/regulatory';

const csv = (value: string | number) => {
  const text = String(value);
  return `"${(/^[\s]*[=+@-]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`;
};
const escape = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export async function GET(request: Request) {
  if (!(await sessionUser())) return new Response('Unauthorised', { status: 401 });
  const query = new URL(request.url).searchParams;
  const data = await db();
  const pack = data.regulatory?.find(({ id }) => id === query.get('id'));
  if (!pack) return new Response('Pack unavailable', { status: 404 });
  const download = (body: string, extension: string, type: string) => new Response(body, {
    headers: { 'Content-Type': type, 'Content-Disposition': `attachment; filename="${pack.id}.${extension}"`, 'Cache-Control': 'private, no-store' },
  });
  if (query.get('format') === 'csv') {
    const headings = 'pack,revision,status,entity,period_start,period_end,requirement,paragraph,framework_version,owner,applicability,rationale,narrative,gaps,evidence_ids';
    const rows = pack.rows.map((row) => [pack.id, pack.revision, pack.status, pack.entity, pack.periodStart, pack.periodEnd, row.requirement.id,
      row.requirement.paragraph, pack.standards[row.requirement.framework].version, row.owner, row.applicability, row.rationale, row.narrative,
      disclosureGaps(row).join(' | '), row.evidence.map((item) => item.id).join(' | ')].map(csv).join(','));
    return download([headings, ...rows].join('\r\n'), 'csv', 'text/csv; charset=utf-8');
  }
  if (query.get('format') === 'publication') {
    if (pack.status !== 'approved' || !pack.hash || pack.rows.some((row) => disclosureGaps(row).length)) {
      return new Response('Publication requires an independently signed-off pack.', { status: 409 });
    }
    const metricsTable = (items: NonNullable<(typeof pack.rows)[number]['evidence'][number]['metrics']>) => items.length
      ? `<table><thead><tr><th>Source measure</th><th>Value</th><th>Unit</th></tr></thead><tbody>${items.map((m) => `<tr><td>${escape(m.label)}</td><td>${m.value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}</td><td>${escape(m.unit)}</td></tr>`).join('')}</tbody></table>` : '';
    const sections = pack.rows.filter((row) => row.applicability === 'applicable').map(({ requirement, narrative, evidence }) =>
      `<section><h2>${escape(pack.standards[requirement.framework].title)} · ${escape(requirement.paragraph)} · ${escape(requirement.title)}</h2><p>${escape(narrative)}</p><ul>${evidence.map((item) => `<li>${escape(item.label)} · ${escape(item.id)} · ${escape(item.version)} · ${escape(item.retrievedAt)}</li>`).join('')}</ul>${metricsTable(evidence.flatMap((item) => item.metrics ?? []))}</section>`);
    return download(`<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(pack.entity)} disclosures</title><style>body{font:16px system-ui;max-width:900px;margin:2rem auto;padding:1rem}p{white-space:pre-wrap}h2{font-size:1.2rem;color:#173526}section{border-top:1px solid #ccc;margin-top:1rem}</style><h1>${escape(pack.entity)} disclosure pack</h1><p>${pack.periodStart} to ${pack.periodEnd} · Revision ${pack.revision} · ${escape(pack.version)}</p><p>Signed off by ${escape(pack.reviewer ?? '')} · ${escape(pack.reviewedAt ?? '')} · ${pack.hash}</p>${sections.join('')}</html>`, 'html', 'text/html; charset=utf-8');
  }
  return download(JSON.stringify({ pack, audit: data.audit.filter((event) => event.target === pack.id) }, null, 2), 'json', 'application/json');
}
