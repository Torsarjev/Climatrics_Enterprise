import { db, sessionUser } from '@/lib/store';
import { disclosureReport, pdfReport, wordReport } from '@/lib/regulatory-document';
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
  const download = (body: BodyInit, extension: string, type: string, inline = false) => new Response(body, {
    headers: { 'Content-Type': type, 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${pack.id}.${extension}"`, 'Cache-Control': 'private, no-store' },
  });
  if (query.get('format') === 'csv') {
    const headings = 'pack,revision,status,entity,period_start,period_end,requirement,section,paragraph,framework_version,owner,applicability,rationale,narrative,gaps,evidence_ids';
    const rows = pack.rows.map((row) => [pack.id, pack.revision, pack.status, pack.entity, pack.periodStart, pack.periodEnd, row.requirement.id,
      row.requirement.section ?? '', row.requirement.paragraph, pack.standards[row.requirement.framework].version, row.owner, row.applicability, row.rationale, row.narrative,
      disclosureGaps(row).join(' | '), row.evidence.map((item) => item.id).join(' | ')].map(csv).join(','));
    return download([headings, ...rows].join('\r\n'), 'csv', 'text/csv; charset=utf-8');
  }
  const format = query.get('format') ?? 'json';
  if (['publication','preview','pdf','pdf-view','docx'].includes(format)) {
    if (pack.status !== 'approved' || !pack.hash || pack.rows.some((row) => disclosureGaps(row).length)) {
      return new Response('Publication requires an independently signed-off pack.', { status: 409 });
    }
    const lines = disclosureReport(pack);
    if (format === 'docx') return download(Uint8Array.from(await wordReport(lines)), 'docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    if (format.startsWith('pdf')) return download(Uint8Array.from(await pdfReport(lines)), 'pdf', 'application/pdf', format === 'pdf-view');
    const content = lines.map(({ level, text }) => {
      const tag = level ? 'h' + level : 'p';
      return `<${tag}>${escape(text)}</${tag}>`;
    }).join('');
    return download(`<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(pack.entity)} disclosure report</title><style>body{font:16px/1.5 system-ui;max-width:850px;margin:2rem auto;padding:1rem;color:#24332e}p{white-space:pre-wrap;overflow-wrap:anywhere}h1,h2{color:#164031}h2{border-top:1px solid #ccc;padding-top:1rem}</style><main>${content}</main></html>`, 'html', 'text/html; charset=utf-8', format === 'preview');
  }
  return download(JSON.stringify({ pack, audit: data.audit.filter((event) => event.target === pack.id) }, null, 2), 'json', 'application/json');
}
