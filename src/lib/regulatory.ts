import { hasMockPlaceholders } from './mock-disclosures';
export const REGISTER_VERSION = 'engine-iv-2026.11.1';
export const FRAMEWORKS = {
  s1: { title: 'IFRS S1', version: 'ISSB June 2023', uri: 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s1-general-requirements/' },
  s2: { title: 'IFRS S2', version: 'ISSB June 2023 · see December 2025 amendments', uri: 'https://www.ifrs.org/issued-standards/ifrs-sustainability-standards-navigator/ifrs-s2-climate-related-disclosures/' },
  bog: { title: 'Bank of Ghana', version: 'Climate-Related Financial Risk Directive · November 2024', uri: 'https://www.bog.gov.gh/reg_directives/climate-related-financial-risk-directive/' },
} as const;

export const GUIDANCE = [
  ['IFRS S2 greenhouse gas amendments · December 2025', 'https://www.ifrs.org/news-and-events/news/2025/12/issb-issues-targeted-amendments-ifrs-s2/'],
  ['BoG explanatory notes · November 2024', 'https://www.bog.gov.gh/reg_directives/explanatory-notes-for-revised-climate-related-financial-risk-directive/'],
  ['BoG Risk Management Directive · 2021', 'https://www.bog.gov.gh/reg_directives/risk-management-directive/'],
  ['BoG IFRS S1 and S2 implementation FAQ · September 2026', 'https://www.bog.gov.gh/news/most-frequently-asked-questions-faqs-on-ifrs-s1-ifrs-s2/'],
] as const;
export type Framework = keyof typeof FRAMEWORKS;
export type EvidenceKind = 'board' | 'screening' | 'physical' | 'stress' | 'capital' | 'liquidity' | 'emissions' | 'targets' | 'control' | 'bank';
export const EVIDENCE_KIND: Record<EvidenceKind, string> = {
  board: 'Board or committee record', screening: 'Borrower climate screening', physical: 'Hazard and concentration evidence',
  stress: 'NGFS scenario and ECL evidence', capital: 'Capital stress evidence', liquidity: 'Liquidity stress evidence',
  emissions: 'Emissions evidence', targets: 'Targets and progress', control: 'Review and control evidence', bank: 'Bank disclosure or policy evidence',
};
export interface Requirement {
  id: string; framework: Framework; paragraph: string; pillar: string; title: string;
  owner: string; evidence: EvidenceKind[];
}
const rows: [Framework, string, string, string, string, EvidenceKind[]][] = [
  ['s1','17–19','General','Materiality judgements','Finance / Sustainability',['bank']],
  ['s1','20–24','General','Reporting entity and connected information','Finance',['bank']],
  ['s1','26–27','Governance','Board oversight and management responsibilities','Company Secretariat',['board']],
  ['s1','28–34','Strategy','Risks, opportunities and strategic response','Strategy',['bank']],
  ['s1','35–40','Financial effects','Current and anticipated financial effects','Finance',['stress','bank']],
  ['s1','41–42','Resilience','Ability to adapt to uncertainty','Strategy / Risk',['bank']],
  ['s1','43–44','Risk management','Identification, prioritisation and monitoring','Enterprise Risk',['screening','control']],
  ['s1','45–53','Metrics and targets','Metrics, targets and progress','Sustainability',['emissions','targets']],
  ['s1','60–69','General','Location and timing of reporting','Finance',['bank']],
  ['s1','70–72','General','Comparatives and any statement of compliance','Finance / Compliance',['bank']],
  ['s2','5–7','Governance','Climate oversight and management controls','Company Secretariat',['board','control']],
  ['s2','9–12','Strategy','Climate risks, opportunities and time horizons','Climate Risk',['physical','bank']],
  ['s2','13','Strategy','Effects on business model and value chain','Strategy',['bank']],
  ['s2','14','Strategy','Strategic response and transition plan','Strategy',['bank','targets']],
  ['s2','15–21','Financial effects','Climate financial effects on position, performance and cash flows','Finance',['stress','bank']],
  ['s2','22–23','Resilience','Scenario analysis and climate resilience','Climate Risk',['stress','bank']],
  ['s2','24–26','Risk management','Climate risk and opportunity processes','Enterprise Risk',['screening','control']],
  ['s2','29(a), B58–B63','Metrics and targets','GHG emissions and financed emissions','Sustainability',['emissions']],
  ['s2','29(b)–(d)','Metrics and targets','Transition, physical and opportunity exposures','Climate Risk',['screening','physical']],
  ['s2','29(e)–(g), 32','Metrics and targets','Capital deployment, internal carbon prices, remuneration and industry metrics','Finance / Sustainability',['bank']],
  ['s2','33–37','Metrics and targets','Climate targets, monitoring and performance','Sustainability',['targets']],
  ['bog','21–28','Governance','Board and senior management oversight and risk appetite','Company Secretariat',['board','bank']],
  ['bog','29–30','Internal controls','Climate-related controls and independent assurance','Internal Audit',['control']],
  ['bog','31–33','Capital and liquidity','Climate risk in ICAAP and ILAAP','Treasury / Risk',['capital','liquidity']],
  ['bog','34–35','Risk management','Identify, assess and manage material risks','Enterprise Risk',['screening','physical']],
  ['bog','36','Monitoring','Indicators, data controls and management reporting','Enterprise Risk',['physical','control']],
  ['bog','37–38','Risk management','Climate drivers across financial risk categories','Enterprise Risk',['stress','bank']],
  ['bog','39–40','Scenario analysis','Physical and transition scenario analysis','Climate Risk',['stress']],
  ['bog','41–47','Prudential disclosures','Climate disclosure evidence','Compliance',['board','stress','emissions']],
  ['bog','48(a)–(m)','Regulatory reporting','Supervisory information, exposures and assumptions','Compliance',['screening','physical','stress','bank']],
  ['bog','49–50','Regulatory reporting','Transition plan submission and remediation of data gaps','Compliance',['capital','targets','control']],
  ['bog','Part V','Transition plan','Transition planning and monitoring','Strategy',['bank','targets']],
];
export const REQUIREMENTS: Requirement[] = rows.map(([framework, paragraph, pillar, title, owner, evidence]) => ({
  id: `${framework}-${paragraph}`, framework, paragraph, pillar, title, owner, evidence,
}));

export type Applicability = 'pending' | 'applicable' | 'not-applicable';
export interface SourceEvidence {
  id: string; kind: EvidenceKind; label: string; provider: string; uri: string; hash: string;
  version: string; units: string; resolution: string; methodology: string; limitations: string;
  sourceApproval: 'approved' | 'documentary'; sourceReviewer: string;
  metrics?: { label: string; value: number; unit: string }[];
}
export interface DisclosureEvidence extends SourceEvidence {
  requirementId: string; standardVersion: string; retrievedAt: string;
  reportingEntity: string; periodStart: string; periodEnd: string;
  linkedDisclosure: string; retention: string;
  applicability: Applicability; controlOwner: string; reviewer?: string; approvalState: 'pending' | 'approved';
}
export interface DisclosureRow {
  requirement: Requirement; owner: string; applicability: Applicability; rationale: string; narrative: string;
  evidence: DisclosureEvidence[];
}
export interface RegulatoryPack {
  id: string; previousId?: string; revision: number; version: string; frameworks: Framework[];
  standards: Pick<Record<Framework, typeof FRAMEWORKS[Framework]>, Framework>;
  entity: string; periodStart: string; periodEnd: string; by: string; at: string;
  status: 'draft' | 'submitted' | 'approved' | 'returned';
  reviewer?: string; reviewedAt?: string; reviewNote?: string; hash?: string;
  rows: DisclosureRow[];
}
export function disclosureGaps(row: DisclosureRow) {
  if (row.applicability === 'pending') return ['Confirm applicability'];
  if (row.applicability === 'not-applicable') return row.rationale.trim() ? [] : ['Document applicability rationale'];
  return [
    ...(!row.owner.trim() ? ['Assign owner'] : []),
    ...(!row.narrative.trim() ? ['Draft the disclosure'] : hasMockPlaceholders(row.narrative) ? ['Replace mock disclosure placeholders'] : []),
    ...row.requirement.evidence.filter((kind) => !row.evidence.some((item) => item.kind === kind)).map((kind) => EVIDENCE_KIND[kind]),
  ];
}
