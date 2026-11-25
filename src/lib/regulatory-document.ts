import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import PDFDocument from 'pdfkit';
import { join } from 'node:path';
import type { RegulatoryPack } from './regulatory';

type Line = { level: 0 | 1 | 2; text: string };
export function disclosureReport(pack: RegulatoryPack) {
  const lines: Line[] = [];
  const add = (text: string, level: Line['level'] = 0) => lines.push({ level, text });
  add(pack.entity + ' disclosure report', 1);
  add(pack.periodStart + ' to ' + pack.periodEnd);
  add(pack.id + ' · Revision ' + pack.revision + ' · Register ' + pack.version);
  add('Prepared by ' + pack.by + ' · Signed by ' + pack.reviewer + ' on ' + pack.reviewedAt);
  add('Signed record hash ' + pack.hash);
  if (pack.previousId) add('Previous revision ' + pack.previousId);
  if (pack.reviewNote) add('Review decision — ' + pack.reviewNote);
  for (const framework of pack.frameworks) {
    const standard = pack.standards[framework];
    const rows = pack.rows.filter(row => row.requirement.framework === framework);
    add(standard.title, 1);
    add(standard.version + ' · ' + rows.length + ' requirements · ' + rows.filter(r => r.applicability === 'applicable').length + ' applicable');
    for (const row of rows) {
      const req = row.requirement;
      add([req.section, req.paragraph, req.title].filter(Boolean).join(' · '), 2);
      add(req.id + ' · ' + row.owner + ' · ' + row.applicability);
      if (row.rationale) add('Applicability rationale — ' + row.rationale);
      if (row.applicability !== 'applicable') continue;
      add(row.narrative);
      for (const e of row.evidence) {
        add('Evidence — ' + e.label + ' (' + e.id + ')');
        add([e.provider, e.version, e.uri, e.retrievedAt].join(' · '));
        add('Source hash ' + e.hash);
        add([e.methodology, e.units, e.resolution].filter(Boolean).join(' · '));
        add('Limitations — ' + e.limitations);
        add([e.controlOwner, e.reviewer, e.approvalState, e.retention].filter(Boolean).join(' · '));
        for (const m of e.metrics ?? []) add(m.label + ' — ' + m.value + ' ' + m.unit);
      }
    }
  }
  return lines;
}

export async function wordReport(lines: Line[]) {
  return Packer.toBuffer(new Document({ sections: [{ children: lines.map(({level, text}) =>
    new Paragraph({ text, heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : undefined })) }] }));
}

export function pdfReport(lines: Line[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const dir = join(process.cwd(), 'assets/report-fonts');
    const doc = new PDFDocument({ size: 'A4', margin: 48, font: join(dir, 'DejaVuSans.ttf') });
    doc.registerFont('body', join(dir, 'DejaVuSans.ttf')).registerFont('heading', join(dir, 'DejaVuSans-Bold.ttf'));
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk)).on('error', reject).on('end', () => resolve(Buffer.concat(chunks)));
    for (const {level, text} of lines) {
      if (level && doc.y > doc.page.height - 125) doc.addPage();
      doc.font(level ? 'heading' : 'body').fontSize(level === 1 ? 18 : level === 2 ? 13 : 9)
        .fillColor(level ? '#164031' : '#24332e').text(text, { paragraphGap: level ? 8 : 4 });
    }
    doc.end();
  });
}
