import type { EvidenceKind, Requirement } from './regulatory';

type Clause = [paragraph: string, title: string, evidence: EvidenceKind[]];
const clauses: [section: string, pillar: string, owner: string, items: Clause[]][] = [
  ['Part I B, E and F', 'Scope and implementation', 'Compliance', [
    ['2–3', 'Regulatory perimeter and related directives', ['bank']],
    ['7', 'Proportionality assessment', ['bank']],
    ['8', 'Applicable implementation date', ['bank']],
    ['9', 'Alignment of governance, policies and processes and quarterly updates', ['bank','control']],
  ]],
  ['Part III A', 'Corporate governance', 'Company Secretariat', [
    ['21', 'Risk strategies, policies and minimum standards', ['board','bank']],
    ['22', 'Material risk assessment across time horizons and integration into the risk framework', ['physical','bank']],
    ['23', 'Risk appetite metrics, limits and targets', ['board','targets']],
    ['24', 'Responsibilities across the three lines of defence', ['board','control']],
    ['25', 'Embedding risk controls in business units and client processes', ['screening','control']],
    ['26', 'Communication of the assessment approach across the three lines', ['control']],
    ['27', 'Senior management review, implementation and escalation', ['board','control']],
    ['28', 'Board and management competence and capacity building', ['board','control']],
  ]],
  ['Part III B', 'Internal controls', 'Internal Audit', [
    ['29(a)', 'Control responsibilities and reporting lines', ['control']],
    ['29(b)', 'Staff understanding of financial risk impacts', ['control']],
    ['29(c)', 'Internal audit assurance on governance, controls and data', ['control']],
    ['30', 'AML/CFT controls for illicit financing linked to environmental crime', ['control']],
  ]],
  ['Part III C', 'Capital and liquidity adequacy', 'Treasury / Risk', [
    ['31', 'Quantification of material climate risks in capital and liquidity adequacy', ['capital','liquidity']],
    ['32', 'Regional scenario suitability and supplemental assumptions', ['stress']],
    ['33', 'ICAAP exposure analysis and impact on capital adequacy', ['capital']],
  ]],
  ['Part III D', 'Risk management process', 'Enterprise Risk', [
    ['34', 'Identification, measurement, monitoring and management over relevant horizons', ['screening','physical']],
    ['35', 'Operational risk management measures, limits, counterparty engagement and policy', ['screening','bank','control']],
  ]],
  ['Part III E', 'Management monitoring and reporting', 'Enterprise Risk', [
    ['36', 'Management risk reporting, data controls and indicators', ['physical','control']],
  ]],
  ['Part III F', 'Financial and operational risk', 'Enterprise Risk', [
    ['37', 'Climate effects on credit, market and liquidity risk', ['stress','liquidity','bank']],
    ['38', 'Operational resilience, critical services and continuity plans', ['bank','control']],
  ]],
  ['Part III G', 'Scenario analysis', 'Climate Risk', [
    ['39', 'Resilience and vulnerability under plausible pathways', ['stress']],
    ['40', 'Physical and transition scenarios across risk types and horizons', ['stress','capital','liquidity']],
  ]],
  ['Part IV A', 'Publication quality and scope', 'Compliance', [
    ['41(a)–(f)', 'Completeness, clarity, comparability, reliability, timing and decision usefulness', ['control','bank']],
    ['42', 'Directors’ Report and Annual Report disclosure locations', ['bank']],
    ['42(a)–(d)', 'ISSB standards and guidance, ICAG adoption and applicable SEC guidance', ['bank']],
    ['46', 'Applicable BoG standardised disclosure template', ['bank']],
    ['47(a)–(b)', 'Periodic review against international standards and peer practice', ['control']],
  ]],
  ['Part IV A · 43(a)', 'Governance disclosures', 'Company Secretariat', [
    ['43(a)(i)', 'Oversight body and responsibilities documented in mandates and policies', ['board']],
    ['43(a)(ii)', 'Management delegation, controls and integration with internal functions', ['board','control']],
    ['43(a)(iii)', 'Board skills and competence for oversight', ['board']],
    ['43(a)(iv)', 'Frequency and channels for Board and committee reporting', ['board']],
    ['43(a)(v)', 'Climate considerations in strategy, transactions and risk oversight', ['board']],
  ]],
  ['Part IV A · 43(b)', 'Strategy disclosures', 'Strategy / Finance', [
    ['43(b)(i)', 'Risks affecting cash flow, access to finance and cost of capital', ['stress','bank']],
    ['43(b)(ii)', 'Current and anticipated effects on business model and value chain', ['bank','physical']],
    ['43(b)(iii)', 'Effects on strategy and decisions, including transition planning', ['bank','targets']],
    ['43(b)(iv)', 'Current and anticipated financial effects and their use in planning', ['stress','bank']],
    ['43(b)(v)', 'Strategy and business-model resilience under climate uncertainty', ['stress','bank']],
    ['43(b) accompanying response guidance', 'Resource reallocation, indirect mitigation and adaptation, and transition dependencies', ['bank','targets']],
    ['45', 'Current and future effects on markets, strategy, financial statements and cash flows', ['stress','bank']],
  ]],
  ['Part IV A · 43(c)', 'Risk management disclosures', 'Enterprise Risk', [
    ['43(c)(i)', 'Risk inputs, scenarios, assessment, prioritisation, monitoring and period changes', ['screening','stress','control']],
    ['43(c)(ii)', 'Integration into overall risk management', ['bank','control']],
  ]],
  ['Part IV A · 43(d)', 'Metrics and targets disclosures', 'Finance / Sustainability', [
    ['43(d)', 'Climate performance measures and progress towards targets', ['targets']],
    ['43(d)(i)', 'Non-financial corporate sector exposure and share of total exposure', ['bank']],
    ['43(d)(ii)', 'Physical-risk exposures by geography and shares of exposures and assets', ['physical','bank']],
    ['43(d)(iii)', 'Maturity profile of physical and transition risk exposures', ['bank']],
    ['43(d)(iv)', 'Carbon-intensive and renewable project exposures as shares of total exposure', ['screening','bank']],
    ['43(d)(v)', 'Vulnerable-sector exposures under the Sustainable Banking Principles guidance', ['bank']],
  ]],
  ['Part IV A · 43(e)', 'Transition risk disclosures', 'Sustainability', [
    ['43(e)(i)', 'Counterparty mitigation and adaptation, instruments and financed projects', ['screening','bank']],
    ['43(e)(ii)', 'Plans to estimate financed emissions where estimates are unavailable', ['bank']],
  ]],
  ['Part IV A · 43(f)', 'Physical risk methodology disclosures', 'Climate Risk', [
    ['43(f)(i)', 'Selected acute and chronic hazards and their relevance to the business', ['physical']],
    ['43(f)(ii)', 'Geographic breakdown and granularity by hazard', ['physical']],
    ['43(f)(iii)', 'Physical risk horizons and scenarios', ['physical','stress']],
    ['43(f)(iv)', 'Criteria for identifying counterparty activity locations and vulnerabilities', ['physical']],
  ]],
  ['Part IV A · 43(g)', 'Concentration risk disclosures', 'Enterprise Risk', [
    ['43(g)(i)', 'Impact of exposed counterparties on risk and financial performance', ['physical','stress']],
    ['43(g)(ii)', 'Identification of vulnerable concentrations and assessment of likelihood and impact', ['physical','bank']],
    ['43(g)(iii)', 'Monitoring concentrations by sector and location', ['physical','control']],
    ['43(g)(iv)', 'Concentration effects on decisions and mitigation actions', ['bank']],
  ]],
  ['Part IV A · 44', 'Transition plan disclosures', 'Strategy', [
    ['44', 'Market disclosure of transition plan, progress, targets and review process', ['bank','targets']],
    ['44(a)', 'GHG emissions performance where available and relevant', ['emissions']],
    ['44(b)', 'Low-carbon transition implications for business, strategy and financial planning', ['bank']],
    ['44(c)', 'Transition actions, emissions targets and planned business changes', ['bank','targets']],
  ]],
  ['Part IV B', 'Supervisory reporting', 'Compliance', [
    ['48', 'Semi-annual and material-change submission record', ['bank','control']],
    ['48(a)', 'Material climate risks and governance, strategy and risk management response', ['bank','board']],
    ['48(b)', 'Accounting for climate effects and carbon-intensive or vulnerable assets', ['bank','physical']],
    ['48(c)', 'Carbon footprint reduction policies and commitments', ['bank','targets']],
    ['48(d)', 'Climate requirements imposed on borrowers and investees', ['screening','bank']],
    ['48(e)', 'Energy transition actions in investments and credit portfolios', ['bank']],
    ['48(f)', 'Risk assessment and stress methodology, scenarios and assumptions', ['stress']],
    ['48(g)', 'Corporate transition plans and national policy alignment where applicable', ['bank','targets']],
    ['48(h)', 'Physical risk drivers, asset vulnerability and exposures', ['physical']],
    ['48(i)', 'Forward-looking transition plans, scenario results and indicators', ['stress','targets']],
    ['48(j)', 'Transition-sensitive and carbon-intensive sector exposures and proportions', ['screening','bank']],
    ['48(k)', 'Identification and assessment of vulnerable concentrations', ['physical','bank']],
    ['48(l)', 'Acute and chronic physical risk exposure by location and relevant proportions', ['physical','bank']],
    ['48(m)', 'Method used to classify physical risk exposures', ['physical']],
    ['49', 'Transition plan submission with ICAAP and after material structural or model changes', ['capital','bank']],
    ['50', 'Significant data gaps, remediation plans and updates to tools and disclosures', ['control','bank']],
  ]],
  ['Part V', 'Transition plan requirements', 'Strategy / Sustainability', [
    ['51(a)', 'Transition objectives, timelines, targets, financing and risk response', ['bank','targets']],
    ['51(b)', 'Products, implementation and priority sector policies', ['bank']],
    ['51(c)', 'Execution, emissions and exposure metrics and targets', ['emissions','targets']],
    ['51(d)', 'Engagement with counterparties, industry and public sector where applicable', ['bank']],
    ['51(e)', 'Oversight, accountability, incentives and training', ['board','control']],
    ['51(f)', 'Strategy changes, dependencies, sensitivities and transition risk actions', ['bank','stress']],
    ['52', 'Proportionality and ongoing suitability of the transition plan', ['bank','control']],
    ['53', 'Significant counterparty transition information where available', ['screening','bank']],
  ]],
  ['Part VI', 'Implementation roadmap', 'Compliance', [
    ['54', 'Board-approved time-bound implementation plan and signatures', ['board','bank']],
    ['55', 'Quarterly implementation progress reports and submission records', ['bank','control']],
  ]],
];

export const BOG_REQUIREMENTS: Requirement[] = clauses.flatMap(([section, pillar, owner, items]) =>
  items.map(([paragraph, title, evidence]) => ({ id: `bog-${paragraph}`, framework: 'bog', section, paragraph, pillar, title, owner, evidence })));
