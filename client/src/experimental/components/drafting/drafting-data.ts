import {
  PAK_WRIT_199_TEMPLATE,
  PAK_BAIL_497_TEMPLATE,
  PAK_BAIL_498_BBA_TEMPLATE,
  PAK_CIVIL_PLAINT_TEMPLATE,
  PAK_STAY_ORDER39_TEMPLATE,
  PAK_CIVIL_MISC_151_TEMPLATE,
  PAK_EXECUTION_ORDER21_TEMPLATE,
  PAK_CRIMINAL_MISC_22A_TEMPLATE,
  PAK_SESSIONS_CRIM_APPEAL_TEMPLATE,
  PAK_SESSIONS_CRIM_REVISION_TEMPLATE,
  PAK_HIGH_COURT_APPEAL_RFA_TEMPLATE,
  PAK_HIGH_COURT_CRIM_APPEAL_TEMPLATE,
  PAK_HIGH_COURT_CRIM_REVISION_TEMPLATE,
  PAK_SUPREME_CPLA_TEMPLATE,
  PAK_SUPREME_CRIM_PETITION_TEMPLATE,
  PAK_FAMILY_SUIT_KHULA_TEMPLATE,
  PAK_GUARDIANS_CUSTODY_S25_TEMPLATE,
  PAK_SUIT_ORDER37_SUMMARY_TEMPLATE,
  PAK_QUASHMENT_561A_TEMPLATE,
  PAK_HABEAS_CORPUS_491_TEMPLATE,
  PAK_CIVIL_REVISION_115_TEMPLATE,
  PAK_VAKALATNAMA_TEMPLATE,
  PAK_AFFIDAVIT_TEMPLATE,
  PAK_LEGAL_NOTICE_GENERIC_TEMPLATE,
  PAK_NOTICE_489F_PPC_TEMPLATE,
  PAK_POWER_OF_ATTORNEY_GENERAL_TEMPLATE,
  PAK_SALE_DEED_TEMPLATE,
} from "@/lib/pakistan-court-templates";

/**
 * drafting-data.ts
 * Comprehensive database of Pakistani Court Petitions, Commercial Contracts,
 * and Statutory Clauses for the Alwakeelo Drafting Studio.
 */

import {
  PARTNERSHIP_TEMPLATE,
  SAAS_TEMPLATE,
  SERVICE_TEMPLATE,
  SHAREHOLDERS_TEMPLATE,
  EMPLOYMENT_TEMPLATE,
  NDA_TEMPLATE as COMM_NDA_TEMPLATE,
  AGREEMENT_TO_SELL_TEMPLATE,
  CONSTRUCTION_TEMPLATE,
  RENT_TEMPLATE,
  LOAN_TEMPLATE,
  FOUNDERS_TEMPLATE,
  MOU_TEMPLATE,
  SOFTWARE_LICENSE_TEMPLATE,
  COPYRIGHT_TEMPLATE,
  IP_ASSIGNMENT_TEMPLATE,
  TRADEMARK_TEMPLATE,
  SETTLEMENT_TEMPLATE,
  GPA_TEMPLATE,
  WILL_TEMPLATE,
} from "@/lib/templates-data";

export type TemplateCategory =
  | "All"
  | "High Court"
  | "Sessions & Criminal"
  | "Civil Court"
  | "Supreme Court"
  | "Family & Personal"
  | "Affidavits & Notices"
  | "Commercial Contracts";

export interface DraftingTemplate {
  id: string;
  title: string;
  category: TemplateCategory;
  forum: string;
  governingLaw: string;
  description: string;
  body: string;
  tags: string[];
}

export interface StatutoryClause {
  id: string;
  title: string;
  statute: string;
  section: string;
  category: "Corporate & Tax" | "Civil & Property" | "Criminal & Bail" | "Evidence & Execution" | "Dispute Resolution";
  summary: string;
  clauseText: string;
  practiceNote: string;
}

// ─── Pakistani Court Petition Templates ───────────────────────────────────────

export const COURT_PETITIONS: DraftingTemplate[] = [
  {
    id: "writ_199",
    title: "Constitutional Writ Petition (Art. 199)",
    category: "High Court",
    forum: "High Court of Judicature (Lahore / Sindh / Islamabad / Peshawar / Balochistan)",
    governingLaw: "Constitution of the Islamic Republic of Pakistan, 1973 (Article 199)",
    description: "Extraordinary constitutional writ challenging illegal administrative orders, demolition notices, sealing, or executive excess violating fundamental rights and natural justice.",
    tags: ["High Court", "Writ", "Mandamus", "Certiorari", "Fundamental Rights", "Due Process"],
    body: PAK_WRIT_199_TEMPLATE,
  },
  {
    id: "bail_497",
    title: "Post-Arrest Bail Application (Sec. 497 CrPC)",
    category: "Sessions & Criminal",
    forum: "Court of Sessions Judge / High Court",
    governingLaw: "Code of Criminal Procedure, 1898 (Section 497)",
    description: "Post-arrest bail on grounds of further inquiry under Section 497(2), inordinate delay in FIR, lack of overt role, and completion of investigation preventing pre-trial punishment.",
    tags: ["Bail", "Section 497", "Criminal", "Sessions Court", "High Court", "Further Inquiry"],
    body: PAK_BAIL_497_TEMPLATE,
  },
  {
    id: "bail_498_bba",
    title: "Pre-Arrest Bail / Bail Before Arrest (Sec. 498 CrPC)",
    category: "Sessions & Criminal",
    forum: "High Court / Sessions Court",
    governingLaw: "Code of Criminal Procedure, 1898 (Section 498)",
    description: "Pre-arrest protective bail pleading demonstrable mala fides, ulterior motives, police harassment, commercial dispute criminalization, and readiness to join investigation.",
    tags: ["BBA", "Pre-Arrest Bail", "Section 498", "Mala Fide", "Harassment"],
    body: PAK_BAIL_498_BBA_TEMPLATE,
  },
  {
    id: "civil_plaint_injunction",
    title: "Civil Plaint: Declaration, Cancellation of Deed & Permanent Injunction",
    category: "Civil Court",
    forum: "Court of Senior Civil Judge (Civil Division)",
    governingLaw: "Code of Civil Procedure, 1908 (Order VII Rule 1) & Specific Relief Act, 1877 (s.39, 42, 54)",
    description: "Masterclass civil plaint for declaration of lawful title, cancellation of forged General Power of Attorney & registered Sale Deed based on fraud vitiating solemn proceedings.",
    tags: ["Plaint", "Declaration", "Injunction", "Specific Relief", "Civil Suit", "Cancellation of Deed"],
    body: PAK_CIVIL_PLAINT_TEMPLATE,
  },
  {
    id: "stay_order39",
    title: "Application for Temporary Injunction (Order XXXIX Rules 1 & 2 CPC)",
    category: "Civil Court",
    forum: "Court of Senior Civil Judge / District Judge",
    governingLaw: "Code of Civil Procedure, 1908 (Order XXXIX Rules 1 & 2 read with Section 151)",
    description: "Interlocutory injunction application satisfying the statutory triple test (prima facie arguable case, balance of convenience, and irreparable loss/injury).",
    tags: ["Order 39", "Stay Order", "Injunction", "Interim Relief", "Civil Procedure"],
    body: PAK_STAY_ORDER39_TEMPLATE,
  },
  {
    id: "civil_misc_151",
    title: "Civil Misc. Application (Inherent Powers Sec. 151 CPC)",
    category: "Civil Court",
    forum: "All Civil Courts & District Courts",
    governingLaw: "Code of Civil Procedure, 1908 (Section 151)",
    description: "Invocation of inherent powers of civil court to prevent abuse of judicial process, preserve status quo, and secure the ends of justice.",
    tags: ["Section 151", "Civil Misc", "Inherent Powers", "Urgent Relief"],
    body: PAK_CIVIL_MISC_151_TEMPLATE,
  },
  {
    id: "execution_order21",
    title: "Execution Application for Decree (Order XXI Rule 11 CPC)",
    category: "Civil Court",
    forum: "Court of Senior Civil Judge (Executing Court)",
    governingLaw: "Code of Civil Procedure, 1908 (Order XXI Rule 11)",
    description: "High Court Rules compliant tabular execution petition seeking attachment, auction sale of judgment debtor's assets, and civil imprisonment.",
    tags: ["Execution", "Order 21", "Decree", "Recovery", "Attachment"],
    body: PAK_EXECUTION_ORDER21_TEMPLATE,
  },
  {
    id: "criminal_misc_22a",
    title: "Application U/S 22-A & 22-B CrPC (Ex-Officio Justice of Peace)",
    category: "Sessions & Criminal",
    forum: "Court of Sessions Judge / Ex-Officio Justice of Peace",
    governingLaw: "Code of Criminal Procedure, 1898 (Sections 22-A & 22-B read with Section 154)",
    description: "Mandatory statutory application seeking directions to Police SHO for registration of FIR regarding commission of cognizable penal offences under Section 154 CrPC.",
    tags: ["22-A", "Justice of Peace", "FIR Registration", "CrPC", "Police Complaint"],
    body: PAK_CRIMINAL_MISC_22A_TEMPLATE,
  },
  {
    id: "sessions_crim_appeal",
    title: "Sessions Criminal Appeal (Sec. 408 CrPC)",
    category: "Sessions & Criminal",
    forum: "Court of Sessions Judge",
    governingLaw: "Code of Criminal Procedure, 1898 (Section 408 & Section 426)",
    description: "Comprehensive criminal appeal challenging conviction and sentence passed by Judicial Magistrate Section 30 with suspension of sentence application.",
    tags: ["Criminal Appeal", "Sessions", "Section 408", "Suspension of Sentence"],
    body: PAK_SESSIONS_CRIM_APPEAL_TEMPLATE,
  },
  {
    id: "sessions_crim_revision",
    title: "Sessions Criminal Revision (Sec. 435 / 439-A CrPC)",
    category: "Sessions & Criminal",
    forum: "Court of Sessions Judge",
    governingLaw: "Code of Criminal Procedure, 1898 (Sections 435 & 439-A)",
    description: "Revisional petition against illegal, arbitrary, or perverse interlocutory and final orders of subordinate criminal courts.",
    tags: ["Criminal Revision", "Sessions Court", "Section 435", "Section 439-A"],
    body: PAK_SESSIONS_CRIM_REVISION_TEMPLATE,
  },
  {
    id: "high_court_appeal_rfa",
    title: "High Court Regular First Appeal (RFA Sec. 96 & Order XLI CPC)",
    category: "High Court",
    forum: "High Court of Judicature",
    governingLaw: "Code of Civil Procedure, 1908 (Section 96 & Order XLI)",
    description: "First appeal on both facts and law against civil money decree of Additional District Judge with application for stay of execution.",
    tags: ["RFA", "High Court", "Section 96", "Civil Appeal", "Order 41"],
    body: PAK_HIGH_COURT_APPEAL_RFA_TEMPLATE,
  },
  {
    id: "high_court_crim_appeal",
    title: "High Court Criminal Appeal (Sec. 410 CrPC)",
    category: "High Court",
    forum: "High Court of Judicature (Criminal Appellate Side)",
    governingLaw: "Code of Criminal Procedure, 1898 (Section 410)",
    description: "Capital / Life imprisonment criminal appeal challenging Sessions judgment on murder or major offences citing Supreme Court benefit of doubt doctrines.",
    tags: ["Criminal Appeal", "High Court", "Section 410", "Murder Trial"],
    body: PAK_HIGH_COURT_CRIM_APPEAL_TEMPLATE,
  },
  {
    id: "high_court_crim_revision",
    title: "High Court Criminal Revision (Sec. 435 / 439 CrPC)",
    category: "High Court",
    forum: "High Court of Judicature (Revisional Side)",
    governingLaw: "Code of Criminal Procedure, 1898 (Sections 435 & 439)",
    description: "High Court supervisory and revisional petition examining correctness, legality, and propriety of subordinate court orders.",
    tags: ["High Court", "Criminal Revision", "Section 439", "Supervisory"],
    body: PAK_HIGH_COURT_CRIM_REVISION_TEMPLATE,
  },
  {
    id: "supreme_court_cpla",
    title: "Supreme Court Civil Petition for Leave to Appeal (CPLA Art. 185(3))",
    category: "Supreme Court",
    forum: "Supreme Court of Pakistan (Appellate Jurisdiction)",
    governingLaw: "Constitution of the Islamic Republic of Pakistan, 1973 (Article 185(3)) & Supreme Court Rules 1980",
    description: "Apex court petition drafted by Senior ASC formulating substantial questions of law of general public importance against High Court final judgment.",
    tags: ["Supreme Court", "CPLA", "Article 185", "Apex Court", "Questions of Law"],
    body: PAK_SUPREME_CPLA_TEMPLATE,
  },
  {
    id: "supreme_crim_petition",
    title: "Supreme Court Criminal Petition for Leave to Appeal (Art. 185(3))",
    category: "Supreme Court",
    forum: "Supreme Court of Pakistan (Criminal Appellate Jurisdiction)",
    governingLaw: "Constitution of the Islamic Republic of Pakistan, 1973 (Article 185(3))",
    description: "Criminal petition for leave to appeal before the Apex Court challenging High Court judgment affirming conviction or setting aside acquittal.",
    tags: ["Supreme Court", "Criminal CPLA", "Article 185(3)", "Capital Punishment"],
    body: PAK_SUPREME_CRIM_PETITION_TEMPLATE,
  },
  {
    id: "quashment_561a",
    title: "High Court Quashment of FIR (Sec. 561-A CrPC)",
    category: "High Court",
    forum: "High Court of Judicature",
    governingLaw: "Code of Criminal Procedure, 1898 (Section 561-A)",
    description: "Inherent powers petition for quashment of FIR and criminal proceedings where civil dispute is maliciously criminalized or no cognizable offence is disclosed.",
    tags: ["High Court", "Quashment", "Section 561-A", "Inherent Powers", "Abuse of Process"],
    body: PAK_QUASHMENT_561A_TEMPLATE,
  },
  {
    id: "habeas_corpus_491",
    title: "High Court Habeas Corpus Petition (Sec. 491 CrPC)",
    category: "High Court",
    forum: "High Court of Judicature",
    governingLaw: "Code of Criminal Procedure, 1898 (Section 491) & Constitution Articles 9 & 10",
    description: "Emergent petition for recovery of detenu from illegal, unconstitutional police confinement with appointment of Court Bailiff.",
    tags: ["Habeas Corpus", "Section 491", "Illegal Detention", "Court Bailiff", "Fundamental Rights"],
    body: PAK_HABEAS_CORPUS_491_TEMPLATE,
  },
  {
    id: "civil_revision_115",
    title: "High Court Civil Revision (Sec. 115 CPC)",
    category: "High Court",
    forum: "High Court of Judicature (Civil Revisional Side)",
    governingLaw: "Code of Civil Procedure, 1908 (Section 115)",
    description: "Civil revision petition against appellate judgments on grounds of jurisdictional failure, illegal exercise, or material irregularity.",
    tags: ["Civil Revision", "Section 115", "High Court", "Jurisdiction"],
    body: PAK_CIVIL_REVISION_115_TEMPLATE,
  },
  {
    id: "family_suit_khula",
    title: "Family Suit for Khula, Dower, Maintenance & Dowry Articles",
    category: "Family & Personal",
    forum: "Court of Judge Family Court",
    governingLaw: "West Pakistan Family Courts Act, 1964 & Dissolution of Muslim Marriages Act, 1939",
    description: "Masterclass family suit for dissolution of marriage on Khula, recovery of prompt dower in gold, itemized dowry recovery, and child maintenance.",
    tags: ["Family", "Khula", "Maintenance", "Dower", "Dowry", "Family Court"],
    body: PAK_FAMILY_SUIT_KHULA_TEMPLATE,
  },
  {
    id: "guardians_custody_s25",
    title: "Custody Petition U/S 25 Guardians and Wards Act, 1890",
    category: "Family & Personal",
    forum: "Court of Guardian Judge",
    governingLaw: "Guardians and Wards Act, 1890 (Section 25 & Section 12)",
    description: "Child custody petition centering upon the supreme statutory test of Welfare of the Minor and Islamic Hizanat rights.",
    tags: ["Guardians", "Custody", "Minor", "Hizanat", "Welfare of Minor"],
    body: PAK_GUARDIANS_CUSTODY_S25_TEMPLATE,
  },
  {
    id: "suit_order37_summary",
    title: "Summary Suit for Money Recovery (Order XXXVII CPC)",
    category: "Civil Court",
    forum: "District Court / High Court Original Side",
    governingLaw: "Code of Civil Procedure, 1908 (Order XXXVII Rules 1 & 2)",
    description: "Fast-track summary recovery suit based on dishonoured cheque, promissory note, or bill of exchange with statutory commercial markup.",
    tags: ["Order 37", "Summary Suit", "Recovery", "Cheque", "Negotiable Instruments"],
    body: PAK_SUIT_ORDER37_SUMMARY_TEMPLATE,
  },
  {
    id: "vakalatnama_high_court",
    title: "Standard High Court & District Bar Vakalatnama",
    category: "Affidavits & Notices",
    forum: "Supreme Court / High Courts / District Courts",
    governingLaw: "Legal Practitioners and Bar Councils Act, 1973 & High Court Rules",
    description: "Comprehensive advocate appointment authorization form detailing powers to plead, compromise, withdraw funds, and file appeals.",
    tags: ["Vakalatnama", "Power of Attorney", "Counsel Authorisation", "Bar Council"],
    body: PAK_VAKALATNAMA_TEMPLATE,
  },
  {
    id: "affidavit_oath_comm",
    title: "Sworn Attested Affidavit (Oath Commissioner)",
    category: "Affidavits & Notices",
    forum: "All Courts & Tribunals",
    governingLaw: "Qanun-e-Shahadat Order, 1984 & Code of Civil Procedure (Order XIX)",
    description: "Formal sworn affidavit format with deponent identification, solemn verification, and Oath Commissioner attestation block.",
    tags: ["Affidavit", "Oath Commissioner", "Verification", "Sworn Statement"],
    body: PAK_AFFIDAVIT_TEMPLATE,
  },
  {
    id: "notice_489f_cheque",
    title: "Cheque Dishonour Statutory Demand Notice (489-F PPC)",
    category: "Affidavits & Notices",
    forum: "Pre-Litigation Statutory Demand",
    governingLaw: "Pakistan Penal Code (Section 489-F) & Negotiable Instruments Act, 1881",
    description: "15-day peremptory statutory payment demand notice before lodging criminal FIR and summary recovery suit.",
    tags: ["489-F PPC", "Cheque Dishonour", "Legal Notice", "Criminal Demand", "Negotiable Instruments"],
    body: PAK_NOTICE_489F_PPC_TEMPLATE,
  },
  {
    id: "legal_notice_generic",
    title: "Formal Legal Demand Notice (Breach & Recovery)",
    category: "Affidavits & Notices",
    forum: "Pre-Litigation Demand",
    governingLaw: "Contract Act, 1872 & Specific Relief Act, 1877",
    description: "Comprehensive legal demand notice by Advocate High Court for commercial breach, payment of outstanding dues, and damages.",
    tags: ["Legal Notice", "Demand Notice", "Breach of Contract", "Damages"],
    body: PAK_LEGAL_NOTICE_GENERIC_TEMPLATE,
  },
  {
    id: "comm_gpa",
    title: "General Power of Attorney (Mukhtar-e-Aam for Property & Litigation)",
    category: "Affidavits & Notices",
    forum: "Registrar / Sub-Registrar / Courts",
    governingLaw: "Powers of Attorney Act, 1882 & Registration Act, 1908",
    description: "Registered power of attorney for immovable property conveyancing, development authorities, revenue departments, and court litigation.",
    tags: ["GPA", "Mukhtar-e-Aam", "Power of Attorney", "Property", "Litigation"],
    body: PAK_POWER_OF_ATTORNEY_GENERAL_TEMPLATE,
  },
  {
    id: "comm_sale_deed",
    title: "Registered Sale Deed (Bainama for Immovable Property)",
    category: "Affidavits & Notices",
    forum: "Office of the Sub-Registrar",
    governingLaw: "Transfer of Property Act, 1882 & Registration Act, 1908",
    description: "Authentic registered sale deed with title warranties, physical possession delivery, boundaries recital, and Article 17 QSO witness block.",
    tags: ["Sale Deed", "Bainama", "Transfer of Property", "Sub-Registrar", "Conveyancing"],
    body: PAK_SALE_DEED_TEMPLATE,
  },
];

// ─── Commercial Contract Templates ────────────────────────────────────────────

export const COMMERCIAL_CONTRACTS: DraftingTemplate[] = [
  {
    id: "comm_partnership",
    title: "Partnership Deed (Partnership Act 1932)",
    category: "Commercial Contracts",
    forum: "Registrar of Firms / Commercial Practice",
    governingLaw: "Partnership Act, 1932",
    description: "Standard multi-partner deed with capital contribution, profit ratio, and Section 48 dissolution rules.",
    tags: ["Partnership", "Commercial", "Firms", "Section 48"],
    body: PARTNERSHIP_TEMPLATE,
  },
  {
    id: "comm_saas",
    title: "Software-as-a-Service (SaaS) Agreement",
    category: "Commercial Contracts",
    forum: "Corporate Commercial",
    governingLaw: "Contract Act, 1872 & Electronic Transactions Ordinance, 2002",
    description: "Enterprise B2B SaaS agreement with 99.5% SLA, data security, IP licensing, and liability caps.",
    tags: ["SaaS", "Cloud", "SLA", "Tech", "Subscription"],
    body: SAAS_TEMPLATE,
  },
  {
    id: "comm_services",
    title: "Master Services Agreement (MSA)",
    category: "Commercial Contracts",
    forum: "Corporate Commercial",
    governingLaw: "Contract Act, 1872",
    description: "Comprehensive professional services agreement with SOW schedules, milestone deliverables, and tax withholding.",
    tags: ["Services", "MSA", "Consultancy", "Deliverables"],
    body: SERVICE_TEMPLATE,
  },
  {
    id: "comm_shareholders",
    title: "Shareholders Agreement (SHA)",
    category: "Commercial Contracts",
    forum: "Corporate / SECP",
    governingLaw: "Companies Act, 2017 & Contract Act, 1872",
    description: "Corporate joint venture & shareholder agreement with ROFR, Tag-Along, Drag-Along, and Board seats.",
    tags: ["SHA", "Shareholders", "Companies Act", "ROFR", "Tag-Along"],
    body: SHAREHOLDERS_TEMPLATE,
  },
  {
    id: "comm_employment",
    title: "Executive Employment Contract",
    category: "Commercial Contracts",
    forum: "Labor / Corporate",
    governingLaw: "Industrial and Commercial Employment (Standing Orders) Ordinance, 1968",
    description: "Employment contract with confidentiality, non-solicitation, probation terms, and severance clauses.",
    tags: ["Employment", "HR", "Labor", "Non-Compete"],
    body: EMPLOYMENT_TEMPLATE,
  },
  {
    id: "comm_nda",
    title: "Mutual Non-Disclosure Agreement (NDA)",
    category: "Commercial Contracts",
    forum: "Corporate Commercial",
    governingLaw: "Contract Act, 1872 & Trade Secrets Protection",
    description: "Bilateral confidentiality agreement with exclusions, 3-year term, and injunctive relief provisions.",
    tags: ["NDA", "Confidentiality", "Trade Secrets"],
    body: COMM_NDA_TEMPLATE,
  },
  {
    id: "comm_agreement_sell",
    title: "Agreement to Sell (Immovable Property)",
    category: "Commercial Contracts",
    forum: "Civil / Property Practice",
    governingLaw: "Transfer of Property Act, 1882 & Registration Act, 1908",
    description: "Property sale agreement with earnest money, balance payment milestones, and vacant possession delivery.",
    tags: ["Property", "Sale Deed", "Real Estate", "Earnest Money"],
    body: AGREEMENT_TO_SELL_TEMPLATE,
  },
  {
    id: "comm_construction",
    title: "Construction Agreement / Works Contract",
    category: "Commercial Contracts",
    forum: "Commercial / Engineering",
    governingLaw: "PEC Standard Bidding Documents & Contract Act, 1872",
    description: "Turnkey building construction agreement with retention money, defect liability, and milestone completion.",
    tags: ["Construction", "EPC", "Contractor", "Works"],
    body: CONSTRUCTION_TEMPLATE,
  },
  {
    id: "comm_tenancy",
    title: "Tenancy Deed (Commercial / Residential Lease)",
    category: "Commercial Contracts",
    forum: "Rent Tribunal / Civil",
    governingLaw: "Punjab Rented Premises Act, 2009 / Provincial Rent Laws",
    description: "Tenancy agreement with security deposit, 10% annual escalation, maintenance duties, and eviction terms.",
    tags: ["Rent", "Lease", "Tenancy", "Escalation"],
    body: RENT_TEMPLATE,
  },
  {
    id: "comm_loan",
    title: "Commercial Loan & Financing Agreement",
    category: "Commercial Contracts",
    forum: "Commercial / Banking",
    governingLaw: "Financial Institutions (Recovery of Finances) Ordinance, 2001 & Contract Act",
    description: "Commercial loan agreement with interest/mark-up schedule, default acceleration, and personal guarantees.",
    tags: ["Loan", "Finance", "Promissory Note", "Guarantee"],
    body: LOAN_TEMPLATE,
  },
  {
    id: "comm_founders",
    title: "Founders Agreement & Equity Vesting",
    category: "Commercial Contracts",
    forum: "Startups / Corporate",
    governingLaw: "Companies Act, 2017",
    description: "Startup founders agreement with 4-year equity vesting, 1-year cliff, IP assignment, and IP transfer.",
    tags: ["Founders", "Vesting", "Startup", "Equity"],
    body: FOUNDERS_TEMPLATE,
  },
  {
    id: "comm_mou",
    title: "Memorandum of Understanding (MOU)",
    category: "Commercial Contracts",
    forum: "Commercial Negotiations",
    governingLaw: "Contract Act, 1872",
    description: "Preliminary business partnership framework detailing prospective collaboration without immediate binding liability.",
    tags: ["MOU", "Framework", "Partnership"],
    body: MOU_TEMPLATE,
  },
  {
    id: "comm_software_license",
    title: "Software License Agreement",
    category: "Commercial Contracts",
    forum: "IT / Tech",
    governingLaw: "Copyright Ordinance, 1962 & Contract Act",
    description: "Perpetual or term on-premise software licensing agreement with maintenance and source code escrow terms.",
    tags: ["Software", "License", "IT", "Tech"],
    body: SOFTWARE_LICENSE_TEMPLATE,
  },
  {
    id: "comm_copyright",
    title: "Deed of Copyright Assignment",
    category: "Commercial Contracts",
    forum: "IP Tribunal / SECP",
    governingLaw: "Copyright Ordinance, 1962",
    description: "Complete worldwide assignment of copyright, moral rights waiver, and title warranties.",
    tags: ["Copyright", "IP", "Assignment"],
    body: COPYRIGHT_TEMPLATE,
  },
  {
    id: "comm_ip_assignment",
    title: "Intellectual Property Assignment Agreement",
    category: "Commercial Contracts",
    forum: "Corporate / Tech",
    governingLaw: "Patents Ordinance 2000 & Copyright Ordinance 1962",
    description: "Comprehensive assignment covering patents, designs, trademarks, trade secrets, and software code.",
    tags: ["IP", "Patents", "Assignment", "Invention"],
    body: IP_ASSIGNMENT_TEMPLATE,
  },
  {
    id: "comm_trademark",
    title: "Trademark License Agreement",
    category: "Commercial Contracts",
    forum: "IPO Pakistan",
    governingLaw: "Trade Marks Ordinance, 2001",
    description: "Quality control, royalty computation, and registered user provisions under IPO Pakistan regulations.",
    tags: ["Trademark", "IPO", "Branding", "License"],
    body: TRADEMARK_TEMPLATE,
  },
  {
    id: "comm_settlement",
    title: "Compromise & Settlement Deed",
    category: "Commercial Contracts",
    forum: "Civil / ADR",
    governingLaw: "Code of Civil Procedure, 1908 (Order XXIII Rule 3) & Contract Act",
    description: "Full and final mutual settlement of pending claims, mutual releases, and withdrawal of legal proceedings.",
    tags: ["Settlement", "Compromise", "Order 23", "Release"],
    body: SETTLEMENT_TEMPLATE,
  },
  {
    id: "comm_gpa",
    title: "General Power of Attorney (Commercial & Property)",
    category: "Commercial Contracts",
    forum: "Registrar / Sub-Registrar",
    governingLaw: "Powers of Attorney Act, 1882 & Registration Act, 1908",
    description: "Comprehensive registered power of attorney for corporate administration and real estate conveyancing.",
    tags: ["GPA", "Power of Attorney", "Registrar"],
    body: GPA_TEMPLATE,
  },
  {
    id: "comm_will",
    title: "Last Will and Testament (Wasiyyat / Bequest)",
    category: "Commercial Contracts",
    forum: "Succession / Civil Court",
    governingLaw: "Muslim Personal Law (Shariat) Application Act & Succession Act, 1925",
    description: "Formal bequest of 1/3rd permissible estate under Islamic Law with executor appointment and debt settlement.",
    tags: ["Will", "Succession", "Bequest", "Shariat"],
    body: WILL_TEMPLATE,
  },
];

export const ALL_DRAFTING_TEMPLATES: DraftingTemplate[] = [
  ...COURT_PETITIONS,
  ...COMMERCIAL_CONTRACTS,
];

// ─── Pakistani Statutory Clause Library ───────────────────────────────────────

export const STATUTORY_CLAUSES: StatutoryClause[] = [
  {
    id: "stat_partnership_s48",
    title: "Partnership Act s.48 — Dissolution & Settlement of Accounts",
    statute: "Partnership Act, 1932",
    section: "Section 48",
    category: "Corporate & Tax",
    summary: "Mandatory statutory waterfall for settling accounts and distributing firm assets upon dissolution.",
    clauseText: `### DISSOLUTION AND SETTLEMENT OF ACCOUNTS (SECTION 48 PARTNERSHIP ACT 1932)
Upon the dissolution of the Firm, the assets of the partnership shall be liquidated and applied strictly in the following statutory order of priority as mandated by Section 48 of the Partnership Act, 1932:
(a) In paying the debts and liabilities of the Firm to third parties;
(b) In paying to each Partner rateably what is due to him from the Firm for advances as distinguished from capital;
(c) In paying to each Partner rateably what is due to him on account of capital; and
(d) The residue, if any, shall be divided among the Partners in the proportions in which they are entitled to share profits.`,
    practiceNote: "Ensures full compliance with Section 48 waterfall. Essential in all Pakistani partnership and joint venture deeds.",
  },
  {
    id: "stat_ito_s153",
    title: "Income Tax Ordinance s.153 — Withholding Tax & Statutory Deduction",
    statute: "Income Tax Ordinance, 2001",
    section: "Section 153",
    category: "Corporate & Tax",
    summary: "Withholding tax deduction at source on goods, services, and contracts with CPR delivery and exemption safeguards.",
    clauseText: `### STATUTORY TAX WITHHOLDING (SECTION 153 INCOME TAX ORDINANCE 2001)
All payments due under this Agreement shall be subject to statutory deduction of withholding income tax at the applicable prescribed rates under Section 153 of the Income Tax Ordinance, 2001 (as amended by the relevant Finance Act), unless the payee furnishes a valid, active exemption certificate issued by the Federal Board of Revenue (FBR) Commissioner Inland Revenue prior to the invoice payment date. The withholding party shall provide a valid Computerized Payment Receipt (CPR) evidencing tax deposit into the Federal Treasury within fifteen (15) days of deduction.`,
    practiceNote: "Prevents tax penalties and FBR disallowance of business expenses under Section 21 of ITO 2001.",
  },
  {
    id: "stat_sra_s54_55",
    title: "Specific Relief Act s.54 & 55 — Perpetual & Mandatory Injunction Grounds",
    statute: "Specific Relief Act, 1877",
    section: "Sections 54 & 55",
    category: "Civil & Property",
    summary: "Standard triple-test pleading paragraphs for perpetual injunction (s.54) and mandatory injunction (s.55).",
    clauseText: `### INJUNCTION GROUNDS (SECTIONS 54 & 55 SPECIFIC RELIEF ACT 1877)
1. That the Plaintiff has an established legal right and character in the suit property, and the Defendant is threatening an invasion of the Plaintiff's right to and enjoyment of property, attracting Section 54 of the Specific Relief Act, 1877.
2. That there exists no standard for ascertaining the actual damage caused, and pecuniary compensation would not afford adequate relief to the Plaintiff.
3. That to prevent the breach of obligation and compel performance of requisite acts, a decree for Mandatory Injunction under Section 55 of the Specific Relief Act, 1877 is eminently just, equitable, and necessary in the circumstances.`,
    practiceNote: "Standard formulation for civil plaints and stay applications across District Courts and High Courts.",
  },
  {
    id: "stat_qso_art17",
    title: "Qanun-e-Shahadat Order Art. 17 — Formal Execution & Attestation Witness Block",
    statute: "Qanun-e-Shahadat Order, 1984",
    section: "Article 17",
    category: "Evidence & Execution",
    summary: "Two competent male witnesses or one male and two female witnesses with complete CNIC numbers and signatures.",
    clauseText: `IN WITNESS WHEREOF, the Parties hereto have signed and executed this Deed on the day, month, and year first above written in the presence of the following attesting witnesses as required under Article 17 of the Qanun-e-Shahadat Order, 1984:

_____________________________                      _____________________________
FIRST PARTY / EXECUTANT                            SECOND PARTY / BENEFICIARY
CNIC No.: ___________________                      CNIC No.: ___________________

WITNESS 1 (Under Art. 17 QSO 1984):               WITNESS 2 (Under Art. 17 QSO 1984):
Signature: __________________________             Signature: __________________________
Name: _______________________________             Name: _______________________________
Father's Name: _______________________             Father's Name: _______________________
CNIC No.: ___________________________             CNIC No.: ___________________________
Address: ____________________________             Address: ____________________________`,
    practiceNote: "Mandatory under Article 17 QSO 1984 for all financial instruments, property sale deeds, and agreements creating liability.",
  },
  {
    id: "stat_peca_2016",
    title: "PECA 2016 — Electronic Evidence, Cybersecurity & Data Protection",
    statute: "Prevention of Electronic Crimes Act, 2016",
    section: "Sections 3, 4, 13 & 21",
    category: "Corporate & Tax",
    summary: "Cybersecurity compliance, protection of confidential electronic communications, and electronic signature integrity.",
    clauseText: `### ELECTRONIC DATA PROTECTION & PECA COMPLIANCE
Each Party undertakes to implement industry-standard cybersecurity and technical safeguards to protect all electronic data, customer records, and confidential communications transmitted under this Agreement. The Parties agree that all electronic transactions and records shall be governed by the Electronic Transactions Ordinance, 2002, and neither Party shall engage in unauthorized access, data interception, or disruption of information systems, which constitutes a cognizable offense under the Prevention of Electronic Crimes Act, 2016 (PECA). Any breach shall entitle the aggrieved Party to immediate injunctive relief and statutory indemnification.`,
    practiceNote: "Essential for SaaS, IT, outsourcing, banking, and confidential commercial agreements in Pakistan.",
  },
  {
    id: "stat_arbitration_1940",
    title: "Arbitration Act 1940 — Statutory Dispute Resolution & Sole Arbitrator",
    statute: "Arbitration Act, 1940",
    section: "Sections 2 & 3",
    category: "Dispute Resolution",
    summary: "Statutory arbitration clause providing for sole arbitrator appointment in Pakistan with final and binding award.",
    clauseText: `### GOVERNING LAW AND ARBITRATION (ARBITRATION ACT 1940)
1. This Agreement shall be governed by and construed in accordance with the substantive and procedural laws of the Islamic Republic of Pakistan.
2. Any dispute, controversy, or claim arising out of, relating to, or in connection with this Agreement, including any question regarding its existence, validity, breach, or termination, shall be referred to and finally resolved by arbitration in accordance with the provisions of the Arbitration Act, 1940.
3. The arbitration shall be conducted by a sole arbitrator to be mutually appointed by the Parties. If the Parties fail to agree upon an arbitrator within thirty (30) days of notice, the arbitrator shall be appointed by the competent Court of Senior Civil Judge having territorial jurisdiction. The seat of arbitration shall be [City], Pakistan, and the arbitral award shall be final, conclusive, and binding on both Parties.`,
    practiceNote: "Enforceable arbitration clause recognized by all Pakistani High Courts under Arbitration Act 1940.",
  },
  {
    id: "stat_cpc_o7_r11",
    title: "CPC Order VII Rule 11 — Cause of Action & Valuation Compliance",
    statute: "Code of Civil Procedure, 1908",
    section: "Order VII Rule 11 & Section 20",
    category: "Civil & Property",
    summary: "Standard paragraph establishing territorial jurisdiction, date of accrual of cause of action, and court fee valuation.",
    clauseText: `### CAUSE OF ACTION, JURISDICTION & VALUATION
1. That the cause of action first arose in favour of the Plaintiff against the Defendants on [Date of First Breach], and subsequently on [Date of Final Refusal/Threat], when the Defendants categorically refused to acknowledge Plaintiff's lawful rights, and continues to accrue from day to day.
2. That the parties reside, the subject matter is situated, and the cause of action substantially arose within the territorial limits of this Honourable Court, which has competent jurisdiction under Section 20 CPC to try and adjudicate this matter.
3. That the valuation of the suit for the purposes of court fee and pecuniary jurisdiction is correctly computed and fixed in accordance with the Court Fees Act, 1870 and Suits Valuation Act, 1887, and appropriate court fee stamp is affixed on the plaint.`,
    practiceNote: "Protects plaint from summary rejection under Order VII Rule 11 CPC for failure to disclose cause of action.",
  },
  {
    id: "stat_crpc_s497_2",
    title: "CrPC s.497(2) — Further Inquiry Rule for Bail",
    statute: "Code of Criminal Procedure, 1898",
    section: "Section 497(2)",
    category: "Criminal & Bail",
    summary: "Statutory pleading paragraph for post-arrest bail where reasonable grounds exist for further inquiry.",
    clauseText: `### FURTHER INQUIRY GROUND (SECTION 497(2) Cr.P.C.)
That there are no reasonable grounds for believing that the Accused/Applicant has committed a non-bailable offense, but there are sufficient grounds for further inquiry into his guilt within the meaning and contemplation of sub-section (2) of Section 497 Cr.P.C. As settled by the Hon'ble Supreme Court of Pakistan in landmark precedent, whenever a case falls within the ambit of further inquiry, grant of bail becomes a matter of right rather than concession.`,
    practiceNote: "Gold standard bail ground for Pakistani Sessions and High Court bail applications.",
  },
];

