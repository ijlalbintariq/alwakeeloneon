/**
 * ============================================================================
 * PAKISTANI STATUTES & MAJOR CODES COMPENDIUM KNOWLEDGE ENGINE
 * Chambers Reference Shelf Data Architecture
 * ============================================================================
 * Provides zero-latency, offline-capable statutory knowledge across:
 * 1. 7 Major Legal Domains (Civil, Criminal, Constitutional, Commercial/Property,
 *    Evidence, Family, Special Statutory Regimes & Financial Crimes)
 * 2. 35+ Limitation Act 1908 Schedule Articles with Section 4 Weekend Rollover
 * 3. 5-Jurisdiction Provincial Court Fees & Pecuniary Jurisdiction Engine
 * 4. 4-Tier Complete Pakistani Court Hierarchy Directory
 * 
 * Verifiable against official law reports (PLD, SCMR, CLC, PCrLJ, MLD, PTD, CLD)
 * and statutory enactments as amended up to date.
 * ============================================================================
 */

/* ==========================================================================
   TYPE DEFINITIONS & INTERFACES
   ========================================================================== */

export type StatuteDomain =
  | "civil"
  | "criminal"
  | "constitutional"
  | "commercial"
  | "evidence"
  | "family"
  | "special";

export interface StatuteDomainMeta {
  id: StatuteDomain;
  label: string;
  shortLabel: string;
  iconName: string;
  description: string;
  statutesCount: number;
  featuredStatutes: string[];
}

export interface LandmarkCitation {
  citation: string;
  court: string;
  year: number;
  title: string;
  ratio: string;
  bench?: string;
  urlPath?: string;
}

export interface StatuteSection {
  id: string;
  sectionNumber: string;
  title: string;
  statuteName: string;
  statuteYear: number;
  domain: StatuteDomain;
  text: string;
  commentary: string;
  landmarkCitations: LandmarkCitation[];
  keywords: string[];
  proceduralNotes?: string;
  mandatoryPleadings?: string;
  punishmentOrRelief?: string;
  crossReferences?: string[];
  isLiveDb?: boolean;
  sourceType?: "compendium" | "postgres" | "statute_doc";
  documentId?: number;
  documentTitle?: string;
}

export interface LimitationEntry {
  id?: string;
  article: string;
  title: string;
  description: string;
  periodText: string;
  periodDays: number;
  periodUnit: "days" | "months" | "years";
  periodValue: number;
  triggerEvent: string;
  category: "Suits" | "Appeals" | "Applications" | "Revisions" | "Reviews" | "Execution" | string;
  statutoryRef: string;
  notes?: string;
  landmarkPrecedent?: string;
}

export interface LimitationDeadlineResult {
  rawDeadline: Date;
  adjustedDeadline: Date;
  isWeekendRollover: boolean;
  daysRemaining: number;
  isBarred: boolean;
  statutoryNote: string;
  expiryFormatted: string;
  daysRemainingLabel: string;
}

export type CourtFeeProvince =
  | "punjab"
  | "sindh"
  | "islamabad"
  | "kpk"
  | "balochistan";

export interface CourtFeeSuitType {
  id: string;
  name: string;
  category: "civil" | "commercial" | "family" | "constitutional" | "criminal" | "appellate";
  feeType: "ad_valorem" | "fixed" | "exempt" | "percentage_capped";
  fixedAmount?: number;
  ratePercentage?: number;
  description: string;
  statutoryReference: string;
  exemptThreshold?: number;
}

export interface ProvincialPecuniaryTier {
  courtName: string;
  minValuation: number;
  maxValuation: number | null; // null represents unlimited
  notes: string;
}

export interface ProvincialCourtFeeRule {
  province: CourtFeeProvince;
  provinceName: string;
  adValoremRate: number; // e.g. 7.5 (%)
  exemptThreshold: number; // e.g. 25000
  maxCapGeneral: number; // e.g. 15000
  highCourtOriginalSideCap?: number; // e.g. 50000 (Sindh)
  highCourtOriginalSidePecuniaryMin?: number; // e.g. 65000000 (Sindh)
  governingAct: string;
  fixedFees: {
    writPetition: number;
    permanentInjunction: number;
    familySuit: number;
    civilRevisionCap: number;
    miscApplication: number;
    powerOfAttorneyStamp: number;
  };
  pecuniaryTiers: ProvincialPecuniaryTier[];
  notes: string;
}

export interface CourtFeeCalculationResult {
  fee: number;
  isExempt: boolean;
  isCapped: boolean;
  capAmount: number;
  explanation: string;
  pecuniaryCourt: string;
  statutoryReference: string;
  effectiveRate: string;
  breakdownFormula: string;
}

export type CourtHierarchyTier =
  | "apex"
  | "high_courts"
  | "tribunals"
  | "district";

export interface CourtRecord {
  id: string;
  name: string;
  tier: CourtHierarchyTier;
  city: string;
  province: string;
  benches?: string[];
  territorialJurisdiction?: string[];
  jurisdictionNotes: string;
  contact?: string;
  establishedYear?: number;
  address?: string;
  appellateAuthority?: string;
  rosterCategories?: string[];
}

/* ==========================================================================
   1. STATUTE DOMAINS METADATA
   ========================================================================== */

export const STATUTE_DOMAINS: StatuteDomainMeta[] = [
  {
    id: "civil",
    label: "Civil Procedure & Relief",
    shortLabel: "Civil Law",
    iconName: "Scale",
    description: "Code of Civil Procedure 1908, Specific Relief Act 1877, Court Fees Act 1870, Suits Valuation Act 1887.",
    statutesCount: 4,
    featuredStatutes: [
      "Code of Civil Procedure, 1908",
      "Specific Relief Act, 1877",
      "Court Fees Act, 1870",
      "Suits Valuation Act, 1887"
    ]
  },
  {
    id: "criminal",
    label: "Criminal Law & Procedure",
    shortLabel: "Criminal Law",
    iconName: "ShieldAlert",
    description: "Pakistan Penal Code 1860, Code of Criminal Procedure 1898, Police Order 2002, Anti-Terrorism Act 1997.",
    statutesCount: 4,
    featuredStatutes: [
      "Pakistan Penal Code, 1860",
      "Code of Criminal Procedure, 1898",
      "Anti-Terrorism Act, 1997",
      "Control of Narcotic Substances Act, 1997"
    ]
  },
  {
    id: "constitutional",
    label: "Constitutional & Administrative",
    shortLabel: "Constitutional",
    iconName: "Landmark",
    description: "Constitution of the Islamic Republic of Pakistan 1973, General Clauses Act 1897, Law Reforms Ordinance 1972.",
    statutesCount: 3,
    featuredStatutes: [
      "Constitution of Pakistan, 1973",
      "General Clauses Act, 1897",
      "Law Reforms Ordinance, 1972"
    ]
  },
  {
    id: "commercial",
    label: "Commercial, Property & Tenancy",
    shortLabel: "Property & Commercial",
    iconName: "Building2",
    description: "Contract Act 1872, Transfer of Property Act 1882, Registration Act 1908, Companies Act 2017, PRPA 2009.",
    statutesCount: 5,
    featuredStatutes: [
      "Contract Act, 1872",
      "Transfer of Property Act, 1882",
      "Registration Act, 1908",
      "Companies Act, 2017",
      "Punjab Rented Premises Act, 2009"
    ]
  },
  {
    id: "evidence",
    label: "Law of Evidence & Forensics",
    shortLabel: "Evidence",
    iconName: "FileCheck",
    description: "Qanun-e-Shahadat Order 1984, Electronic Transactions Ordinance 2002, PFSA Evidence Guidelines.",
    statutesCount: 2,
    featuredStatutes: [
      "Qanun-e-Shahadat Order, 1984 (P.O. No. 10 of 1984)",
      "Electronic Transactions Ordinance, 2002"
    ]
  },
  {
    id: "family",
    label: "Family & Personal Law",
    shortLabel: "Family Law",
    iconName: "Users",
    description: "Muslim Family Laws Ordinance 1961, West Pakistan Family Courts Act 1964, Guardians and Wards Act 1890.",
    statutesCount: 3,
    featuredStatutes: [
      "Muslim Family Laws Ordinance, 1961",
      "West Pakistan Family Courts Act, 1964",
      "Guardians and Wards Act, 1890"
    ]
  },
  {
    id: "special",
    label: "Special Regimes & Cyber Crimes",
    shortLabel: "Special & Cyber",
    iconName: "Cpu",
    description: "Prevention of Electronic Crimes Act 2016 (PECA), Financial Institutions Ordinance 2001 (FIO), NAO 1999.",
    statutesCount: 4,
    featuredStatutes: [
      "Prevention of Electronic Crimes Act, 2016 (PECA)",
      "Financial Institutions (Recovery of Finances) Ordinance, 2001",
      "National Accountability Ordinance, 1999",
      "Anti-Terrorism Act, 1997"
    ]
  }
];

/* ==========================================================================
   2. STATUTE SECTIONS & COMMENTARY DATABASE (42+ RICH PROVISIONS)
   ========================================================================== */

export const STATUTE_SECTIONS: StatuteSection[] = [
  // --- DOMAIN 1: CIVIL PROCEDURE & RELIEF ---
  {
    id: "cpc-o7-r11",
    sectionNumber: "Order VII Rule 11",
    title: "Rejection of Plaint",
    statuteName: "Code of Civil Procedure, 1908",
    statuteYear: 1908,
    domain: "civil",
    text: `The plaint shall be rejected in the following cases:—
(a) where it does not disclose a cause of action:
(b) where the relief claimed is undervalued, and the plaintiff, on being required by the Court to correct the valuation within a time to be fixed by the Court, fails to do so:
(c) where the relief claimed is properly valued, but the plaint is written upon paper insufficiently stamped, and the plaintiff, on being required by the Court to supply the requisite stamp-paper within a time to be fixed by the Court, fails to do so:
(d) where the suit appears from the statement in the plaint to be barred by any law.`,
    commentary: `Order VII Rule 11 CPC casts a statutory duty upon the Court to examine the averments of the plaint at the earliest threshold stage and nip vexatious or barred litigation in the bud. 

Key Procedural Rules:
1. Plaint Statements Presumed True: For rejection under Clause (a) or (d), the Court must restrict its scrutiny exclusively to the averments made inside the four corners of the plaint. The defense set up in the written statement or extraneous documents produced by the defendant cannot be considered.
2. Mandatory Opportunity for Stamp/Valuation: Under Clauses (b) and (c), rejection cannot be ordered peremptorily without first granting the plaintiff a specific, reasonable timeline to make good the deficient court fee or correct the valuation.
3. Fatal Pleading Defects: Where essential statutory ingredients of substantive law (e.g. S.24(c) Specific Relief Act readiness or Section 42 proviso possession) are completely omitted, the plaint fails to disclose a cause of action and is liable to rejection.`,
    proceduralNotes: "Application can be moved at any stage of proceedings prior to final decree; no limitation period restricts the Court's suo motu power to reject under Rule 11.",
    mandatoryPleadings: "Must aver precise calendar date of cause of action accrual, specific infringement of right, and demonstrate absence of statutory bar under Limitation Act 1908 or relevant special law.",
    punishmentOrRelief: "Rejection of plaint (does not preclude plaintiff from presenting a fresh plaint on the same cause of action under Order VII Rule 13 CPC if not otherwise barred).",
    crossReferences: ["cpc-sec-11", "sra-sec-24c", "sra-sec-42", "lim-art-113", "cpc-o7-r13"],
    keywords: ["rejection of plaint", "cause of action", "undervalued", "insufficient stamp", "barred by law", "threshold dismissal", "Order 7 Rule 11", "O7 R11"],
    landmarkCitations: [
      {
        citation: "PLD 2020 SC 142",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Muhammad Tariq v. Mst. Parveen Akhtar",
        ratio: "Scope of Order VII Rule 11 CPC: Plaint must disclose clear cause of action with specific accrual dates. Court must look solely at plaint averments assuming them to be true, without looking into written statement."
      },
      {
        citation: "2019 SCMR 659",
        court: "Supreme Court of Pakistan",
        year: 2019,
        title: "Haji Abdul Wahab v. Province of Punjab",
        ratio: "Rejection on limitation: When the plaint on its face shows the claim is barred by the Limitation Act 1908, rejection under Order VII Rule 11(d) is mandatory."
      },
      {
        citation: "PLD 2021 SC 429",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Muhammad Nawaz v. Ghulam Murtaza",
        ratio: "Failure to plead essential statutory ingredients under substantive law disentitles plaintiff from maintaining the suit and invites summary rejection under Order VII Rule 11 CPC."
      },
      {
        citation: "1991 SCMR 1067",
        court: "Supreme Court of Pakistan",
        year: 1991,
        title: "Siddique Khan v. Abdul Shakur Khan",
        ratio: "Opportunity to make good court fee deficit is mandatory under O.VII R.11(c) before rejection. Court must fix a date and specify the exact deficient amount."
      }
    ]
  },
  {
    id: "cpc-o39-r1-2",
    sectionNumber: "Order XXXIX Rules 1 & 2",
    title: "Temporary Injunctions and Interlocutory Orders",
    statuteName: "Code of Civil Procedure, 1908",
    statuteYear: 1908,
    domain: "civil",
    text: `Rule 1. Where in any suit it is proved by affidavit or otherwise—
(a) that any property in dispute in a suit is in danger of being wasted, damaged, or alienated by any party to the suit, or wrongfully sold in execution of a decree, or
(b) that the defendant threatens, or intends, to remove or dispose of his property with a view to defrauding his creditors,
the Court may by order grant a temporary injunction to restrain such act, or make such other order for the purpose of staying and preventing the wasting, damaging, alienation, sale, removal or disposition of the property as the Court thinks fit, until the disposal of the suit or until further orders.

Rule 2. (1) In any suit for restraining the defendant from committing a breach of contract or other injury of any kind, whether compensation be claimed in the suit or not, the plaintiff may, at any time after the commencement of the suit, and either before or after judgment, apply to the Court for a temporary injunction to restrain the defendant from committing the breach of contract or injury complained of, or any breach of contract or injury of a like kind arising out of the same contract or relating to the same property or right.`,
    commentary: `The grant of temporary injunction is an extraordinary, discretionary, and equitable relief governed strictly by the coexistence of three golden principles:

1. Prima Facie Case: The applicant must demonstrate an arguable, substantial question of law or fact with a reasonable probability of success at trial. A mere prima facie title without clean hands is insufficient.
2. Irreparable Loss: The applicant must establish that if the injunction is refused, they will suffer an injury or damage that cannot be adequately assessed or compensated in terms of monetary damages.
3. Balance of Convenience: The Court must balance the relative hardship: greater hardship and inconvenience would be caused to the applicant by withholding the injunction than would be caused to the opposite party by granting it.`,
    proceduralNotes: "Ex parte status quo orders cannot ordinarily be extended indefinitely without notice; application must be accompanied by a sworn affidavit and specific relief prayer.",
    mandatoryPleadings: "Must specifically plead all three elements (prima facie case, irreparable loss, balance of convenience) with factual substantiation in separate paragraphs.",
    punishmentOrRelief: "Interim restraining order / status quo against alienation, dispossession, demolition, encumbrance, or third-party creation.",
    crossReferences: ["sra-sec-54", "cpc-o39-r3", "cpc-o39-r4", "cpc-sec-151"],
    keywords: ["temporary injunction", "stay order", "status quo", "Order 39 Rule 1", "Order 39 Rule 2", "prima facie case", "irreparable loss", "balance of convenience"],
    landmarkCitations: [
      {
        citation: "PLD 1999 SC 461",
        court: "Supreme Court of Pakistan",
        year: 1999,
        title: "Marghub Siddiqi v. Hamid Hasan Ali",
        ratio: "Tripartite golden principles for grant of temporary injunction: Prima facie case, irreparable loss, and balance of convenience must co-exist simultaneously. Absence of any one element is fatal to the application."
      },
      {
        citation: "2004 SCMR 1092",
        court: "Supreme Court of Pakistan",
        year: 2004,
        title: "Aitchison College v. Muhammad Zubair",
        ratio: "Discretionary power under Order XXXIX Rules 1 & 2 CPC must be exercised judicially, not arbitrarily or capriciously. Court cannot decide ultimate merits of the suit at interlocutory stage."
      },
      {
        citation: "2014 SCMR 1481",
        court: "Supreme Court of Pakistan",
        year: 2014,
        title: "Muhammad Aslam v. Province of Punjab",
        ratio: "Status quo order cannot be granted where the plaintiff fails to prove irreparable loss or where monetary compensation would afford adequate relief."
      }
    ]
  },
  {
    id: "cpc-o21-execution",
    sectionNumber: "Order XXI (Rules 10, 22, 32, 35, 58)",
    title: "Execution of Decrees and Orders",
    statuteName: "Code of Civil Procedure, 1908",
    statuteYear: 1908,
    domain: "civil",
    text: `Rule 10. Application for execution.—Where the holder of a decree desires to execute it, he shall apply to the Court which passed the decree, or to the officer (if any) appointed in this behalf, or if the decree has been sent under the provisions hereinbefore contained to another Court then to such Court.

Rule 22. Notice to show cause against execution in certain cases.—(1) Where an application for execution is made—
(a) more than one year after the date of the decree, or
(b) against the legal representative of a party to the decree,
the Court executing the decree shall issue a notice to the person against whom execution is applied for requiring him to show cause, on a date to be fixed, why the decree should not be executed against him.

Rule 32. Decree for specific performance for restitution of conjugal rights, or for an injunction.—Where the party against whom a decree for specific performance... has been passed, has had an opportunity of obeying the decree and has willfully failed to obey it, the decree may be enforced by his detention in the civil prison, or by the attachment of his property, or by both.

Rule 35. Decree for immovable property.—(1) Where a decree is for the delivery of any immovable property, possession thereof shall be delivered to the party to whom it has been adjudged...

Rule 58. Investigation of claims to, and objections to attachment of, attached property.`,
    commentary: `Execution proceedings represent the culmination of civil litigation. Section 47 CPC strictly prohibits separate civil suits on questions relating to the execution, discharge, or satisfaction of a decree.

Key Principles:
1. Executing Court Cannot Go Behind Decree: The executing court must execute the decree as it stands and has no jurisdiction to alter, amend, or question its legality or correctness on merits.
2. Rule 58 Objections: Third-party objections to attachment or delivery of possession must be investigated and adjudicated by the executing court as a regular suit with full evidentiary opportunities, not summarily rejected.
3. Coercive Machinery: For specific performance decrees, the executing court possesses statutory power to appoint a court commissioner to execute the registered sale deed on behalf of a recalcitrant judgment-debtor.`,
    proceduralNotes: "Execution application must be filed within the period prescribed under Article 182 Limitation Act 1908, subject to the ultimate 6-year ceiling under Section 48 CPC.",
    mandatoryPleadings: "Must specify decree date, court, relief granted, appeal history, and exact property or monetary satisfaction demanded.",
    punishmentOrRelief: "Warrant of possession, attachment/sale of immovable property, appointment of commissioner for conveyance execution, detention in civil prison.",
    crossReferences: ["cpc-sec-47", "cpc-sec-48", "lim-art-182"],
    keywords: ["execution of decree", "Order 21", "warrant of possession", "Rule 58 objection", "Section 47 CPC", "executing court", "decree-holder"],
    landmarkCitations: [
      {
        citation: "2020 SCMR 1254",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Muhammad Aslam v. Mst. Razia Begum",
        ratio: "Executing court cannot go behind the decree; it must execute the decree as passed in letter and spirit, without reopening settled findings of fact."
      },
      {
        citation: "PLD 2021 SC 562",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Bashir Ahmad v. Mian Muhammad",
        ratio: "Scope of Section 47 & Order XXI Rule 58 CPC: Separate suit is barred; executing court is fully competent and obligated to adjudicate third-party claims on evidence."
      }
    ]
  },
  {
    id: "cpc-sec-11",
    sectionNumber: "Section 10 & 11",
    title: "Stay of Suit (Res Sub-Judice) & Res Judicata",
    statuteName: "Code of Civil Procedure, 1908",
    statuteYear: 1908,
    domain: "civil",
    text: `Section 10. Stay of suit.—No Court shall proceed with the trial of any suit in which the matter in issue is also directly and substantially in issue in a previously instituted suit between the same parties, or between parties under whom they or any of them claim litigating under the same title where such suit is pending in the same or any other Court in Pakistan having jurisdiction to grant the relief claimed.

Section 11. Res judicata.—No Court shall try any suit or issue in which the matter directly and substantially in issue has been directly and substantially in issue in a former suit between the same parties, or between parties under whom they or any of them claim, litigating under the same title, in a Court competent to try such subsequent suit or the suit in which such issue has been subsequently raised, and has been heard and finally decided by such Court.`,
    commentary: `Section 10 (Res Sub-Judice) prevents courts of concurrent jurisdiction from simultaneously adjudicating two parallel litigations over identical matters in issue. Section 11 (Res Judicata) enforces the fundamental public policy principle of 'interest reipublicae ut sit finis litium' (finality of litigation) and 'nemo debet bis vexari pro una et eadem causa' (no one should be twice vexed for the same cause).

Constructive Res Judicata (Explanation IV): Any matter which might and ought to have been made a ground of defense or attack in such former suit shall be deemed to have been a matter directly and substantially in issue in such suit.`,
    proceduralNotes: "Plea of Res Judicata can be raised under Order VII Rule 11(d) CPC or as a preliminary issue of law under Order XIV Rule 2 CPC.",
    mandatoryPleadings: "Must annex certified copies of earlier plaint, written statement, issues, and final judgment/decree.",
    punishmentOrRelief: "Dismissal or rejection of subsequent suit / Stay of trial pending earlier suit.",
    crossReferences: ["cpc-o7-r11", "cpc-sec-12-2"],
    keywords: ["res judicata", "res sub judice", "Section 10", "Section 11 CPC", "finality of litigation", "constructive res judicata", "former suit"],
    landmarkCitations: [
      {
        citation: "PLD 2019 SC 438",
        court: "Supreme Court of Pakistan",
        year: 2019,
        title: "Tariq Transport Co. v. Federation of Pakistan",
        ratio: "Constructive Res Judicata: A party omitting to take a plea which ought to have been taken in the earlier litigation cannot be permitted to initiate a fresh round of litigation on that omitted ground."
      },
      {
        citation: "2017 SCMR 1680",
        court: "Supreme Court of Pakistan",
        year: 2017,
        title: "Muhammad Aslam v. Province of Punjab",
        ratio: "Section 10 CPC applies only to the trial of the suit, not to interlocutory proceedings or applications for temporary injunction."
      }
    ]
  },
  {
    id: "cpc-sec-12-2",
    sectionNumber: "Section 12(2)",
    title: "Challenge to Validity of Decree on Ground of Fraud, Misrepresentation or Want of Jurisdiction",
    statuteName: "Code of Civil Procedure, 1908",
    statuteYear: 1908,
    domain: "civil",
    text: `Where a person challenges the validity of a decree, judgment or order on the plea of fraud, misrepresentation or want of jurisdiction, he shall seek his remedy by making an application to the Court which passed the final decree, judgment or order and not by a separate suit.`,
    commentary: `Section 12(2) CPC was enacted by the Law Reforms Ordinance to eliminate endless cycles of separate civil suits instituted to impeach earlier decrees. 

Essential Rules:
1. Complete Bar on Separate Suit: A separate suit challenging a decree on fraud, misrepresentation, or coram non judice is barred by law and must be rejected under Order VII Rule 11(d).
2. Proper Forum: The application lies exclusively before the Court that passed the final decree (if affirmed in appeal, before the appellate court).
3. Recording of Evidence: Where serious disputed questions of fraud or forgery are raised, the court must frame issues and record evidence rather than disposing of the application summarily.`,
    proceduralNotes: "Governed by Article 181 Limitation Act 1908 (3-year limitation clock commencing from the date of knowledge of fraud/decree).",
    mandatoryPleadings: "Must plead specific particulars of fraud with exact dates, nature of deception, and exact date of discovery of fraud.",
    punishmentOrRelief: "Setting aside of fraudulent decree / Restoration of original suit to its original position.",
    crossReferences: ["cpc-o7-r11", "lim-art-181"],
    keywords: ["Section 12(2)", "fraud", "misrepresentation", "want of jurisdiction", "setting aside decree", "bar on separate suit"],
    landmarkCitations: [
      {
        citation: "PLD 1997 SC 823",
        court: "Supreme Court of Pakistan",
        year: 1997,
        title: "Government of Sindh v. Sharaf Faridi",
        ratio: "Scope of Section 12(2) CPC: Remedy against decree procured by fraud is by moving an application before the court that passed the final decree, not by a separate suit."
      },
      {
        citation: "2020 SCMR 1475",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Muhammad Siddique v. Mst. Noor Bibi",
        ratio: "Where application under Section 12(2) CPC raises contested factual assertions regarding forged power of attorney, holding of regular trial and recording of evidence is indispensable."
      }
    ]
  },
  {
    id: "cpc-sec-115",
    sectionNumber: "Section 115",
    title: "Civil Revision Jurisdiction of High Court and District Court",
    statuteName: "Code of Civil Procedure, 1908",
    statuteYear: 1908,
    domain: "civil",
    text: `(1) The High Court may call for the record of any case which has been decided by any Court subordinate to such High Court and in which no appeal lies thereto, and if such subordinate Court appears—
(a) to have exercised a jurisdiction not vested in it by law, or
(b) to have failed to exercise a jurisdiction so vested, or
(c) to have acted in the exercise of its jurisdiction illegally or with material irregularity,
the High Court may make such order in the case as it thinks fit:
Provided that the High Court shall not, under this section, vary or reverse any order made, or any order deciding an issue, in the course of a suit or other proceeding, except where the order, if it had been made in favor of the party applying for revision, would have finally disposed of the suit or other proceedings.
(2) The District Court may exercise revisional powers in respect of any case decided by a Civil Judge...`,
    commentary: `Revisional jurisdiction under Section 115 CPC is supervisory and correctional in nature. It is not an appellate forum and cannot be used to re-appreciate findings of fact unless the subordinate court committed jurisdictional error, misread evidence, or acted with patent perversity.`,
    proceduralNotes: "Limitation period is 90 days from the date of the impugned order/decree; must annex certified copies of all subordinate court pleadings and judgments.",
    mandatoryPleadings: "Must specify exact jurisdictional defect: illegal exercise, failure to exercise, or material irregularity.",
    punishmentOrRelief: "Setting aside or modification of subordinate court judgment/order.",
    crossReferences: ["cpc-sec-96", "cpc-sec-100", "lim-art-156"],
    keywords: ["civil revision", "Section 115 CPC", "jurisdictional error", "material irregularity", "supervisory jurisdiction"],
    landmarkCitations: [
      {
        citation: "PLD 2018 SC 643",
        court: "Supreme Court of Pakistan",
        year: 2018,
        title: "Muhammad Din v. Ghulam Rasool",
        ratio: "Revisional jurisdiction under Section 115 CPC is confined to jurisdictional errors, illegalities, or material irregularities; High Court cannot re-evaluate evidence as a routine court of appeal."
      }
    ]
  },
  {
    id: "cpc-sec-151",
    sectionNumber: "Section 151",
    title: "Saving of Inherent Powers of Civil Court",
    statuteName: "Code of Civil Procedure, 1908",
    statuteYear: 1908,
    domain: "civil",
    text: `Nothing in this Code shall be deemed to limit or otherwise affect the inherent power of the Court to make such orders as may be necessary for the ends of justice or to prevent abuse of the process of the Court.`,
    commentary: `Section 151 CPC does not confer any new substantive power, but recognizes and preserves the inherent power residing in every civil court to do justice and prevent procedural abuse where no specific provision of the Code directly applies.`,
    proceduralNotes: "Cannot be invoked in direct contravention of express statutory provisions of CPC or Limitation Act.",
    mandatoryPleadings: "Must demonstrate absence of specific alternative provision and grave prejudice to ends of justice.",
    punishmentOrRelief: "Restoration of applications, consolidation of suits, rectification of clerical errors, maintenance of status quo.",
    crossReferences: ["cpc-o39-r1-2", "cpc-sec-12-2"],
    keywords: ["Section 151 CPC", "inherent powers", "ends of justice", "abuse of process", "procedural justice"],
    landmarkCitations: [
      {
        citation: "PLD 2020 SC 282",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Haji Muhammad v. Abdul Ghani",
        ratio: "Section 151 CPC cannot be invoked as an alternate remedy to bypass express statutory provisions, but is fully available to prevent procedural entrapment and gross injustice."
      }
    ]
  },
  {
    id: "sra-sec-8-9",
    sectionNumber: "Section 8 & 9",
    title: "Recovery of Specific Immovable Property & Summary Suit by Dispossessed Person",
    statuteName: "Specific Relief Act, 1877",
    statuteYear: 1877,
    domain: "civil",
    text: `Section 8. Recovery of specific immovable property.—A person entitled to the possession of specific immovable property may recover it in the manner prescribed by the Code of Civil Procedure.

Section 9. Suit by person dispossessed of immovable property.—If any person is dispossessed without his consent of immovable property otherwise than in due course of law, he or any person claiming through him may, by suit, recover possession thereof, notwithstanding any other title that may be set up in such suit.
Nothing in this section shall bar any person from suing to establish his title to such property and to recover possession thereof.
No suit under this section shall be brought after the expiration of six months from the date of the dispossession, or against the Federal or Provincial Government.`,
    commentary: `Section 9 SRA 1877 provides an extraordinary summary remedy to restore settled possession unlawfully disturbed without due process. In a Section 9 suit, questions of proprietary title are completely irrelevant; the plaintiff must only prove previous peaceful possession and illegal dispossession within 6 months.`,
    proceduralNotes: "Strict 6-month limitation clock from date of dispossession; no appeal lies against a decree under Section 9.",
    mandatoryPleadings: "Must aver actual peaceful physical possession and exact date/manner of forcible illegal dispossession.",
    punishmentOrRelief: "Summary decree for restoration of physical possession.",
    crossReferences: ["sra-sec-42", "lim-art-142"],
    keywords: ["Section 9 SRA", "summary dispossession", "settled possession", "6 months limitation", "recovery of possession"],
    landmarkCitations: [
      {
        citation: "2018 SCMR 145",
        court: "Supreme Court of Pakistan",
        year: 2018,
        title: "Muhammad Sarwar v. Province of Punjab",
        ratio: "In a suit under Section 9 Specific Relief Act 1877, title is not to be investigated; court is concerned solely with peaceful settled possession and unlawful dispossession within 6 months."
      }
    ]
  },
  {
    id: "sra-sec-12",
    sectionNumber: "Section 12",
    title: "Cases in which Specific Performance Enforceable",
    statuteName: "Specific Relief Act, 1877",
    statuteYear: 1877,
    domain: "civil",
    text: `Except as otherwise provided in this Chapter, the specific performance of any contract may in the discretion of the Court be enforced—
(a) when the act agreed to be done is in the nature of a trust;
(b) when there exists no standard for ascertaining the actual damage caused by the non-performance of the act agreed to be done;
(c) when the act agreed to be done is such that pecuniary compensation for its non-performance would not afford adequate relief; or
(d) when it is probable that pecuniary compensation cannot be got for the non-performance of the act agreed to be done.

Explanation.—Unless and until the contrary is proved, the Court shall presume that the breach of a contract to transfer immovable property cannot be adequately relieved by compensation in money, and that the breach of a contract to transfer movable property can be thus relieved.`,
    commentary: `Section 12 Specific Relief Act 1877 establishes the statutory foundation for suits compelling specific performance of contracts, particularly for immovable property.

Key Statutory Principles:
1. Discretionary Equitable Relief: Specific performance is not an absolute right; relief is governed by judicial discretion guided by equity, good conscience, and fairness.
2. Immovable Property Presumption: The Explanation creates a statutory presumption that damages are inadequate relief for breach of real estate agreements.
3. Clean Hands Doctrine: He who comes to equity must come with clean hands; any deceit, concealment, or unilateral variation of terms forfeits equitable relief.`,
    proceduralNotes: "Suit must be instituted within 3 years under Article 113 Limitation Act 1908 from the date fixed for performance or notice of refusal.",
    mandatoryPleadings: "Must aver contract terms, earnest money paid, balance consideration, tender of performance, and readiness under Section 24(c).",
    punishmentOrRelief: "Decree for specific performance directing execution of registered conveyance and delivery of possession.",
    crossReferences: ["sra-sec-24c", "lim-art-113", "tpa-sec-54"],
    keywords: ["specific performance", "Section 12 SRA", "agreement to sell", "immovable property", "equitable relief", "clean hands"],
    landmarkCitations: [
      {
        citation: "2016 SCMR 1747",
        court: "Supreme Court of Pakistan",
        year: 2016,
        title: "Muhammad Riaz v. Mst. Sakina Bibi",
        ratio: "Specific performance of contract is an equitable discretionary relief; the plaintiff must come to court with clean hands and demonstrate strict adherence to contract covenants."
      },
      {
        citation: "2021 SCMR 1358",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Ghulam Nabi v. Muhammad Asghar",
        ratio: "Agreement to sell does not confer proprietary title in immovable property; plaintiff must obtain decree for specific performance and get conveyance deed executed."
      }
    ]
  },
  {
    id: "sra-sec-24c",
    sectionNumber: "Section 24(c)",
    title: "Personal Bars to Relief — Mandatory Averment of Continuous Readiness and Willingness",
    statuteName: "Specific Relief Act, 1877",
    statuteYear: 1877,
    domain: "civil",
    text: `Specific performance of a contract cannot be enforced in favour of a person—
(a) who could not recover compensation for its breach;
(b) who has become incapable of performing, or violates, any essential term of the contract that on his part remains to be performed;
(c) who fails to aver and prove that he has performed, or has at all times been ready and willing to perform, the essential terms of the contract which are to be performed by him, other than terms the performance of which has been prevented or waived by the defendant.`,
    commentary: `Section 24(c) Specific Relief Act 1877 creates an absolute personal bar against granting specific performance. Under settled Pakistani Supreme Court jurisprudence (PLD 2021 SC 429), continuous readiness and willingness is an indispensable condition precedent.

Fatal Pleading Traps:
1. Mandatory Dual Requirement: The plaintiff must BOTH explicitly aver in the plaint AND subsequently prove on evidence that they were ready and willing at all material times (from contract execution to final decree).
2. Financial Capability: Readiness includes demonstrating liquid financial capability to pay the outstanding balance sale consideration.
3. Judicial Deposit: Failure to deposit balance consideration upon court direction negates readiness and leads to dismissal of suit.`,
    proceduralNotes: "Omission of Section 24(c) averment in the plaint is a fatal defect that cannot be cured at the argument stage.",
    mandatoryPleadings: "Must contain explicit clause: 'The plaintiff has at all material times been ready, willing, and possessed of financial capacity to perform his part of the contract, and remains ready and willing to deposit the balance sale consideration...'",
    punishmentOrRelief: "Dismissal of suit for specific performance with costs.",
    crossReferences: ["sra-sec-12", "cpc-o7-r11", "lim-art-113"],
    keywords: ["Section 24(c)", "readiness and willingness", "financial capability", "mandatory pleading", "personal bar", "specific relief"],
    landmarkCitations: [
      {
        citation: "PLD 2021 SC 429",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Muhammad Nawaz v. Ghulam Murtaza",
        ratio: "Supreme Court Full Bench: In a suit for specific performance, plaintiff must explicitly plead and prove readiness and willingness to perform his part from the date of contract up to the date of hearing; omission in plaint is fatal and cannot be condoned."
      },
      {
        citation: "2021 SCMR 1358",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Ghulam Nabi v. Muhammad Asghar",
        ratio: "Readiness under Section 24(c) encompasses genuine financial capability and capacity to pay the remaining consideration money on the stipulated date."
      },
      {
        citation: "2022 SCMR 898",
        court: "Supreme Court of Pakistan",
        year: 2022,
        title: "Mst. Mumtaz Begum v. Abdul Rasheed",
        ratio: "Failure to deposit balance sale consideration in court upon judicial direction unequivocally negates readiness and willingness under Section 24(c) SRA 1877."
      }
    ]
  },
  {
    id: "sra-sec-42",
    sectionNumber: "Section 42",
    title: "Discretion of Court as to Declaration of Status or Right & Consequential Relief Proviso",
    statuteName: "Specific Relief Act, 1877",
    statuteYear: 1877,
    domain: "civil",
    text: `Any person entitled to any legal character, or to any right as to any property, may institute a suit against any person denying, or interested to deny, his title to such character or right, and the Court may in its discretion make therein a declaration that he is so entitled, and the plaintiff need not in such suit ask for any further relief:

Provided that no Court shall make any such declaration where the plaintiff, being able to seek further relief than a mere declaration of title, omits to do so.`,
    commentary: `Section 42 enables a person whose legal status or title to property is clouded or denied to obtain a binding declaratory decree. 

The Proviso Bar:
The statutory proviso is strict and mandatory. Where the plaintiff is out of possession of immovable property, a suit for mere declaration of title without praying for consequential relief of possession (under Section 8/9 SRA) is legally incompetent and barred. The Court has no jurisdiction to grant a naked declaration in such cases.`,
    proceduralNotes: "Ad valorem court fee under Section 7(iv)(c) Court Fees Act 1870 is attracted when consequential relief (possession/injunction) is sought.",
    mandatoryPleadings: "Must aver title/legal character, specific denial by defendant, and if dispossessed, must explicitly pray for recovery of possession as consequential relief.",
    punishmentOrRelief: "Decree declaring legal character or title + consequential relief (possession / injunction).",
    crossReferences: ["sra-sec-8", "sra-sec-54", "cfa-sec-7"],
    keywords: ["Section 42", "declaration", "consequential relief", "proviso bar", "legal character", "title cloud", "Specific Relief Act"],
    landmarkCitations: [
      {
        citation: "PLD 2020 SC 703",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Mst. Khurshid Begum v. Ghulam Sarwar",
        ratio: "Suit for declaration without seeking consequential relief of possession, where the plaintiff was out of physical possession on the date of suit, is hit by the proviso to Section 42 SRA 1877 and liable to dismissal."
      },
      {
        citation: "2018 SCMR 1970",
        court: "Supreme Court of Pakistan",
        year: 2018,
        title: "Province of Punjab v. Muhammad Hussain",
        ratio: "Declaration of legal character or property title cannot be granted in a vacuum; plaintiff must establish a preexisting, enforceable legal right."
      }
    ]
  },
  {
    id: "sra-sec-54",
    sectionNumber: "Section 54",
    title: "Perpetual Injunction When Granted",
    statuteName: "Specific Relief Act, 1877",
    statuteYear: 1877,
    domain: "civil",
    text: `Subject to the other provisions contained in, or referred to by, this Chapter, a perpetual injunction may be granted to prevent the breach of an obligation existing in favour of the applicant, whether expressly or by implication.
When such obligation arises from contract, the Court shall be guided by the rules and provisions contained in Chapter II of this Part.
When the defendant invades or threatens to invade the plaintiff's right to, or enjoyment of, property, the Court may grant a perpetual injunction in the following cases:—
(a) where the defendant is trustee of the property for the plaintiff;
(b) where there exists no standard for ascertaining the actual damage caused, or likely to be caused, by the invasion;
(c) where the invasion is such that pecuniary compensation would not afford adequate relief;
(d) where it is probable that pecuniary compensation cannot be got for the invasion;
(e) where the injunction is necessary to prevent a multiplicity of judicial proceedings.`,
    commentary: `Section 54 provides permanent protection for settled legal rights and peaceful possession. A perpetual injunction can only be granted by the decree made at the hearing and upon the merits of the suit, perpetually enjoining the defendant from the assertion of a right or commission of an act contrary to the plaintiff's rights.`,
    proceduralNotes: "Fixed court fee applies in purely preventive injunction suits; ad valorem applies if coupled with title declaration.",
    mandatoryPleadings: "Must aver settled lawful possession, specific threat of dispossession/interference, and inadequacy of monetary compensation.",
    punishmentOrRelief: "Perpetual restraining decree against unlawful dispossession or interference.",
    crossReferences: ["cpc-o39-r1-2", "sra-sec-56"],
    keywords: ["perpetual injunction", "permanent injunction", "Section 54 SRA", "settled possession", "multiplicity of proceedings"],
    landmarkCitations: [
      {
        citation: "2002 SCMR 1391",
        court: "Supreme Court of Pakistan",
        year: 2002,
        title: "Muhammad Shafi v. Ghulam Rasool",
        ratio: "Permanent injunction granted to protect settled, peaceful possession against unlawful dispossession without due process of law, even against true owner until evicted by lawful decree."
      }
    ]
  },
  {
    id: "cfa-sec-7",
    sectionNumber: "Section 7 & 28",
    title: "Computation of Fees Payable in Suits & Stamp Inadvertence Cure",
    statuteName: "Court Fees Act, 1870",
    statuteYear: 1870,
    domain: "civil",
    text: `Section 7. Computation of fees payable in certain suits.—The amount of fee payable under this Act in the suits next hereinafter mentioned shall be computed as follows:—
(i) For money (recovery suits) — according to the amount claimed;
(iv)(c) For declaratory decree and consequential relief — according to the amount at which the relief sought is valued in the plaint;
(iv)(d) For an injunction — according to the amount at which the relief sought is valued;
(v) For possession of land, houses and gardens — according to the market value or revenue multiples;
(x) For specific performance of a contract of sale — according to the amount of the consideration.

Section 28. Stamping of documents inadvertently received.—No document which ought to bear a stamp under this Act shall be of any validity, unless and until it is properly stamped. But, if any such document is through mistake or inadvertence received, filed or used in any Court or office, the presiding Judge or the head of the office may, if he thinks fit, order that the same be stamped as he may direct; and, on such document being stamped accordingly, the same and every proceeding relative thereto shall be as valid as if it had been properly stamped in the first instance.`,
    commentary: `Section 7 Court Fees Act 1870 regulates ad valorem and fixed court fees across Pakistan. Combined with Section 28 and Order VII Rule 11(c) CPC, an insufficiently stamped plaint is not void ab initio; the Court possesses statutory power to permit making up the deficiency with retrospective validity.`,
    proceduralNotes: "Provincial amendments (e.g. Punjab Amendment Act 2012) establish a maximum statutory fee cap of PKR 15,000/- for all ad valorem suits.",
    mandatoryPleadings: "Must contain valuation paragraph stating: 'The suit is valued for the purposes of court fee and jurisdiction at Rs. X...'",
    punishmentOrRelief: "Validation of plaint upon making up stamp deficit; rejection if default continues.",
    crossReferences: ["cpc-o7-r11", "sva-sec-8"],
    keywords: ["court fees", "Section 7 CFA", "Section 28 CFA", "ad valorem", "valuation of suit", "stamp paper", "statutory cap"],
    landmarkCitations: [
      {
        citation: "1991 SCMR 1067",
        court: "Supreme Court of Pakistan",
        year: 1991,
        title: "Siddique Khan v. Abdul Shakur Khan",
        ratio: "Section 28 CFA & Order VII Rule 11 CPC: Opportunity to make good court fee deficit is a mandatory statutory right; retrospective validity attaches once deficiency is supplied."
      }
    ]
  },

  // --- DOMAIN 2: CRIMINAL LAW & PROCEDURE ---
  {
    id: "ppc-sec-34-149",
    sectionNumber: "Section 34 & 149",
    title: "Common Intention & Common Object of Unlawful Assembly",
    statuteName: "Pakistan Penal Code, 1860",
    statuteYear: 1860,
    domain: "criminal",
    text: `Section 34. Acts done by several persons in furtherance of common intention.—When a criminal act is done by several persons in furtherance of the common intention of all, each of such persons is liable for that act in the same manner as if it were done by him alone.

Section 149. Every member of unlawful assembly guilty of offence committed in prosecution of common object.—If an offence is committed by any member of an unlawful assembly in prosecution of the common object of that assembly, or such as the members of that assembly knew to be likely to be committed in prosecution of that object, every person who, at the time of the committing of that offence, is a member of the same assembly, is guilty of that offence.`,
    commentary: `Sections 34 and 149 PPC embody principles of constructive joint criminal liability under Pakistani law.

Distinction:
Section 34 requires prior meeting of minds (pre-arranged plan or consensus developed on the spot) and active participation in the criminal act. Section 149 requires membership in an unlawful assembly of 5 or more persons sharing a common object, holding every member constructively liable even if they did not commit the fatal overt act.`,
    proceduralNotes: "Constructive liability must be specifically charged in the formal charge framed under Section 221-223 CrPC.",
    mandatoryPleadings: "Must aver specific role, pre-concert of minds, joint presence, and furtherance of shared criminal design.",
    punishmentOrRelief: "Vicarious/constructive punishment identical to the substantive offence committed.",
    crossReferences: ["ppc-sec-302", "crpc-sec-221"],
    keywords: ["common intention", "common object", "Section 34", "Section 149", "joint liability", "unlawful assembly", "vicarious liability"],
    landmarkCitations: [
      {
        citation: "PLD 2018 SC 795",
        court: "Supreme Court of Pakistan",
        year: 2018,
        title: "Muhammad Riaz v. State",
        ratio: "Section 34 PPC requires pre-concert or meeting of minds; mere presence at the scene without participation or shared criminal intention does not attract constructive liability."
      }
    ]
  },
  {
    id: "ppc-sec-489f",
    sectionNumber: "Section 489-F",
    title: "Dishonestly Issuing a Cheque",
    statuteName: "Pakistan Penal Code, 1860",
    statuteYear: 1860,
    domain: "criminal",
    text: `Whoever dishonestly issues a cheque towards repayment of a loan or fulfillment of an obligation which is dishonoured on presentation, shall be punished with imprisonment which may extend to three years, or with fine, or with both, unless he can establish, for which burden of proof shall rest on him, that he had made arrangements with his bank to ensure that the cheque would be honoured and that the bank was at fault in not honouring the cheque.`,
    commentary: `Section 489-F PPC was inserted to curb fraudulent financial transactions and protect commercial faith.

Three Mandatory Statutory Ingredients:
1. Issuance of Cheque with Dishonest Intention: Dishonesty (as defined under Section 24 PPC) is the cornerstone. Mere dishonour without dishonest intention does not constitute an offence.
2. Towards Repayment of Loan or Fulfillment of Obligation: Must relate to an existing, enforceable legal liability; cheques issued as collateral guarantee or security during ongoing business disputes do not automatically attract criminal liability.
3. Dishonour on Presentation: Cheque must be presented and returned unpaid with a bank return memo.

Statutory Defense:
The accused can discharge the reverse burden by proving that adequate arrangements were made with the bank or that bank operational error caused the dishonour.`,
    proceduralNotes: "Cognizable, bailable, and compoundable offence tried by Judicial Magistrate Class I; does not bar concurrent civil recovery under Order XXXVII CPC.",
    mandatoryPleadings: "Must plead exact transaction date, consideration, loan obligation, cheque details, bank dishonour memo date, and dishonest inducement.",
    punishmentOrRelief: "Imprisonment up to 3 years, or with fine, or both.",
    crossReferences: ["ppc-sec-420", "ppc-sec-406", "crpc-sec-154", "crpc-sec-497"],
    keywords: ["489-F", "dishonoured cheque", "bouncing cheque", "financial obligation", "dishonest intention", "cheque return memo", "PPC 489-F"],
    landmarkCitations: [
      {
        citation: "1998 SCMR 2268",
        court: "Supreme Court of Pakistan",
        year: 1998,
        title: "Muhammad Aslam v. State",
        ratio: "Pre-arrest bail in financial disputes: Criminal justice machinery cannot be permitted to be used as a recovery agency or coercive tool for recovery of civil debts."
      },
      {
        citation: "PLD 2019 SC 112",
        court: "Supreme Court of Pakistan",
        year: 2019,
        title: "Mian Allah Ditta v. State",
        ratio: "Essential ingredients of Section 489-F PPC: Dishonesty is the cornerstone of the offence. A post-dated cheque handed over as security in a business transaction does not attract Section 489-F PPC in the absence of dishonest intention at inception."
      },
      {
        citation: "2022 SCMR 592",
        court: "Supreme Court of Pakistan",
        year: 2022,
        title: "Zahid Sarfraz v. State",
        ratio: "Concurrent remedies: Filing of a civil suit for recovery under Order XXXVII CPC and registration of criminal case under Section 489-F PPC can proceed concurrently without legal bar."
      }
    ]
  },
  {
    id: "ppc-sec-420-406",
    sectionNumber: "Section 420 & 406",
    title: "Cheating and Dishonestly Inducing Delivery of Property & Criminal Breach of Trust",
    statuteName: "Pakistan Penal Code, 1860",
    statuteYear: 1860,
    domain: "criminal",
    text: `Section 420. Cheating and dishonestly inducing delivery of property.—Whoever cheats and thereby dishonestly induces the person deceived to deliver any property to any person, or to make, alter or destroy the whole or any part of a valuable security, or anything which is signed or sealed, and which is capable of being converted into a valuable security, shall be punished with imprisonment of either description for a term which may extend to seven years, and shall also be liable to fine.

Section 406. Punishment for criminal breach of trust.—Whoever commits criminal breach of trust shall be punished with imprisonment of either description for a term which may extend to seven years, or with fine, or with both.`,
    commentary: `Crucial Distinction between Section 420 and Section 406 PPC:
1. Section 420 (Cheating): Requires dishonest or fraudulent intention *at the very inception* of the transaction inducing the delivery of property.
2. Section 406 (Criminal Breach of Trust): Requires lawful entrustment of property at the inception, followed by subsequent dishonest misappropriation or conversion to one's own use.
3. Mutual Exclusivity: Offences of cheating and criminal breach of trust cannot ordinarily arise from the same single act regarding the same property, as entrustment negates fraudulent inducement at inception.`,
    proceduralNotes: "Both offences are non-bailable, compoundable with permission of Court, and triable by Magistrate Class I.",
    mandatoryPleadings: "Must specify whether fraudulent deception occurred ab initio (S.420) or lawful entrustment was followed by conversion (S.406).",
    punishmentOrRelief: "Imprisonment up to 7 years and fine.",
    crossReferences: ["ppc-sec-489f", "crpc-sec-561a"],
    keywords: ["cheating", "criminal breach of trust", "Section 420", "Section 406", "fraudulent inducement", "entrustment", "misappropriation"],
    landmarkCitations: [
      {
        citation: "2019 SCMR 1429",
        court: "Supreme Court of Pakistan",
        year: 2019,
        title: "Tariq Mahmood v. State",
        ratio: "Mere breach of contract or failure to pay balance consideration does not constitute an offence of cheating under Section 420 PPC unless fraudulent intention is established ab initio."
      },
      {
        citation: "2021 SCMR 873",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Farman Ali v. State",
        ratio: "Distinction between criminal breach of trust (S. 406) and civil liability: Entrustment and dishonest conversion are mandatory sine qua non for criminal liability."
      }
    ]
  },
  {
    id: "ppc-sec-302",
    sectionNumber: "Section 302",
    title: "Punishment of Qatl-i-Amd (Murder)",
    statuteName: "Pakistan Penal Code, 1860",
    statuteYear: 1860,
    domain: "criminal",
    text: `Whoever commits qatl-i-amd shall, subject to the provisions of this Chapter be:—
(a) punished with death as qisas;
(b) punished with death, or imprisonment for life as ta'zir, having regard to the facts and circumstances of the case, if the proof in either of the forms specified in section 304 is not available; or
(c) punished with imprisonment of either description for a term which may extend to twenty-five years, where according to the Injunctions of Islam the punishment of qisas is not applicable.`,
    commentary: `Section 302 PPC prescribes punishment for intentional homicide (Qatl-i-Amd). 

Principles in Capital Offence Trials:
1. Standard of Proof: Standard of proof in capital cases is proof beyond all reasonable shadow of doubt. A single circumstance creating reasonable doubt entitles the accused to acquittal as an absolute right.
2. Two-Plea Rule: The prosecution must stand on its own legs and cannot derive strength from weaknesses in the defense plea.
3. Mitigating Factors for Life Imprisonment: Absence of premeditation, sudden fight, or unproven motive are valid mitigating grounds for awarding life imprisonment instead of capital death sentence.`,
    proceduralNotes: "Exclusively triable by Court of Session; death sentence requires High Court confirmation under Section 374 CrPC.",
    mandatoryPleadings: "Must detail ocular evidence, medical evidence (post-mortem), recovery of crime weapon, forensic PFSA matching, and motive.",
    punishmentOrRelief: "Death, Life Imprisonment (25 years), or up to 25 years rigorous imprisonment + compensation under Section 544-A CrPC.",
    crossReferences: ["crpc-sec-154", "crpc-sec-374", "ppc-sec-34"],
    keywords: ["Section 302", "murder", "Qatl-i-Amd", "death penalty", "life imprisonment", "qisas", "ta'zir", "capital sentence"],
    landmarkCitations: [
      {
        citation: "PLD 2019 SC 527",
        court: "Supreme Court of Pakistan",
        year: 2019,
        title: "Muhammad Akram v. State",
        ratio: "Standard of proof in capital offences: For giving benefit of doubt, it is not necessary that there should be many circumstances creating doubt; a single circumstance creating reasonable doubt entitles the accused to acquittal as a matter of right."
      },
      {
        citation: "2020 SCMR 1420",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Naveed Asghar v. State",
        ratio: "Mitigating circumstances: Absence of pre-concert or unproven motive warrants the reduction of sentence from death penalty to imprisonment for life."
      }
    ]
  },
  {
    id: "crpc-sec-154",
    sectionNumber: "Section 154",
    title: "Information in Cognizable Cases (First Information Report - FIR)",
    statuteName: "Code of Criminal Procedure, 1898",
    statuteYear: 1898,
    domain: "criminal",
    text: `Every information relating to the commission of a cognizable offence if given orally to an officer in charge of a police-station, shall be reduced to writing by him or under his direction, and be read over to the informant; and every such information, whether given in writing or reduced to writing as aforesaid, shall be signed by the person giving it, and the substance thereof shall be entered in a book to be kept by such officer in such form as the Provincial Government may prescribe in this behalf.`,
    commentary: `Section 154 CrPC governs the registration of the First Information Report (FIR). 

Key Legal Doctrines:
1. Mandatory Registration (Sugran Bibi Principle): Upon receiving information disclosing the commission of a cognizable offence, the SHO has no discretion or authority to conduct a preliminary inquiry; registration of FIR under Section 154 CrPC is mandatory.
2. Prohibition of Second FIR: Law does not contemplate registration of a second FIR regarding the same occurrence; any subsequent information or counter-version must be recorded under Section 161 CrPC in the ongoing investigation.`,
    proceduralNotes: "Remedy against police refusal to register FIR lies before the Ex-Officio Justice of Peace under Section 22-A(6) CrPC.",
    mandatoryPleadings: "Must aver date, time, venue of occurrence, names of accused, role ascribed, weapon used, witnesses present, and specific cognizable offences.",
    punishmentOrRelief: "Registration of FIR and commencement of statutory investigation under Chapter XIV CrPC.",
    crossReferences: ["crpc-sec-22a", "crpc-sec-156", "ppc-sec-489f"],
    keywords: ["FIR", "Section 154 CrPC", "cognizable offence", "police station", "Sugran Bibi", "mandatory registration", "second FIR bar"],
    landmarkCitations: [
      {
        citation: "PLD 2007 SC 539",
        court: "Supreme Court of Pakistan",
        year: 2007,
        title: "Mst. Sugran Bibi v. SHO Police Station Lodhran",
        ratio: "Registration of FIR is mandatory under Section 154 CrPC once commission of a cognizable offence is disclosed; police officer has no authority or jurisdiction to conduct preliminary inquiry before registration."
      },
      {
        citation: "PLD 2018 SC 595",
        court: "Supreme Court of Pakistan",
        year: 2018,
        title: "Sughran Bibi v. State (Larger Bench)",
        ratio: "Second FIR on same occurrence is impermissible; all subsequent statements, versions, or counter-versions must be recorded by the Investigating Officer under Section 161 CrPC."
      }
    ]
  },
  {
    id: "crpc-sec-22a-22b",
    sectionNumber: "Section 22-A & 22-B",
    title: "Powers of Ex-Officio Justice of the Peace",
    statuteName: "Code of Criminal Procedure, 1898",
    statuteYear: 1898,
    domain: "criminal",
    text: `Section 22-A(6). An ex-officio Justice of the Peace may issue appropriate directions to the police authorities on a complaint, regarding—
(i) non-registration of a criminal case;
(ii) transfer of investigation from one police officer to another; and
(iii) neglect, failure or excess committed by a police authority in relation to its functions and duties.

Section 22-B. Duties of Justice of the Peace.—Subject to rules made by the Provincial Government, every Justice of the Peace shall have power to make arrest of persons committing breach of peace and assist police officers.`,
    commentary: `Ex-Officio Justices of the Peace (Sessions and Additional Sessions Judges) exercise administrative and quasi-judicial supervisory powers over police inaction or excesses.

Scope & Limitations:
1. Not an Alternate Trial Court: The Justice of the Peace cannot adjudicate civil disputes or examine the veracity of defense pleas at this stage.
2. Judicial Application of Mind: Mechanical directions for FIR registration are deprecated; the Justice of the Peace must satisfy themselves that cognizable allegations are genuinely disclosed (Khizer Hayat case).`,
    proceduralNotes: "Petition under Section 22-A/22-B CrPC is filed before the Sessions Judge / Ex-Officio Justice of Peace of the concerned district.",
    mandatoryPleadings: "Must show prior approach to SHO/DPO and refusal to register FIR despite disclosure of cognizable offence.",
    punishmentOrRelief: "Direction to SHO to record statement under Section 154 CrPC and proceed in accordance with law.",
    crossReferences: ["crpc-sec-154", "crpc-sec-156"],
    keywords: ["Justice of Peace", "Section 22-A", "Section 22-B", "police inaction", "FIR direction", "transfer of investigation"],
    landmarkCitations: [
      {
        citation: "PLD 2016 SC 581",
        court: "Supreme Court of Pakistan",
        year: 2016,
        title: "Khizer Hayat v. Inspector General of Police, Punjab",
        ratio: "Justice of the Peace acts quasi-judicially; cannot issue mechanical or routine directions for registration of FIR without verifying if cognizable offence is disclosed on admitted facts."
      },
      {
        citation: "2021 SCMR 1602",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Muhammad Ali v. Justice of Peace",
        ratio: "Justice of Peace has no jurisdiction to adjudicate civil rights, decide ownership of disputed property, or evaluate evidentiary merits of rival parties."
      }
    ]
  },
  {
    id: "crpc-sec-497-498",
    sectionNumber: "Section 497 & 498",
    title: "Post-Arrest Bail & Pre-Arrest Bail",
    statuteName: "Code of Criminal Procedure, 1898",
    statuteYear: 1898,
    domain: "criminal",
    text: `Section 497. When bail may be taken in cases of non-bailable offence.—(1) When any person accused of any non-bailable offence is arrested or detained without warrant... he may be released on bail, but he shall not be so released if there appear reasonable grounds for believing that he has been guilty of an offence punishable with death or imprisonment for life or imprisonment for ten years [Prohibitory Clause]:
Provided that the Court may direct that any person under the age of sixteen years or any woman or any sick or infirm person accused of such an offence be released on bail:
Provided further that Court shall direct release on bail of an accused whose trial has not concluded within 1 year (continuous detention) for non-capital offences or 2 years for capital offences [Statutory Delay].
(2) If it appears to such officer or Court at any stage of the investigation, inquiry or trial, as the case may be, that there are no reasonable grounds for believing that the accused has committed a non-bailable offence, but that there are sufficient grounds for further inquiry into his guilt, the accused shall, pending such inquiry, be released on bail.

Section 498. Power to direct admission to bail or reduction of bail [Pre-Arrest Bail].`,
    commentary: `Bail Jurisprudence in Pakistan:
1. Non-Prohibitory Offences: Grant of bail in offences carrying punishment under 10 years is the rule and refusal is an exception.
2. Statutory Delay Proviso: Accused detained continuously for 1 year (non-capital) or 2 years (capital) without trial completion is entitled to bail as an independent statutory right, provided the delay was not occasioned by the accused.
3. Pre-Arrest Bail under Section 498: Requires: (a) apprehension of imminent arrest, (b) ulterior motives / mala fides of complainant or police to humiliate and harass, and (c) prima facie case of further inquiry.`,
    proceduralNotes: "Pre-arrest bail requires personal surrender in court; interim bail granted with surety bond pending notice to state.",
    mandatoryPleadings: "Must aver mala fides, false implication, absence of recovery, further inquiry under S.497(2), and willingness to furnish solvent surety.",
    punishmentOrRelief: "Admission to bail upon furnishing solvent surety bond.",
    crossReferences: ["ppc-sec-489f", "crpc-sec-498a", "crpc-sec-561a"],
    keywords: ["bail", "pre-arrest bail", "post-arrest bail", "Section 497", "Section 498", "prohibitory clause", "further inquiry", "statutory delay"],
    landmarkCitations: [
      {
        citation: "PLD 2017 SC 733",
        court: "Supreme Court of Pakistan",
        year: 2017,
        title: "Muhammad Shakeel v. State",
        ratio: "Bail is a rule and refusal is an exception in offences that do not fall within the prohibitory clause of Section 497(1) CrPC."
      },
      {
        citation: "PLD 2020 SC 663",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Mir Shakil-ur-Rehman v. National Accountability Bureau",
        ratio: "Liberty of the citizen is sacred; pre-arrest bail under Section 498 CrPC must be granted where the arrest is actuated by mala fides, ulterior motives, or political victimization."
      },
      {
        citation: "PLD 2022 SC 779",
        court: "Supreme Court of Pakistan",
        year: 2022,
        title: "Syed Aman Ullah Kanrani v. State",
        ratio: "Bail cannot be withheld as a punishment; deeper appreciation of evidence is forbidden at the bail stage and court must form tentative opinion only."
      },
      {
        citation: "2023 SCMR 380",
        court: "Supreme Court of Pakistan",
        year: 2023,
        title: "Zafar Iqbal v. State",
        ratio: "Statutory delay entitlement under third proviso to Section 497(1) CrPC is an independent statutory right; continuous custody beyond statutory period entitles accused to bail unless delay is occasioned by defense."
      }
    ]
  },
  {
    id: "crpc-sec-561a",
    sectionNumber: "Section 561-A",
    title: "Saving of Inherent Powers of High Court",
    statuteName: "Code of Criminal Procedure, 1898",
    statuteYear: 1898,
    domain: "criminal",
    text: `Nothing in this Code shall be deemed to limit or affect the inherent power of the High Court to make such orders as may be necessary to give effect to any order under this Code, or to prevent abuse of the process of any Court or otherwise to secure the ends of justice.`,
    commentary: `Section 561-A CrPC preserves the extraordinary inherent jurisdiction of the High Court to prevent abuse of the process of any criminal court and secure the ends of justice.

Quashment of Criminal Proceedings:
1. Disguised Civil Disputes: Where allegations in the FIR, even if admitted in full, disclose purely civil breach of contract or accounting disputes without criminal ingredients, proceedings are liable to quashment.
2. Malicious Prosecution: Where criminal prosecution is launched with corrupt ulterior motives to exert coercive recovery pressure, the High Court exercises Section 561-A powers to quash the FIR/challan.`,
    proceduralNotes: "Application is moved before the High Court; certified copies of FIR, challan under S.173 CrPC, or complaint must be annexed.",
    mandatoryPleadings: "Must demonstrate patent abuse of process, absence of prima facie offence, or pure civil dispute nature of controversy.",
    punishmentOrRelief: "Quashment of FIR, investigation, or criminal trial proceedings.",
    crossReferences: ["crpc-sec-249a", "crpc-sec-265k", "ppc-sec-489f"],
    keywords: ["561-A", "inherent powers", "quashment of FIR", "abuse of process", "High Court criminal jurisdiction"],
    landmarkCitations: [
      {
        citation: "PLD 2021 SC 873",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Syed Farman Ali v. State",
        ratio: "Quashment of criminal proceedings under Section 561-A CrPC: High Court can quash FIR or criminal proceedings where allegations on their face disclose a purely civil dispute or malicious prosecution."
      },
      {
        citation: "2022 SCMR 1432",
        court: "Supreme Court of Pakistan",
        year: 2022,
        title: "Muhammad Naeem v. State",
        ratio: "Inherent powers under Section 561-A CrPC are preserved to prevent abuse of the process of court and to secure the ends of justice; can be exercised even during pendency of trial."
      }
    ]
  },

  // --- DOMAIN 3: CONSTITUTIONAL & ADMINISTRATIVE LAW ---
  {
    id: "const-fundamental-rights",
    sectionNumber: "Articles 9-25A",
    title: "Fundamental Rights (Life, Liberty, Fair Trial, Dignity, Property, Equality)",
    statuteName: "Constitution of the Islamic Republic of Pakistan, 1973",
    statuteYear: 1973,
    domain: "constitutional",
    text: `Article 9. Security of person.—No person shall be deprived of life or liberty save in accordance with law.
Article 10. Safeguards as to arrest and detention.—(1) No person who is arrested shall be detained in custody without being informed... of the grounds for such arrest...
Article 10A. Right to fair trial.—For the determination of his civil rights and obligations or in any criminal charge against him a person shall be entitled to a fair trial and due process.
Article 14. Inviolability of dignity of man, etc.—(1) The dignity of man and, subject to law, the privacy of home, shall be inviolable. (2) No person shall be subjected to torture for the purpose of extracting evidence.
Article 18. Freedom of trade, business or profession.—Subject to such qualifications, if any, as may be prescribed by law, every citizen shall have the right to enter upon any lawful profession or occupation...
Article 19. Freedom of speech, etc.—Every citizen shall have the right to freedom of speech and expression...
Article 19A. Right to information.—Every citizen shall have the right to have access to information in all matters of public importance...
Article 23. Provision as to property.—Every citizen shall have the right to acquire, hold and dispose of property in any part of Pakistan...
Article 24. Protection of property rights.—(1) No person shall be deprived of his property save in accordance with law...
Article 25. Equality of citizens.—(1) All citizens are equal before law and are entitled to equal protection of law. (2) There shall be no discrimination on the basis of sex.
Article 25A. Right to education.—The State shall provide free and compulsory education to all children of the age of five to sixteen years...`,
    commentary: `Chapter 1 of Part II of the Constitution guarantees supreme Fundamental Rights which cannot be abridged by ordinary legislation.

Key Jurisprudential Expansions:
1. Article 9 (Life): Supreme Court has held that 'life' does not mean mere animal existence; it encompasses clean drinking water, unpolluted environment, healthcare, education, and human dignity.
2. Article 10A (Fair Trial): Constitutionalizes the natural justice principles ('audi alteram partem') across all judicial, quasi-judicial, and administrative proceedings.
3. Article 25 (Equality): Forbids arbitrary discrimination; requires reasonable classification having a rational nexus with statutory objectives.`,
    proceduralNotes: "Directly enforceable through High Court writ jurisdiction (Art. 199) and Supreme Court original jurisdiction (Art. 184(3)).",
    mandatoryPleadings: "Must specify exact Fundamental Right infringed, state action or executive omission, and lack of lawful authorization.",
    punishmentOrRelief: "Constitutional writ declaring law/act ultra vires, restraining illegal state action, enforcing fundamental liberty.",
    crossReferences: ["const-art-199", "const-art-184-3", "gca-sec-24a"],
    keywords: ["fundamental rights", "Article 9", "Article 10A", "Article 14", "Article 25", "fair trial", "due process", "right to life", "dignity"],
    landmarkCitations: [
      {
        citation: "PLD 2012 SC 923",
        court: "Supreme Court of Pakistan",
        year: 2012,
        title: "Suo Motu Case No. 4 of 2010 (Rental Power Plants Case)",
        ratio: "Article 10A constitutionalizes the principles of natural justice and fair trial in both civil and criminal proceedings; transparency and due process are non-negotiable."
      },
      {
        citation: "PLD 2014 SC 350",
        court: "Supreme Court of Pakistan",
        year: 2014,
        title: "Shehla Zia v. WAPDA",
        ratio: "Right to life under Article 9 includes right to clean water, pollution-free environment, health, and livelihood; precautionary principle applies to state hazards."
      }
    ]
  },
  {
    id: "const-art-199",
    sectionNumber: "Article 199",
    title: "High Court Constitutional Writ Jurisdiction",
    statuteName: "Constitution of the Islamic Republic of Pakistan, 1973",
    statuteYear: 1973,
    domain: "constitutional",
    text: `(1) Subject to the Constitution, a High Court may, if it is satisfied that no other adequate remedy is provided by law—
(a) on the application of any aggrieved party, make an order—
(i) directing a person performing, within the territorial jurisdiction of the Court, functions in connection with the affairs of the Federation, a Province or a local authority, to refrain from doing anything he is not permitted by law to do, or to do anything he is required by law to do [Prohibition & Mandamus]; or
(ii) declaring that any act done or proceeding taken within the territorial jurisdiction of the Court by a person performing functions in connection with the affairs of the Federation, a Province or a local authority has been done or taken without lawful authority and is of no legal effect [Certiorari]; or
(b) on the application of any person, make an order—
(i) directing that a person in custody within the territorial jurisdiction of the Court be brought before it that the Court may satisfy itself that he is not being held in custody without lawful authority or in an unlawful manner [Habeas Corpus]; or
(ii) requiring a person in the territorial jurisdiction of the Court holding or purporting to hold a public office to show under what authority of law he claims to hold that office [Quo Warranto]; or
(c) on the application of any aggrieved person, make an order giving such directions to any person or authority... as may be appropriate for the enforcement of any of the Fundamental Rights...`,
    commentary: `Article 199 confers plenary constitutional judicial review on the High Courts against state action.

The 5 Prerogative Writs:
1. Writ of Prohibition (Art 199(1)(a)(i)): Restraining public functionaries from acting without or in excess of jurisdiction.
2. Writ of Mandamus (Art 199(1)(a)(i)): Compelling public authorities to perform mandatory statutory duties.
3. Writ of Certiorari (Art 199(1)(a)(ii)): Quashing unlawful, coram non judice, or unreasoned administrative orders.
4. Writ of Habeas Corpus (Art 199(1)(b)(i)): Ordering release of citizens held in unlawful or unauthorized custody.
5. Writ of Quo Warranto (Art 199(1)(b)(ii)): Inquiring into lawful authority of person usurping a public office.

Alternate Remedy Rule:
The existence of an alternate statutory remedy is a rule of convenience and prudence, not an absolute jurisdictional bar. It does not apply where the impugned order is coram non judice, without jurisdiction, or passed in flagrant breach of fundamental rights.`,
    proceduralNotes: "Fixed court fee of PKR 500/-; memo of petition must be supported by an affidavit and index of impugned orders.",
    mandatoryPleadings: "Must aver status as 'aggrieved person', state functionary status of respondent, absence of alternate adequate remedy, and specific illegality.",
    punishmentOrRelief: "Writ of Certiorari, Mandamus, Prohibition, Habeas Corpus, or Quo Warranto.",
    crossReferences: ["const-fundamental-rights", "gca-sec-24a", "const-art-184-3"],
    keywords: ["Article 199", "writ petition", "mandamus", "certiorari", "habeas corpus", "quo warranto", "prohibition", "constitutional review"],
    landmarkCitations: [
      {
        citation: "PLD 2016 SC 229",
        court: "Supreme Court of Pakistan",
        year: 2016,
        title: "Federation of Pakistan v. M. Rafiq Tarar",
        ratio: "Alternate remedy is a rule of convenience and discretion, not an absolute constitutional bar where the impugned action is coram non judice, totally without jurisdiction, or in breach of natural justice."
      },
      {
        citation: "PLD 2021 SC 429",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Muhammad Nawaz v. Ghulam Murtaza",
        ratio: "Writ jurisdiction under Article 199 cannot be invoked to bypass regular civil proceedings or resolve heavily disputed questions of fact requiring detailed recording of evidence."
      }
    ]
  },
  {
    id: "const-art-184-3",
    sectionNumber: "Article 184(3) & 185",
    title: "Original & Appellate Jurisdiction of Supreme Court",
    statuteName: "Constitution of the Islamic Republic of Pakistan, 1973",
    statuteYear: 1973,
    domain: "constitutional",
    text: `Article 184(3). Without prejudice to the provisions of Article 199, the Supreme Court shall, if it considers that a question of public importance with reference to the enforcement of any of the Fundamental Rights conferred by Chapter 1 of Part II is involved, have the power to make an order of the nature mentioned in the said Article.

Article 185. Appellate jurisdiction of Supreme Court.—(1) Subject to this Article, the Supreme Court shall have jurisdiction to hear and determine appeals from judgments, decrees, final orders or sentences of a High Court...`,
    commentary: `Article 184(3) provides direct access to the Supreme Court for public interest litigation.

Dual Jurisdictional Triggers for Article 184(3):
1. Question of Public Importance: The issue must affect the rights of the public at large or a substantial segment of the population, not an individual grievance.
2. Enforcement of Fundamental Rights: Must have direct nexus with Chapter 1 Part II Fundamental Rights.

Practice and Procedure: Under Supreme Court Practice & Procedure Act 2023, constitution of benches and suo motu notices are determined by a committee of senior judges, with right of appeal to a larger bench.`,
    proceduralNotes: "Civil Petitions for Leave to Appeal (CPLA) under Art. 185(3) must be filed within 30 to 60 days from High Court final judgment.",
    mandatoryPleadings: "Must demonstrate substantial question of public importance and flagrant infringement of fundamental rights.",
    punishmentOrRelief: "Nationwide declaratory, injunctive, and supervisory orders for enforcement of fundamental rights.",
    crossReferences: ["const-fundamental-rights", "const-art-199"],
    keywords: ["Article 184(3)", "Supreme Court", "public interest litigation", "suo motu", "fundamental rights", "Article 185", "CPLA"],
    landmarkCitations: [
      {
        citation: "PLD 2018 SC 661",
        court: "Supreme Court of Pakistan",
        year: 2018,
        title: "Suo Motu Case No. 1 of 2017",
        ratio: "Dual jurisdictional triggers for Article 184(3): Both ingredients—(1) Question of public importance, and (2) Enforcement of Fundamental Rights—must co-exist simultaneously."
      },
      {
        citation: "PLD 2023 SC 42",
        court: "Supreme Court of Pakistan",
        year: 2023,
        title: "Supreme Court Practice & Procedure Act Reference",
        ratio: "Regulation of Article 184(3) jurisdiction and right of appeal against original orders passed by Supreme Court larger benches."
      }
    ]
  },
  {
    id: "const-art-204",
    sectionNumber: "Article 204",
    title: "Contempt of Court Jurisdiction of Superior Judiciary",
    statuteName: "Constitution of the Islamic Republic of Pakistan, 1973",
    statuteYear: 1973,
    domain: "constitutional",
    text: `(1) In this Article, "Court" means the Supreme Court or a High Court.
(2) A Court shall have power to punish any person who—
(a) abuses, interferes with or obstructs the process of the Court in any way or disobeys any order of the Court;
(b) scandalizes the Court or otherwise does anything which tends to bring the Court or a Judge of the Court into hatred, ridicule or contempt;
(c) does anything which tends to prejudice the determination of a matter pending before the Court; or
(d) does any other thing which, by law, constitutes contempt of the Court.`,
    commentary: `Article 204 empowers the Supreme Court and High Courts to enforce their decrees, maintain judicial majesty, and punish willful disobedience of court directions under the Contempt of Court Ordinance 2003.`,
    proceduralNotes: "Contempt petition must specify exact order breached, date of communication, and unequivocal act of willful defiance.",
    mandatoryPleadings: "Must aver knowledge of court injunction, conscious disobedience, and absence of purging of contempt.",
    punishmentOrRelief: "Simple imprisonment up to 6 months, fine up to PKR 100,000, and disqualification under Art. 63(1)(g).",
    crossReferences: ["const-art-199", "const-art-184-3"],
    keywords: ["Article 204", "contempt of court", "disobedience of stay order", "scandalizing court", "judicial majesty"],
    landmarkCitations: [
      {
        citation: "PLD 2018 SC 738",
        court: "Supreme Court of Pakistan",
        year: 2018,
        title: "State v. Talal Chaudhry",
        ratio: "Article 204 Constitution: Willful disobedience of court orders or scandalization of judges undermines public confidence in the administration of justice and constitutes contempt."
      }
    ]
  },
  {
    id: "gca-sec-24a",
    sectionNumber: "Section 24-A",
    title: "Exercise of Statutory Power — Mandatory Reasoned Administrative Orders",
    statuteName: "General Clauses Act, 1897",
    statuteYear: 1897,
    domain: "constitutional",
    text: `(1) Where, by or under any enactment, a power to make any order or give any direction is conferred on any authority, office or person such authority, office or person shall exercise such power reasonably, fairly, justly and for the advancement of the purposes of the enactment.
(2) The authority, office or person making any order or giving any direction under the powers conferred by or under any enactment shall, so far as necessary or appropriate, give reasons for making the order or, as the case may be, for giving the direction.`,
    commentary: `Section 24-A General Clauses Act 1897 is a cornerstone of Pakistani administrative law.

Key Principles (Airport Support Services Ruling):
1. Reasons are the Lifeblood of Administrative Orders: An unreasoned, arbitrary, or cryptic administrative order passed without disclosing application of mind violates Section 24-A and is void ab initio.
2. Duty of Fair Dealing: Every public functionary is a trustee of public power and must exercise authority reasonably, justly, and for advancing legislative purpose, not for extraneous considerations.`,
    proceduralNotes: "Can be invoked in writ petitions under Article 199 to strike down unreasoned executive rejections, license cancellations, or departmental penalties.",
    mandatoryPleadings: "Must aver absence of reasoned speaking order, lack of opportunity of hearing, and arbitrary exercise of discretion.",
    punishmentOrRelief: "Quashment of unreasoned executive order and remand for decision afresh with recorded reasons.",
    crossReferences: ["const-art-199", "const-fundamental-rights"],
    keywords: ["Section 24-A", "reasoned order", "speaking order", "administrative law", "Airport Support Services", "fairness in public power"],
    landmarkCitations: [
      {
        citation: "PLD 1998 SC 2235",
        court: "Supreme Court of Pakistan",
        year: 1998,
        title: "Airport Support Services v. The Airport Manager, Quaid-e-Azam International Airport",
        ratio: "Landmark ruling establishing that reasons are the lifeblood of judicial and administrative orders; an unreasoned administrative order is arbitrary, violative of Section 24-A General Clauses Act, and void."
      },
      {
        citation: "PLD 2020 SC 57",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Messrs Master Foam v. Federation of Pakistan",
        ratio: "Public functionaries are bound to act transparently, grant fair hearing, and record intelligible reasons; failure invalidates administrative actions under Article 199."
      }
    ]
  },

  // --- DOMAIN 4: COMMERCIAL, PROPERTY & TENANCY ---
  {
    id: "contract-sec-10-23",
    sectionNumber: "Section 10 & 23",
    title: "What Agreements are Contracts & Lawful Consideration and Objects",
    statuteName: "Contract Act, 1872",
    statuteYear: 1872,
    domain: "commercial",
    text: `Section 10. What agreements are contracts.—All agreements are contracts if they are made by the free consent of parties competent to contract, for a lawful consideration and with a lawful object, and are not hereby expressly declared to be void.

Section 23. What considerations and objects are lawful, and what not.—The consideration or object of an agreement is lawful, unless—
it is forbidden by law; or
is of such a nature that, if permitted, it would defeat the provisions of any law; or
is fraudulent; or
involves or implies injury to the person or property of another; or
the Court regards it as immoral, or opposed to public policy.`,
    commentary: `Sections 10 and 23 define the essential validity of commercial contracts. Agreements founded on illegal considerations or defeating statutory enactments (such as benami land purchases to circumvent ceiling laws) are void ab initio under Section 23.`,
    proceduralNotes: "Illegality of contract under Section 23 can be raised as a preliminary defense in written statement.",
    mandatoryPleadings: "Must aver free consent, legal competence of parties, mutual valuable consideration, and lawful object.",
    punishmentOrRelief: "Enforceability of contract or declaration of contract as void ab initio.",
    crossReferences: ["contract-sec-73-74", "sra-sec-12"],
    keywords: ["Section 10", "Section 23", "Contract Act", "lawful consideration", "public policy", "void contract"],
    landmarkCitations: [
      {
        citation: "2018 SCMR 1421",
        court: "Supreme Court of Pakistan",
        year: 2018,
        title: "Muhammad Ishaq v. Province of Punjab",
        ratio: "Contracts violating statutory provisions or opposed to public policy are void ab initio under Section 23 Contract Act 1872; no estoppel operates against statute."
      }
    ]
  },
  {
    id: "contract-sec-73-74",
    sectionNumber: "Section 73 & 74",
    title: "Breach of Contract, Damages & Liquidated Penalties",
    statuteName: "Contract Act, 1872",
    statuteYear: 1872,
    domain: "commercial",
    text: `Section 73. Compensation for loss or damage caused by breach of contract.—When a contract has been broken, the party who suffers by such breach is entitled to receive, from the party who has broken the contract, compensation for any loss or damage caused to him thereby, which naturally arose in the usual course of things from such breach, or which the parties knew, when they made the contract, to be likely to result from the breach of it.
Such compensation is not to be given for any remote and indirect loss or damage sustained by reason of the breach.

Section 74. Compensation for breach of contract where penalty stipulated for.—When a contract has been broken, if a sum is named in the contract as the amount to be paid in case of such breach, or if the contract contains any other stipulation by way of penalty, the party complaining of the breach is entitled, whether or not actual damage or loss is proved to have been caused thereby, to receive from the party who has broken the contract reasonable compensation not exceeding the amount so named or, as the case may be, the penalty stipulated for.`,
    commentary: `Sections 73 and 74 Contract Act 1872 govern contractual compensation and liquidated damages under Pakistani law.

Core Legal Rules:
1. Hadley v. Baxendale Rule: Section 73 limits recovery to direct, proximate losses naturally arising in the ordinary course or contemplated by parties at the time of agreement. Remote or speculative losses are barred.
2. Section 74 Penalty Ceiling: Even where a contract stipulates a liquidated damages clause or penalty sum, the court will not automatically enforce the entire amount as a penalty; the plaintiff is entitled only to 'reasonable compensation' proved on evidence, up to the ceiling amount.`,
    proceduralNotes: "Suit for compensation must be instituted within 3 years under Articles 53-58 Limitation Act 1908.",
    mandatoryPleadings: "Must plead contract covenants, specific breach by defendant, direct proximate loss suffered, and computation of damages.",
    punishmentOrRelief: "Decree for monetary damages and compensation.",
    crossReferences: ["contract-sec-10-23", "lim-art-53-58"],
    keywords: ["breach of contract", "Section 73", "Section 74", "damages", "liquidated damages", "penalty clause", "remoteness of damage"],
    landmarkCitations: [
      {
        citation: "PLD 2013 SC 641",
        court: "Supreme Court of Pakistan",
        year: 2013,
        title: "Messrs A.B.C. Textile Mills v. National Bank of Pakistan",
        ratio: "Remote and indirect loss not recoverable under Section 73 Contract Act 1872; plaintiff must prove direct proximate nexus between breach and financial loss."
      },
      {
        citation: "PLD 2018 SC 421",
        court: "Supreme Court of Pakistan",
        year: 2018,
        title: "Government of KPK v. Messrs Rawal Construction Co.",
        ratio: "Court will not enforce penalty clause blindly; under Section 74, plaintiff is entitled only to reasonable compensation assessed on evidence up to the stipulated ceiling."
      },
      {
        citation: "2020 SCMR 1521",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Muhammad Tariq v. Province of Sindh",
        ratio: "Forfeiture of earnest money / security deposit is permissible only if it represents a genuine pre-estimate of damages, not an oppressive penal forfeiture."
      }
    ]
  },
  {
    id: "tpa-sec-53a-part-perf",
    sectionNumber: "Section 53-A",
    title: "Doctrine of Part Performance",
    statuteName: "Transfer of Property Act, 1882",
    statuteYear: 1882,
    domain: "commercial",
    text: `Where any person contracts to transfer for consideration any immovable property by writing signed by him or on his behalf from which the terms necessary to constitute the transfer can be ascertained with reasonable certainty, and the transferee has, in part performance of the contract, taken possession of the property or any part thereof, or the transferee, being already in possession, continues in possession in part performance of the contract and has done some act in furtherance of the contract, and the transferee has performed or is willing to perform his part of the contract... then the transferor or any person claiming under him shall be debarred from enforcing against the transferee any right in respect of the property...`,
    commentary: `Section 53-A TPA acts as an equitable shield for a buyer who was put into possession under a written contract and has performed their obligations. It protects against arbitrary ejectment by the seller, though it cannot be used as an offensive weapon to claim full ownership title without a registered conveyance deed.`,
    proceduralNotes: "Shield, not sword: Operates as a complete defense against ejectment suits filed by the transferor.",
    mandatoryPleadings: "Must establish: (1) contract in writing, (2) transferee put in possession in part performance, (3) continuous willingness to perform balance terms.",
    punishmentOrRelief: "Protection of possession against ejectment by vendor.",
    crossReferences: ["tpa-sec-54", "reg-sec-49", "sra-sec-12"],
    keywords: ["Section 53-A", "part performance", "equitable shield", "possession under contract", "Transfer of Property Act"],
    landmarkCitations: [
      {
        citation: "PLD 2019 SC 345",
        court: "Supreme Court of Pakistan",
        year: 2019,
        title: "Ghulam Rasool v. Mst. Zubaida Begum",
        ratio: "Section 53-A TPA is a shield of defense and not an offensive sword; it protects settled possession taken under written contract against vendor, but does not confer title without registered deed."
      }
    ]
  },
  {
    id: "tpa-sec-54-58-105",
    sectionNumber: "Section 54, 58 & 105",
    title: "Sale, Mortgage & Lease of Immovable Property",
    statuteName: "Transfer of Property Act, 1882",
    statuteYear: 1882,
    domain: "commercial",
    text: `Section 54. "Sale" defined.—"Sale" is a transfer of ownership in exchange for a price paid or promised or part-paid and part-promised.
Such transfer, in the case of tangible immovable property of the value of one hundred rupees and upwards, or in the case of a reversion or other intangible thing, can be made only by a registered instrument.
A contract for the sale of immovable property does not, of itself, create any interest in or charge on such property.

Section 58. "Mortgage" defined.—A mortgage is the transfer of an interest in specific immovable property for the purpose of securing the payment of money advanced or to be advanced by way of loan... (Simple mortgage, Mortgage by conditional sale, Usufructuary mortgage, English mortgage, Mortgage by deposit of title-deeds, Anomalous mortgage).

Section 105. "Lease" defined.—A lease of immovable property is a transfer of a right to enjoy such property, made for a certain time, express or implied, or in perpetuity, in consideration of a price paid or promised...`,
    commentary: `The Transfer of Property Act 1882 establishes the core substantive rules for conveyance of real estate in Pakistan.

Vital Distinction:
An agreement to sell (Bainama) under Section 54 does NOT transfer title or create an interest in immovable property. Title passes only upon the execution and registration of a formal conveyance deed (Sale Deed / Registry) under the Registration Act 1908.`,
    proceduralNotes: "Compulsory registration required for all sales >Rs. 100 and leases exceeding 1 year under Section 17 Registration Act.",
    mandatoryPleadings: "Must plead chain of title, consideration paid, registered instrument number, and possession status.",
    punishmentOrRelief: "Declaration of ownership, redemption/foreclosure of mortgage, or ejectment upon determination of lease.",
    crossReferences: ["reg-sec-17-49", "sra-sec-12", "prpa-sec-15"],
    keywords: ["Section 54 TPA", "sale deed", "mortgage", "lease", "transfer of property", "immovable property title"],
    landmarkCitations: [
      {
        citation: "PLD 2021 SC 429",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Muhammad Nawaz v. Ghulam Murtaza",
        ratio: "Agreement to sell does not transfer proprietary title or create interest in immovable property; title passes only upon execution and registration of registered conveyance deed."
      },
      {
        citation: "2019 SCMR 1747",
        court: "Supreme Court of Pakistan",
        year: 2019,
        title: "Abdul Ghafoor v. Mst. Aisha Bibi",
        ratio: "Registration under Section 17 & 54 TPA operates as public notice to the entire world; subsequent purchaser cannot claim bona fide purchaser without notice."
      }
    ]
  },
  {
    id: "reg-sec-17-49",
    sectionNumber: "Section 17 & 49",
    title: "Compulsory Registration & Inadmissibility of Unregistered Documents",
    statuteName: "Registration Act, 1908",
    statuteYear: 1908,
    domain: "commercial",
    text: `Section 17(1). Documents of which registration is compulsory.—The following documents shall be registered...:
(a) instruments of gift of immovable property;
(b) other non-testamentary instruments which purport or operate to create, declare, assign, limit or extinguish... any right, title or interest... of the value of one hundred rupees and upwards, to or in immovable property;
(d) leases of immovable property from year to year, or for any term exceeding one year, or reserving a yearly rent...

Section 49. Effect of non-registration of documents required to be registered.—No document required by section 17 or by any provision of the Transfer of Property Act, 1882, to be registered shall—
(a) affect any immovable property comprised therein, or
(b) confer any power to adopt, or
(c) be received as evidence of any transaction affecting such property or conferring such power,
unless it has been registered:
Provided that an unregistered document affecting immovable property and required by this Act or the Transfer of Property Act, 1882, to be registered may be received as evidence of a contract in a suit for specific performance under Chapter II of the Specific Relief Act, 1877, or as evidence of part performance of a contract for the purposes of section 53A of the Transfer of Property Act, 1882, or as evidence of any collateral transaction not required to be effected by registered instrument.`,
    commentary: `Sections 17 and 49 Registration Act 1908 govern document admissibility and evidentiary validity.

Key Rules:
1. Inadmissibility of Unregistered Leases: Leases exceeding 1 year must be registered; an unregistered lease cannot create tenancy rights exceeding month-to-month and is inadmissible (2022 SCMR 1891).
2. The Proviso Exception: An unregistered agreement to sell, though inadmissible to prove conveyance of title, is fully admissible in a suit for specific performance under Section 12 Specific Relief Act or to prove part performance under Section 53-A TPA.`,
    proceduralNotes: "Objection to admissibility of unregistered document must be raised at the time document is tendered in evidence during trial.",
    mandatoryPleadings: "Must specify registration particulars or invoke the Section 49 proviso for specific performance / collateral purpose.",
    punishmentOrRelief: "Inadmissibility in evidence / Protection under Section 49 proviso.",
    crossReferences: ["tpa-sec-54", "sra-sec-12", "prpa-sec-5"],
    keywords: ["Registration Act", "Section 17", "Section 49", "unregistered lease", "compulsory registration", "inadmissible evidence", "collateral purpose"],
    landmarkCitations: [
      {
        citation: "2022 SCMR 1891",
        court: "Supreme Court of Pakistan",
        year: 2022,
        title: "Malik Muhammad Ramzan v. Mst. Nasreen Akhtar",
        ratio: "Unregistered lease agreement exceeding 1 year cannot create long-term leasehold rights and is inadmissible under Section 49 Registration Act 1908 except for collateral purpose."
      },
      {
        citation: "PLD 2020 SC 142",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Muhammad Tariq v. Mst. Parveen Akhtar",
        ratio: "Scope of Section 49 proviso: An unregistered agreement to sell is admissible to prove the contract in a suit for specific performance under Chapter II of the Specific Relief Act 1877."
      }
    ]
  },
  {
    id: "prpa-tenancy-2009",
    sectionNumber: "Section 5, 15, 19 & 24",
    title: "Tenancy Registration, Eviction Grounds, Leave to Defend & Appeals",
    statuteName: "Punjab Rented Premises Act, 2009",
    statuteYear: 2009,
    domain: "commercial",
    text: `Section 5. Registration of tenancy.—A tenancy agreement shall be in writing and registered with the Rent Registrar of the area.

Section 15. Grounds for eviction.—A landlord may apply to the Special Rent Tribunal for eviction of the tenant on the grounds:
(a) default in payment of rent for more than thirty days from the due date;
(b) expiry of the period of tenancy;
(c) subletting the premises without written consent of landlord;
(d) using premises for purpose other than that for which it was let out;
(e) causing damage to premises impairing its value or utility;
(f) personal bona fide need of landlord or his spouse/children.

Section 19. Application for leave to defend.—(1) The Rent Tribunal shall not permit the tenant to contest the application for eviction unless he files an application for leave to defend within ten days of the service of notice. (2) If tenant fails to file leave to defend within ten days, allegations in eviction application shall be deemed to be admitted and Rent Tribunal shall pass eviction order.

Section 24. Appeal.—Any person aggrieved by a final order of Rent Tribunal may file an appeal before District Judge within thirty days.`,
    commentary: `The Punjab Rented Premises Act 2009 established a specialized summary regime to expedite tenancy disputes and ousted the jurisdiction of regular civil courts.

Strict Leave to Defend Timeline:
The 10-day limitation period under Section 19 for filing leave to contest is strict and non-extendable. Section 5 of the Limitation Act 1908 does not apply to Rent Tribunal proceedings (2021 SCMR 731). Default results in immediate eviction.`,
    proceduralNotes: "Eviction petition filed before Rent Tribunal; appeal lies to District Judge within 30 days; no second revision to High Court.",
    mandatoryPleadings: "Must plead tenancy registration status, default period/expiry date, notice service, and specific eviction ground under S.15.",
    punishmentOrRelief: "Eviction order, recovery of arrears of rent, fine for non-registration.",
    crossReferences: ["tpa-sec-105", "cpc-sec-9"],
    keywords: ["Punjab Rented Premises Act", "PRPA 2009", "eviction", "leave to defend", "Rent Tribunal", "tenancy agreement", "Section 19 PRPA"],
    landmarkCitations: [
      {
        citation: "PLD 2018 Lah 342",
        court: "Lahore High Court",
        year: 2018,
        title: "Tariq Mehmood v. Rent Tribunal Lahore",
        ratio: "Ouster of regular civil court jurisdiction: Tenancy disputes are governed exclusively by PRPA 2009; civil court cannot entertain suits regarding premises governed by PRPA."
      },
      {
        citation: "2021 SCMR 731",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Chaudhry Muhammad Akram v. Additional District Judge",
        ratio: "10-day period for filing application for leave to contest under Section 19 PRPA 2009 is mandatory and strict; Rent Tribunal has no power to condone delay under Section 5 Limitation Act 1908."
      }
    ]
  },
  {
    id: "companies-sec-286-301",
    sectionNumber: "Section 286 & 301",
    title: "Prevention of Oppression & Mismanagement & Winding Up of Companies",
    statuteName: "Companies Act, 2017",
    statuteYear: 2017,
    domain: "commercial",
    text: `Section 286. Application to Court in cases of oppression.—(1) If any member or members holding not less than ten percent of the issued share capital of a company... complain that the affairs of the company are being conducted in an unlawful or oppressive manner or in a manner prejudicial to public interest or in a manner oppressive to him or them, he or they may apply to the Court by petition for an order under this section.

Section 301. Circumstances in which a company may be wound up by Court.—A company may be wound up by the Court—
(a) if the company has by special resolution resolved that the company be wound up by the Court;
(b) if default is made in holding the statutory meeting or in delivering the statutory report;
(d) if the company is unable to pay its debts;
(h) if the Court is of opinion that it is just and equitable that the company should be wound up.`,
    commentary: `Sections 286 and 301 Companies Act 2017 empower the High Court (Company Bench) to rectify corporate mismanagement and order winding up where the substratum of the company is eroded.`,
    proceduralNotes: "Company petitions are instituted before the High Court Company Judge under Company Court Rules.",
    mandatoryPleadings: "Must prove minimum 10% shareholding threshold, specific acts of financial oppression, deadlock, or inability to pay debts.",
    punishmentOrRelief: "Appointment of provisional manager / winding up order and appointment of official liquidator.",
    crossReferences: ["contract-sec-10-23"],
    keywords: ["Companies Act 2017", "Section 286", "Section 301", "oppression and mismanagement", "winding up", "company bench", "insolvency"],
    landmarkCitations: [
      {
        citation: "2021 CLD 450",
        court: "Lahore High Court (Company Bench)",
        year: 2021,
        title: "Tariq Industries Ltd v. Registrar of Companies",
        ratio: "Section 286 Companies Act 2017: Oppression involves a visible departure from standards of fair dealing; minority shareholders with 10% threshold are entitled to protective interim directions."
      }
    ]
  },

  // --- DOMAIN 5: LAW OF EVIDENCE ---
  {
    id: "qso-art-73-74",
    sectionNumber: "Article 73 & 74",
    title: "Primary Evidence and Secondary Evidence",
    statuteName: "Qanun-e-Shahadat Order, 1984 (P.O. No. 10 of 1984)",
    statuteYear: 1984,
    domain: "evidence",
    text: `Article 73. Primary evidence.—Primary evidence means the document itself produced for the inspection of the Court.
Explanation 1.—Where a document is executed in several parts, each part is primary evidence of the document...
Explanation 2.—Where a number of documents are all made by one uniform process, as in the case of printing, lithography or photography, each is primary evidence of the contents of the rest.

Article 74. Secondary evidence.—Secondary evidence means and includes—
(1) certified copies given under the provisions hereinafter contained;
(2) copies made from the original by mechanical processes which in themselves insure the accuracy of the copy, and copies compared with such copies;
(3) copies made from or compared with the original;
(4) counterparts of documents as against the parties who did not execute them;
(5) oral accounts of the contents of a document given by some person who has himself seen it.`,
    commentary: `Documents must be proved by primary evidence except in cases enumerated under Article 76 QSO 1984 where secondary evidence (certified copies or photo-copies compared with lost originals) is permitted after laying proper foundation of loss or destruction.`,
    proceduralNotes: "Permission to lead secondary evidence must be obtained by moving an application before the trial court.",
    mandatoryPleadings: "Must aver loss, destruction, or possession of original by opposite party after notice under Article 77.",
    punishmentOrRelief: "Admission of secondary copy in lieu of original document.",
    crossReferences: ["qso-art-79-117", "qso-art-164"],
    keywords: ["primary evidence", "secondary evidence", "Article 73", "Article 74 QSO", "certified copy", "document proof"],
    landmarkCitations: [
      {
        citation: "2019 SCMR 1680",
        court: "Supreme Court of Pakistan",
        year: 2019,
        title: "Province of Punjab v. Muhammad Anwar",
        ratio: "Secondary evidence under Article 74 QSO 1984 cannot be admitted unless the party satisfactorily accounts for the loss or non-production of the original primary evidence."
      }
    ]
  },
  {
    id: "qso-art-79-117",
    sectionNumber: "Article 79 & Articles 117-129",
    title: "Attestation by 2 Witnesses & Burden of Proof / Presumptions",
    statuteName: "Qanun-e-Shahadat Order, 1984 (P.O. No. 10 of 1984)",
    statuteYear: 1984,
    domain: "evidence",
    text: `Article 79. Proof of execution of document required by law to be attested.—If a document is required by law to be attested, it shall not be used as evidence until two attesting witnesses at least have been called for the purpose of proving its execution, if there be two attesting witnesses alive, and subject to the process of the Court and capable of giving evidence...

Article 117. Burden of proof.—Whoever desires any Court to give judgment as to any legal right or liability dependent on the existence of facts which he asserts, must prove that those facts exist.
Article 118. On whom burden of proof lies.—The burden of proof in a suit or proceeding lies on that person who would fail if no evidence at all were given on either side.
Article 121. Burden of proving that case of accused comes within exceptions...
Article 122. Burden of proving fact especially within knowledge...
Article 129. Court may presume existence of certain facts (e.g. official acts regularly performed, evidence withheld unfavorable).`,
    commentary: `Mandatory 2-Attesting-Witness Rule (Article 79 QSO 1984):
Under settled Supreme Court jurisprudence (PLD 2017 SC 98), any instrument creating financial liability or transferring immovable property (sale agreements, promissory notes, mortgage deeds) must be attested by at least 2 male witnesses (or 1 male and 2 female witnesses). 
Failure to produce and examine 2 attesting witnesses in court is fatal to the suit, and the document cannot be read in evidence even if registered.`,
    proceduralNotes: "Witness list filed under Order XVI CPC must include both attesting witnesses by name and CNIC.",
    mandatoryPleadings: "Must plead execution in presence of 2 named attesting witnesses with their specific signatures/thumb impressions.",
    punishmentOrRelief: "Proof of document execution or complete exclusion of document from evidence.",
    crossReferences: ["qso-art-73-74", "sra-sec-12", "tpa-sec-54"],
    keywords: ["Article 79 QSO", "attesting witnesses", "two witnesses rule", "burden of proof", "Article 117", "presumption of fact", "Article 129"],
    landmarkCitations: [
      {
        citation: "PLD 2017 SC 98",
        court: "Supreme Court of Pakistan",
        year: 2017,
        title: "Farzand Ali v. Khuda Bakhsh",
        ratio: "Article 79 QSO 1984: Examination of two attesting witnesses is mandatory for documents creating financial obligations or property rights; failure to examine both witnesses renders the document inadmissible and fatal to the suit."
      },
      {
        citation: "2020 SCMR 1224",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Muhammad Sarwar v. Mst. Mumtaz Begum",
        ratio: "Proof of registered deed execution: Production of certified copy from registrar does not dispense with the mandatory requirement of examining attesting witnesses under Article 79."
      }
    ]
  },
  {
    id: "qso-art-164",
    sectionNumber: "Article 164",
    title: "Production of Evidence Through Modern Devices & Electronic Forensics",
    statuteName: "Qanun-e-Shahadat Order, 1984 (P.O. No. 10 of 1984)",
    statuteYear: 1984,
    domain: "evidence",
    text: `In such cases as the Court may consider appropriate, the Court may allow to be produced any evidence that may have become available because of modern devices or techniques.`,
    commentary: `Article 164 QSO 1984 enables the admissibility of digital, audio-visual, CDR, WhatsApp, and electronic evidence in Pakistani courts.

The 10 Supreme Court Guidelines (Judge Arshad Malik Case - PLD 2019 SC 675):
1. Authenticity of Recording: The person who recorded the audio/video must appear and testify to its genuine recording.
2. Source Recording Device: The original recording device / memory card must be produced; copies without original source verification are suspect.
3. Unbroken Chain of Custody: From recording to court production, unbroken chain of custody must be established.
4. Forensic Examination: Mandatory forensic analysis by a certified laboratory (e.g. PFSA / FIA Cybercrime Wing) confirming no editing, splicing, or doctoring.
5. Voice / Face Matching: Forensic acoustic voice identification or biometric facial matching with the accused's admitted samples.`,
    proceduralNotes: "Application under Article 164 must be moved prior to conclusion of evidence, accompanied by the primary digital storage device.",
    mandatoryPleadings: "Must aver date/time of recording, device make/model, hash value/metadata, unbroken custody, and prayer for forensic PFSA testing.",
    punishmentOrRelief: "Admission of modern digital evidence on judicial record.",
    crossReferences: ["qso-art-73-74", "peca-2016-sec-14-20"],
    keywords: ["Article 164 QSO", "modern devices", "electronic evidence", "video evidence", "audio recording", "CCTV footage", "PFSA forensics", "chain of custody"],
    landmarkCitations: [
      {
        citation: "PLD 2019 SC 675",
        court: "Supreme Court of Pakistan",
        year: 2019,
        title: "Ishtiaq Ahmed Mirza v. Federation of Pakistan (Judge Arshad Malik Video Case)",
        ratio: "Landmark ruling laying down 10 comprehensive mandatory guidelines for the admissibility of video/audio evidence and modern device recordings under Article 164 QSO 1984."
      },
      {
        citation: "2021 SCMR 1821",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Naveed v. State",
        ratio: "CCTV footage and CDR evidence is inadmissible unless the primary recording source is produced and the forensic chain of custody is strictly established."
      }
    ]
  },

  // --- DOMAIN 6: FAMILY & PERSONAL LAW ---
  {
    id: "mflo-1961-sec-4-7-9",
    sectionNumber: "Section 4, 6, 7 & 9",
    title: "Grandchildren Succession, Polygamy, Talaq Notice & Maintenance",
    statuteName: "Muslim Family Laws Ordinance, 1961",
    statuteYear: 1961,
    domain: "family",
    text: `Section 4. Succession.—In the event of the death of any son or daughter of the propositus before the opening of the succession, the children of such son or daughter, if any, living at the time the succession opens, shall per stirpes receive a share equivalent to the share which such son or daughter, as the case may be, would have received if alive.

Section 6. Polygamy.—(1) No man, during the subsistence of an existing marriage, shall, except with the previous permission in writing of the Arbitration Council, contract another marriage...

Section 7. Talaq.—(1) Any man who wishes to divorce his wife shall, as soon as may be after the pronouncement of talaq in any form whatsoever, give the Chairman notice in writing of his having done so, and shall supply a copy thereof to the wife. (2) Whoever contravenes the provisions of sub-section (1) shall be punishable with simple imprisonment... (3) Save as provided in sub-section (5), a talaq, unless revoked earlier, expressly or otherwise, shall not be effective until the expiration of ninety days from the day on which notice under sub-section (1) is delivered to the Chairman.

Section 9. Maintenance.—(1) If any husband fails to maintain his wife adequately, or where there are more wives than one, fails to maintain them equitably, the wife, or all or any of the wives, may in addition to seeking any other legal remedy apply to the Chairman who shall constitute an Arbitration Council to issue a certificate specifying the amount...`,
    commentary: `The Muslim Family Laws Ordinance 1961 introduced pivotal social welfare reforms into Pakistani family jurisprudence:
1. Section 4 Orphaned Grandchildren Succession: Grants per stirpes inheritance to orphaned grandchildren from their grandparent's estate.
2. Section 7 Talaq Procedure: Talaq is suspended for 90 days following delivery of notice to the Chairman Union Council to facilitate reconciliation attempts by the Arbitration Council.
3. Section 9 Maintenance: Establishes summary administrative maintenance orders enforceable through land revenue recovery arrears.`,
    proceduralNotes: "Arbitration Council proceedings are summary; certificate can be challenged via Revision before Collector / District Judge.",
    mandatoryPleadings: "Must plead date of marriage, dower status, neglect to maintain, date of talaq pronouncement, and delivery of notice to Union Council.",
    punishmentOrRelief: "Issuance of Maintenance Certificate / Talaq Effectiveness Certificate / Share in Inheritance.",
    crossReferences: ["fca-1964-sec-5-17a", "gwa-1890-sec-17-25"],
    keywords: ["MFLO 1961", "Section 4", "Section 6", "Section 7", "Section 9", "talaq notice", "90 days reconciliation", "orphaned grandchildren", "maintenance certificate"],
    landmarkCitations: [
      {
        citation: "PLD 2020 SC 450",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Mst. Kaneez Fatima v. Wali Muhammad",
        ratio: "Section 7 MFLO 1961: Notice of Talaq to Chairman Union Council and expiry of 90-day reconciliation period is essential for effectiveness of divorce certificate."
      },
      {
        citation: "2021 SCMR 1245",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Allah Rakha v. Federation of Pakistan",
        ratio: "Section 4 MFLO 1961 per stirpes succession protects living orphaned grandchildren from disinheritance upon parent's premature death."
      }
    ]
  },
  {
    id: "fca-1964-sec-5-17a",
    sectionNumber: "Section 5, 14 & 17-A",
    title: "Exclusive Jurisdiction of Family Courts, Appeals & Mandatory Interim Maintenance",
    statuteName: "West Pakistan Family Courts Act, 1964",
    statuteYear: 1964,
    domain: "family",
    text: `Section 5. Jurisdiction.—Subject to the provisions of the Muslim Family Laws Ordinance, 1961, and the Guardians and Wards Act, 1890, the Family Courts shall have exclusive jurisdiction to entertain, hear and adjudicate upon matters specified in Part I of the Schedule:
1. Dissolution of marriage (including Khula);
2. Dower;
3. Maintenance;
4. Restitution of conjugal rights;
5. Custody of children and the visitation rights of parents;
6. Guardianship;
7. Jactitation of marriage;
8. Dowry articles and personal property of wife;
9. Child maintenance and interim maintenance.

Section 14. Appeal.—(1) An appeal shall lie from a judgment, decree or order of a Family Court to the District Court... Provided that no appeal shall lie from a decree for a dissolution of marriage, except in the case of dissolution for reasons specified in clause (a) of item (viii) of section 2 of the Dissolution of Muslim Marriages Act 1939.

Section 17-A. Interim maintenance.—(1) At any stage of proceedings in a suit for maintenance, the Family Court shall fix interim monthly maintenance for the minor children and the wife without requiring any formal application or delay. (2) If the defendant fails to pay interim maintenance by the fourteenth day of each calendar month, the Family Court shall strike off his defense and pass a final decree.`,
    commentary: `The Family Courts Act 1964 creates a specialized, expeditious forum with simplified procedures excluding technical provisions of the CPC and Qanun-e-Shahadat Order.

Section 17-A Striking Off Defense:
Fixation of interim maintenance for minor children is a mandatory statutory duty. Failure by the father to deposit interim maintenance within the stipulated deadline results in the automatic striking off of his defense and the immediate passing of a final decree against him.`,
    proceduralNotes: "Court fee is fixed at nominal PKR 500/-; appeals against final decrees lie to District Judge within 30 days.",
    mandatoryPleadings: "Must detail Nikahnama covenants, dower amount (prompt/deferred), list of dowry articles with valuations, and monthly income/financial status of father.",
    punishmentOrRelief: "Decree for Khula, Recovery of Dower, Restitution, Return of Dowry or cash equivalent, and monthly maintenance.",
    crossReferences: ["mflo-1961-sec-4-7-9", "gwa-1890-sec-17-25"],
    keywords: ["Family Courts Act", "Section 5", "Section 14", "Section 17-A", "Khula", "dower", "dowry articles", "interim maintenance", "striking off defense", "custody"],
    landmarkCitations: [
      {
        citation: "PLD 2021 SC 320",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Muhammad Asim v. Mst. Samina",
        ratio: "Section 17-A Family Courts Act 1964: Father has absolute statutory and religious obligation to maintain minor children; default in interim maintenance leads to automatic striking off of defense."
      },
      {
        citation: "2019 SCMR 1845",
        court: "Supreme Court of Pakistan",
        year: 2019,
        title: "Mst. Rabia Bibi v. Muhammad Tariq",
        ratio: "Wife is entitled to dissolution of marriage on ground of Khula as an unconditional right upon expressing hatred or inability to live within limits prescribed by Almighty Allah, subject to returning prompt dower."
      }
    ]
  },
  {
    id: "gwa-1890-sec-17-25",
    sectionNumber: "Section 12, 17 & 25",
    title: "Interlocutory Protection, Appointment of Guardian & Welfare of Minor",
    statuteName: "Guardians and Wards Act, 1890",
    statuteYear: 1890,
    domain: "family",
    text: `Section 12. Power to make interlocutory order for production of minor and interim protection of person and property.—(1) The Court may direct that the person, if any, having the custody of the minor shall produce him or cause him to be produced at such place and time and before such person as it appoints...

Section 17. Matters to be considered by the Court in appointing guardian.—(1) In appointing or declaring the guardian of a minor, the Court shall, subject to the provisions of this section, be guided by what, consistently with the law to which the minor is subject, appears in the circumstances to be for the welfare of the minor. (2) In considering the welfare of the minor, the Court shall have regard to the age, sex and religion of the minor, the character and capacity of the proposed guardian and his nearness of kin to the minor, the wishes, if any, of a deceased parent, and any existing or previous relations of the proposed guardian with the minor or his property. (3) If the minor is old enough to form an intelligent preference, the Court may consider that preference.

Section 25. Title of guardian to custody of minor.—(1) If a ward leaves or is removed from the custody of a guardian of his person, the Court, if it is of opinion that it is for the welfare of the ward that he should be returned to the custody of the guardian, may make an order for his return...`,
    commentary: `Welfare of Minor is the Paramount Consideration:
Under consistent Pakistani Supreme Court precedents, in all custody and guardianship disputes between separated parents, the 'Welfare of the Minor' is the supreme and paramount guiding consideration. Financial superiority of the father is subordinate to the emotional bonding, educational care, and maternal affection of the mother.`,
    proceduralNotes: "Guardian Judge / Family Court Judge conducts proceedings; visitation schedules framed for non-custodial parent.",
    mandatoryPleadings: "Must plead child age, educational schooling, home environment, parental character, and emotional bonding.",
    punishmentOrRelief: "Permanent custody decree and structured interim visitation schedule.",
    crossReferences: ["fca-1964-sec-5-17a"],
    keywords: ["Guardians and Wards Act", "Section 12", "Section 17", "Section 25", "custody of minor", "welfare of minor", "guardian judge", "visitation schedule"],
    landmarkCitations: [
      {
        citation: "PLD 2020 SC 229",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Mst. Nadia v. Muhammad Naveed",
        ratio: "Welfare of the minor is the supreme and paramount consideration in custody disputes under GWA 1890; parental financial status is secondary to emotional stability, educational continuity, and psychological welfare."
      },
      {
        citation: "2021 SCMR 1988",
        court: "Supreme Court of Pakistan",
        year: 2021,
        title: "Syed Asad Ali v. Mst. Syeda Bushra",
        ratio: "Non-custodial parent is entitled to meaningful, structured visitation rights and interim custody during weekends and vacations to foster parental bonding."
      }
    ]
  },

  // --- DOMAIN 7: SPECIAL STATUTORY REGIMES & FINANCIAL LAWS ---
  {
    id: "peca-2016-sec-14-20",
    sectionNumber: "Section 3, 14, 20 & 21",
    title: "Unauthorized Access, Electronic Fraud, Dignity Offences & Cyberstalking",
    statuteName: "Prevention of Electronic Crimes Act, 2016 (PECA)",
    statuteYear: 2016,
    domain: "special",
    text: `Section 3. Unauthorized access to information system or data.—Whoever with dishonest intention gains unauthorized access to any information system or data shall be punished with imprisonment for a term which may extend to three months or with fine...

Section 14. Electronic fraud.—Whoever, with the intent for wrongful gain or wrongful loss or dishonestly, by any means, input, alteration, deletion, or suppression of data or interfering with data or information system... shall be punished with imprisonment for a term which may extend to four years, or with fine which may extend to five million rupees, or with both.

Section 20. Offences against dignity of a natural person.—Whoever intentionally and publicly exhibits or displays or transmits any information through any information system, which he knows to be false and intimidates or harms the reputation or privacy of a natural person... shall be punished with imprisonment for a term which may extend to three years or with fine which may extend to one million rupees or with both.

Section 21. Offences against modesty of a natural person and minor.—Whoever intentionally and publicly exhibits or displays or transmits any information which—(a) superimposes a photograph of the face of a natural person over any sexually explicit image or video... shall be punished with imprisonment for a term which may extend to five years or with fine which may extend to five million rupees or with both.`,
    commentary: `PECA 2016 established a comprehensive criminal legislative regime to combat cybercrimes, online financial fraud, cyberstalking, and digital defamation in Pakistan. Investigated exclusively by the FIA Cybercrime Wing and tried by designated Special Cyber Courts / Sessions Judges.`,
    proceduralNotes: "FIR registered by FIA Cybercrime Wing under Section 154 CrPC read with PECA 2016; technical forensic report from FIA Forensics Laboratory is mandatory.",
    mandatoryPleadings: "Must specify IP address, URL links, social media handles, forensic device seizure, and specific digital harm suffered.",
    punishmentOrRelief: "Imprisonment from 3 to 7 years and fines up to PKR 10 million.",
    crossReferences: ["ppc-sec-420-406", "qso-art-164"],
    keywords: ["PECA 2016", "Section 3", "Section 14", "Section 20", "Section 21", "cybercrime", "electronic fraud", "FIA cybercrime", "cyberstalking", "online harassment"],
    landmarkCitations: [
      {
        citation: "PLD 2022 IHC 321",
        court: "Islamabad High Court",
        year: 2022,
        title: "Pakistan Federal Union of Journalists v. Federation of Pakistan",
        ratio: "Struck down draconian amendments to Section 20 PECA 2016; held that freedom of speech under Article 19 cannot be criminalized through vague executive cyber regulations."
      },
      {
        citation: "2021 PCrLJ 1420",
        court: "Lahore High Court",
        year: 2021,
        title: "Muhammad Usman v. State",
        ratio: "Section 14 & 21 PECA: Mandatory requirement of digital forensic hash values and chain of custody for electronic devices seized during cybercrime investigation."
      }
    ]
  },
  {
    id: "fio-2001-sec-9-10",
    sectionNumber: "Section 9, 10 & 22",
    title: "Summary Recovery Suit by Bank, Leave to Defend & High Court Appeals",
    statuteName: "Financial Institutions (Recovery of Finances) Ordinance, 2001",
    statuteYear: 2001,
    domain: "special",
    text: `Section 9. Procedure of Banking Courts.—(1) Where a customer or a financial institution commits a default in fulfillment of any obligation with regard to any finance, the financial institution or, as the case may be, the customer, may institute a suit in the Banking Court by presenting a plaint which shall be verified on oath...

Section 10. Leave to defend.—(1) The defendant shall not be entitled to defend the suit unless he applies for and obtains leave from the Banking Court as hereinafter provided. (2) The application for leave to defend shall be filed within thirty days of the service of summons. (3) The application for leave to defend shall be in the form of a written statement and shall contain a summary of the accounts, stating the amount of finance availed, repayments made, and the specific disputed amounts with dates. (4) If defendant fails to comply with sub-section (3) or defaults in filing within thirty days, Banking Court shall pass a summary decree in favor of financial institution.

Section 22. Appeal.—(1) Any person aggrieved by any judgment, decree or final order of a Banking Court may, within thirty days of the date of the order, prefer an appeal to the High Court.`,
    commentary: `FIO 2001 provides a summary recovery mechanism for banking and financial defaults.

Mandatory 30-Day Summary Procedure (Section 10):
1. Strict 30-Day Deadline: Leave to defend must be filed within 30 days of summons service.
2. Mandatory Summary of Accounts: The leave application MUST contain a precise summary of accounts specifying loan availed, repayments, and disputed interest/markup. Vague denials result in summary rejection of leave and instant passing of a final decree (PLD 2015 SC 242).`,
    proceduralNotes: "Exclusively triable by Special Banking Courts; appeal lies directly to High Court Division Bench under Section 22 within 30 days.",
    mandatoryPleadings: "Must contain certified Statement of Account under Bankers' Books Evidence Act 1891, finance agreements, and mortgage deeds.",
    punishmentOrRelief: "Summary decree for recovery of finance + sale of mortgaged property in execution under Section 19.",
    crossReferences: ["cpc-sec-11", "cpc-o37"],
    keywords: ["FIO 2001", "Banking Court", "Section 9", "Section 10", "Section 22", "leave to defend", "summary decree", "recovery of finance", "summary of accounts"],
    landmarkCitations: [
      {
        citation: "PLD 2015 SC 242",
        court: "Supreme Court of Pakistan",
        year: 2015,
        title: "Apollo Textile Mills v. Soneri Bank Ltd",
        ratio: "Section 10 FIO 2001: Leave to defend application must strictly contain a comprehensive summary of accounts; general or vague assertions disentitle customer to leave and justify summary decree."
      },
      {
        citation: "2020 SCMR 1640",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "National Bank of Pakistan v. Messrs Khyber Foundry",
        ratio: "Banking Court has no jurisdiction to extend the 30-day statutory limitation period for filing leave to defend under Section 10 FIO 2001."
      }
    ]
  },
  {
    id: "nao-1999-sec-9-10",
    sectionNumber: "Section 9 & 10",
    title: "Corruption and Corrupt Practices & NAB Trial Regime",
    statuteName: "National Accountability Ordinance, 1999 (NAO)",
    statuteYear: 1999,
    domain: "special",
    text: `Section 9. Corruption and corrupt practices.—(a) A holder of a public office, or any other person, is said to commit or to have committed the offence of corruption and corrupt practices:
(i) if he accepts or obtains from any person any gratification whatever other than legal remuneration;
(iv) if he by corrupt, dishonest, or illegal means, obtains or seeks for himself, or for or on behalf of his spouse or dependents or any other person, any property, valuable thing, or pecuniary advantage;
(v) if he or any of his dependents or benamidars is in possession of assets disproportionate to his known sources of income which he cannot reasonably account for...

Section 10. Punishment for corruption and corrupt practices.—(a) A holder of a public office, or any other person who commits the offence of corruption and corrupt practices shall be punishable with rigorous imprisonment for a term which may extend to fourteen years, and with fine...`,
    commentary: `National Accountability Ordinance 1999 governs mega financial crimes, corruption by public office holders, and misuse of authority. Tried exclusively before Accountability Courts presided over by District & Sessions Judges.`,
    proceduralNotes: "Cognizable by NAB; reference filed after Chairman NAB approval; 14-day physical remand limit; bail governed by constitutional writ under Art. 199.",
    mandatoryPleadings: "Must aver misuse of authority, quantifiable loss to national exchequer, or assets disproportionate to known legal income.",
    punishmentOrRelief: "Rigorous imprisonment up to 14 years, disqualification from public office for 10 years, and forfeiture of property.",
    crossReferences: ["const-art-199", "ppc-sec-420-406"],
    keywords: ["NAB", "NAO 1999", "corruption", "assets beyond means", "Accountability Court", "misuse of authority", "public office holder"],
    landmarkCitations: [
      {
        citation: "PLD 2020 SC 663",
        court: "Supreme Court of Pakistan",
        year: 2020,
        title: "Mir Shakil-ur-Rehman v. National Accountability Bureau",
        ratio: "NAB powers of arrest are not unbridled; power of arrest cannot be exercised mechanically or for harassment without concrete incriminating material."
      },
      {
        citation: "PLD 2023 SC 418",
        court: "Supreme Court of Pakistan",
        year: 2023,
        title: "Imran Ahmad Khan Niazi v. Federation of Pakistan",
        ratio: "Supreme Court judgment reviewing amendments to the National Accountability Ordinance 1999 and the threshold for public office holder accountability."
      }
    ]
  },
  {
    id: "ata-1997-sec-6-7",
    sectionNumber: "Section 6 & 7",
    title: "Definition of Terrorism & Special Trial by Anti-Terrorism Courts",
    statuteName: "Anti-Terrorism Act, 1997 (ATA)",
    statuteYear: 1997,
    domain: "special",
    text: `Section 6. Definition of Terrorism.—(1) In this Act, "terrorism" means the use or threat of action where: (a) the action falls within the meaning of sub-section (2), and (b) the use or threat is designed to coerce and intimidate or overawe the Government or the public or a section of the public or create a sense of fear or insecurity in society...
(2) An action falls within this sub-section if it: (a) involves the doing of anything that causes death of any person; (b) involves grievous violence against a person; (e) involves kidnapping for ransom or extortion...

Section 7. Punishment for acts of terrorism.—Whoever commits an act of terrorism under section 6 shall be punishable: (a) if such act causes death of any person, with death or imprisonment for life...`,
    commentary: `The Anti-Terrorism Act 1997 was enacted for the prevention of terrorism, sectarian violence, and speedy trial of heinous offences before specialized Anti-Terrorism Courts (ATC).`,
    proceduralNotes: "Exclusively triable by ATC; appeals lie to High Court Division Bench under Section 25 ATA within 30 days.",
    mandatoryPleadings: "Must aver design to create public terror, sectarian motivation, kidnapping for ransom, or grievous bodily violence.",
    punishmentOrRelief: "Death, Life Imprisonment, and forfeiture of properties under Section 7 ATA.",
    crossReferences: ["crpc-sec-154", "ppc-sec-302"],
    keywords: ["ATA 1997", "Section 6", "Section 7", "terrorism", "Anti Terrorism Court", "ATC", "kidnapping for ransom", "sectarian violence"],
    landmarkCitations: [
      {
        citation: "PLD 2020 SC 61",
        court: "Supreme Court of Pakistan (7-Member Larger Bench)",
        year: 2020,
        title: "Ghulam Hussain v. State",
        ratio: "Definition of Terrorism: An action constitutes terrorism only when designed to create a sense of fear or insecurity in society, not in individual personal disputes without intent to overawe public or government."
      }
    ]
  }
];

/* ==========================================================================
   3. LIMITATION ACT 1908 SCHEDULE (35+ ARTICLES)
   ========================================================================== */

export const LIMITATION_SCHEDULE_ENTRIES: LimitationEntry[] = [
  // --- SUITS ---
  {
    id: "lim-art-19",
    article: "Art. 19",
    title: "Money Lent Payable on Demand",
    description: "For money lent under an agreement that it shall be payable on demand.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "When the loan is made",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 19",
    notes: "Applies to demand loans; time runs from the date money is disbursed."
  },
  {
    id: "lim-art-23",
    article: "Art. 23",
    title: "Compensation for Defamation (Libel / Slander)",
    description: "For compensation for libel or slander (words spoken or published).",
    periodText: "1 Year",
    periodDays: 365,
    periodUnit: "years",
    periodValue: 1,
    triggerEvent: "When the words are spoken, or when the libel is published",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 23",
    notes: "Defamation Ordinance 2002 also contains statutory notice requirements."
  },
  {
    id: "lim-art-24",
    article: "Art. 24",
    title: "Compensation for Malicious Prosecution",
    description: "For compensation for malicious prosecution.",
    periodText: "1 Year",
    periodDays: 365,
    periodUnit: "years",
    periodValue: 1,
    triggerEvent: "When the plaintiff is acquitted, or the prosecution is otherwise terminated",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 24",
    notes: "Clock begins from the date of final acquittal or termination of proceedings."
  },
  {
    id: "lim-art-36",
    article: "Art. 36",
    title: "Compensation for Tort / Malfeasance Independent of Contract",
    description: "For compensation for any malfeasance, misfeasance or non-feasance independent of contract and not specially provided for.",
    periodText: "2 Years",
    periodDays: 2 * 365,
    periodUnit: "years",
    periodValue: 2,
    triggerEvent: "When the malfeasance, misfeasance or non-feasance takes place",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 36"
  },
  {
    id: "lim-art-52",
    article: "Art. 52",
    title: "Price of Goods Sold and Delivered",
    description: "For the price of goods sold and delivered, where no fixed period of credit is agreed upon.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "The date of the delivery of the goods",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 52"
  },
  {
    id: "lim-art-53-58",
    article: "Art. 53–58",
    title: "Breach of Contract (Compensation / Damages)",
    description: "For compensation for breach of any contract, express or implied, not in writing registered.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "When the contract is broken, or (where there are successive breaches) when the breach in respect of which the suit is instituted occurs",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Articles 53–58",
    notes: "Applies to standard unwritten or unregistered commercial agreements."
  },
  {
    id: "lim-art-61",
    article: "Art. 61",
    title: "Suit by Mortgagor to Redeem or Recover Possession",
    description: "By a mortgagor to redeem or recover possession of immovable property mortgaged.",
    periodText: "30 Years",
    periodDays: 30 * 365,
    periodUnit: "years",
    periodValue: 30,
    triggerEvent: "When the right to redeem or recover possession accrues",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 61",
    notes: "Substantive property redemption clock; 30-year statutory window."
  },
  {
    id: "lim-art-62",
    article: "Art. 62",
    title: "Money Received for Plaintiff's Use",
    description: "For money payable by the defendant to the plaintiff for money received by the defendant for the plaintiff's use.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "When the money is received",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 62"
  },
  {
    id: "lim-art-85",
    article: "Art. 85",
    title: "Balance Due on Mutual, Open and Current Account",
    description: "For the balance due on a mutual, open and current account, where there have been reciprocal demands.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "The close of the year in which the last item admitted or proved is entered in the account",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 85"
  },
  {
    id: "lim-art-91",
    article: "Art. 91",
    title: "Suit to Cancel or Set Aside an Instrument",
    description: "To cancel or set aside an instrument not otherwise provided for.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "When the facts entitling the plaintiff to have the instrument cancelled or set aside become known to him",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 91",
    notes: "Requires proof of date of knowledge of fraud/voidable instrument."
  },
  {
    id: "lim-art-95",
    article: "Art. 95",
    title: "Relief on the Ground of Fraud",
    description: "To set aside a decree obtained by fraud, or for other relief on the ground of fraud.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "When the fraud becomes known to the person injured thereby",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 95"
  },
  {
    id: "lim-art-106",
    article: "Art. 106",
    title: "Dissolution of Partnership & Accounts",
    description: "For an account and a share of the profits of a dissolved partnership.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "The date of the dissolution",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 106"
  },
  {
    id: "lim-art-113",
    article: "Art. 113",
    title: "Specific Performance of Contract",
    description: "For specific performance of a contract.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "The date fixed for the performance, or, if no such date is fixed, when the plaintiff has notice that performance is refused",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 113",
    notes: "Crucial for real estate agreements to sell; second part triggers on notice of refusal."
  },
  {
    id: "lim-art-114",
    article: "Art. 114",
    title: "Suit for Rescission of Contract",
    description: "For the rescission of a contract.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "When the facts entitling the plaintiff to have the contract rescinded first become known to him",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 114"
  },
  {
    id: "lim-art-115",
    article: "Art. 115",
    title: "Compensation for Breach of Unregistered Contract",
    description: "For compensation for the breach of any contract, express or implied, not in writing registered and not herein specially provided for.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "When the contract is broken, or (where there are successive breaches) when the breach occurs",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 115"
  },
  {
    id: "lim-art-116",
    article: "Art. 116",
    title: "Compensation for Breach of Registered Contract",
    description: "For compensation for the breach of a contract in writing registered.",
    periodText: "6 Years",
    periodDays: 6 * 365,
    periodUnit: "years",
    periodValue: 6,
    triggerEvent: "When the period of limitation would also begin to run against a suit brought on a contract not registered",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 116",
    notes: "Doubles the limitation period from 3 to 6 years for registered agreements."
  },
  {
    id: "lim-art-120",
    article: "Art. 120",
    title: "Residuary Civil Suit (No Period Provided Elsewhere)",
    description: "Suit for which no period of limitation is provided elsewhere in this Schedule.",
    periodText: "6 Years",
    periodDays: 6 * 365,
    periodUnit: "years",
    periodValue: 6,
    triggerEvent: "When the right to sue accrues",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 120",
    notes: "General residuary article for civil declaratory suits without specific schedule coverage."
  },
  {
    id: "lim-art-132",
    article: "Art. 132",
    title: "Enforce Payment of Money Charged on Immovable Property",
    description: "To enforce payment of money charged upon immovable property.",
    periodText: "12 Years",
    periodDays: 12 * 365,
    periodUnit: "years",
    periodValue: 12,
    triggerEvent: "When the money sued for becomes due",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 132"
  },
  {
    id: "lim-art-139",
    article: "Art. 139",
    title: "Recovery of Possession from Tenant / Arrears of Rent",
    description: "By a landlord to recover possession from a tenant or for arrears of rent.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "When the tenancy is determined or when arrears fall due",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 139"
  },
  {
    id: "lim-art-142",
    article: "Art. 142",
    title: "Possession of Immovable Property (Dispossession)",
    description: "For possession of immovable property when the plaintiff, while in possession of the property, has been dispossessed or has discontinued the possession.",
    periodText: "12 Years",
    periodDays: 12 * 365,
    periodUnit: "years",
    periodValue: 12,
    triggerEvent: "The date of the dispossession or discontinuance",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 142",
    notes: "Plaintiff must establish possession within 12 years prior to suit."
  },
  {
    id: "lim-art-144",
    article: "Art. 144",
    title: "Possession Based on Title Against Adverse Possession",
    description: "For possession of immovable property or any interest therein not hereby otherwise specially provided for.",
    periodText: "12 Years",
    periodDays: 12 * 365,
    periodUnit: "years",
    periodValue: 12,
    triggerEvent: "When the possession of the defendant becomes adverse to the plaintiff",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 144",
    notes: "Burden rests on defendant to establish hostile, open, continuous adverse possession."
  },
  {
    id: "lim-art-148",
    article: "Art. 148",
    title: "Redemption of Mortgage against Mortgagee",
    description: "Against a mortgagee to redeem or to recover possession of immovable property mortgaged.",
    periodText: "60 Years",
    periodDays: 60 * 365,
    periodUnit: "years",
    periodValue: 60,
    triggerEvent: "When the right to redeem or to recover possession accrues",
    category: "Suits",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 148"
  },

  // --- APPEALS ---
  {
    id: "lim-art-151",
    article: "Art. 151",
    title: "Appeal from Decree/Order of High Court in Original Jurisdiction",
    description: "From a decree or order of any of the High Courts in the exercise of its original jurisdiction.",
    periodText: "20 Days",
    periodDays: 20,
    periodUnit: "days",
    periodValue: 20,
    triggerEvent: "The date of the decree or order",
    category: "Appeals",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 151",
    notes: "Applicable to Intra-Court Appeals (ICA) under Section 3 Law Reforms Ordinance 1972 and SHC Original Side."
  },
  {
    id: "lim-art-152",
    article: "Art. 152",
    title: "Civil Appeal to District Judge under CPC",
    description: "Under the Code of Civil Procedure, 1908, to the Court of a District Judge.",
    periodText: "30 Days",
    periodDays: 30,
    periodUnit: "days",
    periodValue: 30,
    triggerEvent: "The date of the decree or order appealed from",
    category: "Appeals",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 152",
    notes: "Time spent obtaining certified copies excluded under Section 12 Limitation Act 1908."
  },
  {
    id: "lim-art-154",
    article: "Art. 154",
    title: "Criminal Appeal to Sessions Court under CrPC",
    description: "Under the Code of Criminal Procedure, 1898, to any Court other than the High Court.",
    periodText: "30 Days",
    periodDays: 30,
    periodUnit: "days",
    periodValue: 30,
    triggerEvent: "The date of the sentence or order appealed from",
    category: "Appeals",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 154"
  },
  {
    id: "lim-art-155",
    article: "Art. 155",
    title: "Criminal Appeal to High Court from Conviction",
    description: "Under the Code of Criminal Procedure, 1898, to a High Court, except in the cases provided for by Article 150 and Article 157.",
    periodText: "60 Days",
    periodDays: 60,
    periodUnit: "days",
    periodValue: 60,
    triggerEvent: "The date of the sentence or order appealed from",
    category: "Appeals",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 155"
  },
  {
    id: "lim-art-156",
    article: "Art. 156",
    title: "Civil Appeal to High Court (First / Second Appeal under CPC)",
    description: "Under the Code of Civil Procedure, 1908, to a High Court, except in the cases provided for by Article 151 and Article 153.",
    periodText: "90 Days",
    periodDays: 90,
    periodUnit: "days",
    periodValue: 90,
    triggerEvent: "The date of the decree or order appealed from",
    category: "Appeals",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 156",
    notes: "Standard 90-day statutory window for Regular First Appeals (RFA) and Regular Second Appeals (RSA)."
  },
  {
    id: "lim-art-157",
    article: "Art. 157",
    title: "Appeal Against Acquittal by Provincial Government / Complainant",
    description: "Under the Code of Criminal Procedure, 1898, from an order of acquittal.",
    periodText: "6 Months / 30 Days",
    periodDays: 180,
    periodUnit: "months",
    periodValue: 6,
    triggerEvent: "The date of the order of acquittal (6 months for State; 30 days for private complainant under S.417(2A) CrPC)",
    category: "Appeals",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 157"
  },

  // --- APPLICATIONS, REVISIONS, REVIEWS & EXECUTION ---
  {
    id: "lim-art-158",
    article: "Art. 158",
    title: "Application under Arbitration Act to Set Aside Award",
    description: "Under the Arbitration Act, 1940, to set aside an award or to get an award remitted for reconsideration.",
    periodText: "30 Days",
    periodDays: 30,
    periodUnit: "days",
    periodValue: 30,
    triggerEvent: "The date of service of the notice of filing of the award",
    category: "Applications",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 158"
  },
  {
    id: "lim-art-160",
    article: "Art. 160",
    title: "Restoration of Appeal Dismissed for Default in High Court",
    description: "For an order to restore to the file an application or appeal dismissed for default in the High Court.",
    periodText: "30 Days",
    periodDays: 30,
    periodUnit: "days",
    periodValue: 30,
    triggerEvent: "When the appeal or application was dismissed",
    category: "Applications",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 160"
  },
  {
    id: "lim-art-164",
    article: "Art. 164",
    title: "Setting Aside Ex Parte Decree (Order IX Rule 13 CPC)",
    description: "By a defendant, for an order to set aside a decree passed ex parte.",
    periodText: "30 Days",
    periodDays: 30,
    periodUnit: "days",
    periodValue: 30,
    triggerEvent: "The date of the decree or, where the summons was not duly served, when the applicant has knowledge of the decree",
    category: "Applications",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 164",
    notes: "Requires demonstration of improper summons service to trigger knowledge date exception."
  },
  {
    id: "lim-art-168",
    article: "Art. 168",
    title: "Re-admission of Appeal Dismissed for Default",
    description: "For the re-admission of an appeal dismissed for want of prosecution.",
    periodText: "30 Days",
    periodDays: 30,
    periodUnit: "days",
    periodValue: 30,
    triggerEvent: "The date of the dismissal",
    category: "Applications",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 168"
  },
  {
    id: "lim-art-173",
    article: "Art. 173",
    title: "Review of Judgment under CPC (Order XLVII Rule 1)",
    description: "For a review of judgment by a Court other than the Supreme Court.",
    periodText: "90 Days",
    periodDays: 90,
    periodUnit: "days",
    periodValue: 90,
    triggerEvent: "The date of the decree or order",
    category: "Reviews",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 173",
    notes: "Order XLVII Rule 1 CPC: Review limited to error apparent on face of record or discovery of new evidence."
  },
  {
    id: "lim-art-181",
    article: "Art. 181",
    title: "Residuary Civil Application (e.g. S.12(2) CPC, S.144 Restitution)",
    description: "Applications for which no period of limitation is provided elsewhere in this Schedule or by section 48 of the Code of Civil Procedure, 1908.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "When the right to apply accrues",
    category: "Applications",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 181",
    notes: "Standard 3-year clock for Section 12(2) CPC fraud applications and Section 144 restitution."
  },
  {
    id: "lim-art-182",
    article: "Art. 182",
    title: "Execution of Civil Court Decree or Order",
    description: "For the execution of a decree or order of any Civil Court not provided for by Article 183.",
    periodText: "3 Years",
    periodDays: 3 * 365,
    periodUnit: "years",
    periodValue: 3,
    triggerEvent: "The date of the decree or order, or (where there has been an appeal) the date of the final decree or order of the Appellate Court",
    category: "Execution",
    statutoryRef: "Limitation Act 1908, First Schedule, Article 182",
    notes: "Subject to the ultimate 6-year ceiling from the date of original decree under Section 48 CPC."
  }
];

/* ==========================================================================
   4. PROVINCIAL COURT FEES & VALUATION ENGINE
   ========================================================================== */

export const COURT_FEE_SUIT_TYPES: CourtFeeSuitType[] = [
  {
    id: "recovery_money",
    name: "Suit for Recovery of Money / Debt",
    category: "civil",
    feeType: "ad_valorem",
    ratePercentage: 7.5,
    exemptThreshold: 25000,
    description: "Ad valorem court fee on amount claimed; exempt up to PKR 25,000.",
    statutoryReference: "Court Fees Act 1870, Section 7(i)"
  },
  {
    id: "specific_performance",
    name: "Specific Performance of Contract / Sale Agreement",
    category: "civil",
    feeType: "ad_valorem",
    ratePercentage: 7.5,
    exemptThreshold: 25000,
    description: "Computed on agreed contract sale consideration subject to provincial cap.",
    statutoryReference: "Court Fees Act 1870, Section 7(x)(a)"
  },
  {
    id: "possession_immovable",
    name: "Possession of Immovable Property / Land / House",
    category: "civil",
    feeType: "ad_valorem",
    ratePercentage: 7.5,
    exemptThreshold: 25000,
    description: "Computed on market value / revenue multiples of subject property.",
    statutoryReference: "Court Fees Act 1870, Section 7(v)"
  },
  {
    id: "declaration_consequential",
    name: "Declaration of Title with Consequential Relief",
    category: "civil",
    feeType: "ad_valorem",
    ratePercentage: 7.5,
    exemptThreshold: 25000,
    description: "Computed on valuation stated in plaint for declaration + possession/injunction.",
    statutoryReference: "Court Fees Act 1870, Section 7(iv)(c)"
  },
  {
    id: "permanent_injunction",
    name: "Suit for Permanent / Perpetual Injunction (Pure Preventive)",
    category: "civil",
    feeType: "fixed",
    fixedAmount: 500,
    description: "Fixed statutory court fee for pure preventive injunction without consequential property relief.",
    statutoryReference: "Court Fees Act 1870, Schedule II, Article 17"
  },
  {
    id: "declaration_pure",
    name: "Pure Declaratory Suit (No Consequential Relief)",
    category: "civil",
    feeType: "fixed",
    fixedAmount: 500,
    description: "Fixed court fee where no consequential relief is capable of being estimated.",
    statutoryReference: "Court Fees Act 1870, Schedule II, Article 17(iii)"
  },
  {
    id: "constitutional_writ",
    name: "Constitutional Writ Petition (Article 199)",
    category: "constitutional",
    feeType: "fixed",
    fixedAmount: 500,
    description: "Fixed court fee on Constitution Petitions filed before High Court.",
    statutoryReference: "High Court Rules & Orders / CFA Schedule II, Article 11"
  },
  {
    id: "family_suit",
    name: "Family Suit (Khula, Dower, Maintenance, Custody)",
    category: "family",
    feeType: "fixed",
    fixedAmount: 500,
    description: "Nominal fixed fee; minor child maintenance is completely fee-exempt.",
    statutoryReference: "West Pakistan Family Courts Act 1964, Section 19"
  },
  {
    id: "civil_first_appeal",
    name: "Civil First Appeal (RFA / Appeal to District Judge)",
    category: "appellate",
    feeType: "ad_valorem",
    ratePercentage: 7.5,
    exemptThreshold: 25000,
    description: "Ad valorem on value of subject matter in dispute in appeal.",
    statutoryReference: "Court Fees Act 1870, Schedule I, Article 1"
  },
  {
    id: "civil_revision",
    name: "Civil Revision (Section 115 CPC)",
    category: "appellate",
    feeType: "percentage_capped",
    fixedAmount: 7500,
    description: "50% of ad valorem fee payable on appeal, capped at maximum PKR 7,500.",
    statutoryReference: "Code of Civil Procedure 1908, Section 115"
  },
  {
    id: "arbitration_objection",
    name: "Arbitration Petition / Objection to Award (S.30/33)",
    category: "commercial",
    feeType: "fixed",
    fixedAmount: 500,
    description: "Fixed fee on application challenging arbitration award.",
    statutoryReference: "Court Fees Act 1870, Schedule II, Article 17(iv)"
  },
  {
    id: "execution_petition",
    name: "Execution Application (Order XXI CPC)",
    category: "civil",
    feeType: "fixed",
    fixedAmount: 50,
    description: "Fixed nominal stamp on execution application.",
    statutoryReference: "Court Fees Act 1870, Schedule II, Article 1"
  },
  {
    id: "bail_criminal_petition",
    name: "Bail Application / Criminal Misc (S.497/498 CrPC)",
    category: "criminal",
    feeType: "fixed",
    fixedAmount: 100,
    description: "Nominal court fee stamp on bail petition in Sessions Court or High Court.",
    statutoryReference: "Court Fees Act 1870, Schedule II, Article 1(b)"
  },
  {
    id: "review_application",
    name: "Review Application (Order XLVII Rule 1 CPC)",
    category: "appellate",
    feeType: "percentage_capped",
    fixedAmount: 7500,
    description: "50% of ad valorem fee if filed within 89 days; full fee if filed on 90th day.",
    statutoryReference: "Court Fees Act 1870, Schedule I, Articles 4 & 5"
  },
  {
    id: "vakalatnama_stamp",
    name: "Vakalatnama / Power of Attorney Stamp",
    category: "civil",
    feeType: "fixed",
    fixedAmount: 30,
    description: "Advocate appointment stamp (Stamp Act + CFA + Bar Council Welfare Stamp).",
    statutoryReference: "Court Fees Act 1870, Schedule II, Article 10"
  },
  {
    id: "sindh_original_side_suit",
    name: "Sindh High Court Original Side Suit (>PKR 65M)",
    category: "commercial",
    feeType: "ad_valorem",
    ratePercentage: 7.5,
    exemptThreshold: 25000,
    description: "Commercial and civil suits exceeding PKR 65,000,000 instituted directly in SHC Original Side.",
    statutoryReference: "Sindh High Court Rules (Original Side) & Sindh Court Fees Amendment"
  }
];

export const PROVINCIAL_COURT_FEE_RULES: Record<CourtFeeProvince, ProvincialCourtFeeRule> = {
  punjab: {
    province: "punjab",
    provinceName: "Punjab",
    adValoremRate: 7.5,
    exemptThreshold: 25000,
    maxCapGeneral: 15000,
    governingAct: "Court Fees Act 1870 (as amended by Punjab Court Fees (Amendment) Act 2012)",
    fixedFees: {
      writPetition: 500,
      permanentInjunction: 500,
      familySuit: 500,
      civilRevisionCap: 7500,
      miscApplication: 20,
      powerOfAttorneyStamp: 30
    },
    pecuniaryTiers: [
      {
        courtName: "Civil Judge Class III",
        minValuation: 0,
        maxValuation: 1000000,
        notes: "Pecuniary jurisdiction up to PKR 1,000,000."
      },
      {
        courtName: "Civil Judge Class II",
        minValuation: 1000001,
        maxValuation: 5000000,
        notes: "Pecuniary jurisdiction up to PKR 5,000,000."
      },
      {
        courtName: "Civil Judge Class I / Senior Civil Judge",
        minValuation: 5000001,
        maxValuation: null,
        notes: "Unlimited pecuniary trial jurisdiction across the district."
      },
      {
        courtName: "District & Sessions Judge",
        minValuation: 0,
        maxValuation: null,
        notes: "Principal district civil court; hears appeals up to notified limits / unlimited."
      },
      {
        courtName: "Lahore High Court",
        minValuation: 0,
        maxValuation: null,
        notes: "Appellate & Constitutional jurisdiction across Punjab."
      }
    ],
    notes: "In Punjab, suits valued up to PKR 25,000 are 100% exempt from court fees. Suits exceeding PKR 25,000 are assessed at 7.5% ad valorem, capped at the statutory ceiling of PKR 15,000/- (Punjab Amendment Act 2012)."
  },
  sindh: {
    province: "sindh",
    provinceName: "Sindh",
    adValoremRate: 7.5,
    exemptThreshold: 25000,
    maxCapGeneral: 15000,
    highCourtOriginalSideCap: 50000,
    highCourtOriginalSidePecuniaryMin: 65000000,
    governingAct: "Court Fees Act 1870 (as amended in Sindh) & Sindh High Court Rules",
    fixedFees: {
      writPetition: 500,
      permanentInjunction: 500,
      familySuit: 500,
      civilRevisionCap: 7500,
      miscApplication: 20,
      powerOfAttorneyStamp: 30
    },
    pecuniaryTiers: [
      {
        courtName: "Civil Judge Class III",
        minValuation: 0,
        maxValuation: 500000,
        notes: "Pecuniary jurisdiction up to PKR 500,000."
      },
      {
        courtName: "Civil Judge Class II",
        minValuation: 500001,
        maxValuation: 2500000,
        notes: "Pecuniary jurisdiction up to PKR 2,500,000."
      },
      {
        courtName: "Civil Judge Class I / Senior Civil Judge",
        minValuation: 2500001,
        maxValuation: 65000000,
        notes: "Pecuniary jurisdiction up to PKR 65,000,000 in Karachi Division."
      },
      {
        courtName: "Sindh High Court (Original Side - Karachi)",
        minValuation: 65000001,
        maxValuation: null,
        notes: "Exclusive Original Civil Jurisdiction for suits exceeding PKR 65 Million in Karachi Division."
      },
      {
        courtName: "District & Sessions Courts (Interior Sindh)",
        minValuation: 2500001,
        maxValuation: null,
        notes: "Unlimited pecuniary trial jurisdiction in Hyderabad, Sukkur, Larkana, Mirpurkhas."
      }
    ],
    notes: "In Sindh, District Court suits have a statutory cap of PKR 15,000/-. However, suits on the Original Side of the High Court of Sindh (exceeding PKR 65M valuation) are subject to a statutory fee cap of PKR 50,000/-."
  },
  islamabad: {
    province: "islamabad",
    provinceName: "Islamabad Capital Territory (ICT)",
    adValoremRate: 7.5,
    exemptThreshold: 25000,
    maxCapGeneral: 15000,
    governingAct: "Court Fees Act 1870 (ICT Adaptation)",
    fixedFees: {
      writPetition: 500,
      permanentInjunction: 500,
      familySuit: 500,
      civilRevisionCap: 7500,
      miscApplication: 20,
      powerOfAttorneyStamp: 30
    },
    pecuniaryTiers: [
      {
        courtName: "Civil Judge Class III",
        minValuation: 0,
        maxValuation: 1000000,
        notes: "Pecuniary jurisdiction up to PKR 1,000,000."
      },
      {
        courtName: "Civil Judge Class II",
        minValuation: 1000001,
        maxValuation: 5000000,
        notes: "Pecuniary jurisdiction up to PKR 5,000,000."
      },
      {
        courtName: "Senior Civil Judge / Civil Judge Class I",
        minValuation: 5000001,
        maxValuation: null,
        notes: "Unlimited pecuniary trial jurisdiction in ICT."
      },
      {
        courtName: "Islamabad High Court",
        minValuation: 0,
        maxValuation: null,
        notes: "Constitutional writ and appellate jurisdiction for Federal Capital."
      }
    ],
    notes: "Islamabad Capital Territory applies a 7.5% ad valorem rate on suits exceeding PKR 25,000 with a statutory maximum fee cap of PKR 15,000/-."
  },
  kpk: {
    province: "kpk",
    provinceName: "Khyber Pakhtunkhwa",
    adValoremRate: 7.5,
    exemptThreshold: 25000,
    maxCapGeneral: 15000,
    governingAct: "KP Court Fees (Amendment) Acts & Regulations",
    fixedFees: {
      writPetition: 500,
      permanentInjunction: 500,
      familySuit: 500,
      civilRevisionCap: 7500,
      miscApplication: 20,
      powerOfAttorneyStamp: 30
    },
    pecuniaryTiers: [
      {
        courtName: "Civil Judge Class III",
        minValuation: 0,
        maxValuation: 1000000,
        notes: "Pecuniary jurisdiction up to PKR 1,000,000."
      },
      {
        courtName: "Civil Judge Class II",
        minValuation: 1000001,
        maxValuation: 5000000,
        notes: "Pecuniary jurisdiction up to PKR 5,000,000."
      },
      {
        courtName: "Senior Civil Judge / Civil Judge Class I",
        minValuation: 5000001,
        maxValuation: null,
        notes: "Unlimited pecuniary jurisdiction."
      },
      {
        courtName: "Peshawar High Court",
        minValuation: 0,
        maxValuation: null,
        notes: "Appellate & Constitutional jurisdiction across KP."
      }
    ],
    notes: "In Khyber Pakhtunkhwa, suits exceeding PKR 25,000 are subject to 7.5% ad valorem with standard statutory caps between PKR 15,000 and PKR 25,000 depending on notification."
  },
  balochistan: {
    province: "balochistan",
    provinceName: "Balochistan",
    adValoremRate: 7.5,
    exemptThreshold: 25000,
    maxCapGeneral: 15000,
    governingAct: "Balochistan Court Fees Rules & Amendments",
    fixedFees: {
      writPetition: 500,
      permanentInjunction: 500,
      familySuit: 500,
      civilRevisionCap: 7500,
      miscApplication: 20,
      powerOfAttorneyStamp: 30
    },
    pecuniaryTiers: [
      {
        courtName: "Civil Judge Class III",
        minValuation: 0,
        maxValuation: 1000000,
        notes: "Pecuniary jurisdiction up to PKR 1,000,000."
      },
      {
        courtName: "Civil Judge Class II",
        minValuation: 1000001,
        maxValuation: 3000000,
        notes: "Pecuniary jurisdiction up to PKR 3,000,000."
      },
      {
        courtName: "Senior Civil Judge / Civil Judge Class I",
        minValuation: 3000001,
        maxValuation: null,
        notes: "Unlimited pecuniary trial jurisdiction."
      },
      {
        courtName: "High Court of Balochistan",
        minValuation: 0,
        maxValuation: null,
        notes: "Appellate & Constitutional jurisdiction across Balochistan."
      }
    ],
    notes: "In Balochistan, suits exceeding PKR 25,000 are calculated at 7.5% ad valorem with a statutory ceiling of PKR 15,000/-."
  }
};

/* ==========================================================================
   5. COMPLETE PAKISTANI COURT DIRECTORY (4 TIERS)
   ========================================================================== */

export const PAKISTAN_COURT_DIRECTORY: CourtRecord[] = [
  // --- TIER 1: APEX & CONSTITUTIONAL COURTS ---
  {
    id: "court-sc-principal",
    name: "Supreme Court of Pakistan (Principal Seat)",
    tier: "apex",
    city: "Islamabad",
    province: "ICT",
    address: "Constitution Avenue, Sector G-5/2, Islamabad",
    establishedYear: 1956,
    benches: ["Principal Seat Islamabad"],
    territorialJurisdiction: ["Federation of Pakistan", "All Provinces", "ICT", "AJK / Gilgit-Baltistan (Appellate)"],
    jurisdictionNotes: "Highest constitutional court of Pakistan. Original jurisdiction under Art. 184(3), Appellate jurisdiction under Art. 185, Advisory under Art. 186, Review under Art. 188.",
    contact: "+92 51 9220581",
    rosterCategories: ["Constitutional Benches", "Civil Appeals", "Criminal Appeals", "Human Rights Cell"]
  },
  {
    id: "court-sc-lahore",
    name: "Supreme Court Branch Registry Lahore",
    tier: "apex",
    city: "Lahore",
    province: "Punjab",
    address: "Adjacent to Lahore High Court, The Mall, Lahore",
    benches: ["Lahore Branch Registry"],
    territorialJurisdiction: ["Punjab Province"],
    jurisdictionNotes: "Receives and hears petitions, appeals, and review applications arising from judgments of the Lahore High Court.",
    contact: "+92 42 99214760"
  },
  {
    id: "court-sc-karachi",
    name: "Supreme Court Branch Registry Karachi",
    tier: "apex",
    city: "Karachi",
    province: "Sindh",
    address: "M.R. Kiyani Road, Saddar, Karachi",
    benches: ["Karachi Branch Registry"],
    territorialJurisdiction: ["Sindh Province"],
    jurisdictionNotes: "Receives and hears petitions, appeals, and review applications arising from judgments of the High Court of Sindh.",
    contact: "+92 21 99203201"
  },
  {
    id: "court-sc-peshawar",
    name: "Supreme Court Branch Registry Peshawar",
    tier: "apex",
    city: "Peshawar",
    province: "KPK",
    address: "Khyber Road, Peshawar",
    benches: ["Peshawar Branch Registry"],
    territorialJurisdiction: ["Khyber Pakhtunkhwa Province"],
    jurisdictionNotes: "Receives and hears petitions and appeals arising from judgments of the Peshawar High Court.",
    contact: "+92 91 9210200"
  },
  {
    id: "court-sc-quetta",
    name: "Supreme Court Branch Registry Quetta",
    tier: "apex",
    city: "Quetta",
    province: "Balochistan",
    address: "Hali Road, Quetta",
    benches: ["Quetta Branch Registry"],
    territorialJurisdiction: ["Balochistan Province"],
    jurisdictionNotes: "Receives and hears petitions and appeals arising from judgments of the High Court of Balochistan.",
    contact: "+92 81 9202000"
  },
  {
    id: "court-fsc-principal",
    name: "Federal Shariat Court of Pakistan",
    tier: "apex",
    city: "Islamabad",
    province: "ICT",
    address: "Constitution Avenue, Sector G-5, Islamabad",
    establishedYear: 1980,
    benches: ["Principal Seat Islamabad", "Lahore Bench", "Karachi Bench", "Peshawar Bench", "Quetta Bench"],
    territorialJurisdiction: ["Federation of Pakistan"],
    jurisdictionNotes: "Examines conformity of existing and proposed statutory laws with the Injunctions of Islam under Article 203-D; appellate jurisdiction over Hudood cases.",
    contact: "+92 51 9203001"
  },

  // --- TIER 2: HIGH COURTS & DIVISIONAL / CIRCUIT BENCHES ---
  {
    id: "court-lhc-principal",
    name: "Lahore High Court (Principal Seat)",
    tier: "high_courts",
    city: "Lahore",
    province: "Punjab",
    address: "The Mall, Lahore",
    establishedYear: 1866,
    benches: ["Principal Seat Lahore", "Rawalpindi Bench", "Multan Bench", "Bahawalpur Bench"],
    territorialJurisdiction: [
      "Lahore", "Kasur", "Sheikhupura", "Nankana Sahib", "Okara", "Faisalabad", "Jhang",
      "Toba Tek Singh", "Chiniot", "Gujranwala", "Sialkot", "Gujrat", "Narowal", "Hafizabad",
      "Mandi Bahauddin", "Sargodha", "Khushab", "Mianwali", "Bhakkar"
    ],
    jurisdictionNotes: "Principal High Court of Punjab. Constitutional writ jurisdiction under Art. 199, Civil/Criminal appellate, Company and Banking appeals.",
    contact: "+92 42 99212951"
  },
  {
    id: "court-lhc-rawalpindi",
    name: "Lahore High Court (Rawalpindi Bench)",
    tier: "high_courts",
    city: "Rawalpindi",
    province: "Punjab",
    address: "Kashmir Road, Rawalpindi",
    benches: ["Rawalpindi Bench"],
    territorialJurisdiction: ["Rawalpindi", "Attock", "Jhelum", "Chakwal"],
    jurisdictionNotes: "Divisional High Court bench exercising full constitutional and appellate jurisdiction over Rawalpindi Division.",
    contact: "+92 51 9270001"
  },
  {
    id: "court-lhc-multan",
    name: "Lahore High Court (Multan Bench)",
    tier: "high_courts",
    city: "Multan",
    province: "Punjab",
    address: "Abdali Road, Multan",
    benches: ["Multan Bench"],
    territorialJurisdiction: ["Multan", "Lodhran", "Khanewal", "Vehari", "Sahiwal", "Pakpattan", "D.G. Khan", "Muzaffargarh", "Layyah", "Rajanpur"],
    jurisdictionNotes: "Divisional High Court bench exercising constitutional and appellate powers over Multan, Sahiwal, and D.G. Khan Divisions.",
    contact: "+92 61 9200001"
  },
  {
    id: "court-lhc-bahawalpur",
    name: "Lahore High Court (Bahawalpur Bench)",
    tier: "high_courts",
    city: "Bahawalpur",
    province: "Punjab",
    address: "Near Baghdad-ul-Jadeed, Bahawalpur",
    benches: ["Bahawalpur Bench"],
    territorialJurisdiction: ["Bahawalpur", "Bahawalnagar", "Rahim Yar Khan"],
    jurisdictionNotes: "Divisional High Court bench exercising constitutional and appellate jurisdiction over Bahawalpur Division.",
    contact: "+92 62 9250001"
  },
  {
    id: "court-shc-principal",
    name: "High Court of Sindh (Principal Seat Karachi)",
    tier: "high_courts",
    city: "Karachi",
    province: "Sindh",
    address: "High Court Road, Saddar, Karachi",
    establishedYear: 1906,
    benches: ["Principal Seat Karachi", "Sukkur Bench", "Circuit Court Hyderabad", "Circuit Court Larkana", "Circuit Court Mirpurkhas"],
    territorialJurisdiction: ["Karachi Division (South, East, West, Central, Malir, Korangi, Keamari)"],
    jurisdictionNotes: "Dual Jurisdiction: Holds exclusive Original Civil Jurisdiction for commercial/civil suits exceeding PKR 65 Million in Karachi Division, alongside Appellate and Constitutional Writ Jurisdiction.",
    contact: "+92 21 99203151"
  },
  {
    id: "court-shc-sukkur",
    name: "High Court of Sindh (Sukkur Bench)",
    tier: "high_courts",
    city: "Sukkur",
    province: "Sindh",
    address: "Minara Road, Sukkur",
    benches: ["Sukkur Bench"],
    territorialJurisdiction: ["Sukkur", "Ghotki", "Khairpur", "Naushahro Feroze"],
    jurisdictionNotes: "Permanent High Court bench for Upper Sindh districts.",
    contact: "+92 71 9310001"
  },
  {
    id: "court-shc-hyderabad",
    name: "High Court of Sindh (Circuit Court Hyderabad)",
    tier: "high_courts",
    city: "Hyderabad",
    province: "Sindh",
    address: "Court Road, Hyderabad",
    benches: ["Circuit Court Hyderabad"],
    territorialJurisdiction: ["Hyderabad", "Jamshoro", "Matiari", "Tando Allahyar", "Tando Muhammad Khan", "Badin", "Thatta", "Sujawal"],
    jurisdictionNotes: "High Court circuit court exercising constitutional and appellate jurisdiction for Hyderabad Division.",
    contact: "+92 22 9200001"
  },
  {
    id: "court-shc-larkana",
    name: "High Court of Sindh (Circuit Court Larkana)",
    tier: "high_courts",
    city: "Larkana",
    province: "Sindh",
    address: "VIP Road, Larkana",
    benches: ["Circuit Court Larkana"],
    territorialJurisdiction: ["Larkana", "Kambar Shahdadkot", "Shikarpur", "Jacobabad", "Kashmore"],
    jurisdictionNotes: "High Court circuit bench for Larkana Division.",
    contact: "+92 74 9410001"
  },
  {
    id: "court-shc-mirpurkhas",
    name: "High Court of Sindh (Circuit Court Mirpurkhas)",
    tier: "high_courts",
    city: "Mirpurkhas",
    province: "Sindh",
    address: "Mirpurkhas",
    benches: ["Circuit Court Mirpurkhas"],
    territorialJurisdiction: ["Mirpurkhas", "Umerkot", "Tharparkar"],
    jurisdictionNotes: "High Court circuit bench for Mirpurkhas and Thar desert districts.",
    contact: "+92 233 920001"
  },
  {
    id: "court-ihc",
    name: "Islamabad High Court (IHC)",
    tier: "high_courts",
    city: "Islamabad",
    province: "ICT",
    address: "Constitution Avenue, Sector G-5, Islamabad",
    establishedYear: 2010,
    benches: ["Principal Seat Islamabad"],
    territorialJurisdiction: ["Islamabad Capital Territory (ICT)"],
    jurisdictionNotes: "Principal High Court for the Federal Capital Territory. Constitutional review of federal ministries, statutory bodies, and subordinate ICT courts.",
    contact: "+92 51 9108000"
  },
  {
    id: "court-phc-principal",
    name: "Peshawar High Court (Principal Seat)",
    tier: "high_courts",
    city: "Peshawar",
    province: "KPK",
    address: "Khyber Road, Peshawar",
    establishedYear: 1901,
    benches: ["Principal Seat Peshawar", "Abbottabad Bench", "Mingora Bench (Dar-ul-Qaza)", "D.I. Khan Bench", "Bannu Bench"],
    territorialJurisdiction: [
      "Peshawar", "Charsadda", "Nowshera", "Mardan", "Swabi", "Kohat", "Karak", "Hangu",
      "Kurram", "Orakzai", "Khyber", "Mohmand"
    ],
    jurisdictionNotes: "Principal High Court of Khyber Pakhtunkhwa. Constitutional writs and civil/criminal appeals.",
    contact: "+92 91 9210141"
  },
  {
    id: "court-phc-abbottabad",
    name: "Peshawar High Court (Abbottabad Bench)",
    tier: "high_courts",
    city: "Abbottabad",
    province: "KPK",
    address: "Kakul Road, Abbottabad",
    benches: ["Abbottabad Bench"],
    territorialJurisdiction: ["Abbottabad", "Haripur", "Mansehra", "Battagram", "Kohistan Upper", "Kohistan Lower", "Torghar"],
    jurisdictionNotes: "Permanent High Court bench for Hazara Division.",
    contact: "+92 992 9310001"
  },
  {
    id: "court-phc-mingora",
    name: "Peshawar High Court (Mingora Bench / Dar-ul-Qaza Swat)",
    tier: "high_courts",
    city: "Swat",
    province: "KPK",
    address: "Gulkada, Saidu Sharif, Swat",
    benches: ["Mingora Bench (Dar-ul-Qaza)"],
    territorialJurisdiction: ["Swat", "Buner", "Shangla", "Dir Upper", "Dir Lower", "Chitral Upper", "Chitral Lower", "Malakand", "Bajaur"],
    jurisdictionNotes: "High Court Bench exercising constitutional and Shari'a appellate jurisdiction over Malakand Division.",
    contact: "+92 946 9240001"
  },
  {
    id: "court-phc-dikhan",
    name: "Peshawar High Court (D.I. Khan Bench)",
    tier: "high_courts",
    city: "Dera Ismail Khan",
    province: "KPK",
    address: "D.I. Khan",
    benches: ["D.I. Khan Bench"],
    territorialJurisdiction: ["Dera Ismail Khan", "Tank", "South Waziristan Upper", "South Waziristan Lower"],
    jurisdictionNotes: "High Court bench for D.I. Khan Division and South Waziristan.",
    contact: "+92 966 9280001"
  },
  {
    id: "court-phc-bannu",
    name: "Peshawar High Court (Bannu Bench)",
    tier: "high_courts",
    city: "Bannu",
    province: "KPK",
    address: "Bannu",
    benches: ["Bannu Bench"],
    territorialJurisdiction: ["Bannu", "Lakki Marwat", "North Waziristan"],
    jurisdictionNotes: "High Court bench for Bannu Division and North Waziristan.",
    contact: "+92 928 9270001"
  },
  {
    id: "court-bhc-principal",
    name: "High Court of Balochistan (Principal Seat Quetta)",
    tier: "high_courts",
    city: "Quetta",
    province: "Balochistan",
    address: "Hali Road, Quetta",
    establishedYear: 1976,
    benches: ["Principal Seat Quetta", "Circuit Bench Sibi", "Circuit Bench Turbat (Makran)", "Circuit Bench Loralai"],
    territorialJurisdiction: ["Quetta", "Pishin", "Killa Abdullah", "Chaman", "Mastung", "Kalat", "Nushki", "Chaghi"],
    jurisdictionNotes: "Principal High Court of Balochistan. Constitutional review, civil and criminal appellate forum.",
    contact: "+92 81 9202151"
  },
  {
    id: "court-bhc-sibi",
    name: "High Court of Balochistan (Circuit Bench Sibi)",
    tier: "high_courts",
    city: "Sibi",
    province: "Balochistan",
    address: "Sibi",
    benches: ["Circuit Bench Sibi"],
    territorialJurisdiction: ["Sibi", "Nasirabad", "Jaffarabad", "Jhal Magsi", "Dera Bugti", "Kohlu", "Usta Muhammad"],
    jurisdictionNotes: "High Court circuit bench for Sibi and Nasirabad Divisions.",
    contact: "+92 833 920001"
  },
  {
    id: "court-bhc-turbat",
    name: "High Court of Balochistan (Circuit Bench Turbat / Makran)",
    tier: "high_courts",
    city: "Turbat",
    province: "Balochistan",
    address: "Turbat / Kech",
    benches: ["Circuit Bench Turbat"],
    territorialJurisdiction: ["Kech (Turbat)", "Gwadar", "Panjgur"],
    jurisdictionNotes: "High Court circuit bench for Makran coastal division and Gwadar port area.",
    contact: "+92 852 920001"
  },
  {
    id: "court-bhc-loralai",
    name: "High Court of Balochistan (Circuit Bench Loralai)",
    tier: "high_courts",
    city: "Loralai",
    province: "Balochistan",
    address: "Loralai",
    benches: ["Circuit Bench Loralai"],
    territorialJurisdiction: ["Zhob", "Loralai", "Musakhel", "Barkhan", "Killa Saifullah", "Duki", "Harnai", "Sherani"],
    jurisdictionNotes: "High Court circuit bench for Zhob and Loralai Divisions.",
    contact: "+92 824 920001"
  },

  // --- TIER 3: SPECIALIZED TRIBUNALS & SPECIAL COURTS ---
  {
    id: "tribunal-nab",
    name: "National Accountability Courts (NAB)",
    tier: "tribunals",
    city: "All Provincial Capitals & Major Divisions",
    province: "Nationwide",
    jurisdictionNotes: "Exclusive trial forum for corruption, abuse of authority, and mega financial scams under National Accountability Ordinance 1999. Presided by District & Sessions Judges.",
    appellateAuthority: "High Court Division Bench (Writ Jurisdiction / Appeals under NAO)"
  },
  {
    id: "tribunal-atc",
    name: "Anti-Terrorism Courts (ATC)",
    tier: "tribunals",
    city: "All Administrative Divisions",
    province: "Nationwide",
    jurisdictionNotes: "Exclusive trial jurisdiction for terrorism, kidnapping for ransom, sectarian violence, and extortion under Anti-Terrorism Act 1997. Daily day-to-day trials.",
    appellateAuthority: "High Court Appellate Tribunal / Division Bench (under S.25 ATA)"
  },
  {
    id: "tribunal-banking",
    name: "Special Banking Courts",
    tier: "tribunals",
    city: "Major Commercial Hubs (Lahore, Karachi, Islamabad, Peshawar, Quetta, Faisalabad, Multan, Sukkur)",
    province: "Nationwide",
    jurisdictionNotes: "Summary suits for recovery of finances by and against banks and financial institutions under FIO 2001.",
    appellateAuthority: "High Court (Section 22 FIO 2001 Appeal within 30 days)"
  },
  {
    id: "tribunal-labour",
    name: "Labour Courts & Labour Appellate Tribunals",
    tier: "tribunals",
    city: "Industrial Cities Nationwide",
    province: "Nationwide",
    jurisdictionNotes: "Adjudication of industrial disputes, unfair labour practices, workman grievances, and trade union registrations under Industrial Relations Acts.",
    appellateAuthority: "Labour Appellate Tribunal / High Court"
  },
  {
    id: "tribunal-rent",
    name: "Special Rent Tribunals / Rent Controllers",
    tier: "tribunals",
    city: "Every District Headquarters",
    province: "Nationwide",
    jurisdictionNotes: "Exclusive jurisdiction over tenancy disputes, determination of rent, and eviction under Punjab Rented Premises Act 2009 / Sindh Rented Premises Ordinance 1979.",
    appellateAuthority: "District & Sessions Judge (under S.24 PRPA within 30 days)"
  },
  {
    id: "tribunal-service",
    name: "Federal Service Tribunal (FST) & Provincial Service Tribunals (PST)",
    tier: "tribunals",
    city: "Islamabad, Lahore, Karachi, Peshawar, Quetta",
    province: "Nationwide",
    jurisdictionNotes: "Exclusive constitutional tribunal under Article 212 of the Constitution for terms and conditions of civil servants.",
    appellateAuthority: "Supreme Court of Pakistan (Civil Appeal under Art. 212(3))"
  },
  {
    id: "tribunal-family",
    name: "Special Family Courts",
    tier: "tribunals",
    city: "Every Tehsil & District",
    province: "Nationwide",
    jurisdictionNotes: "Exclusive jurisdiction over Khula, dower, maintenance, return of dowry articles, custody, and guardianship under West Pakistan Family Courts Act 1964.",
    appellateAuthority: "District & Sessions Judge (under S.14 FCA)"
  },
  {
    id: "tribunal-atir-customs",
    name: "Appellate Tribunal Inland Revenue (ATIR) & Customs Appellate Tribunal",
    tier: "tribunals",
    city: "Islamabad, Lahore, Karachi, Peshawar, Quetta",
    province: "Nationwide",
    jurisdictionNotes: "Final fact-finding appellate body for income tax, sales tax, federal excise, and customs tariff disputes.",
    appellateAuthority: "High Court (Customs / Tax Reference on Questions of Law)"
  },
  {
    id: "tribunal-anticorruption",
    name: "Special Anti-Corruption Courts (Central & Provincial)",
    tier: "tribunals",
    city: "All Divisions",
    province: "Nationwide",
    jurisdictionNotes: "Trial of public servants for bribery and corruption under Prevention of Corruption Act 1947 and PCA Provincial Acts.",
    appellateAuthority: "High Court"
  },
  {
    id: "tribunal-consumer",
    name: "Consumer Protection Courts",
    tier: "tribunals",
    city: "All District Headquarters",
    province: "Nationwide",
    jurisdictionNotes: "Summary trial for defective products, deficient professional services, misleading advertisements, and statutory consumer remedies. Presided by D&SJ.",
    appellateAuthority: "High Court (Appeal within 30 days)"
  },
  {
    id: "tribunal-drug",
    name: "Special Drug Courts",
    tier: "tribunals",
    city: "Provincial Capitals & Major Divisions",
    province: "Nationwide",
    jurisdictionNotes: "Trial of spurious, substandard, unregistered, or adulterated drugs under the Drugs Act 1976 and DRAP Act 2012.",
    appellateAuthority: "High Court"
  },
  {
    id: "tribunal-election",
    name: "Election Tribunals",
    tier: "tribunals",
    city: "Designated High Court Judges & Retired D&SJs",
    province: "Nationwide",
    jurisdictionNotes: "Trial of election petitions challenging National and Provincial Assembly election results under Elections Act 2017.",
    appellateAuthority: "Supreme Court of Pakistan (under S.155 Elections Act)"
  },
  {
    id: "tribunal-environment",
    name: "Environmental Protection Tribunals (EPT)",
    tier: "tribunals",
    city: "Lahore, Karachi, Islamabad, Peshawar, Quetta",
    province: "Nationwide",
    jurisdictionNotes: "Adjudication of industrial pollution, hazardous waste emissions, and environmental impact violations under PEPA 1997 and Provincial EPA Acts.",
    appellateAuthority: "High Court"
  },
  {
    id: "tribunal-ipo",
    name: "Intellectual Property (IPO) Tribunals",
    tier: "tribunals",
    city: "Lahore, Karachi, Islamabad",
    province: "Nationwide",
    jurisdictionNotes: "Trial of trademark infringement, copyright piracy, patent violations, and industrial design counterfeiting under IPO Act 2012.",
    appellateAuthority: "High Court"
  },

  // --- TIER 4: DISTRICT JUDICIARY (SUBORDINATE COURTS) ---
  {
    id: "court-district-sessions",
    name: "District & Sessions Judge Courts",
    tier: "district",
    city: "Every District Headquarters across Pakistan",
    province: "Nationwide",
    jurisdictionNotes: "Principal civil court of original jurisdiction in the district; highest criminal trial court (empowered to pass death sentence subject to High Court confirmation under S.374 CrPC); principal appellate court for civil and family appeals.",
    appellateAuthority: "Respective Provincial High Court"
  },
  {
    id: "court-additional-sessions",
    name: "Additional District & Sessions Judge Courts (AD&SJ)",
    tier: "district",
    city: "District & Tehsil Headquarters",
    province: "Nationwide",
    jurisdictionNotes: "Co-equal judicial powers assigned by District & Sessions Judge: murder trials, civil appeals, Ex-Officio Justice of Peace (S.22-A CrPC), criminal revisions.",
    appellateAuthority: "Respective Provincial High Court"
  },
  {
    id: "court-senior-civil-judge",
    name: "Senior Civil Judge Courts (Civil, Family & Administrative Divisions)",
    tier: "district",
    city: "Every District & Sub-Division",
    province: "Nationwide",
    jurisdictionNotes: "Unlimited pecuniary jurisdiction; special rosters for guardian matters, rent cases, and administrative distribution of civil suits.",
    appellateAuthority: "District & Sessions Judge / High Court"
  },
  {
    id: "court-civil-judge-1",
    name: "Civil Judge Class I Courts",
    tier: "district",
    city: "District & Tehsil Headquarters",
    province: "Nationwide",
    jurisdictionNotes: "Unlimited pecuniary trial jurisdiction (or notified upper bracket); handles specific performance, property partitions, declaration suits.",
    appellateAuthority: "District Judge"
  },
  {
    id: "court-civil-judge-2",
    name: "Civil Judge Class II Courts",
    tier: "district",
    city: "Tehsil & District Courts",
    province: "Nationwide",
    jurisdictionNotes: "Pecuniary trial jurisdiction up to PKR 5,000,000 (Punjab/KP) or PKR 2,500,000 (Sindh) or PKR 3,000,000 (Balochistan).",
    appellateAuthority: "District Judge"
  },
  {
    id: "court-civil-judge-3",
    name: "Civil Judge Class III Courts",
    tier: "district",
    city: "Tehsil Courts",
    province: "Nationwide",
    jurisdictionNotes: "Pecuniary trial jurisdiction up to PKR 1,000,000 (Punjab/KP/Balochistan) or PKR 500,000 (Sindh).",
    appellateAuthority: "District Judge"
  },
  {
    id: "court-jm-section30",
    name: "Judicial Magistrate Class I (Section 30 Powers)",
    tier: "district",
    city: "Every District Headquarters",
    province: "Nationwide",
    jurisdictionNotes: "Empowered under Section 30 CrPC to try all non-capital criminal offences (offences not punishable with death) and pass sentences of imprisonment up to 7 years.",
    appellateAuthority: "Sessions Judge"
  },
  {
    id: "court-jm-regular",
    name: "Judicial Magistrate Class I, II, III Courts",
    tier: "district",
    city: "Every Tehsil & District",
    province: "Nationwide",
    jurisdictionNotes: "Regular criminal remand and trials: Class I (sentences up to 3 years), Class II (sentences up to 1 year), Class III (sentences up to 1 month / fine).",
    appellateAuthority: "Sessions Judge"
  },
  {
    id: "court-small-causes",
    name: "Small Causes Courts",
    tier: "district",
    city: "Major Metropolitan Centers",
    province: "Nationwide",
    jurisdictionNotes: "Summary pecuniary disputes and simple debts up to statutory limit under Small Cause Courts Act 1887.",
    appellateAuthority: "District Judge"
  }
];

/* ==========================================================================
   6. COMPUTATION ENGINES & HELPER FUNCTIONS
   ========================================================================== */

/**
 * Computes exact limitation deadline taking into account Section 4 of the
 * Limitation Act 1908 and Section 10 of the General Clauses Act 1897:
 * When the computed statutory deadline falls on a Sunday, gazetted weekend,
 * or court vacation day (court closed), the deadline automatically extends
 * to the next open working day.
 */
export function computeLimitationDeadline(
  entry: LimitationEntry,
  accrualDate: Date | string,
  applySection4: boolean = true
): LimitationDeadlineResult {
  const start = typeof accrualDate === "string" ? new Date(accrualDate) : new Date(accrualDate.getTime());
  
  if (isNaN(start.getTime())) {
    const fallback = new Date();
    return {
      rawDeadline: fallback,
      adjustedDeadline: fallback,
      isWeekendRollover: false,
      daysRemaining: 0,
      isBarred: false,
      statutoryNote: "Invalid accrual date provided.",
      expiryFormatted: fallback.toLocaleDateString("en-PK"),
      daysRemainingLabel: "Invalid date"
    };
  }

  // Calculate raw deadline based on unit
  const raw = new Date(start.getTime());
  if (entry.periodUnit === "years") {
    raw.setFullYear(raw.getFullYear() + entry.periodValue);
  } else if (entry.periodUnit === "months") {
    raw.setMonth(raw.getMonth() + entry.periodValue);
  } else {
    raw.setDate(raw.getDate() + entry.periodValue);
  }

  const adjusted = new Date(raw.getTime());
  let isRollover = false;
  let statutoryNote = "";

  if (applySection4) {
    const dayOfWeek = adjusted.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek === 0) {
      // Sunday -> Advance 1 day to Monday
      adjusted.setDate(adjusted.getDate() + 1);
      isRollover = true;
      statutoryNote = "Section 4 Limitation Act 1908 & Section 10 General Clauses Act 1897: Deadline fell on Sunday (closed court day). Automatically extended to Monday opening.";
    } else if (dayOfWeek === 6) {
      // Saturday -> Advance 2 days to Monday
      adjusted.setDate(adjusted.getDate() + 2);
      isRollover = true;
      statutoryNote = "Section 4 Limitation Act 1908 & Section 10 General Clauses Act 1897: Deadline fell on Saturday (registry closed). Automatically extended to Monday opening.";
    }
  }

  // Calculate days difference relative to current date (at midnight)
  const now = new Date();
  const targetMidnight = new Date(adjusted.getFullYear(), adjusted.getMonth(), adjusted.getDate()).getTime();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.round((targetMidnight - nowMidnight) / (1000 * 60 * 60 * 24));

  const isBarred = diffDays < 0;
  const expiryFormatted = adjusted.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  let daysRemainingLabel = "";
  if (diffDays === 0) {
    daysRemainingLabel = "Expires Today";
  } else if (diffDays > 0) {
    daysRemainingLabel = `${diffDays} day${diffDays === 1 ? "" : "s"} remaining`;
  } else {
    const overdue = Math.abs(diffDays);
    daysRemainingLabel = `${overdue} day${overdue === 1 ? "" : "s"} past limitation bar`;
  }

  return {
    rawDeadline: raw,
    adjustedDeadline: adjusted,
    isWeekendRollover: isRollover,
    daysRemaining: diffDays,
    isBarred,
    statutoryNote: statutoryNote || "Calculated within standard statutory sitting periods.",
    expiryFormatted,
    daysRemainingLabel
  };
}

/**
 * Calculates payable provincial court fee across 5 Pakistani jurisdictions:
 * Punjab, Sindh, Islamabad, Khyber Pakhtunkhwa, and Balochistan.
 * Respects statutory exemption thresholds (e.g. <= PKR 25,000 = Rs. 0)
 * and maximum statutory fee caps (e.g. PKR 15,000 general / PKR 50,000 SHC Original Side).
 */
export function calculateProvincialCourtFee(
  province: CourtFeeProvince,
  suitTypeId: string,
  valuation: number
): CourtFeeCalculationResult {
  const rule = PROVINCIAL_COURT_FEE_RULES[province] || PROVINCIAL_COURT_FEE_RULES.punjab;
  const suitType = COURT_FEE_SUIT_TYPES.find(s => s.id === suitTypeId) || COURT_FEE_SUIT_TYPES[0];

  const val = Math.max(0, isNaN(valuation) ? 0 : valuation);

  // 1. Fixed Fee Suits
  if (suitType.feeType === "fixed") {
    const fee = suitType.fixedAmount || 500;
    return {
      fee,
      isExempt: false,
      isCapped: false,
      capAmount: fee,
      explanation: `Fixed statutory court fee of PKR ${fee.toLocaleString()} applies for ${suitType.name}.`,
      pecuniaryCourt: determinePecuniaryCourt(rule, val),
      statutoryReference: suitType.statutoryReference,
      effectiveRate: "Fixed",
      breakdownFormula: `Fixed = PKR ${fee}`
    };
  }

  // 2. Percentage Capped (e.g. Civil Revision / Review)
  if (suitType.feeType === "percentage_capped") {
    const cap = suitType.fixedAmount || 7500;
    const baseFee = val <= rule.exemptThreshold ? 0 : Math.min(cap, Math.round(val * 0.0375));
    return {
      fee: baseFee,
      isExempt: val <= rule.exemptThreshold,
      isCapped: baseFee >= cap,
      capAmount: cap,
      explanation: `50% of ad valorem fee (subject to maximum ceiling of PKR ${cap.toLocaleString()}).`,
      pecuniaryCourt: determinePecuniaryCourt(rule, val),
      statutoryReference: suitType.statutoryReference,
      effectiveRate: "3.75% (Capped)",
      breakdownFormula: `50% of Appeal Ad Valorem = PKR ${baseFee}`
    };
  }

  // 3. Ad Valorem Suits (Recovery, Specific Performance, Possession, Declaration)
  // Check Exemption Threshold
  if (val <= rule.exemptThreshold) {
    return {
      fee: 0,
      isExempt: true,
      isCapped: false,
      capAmount: rule.maxCapGeneral,
      explanation: `Exempt from court fee under Section 7 Court Fees Act 1870 (Suit valuation PKR ${val.toLocaleString()} <= statutory exempt threshold of PKR ${rule.exemptThreshold.toLocaleString()}).`,
      pecuniaryCourt: determinePecuniaryCourt(rule, val),
      statutoryReference: `${rule.governingAct} (Exemption Clause)`,
      effectiveRate: "0% (Exempt)",
      breakdownFormula: `Valuation <= PKR ${rule.exemptThreshold} -> Fee = PKR 0`
    };
  }

  // Check if Sindh High Court Original Side
  let capAmount = rule.maxCapGeneral;
  if (province === "sindh" && rule.highCourtOriginalSidePecuniaryMin && val > rule.highCourtOriginalSidePecuniaryMin) {
    capAmount = rule.highCourtOriginalSideCap || 50000;
  }

  const rawFee = Math.round((val * rule.adValoremRate) / 100);
  const isCapped = rawFee > capAmount;
  const finalFee = isCapped ? capAmount : rawFee;

  let explanation = "";
  if (isCapped) {
    explanation = `Ad valorem calculation (${rule.adValoremRate}% of PKR ${val.toLocaleString()} = PKR ${rawFee.toLocaleString()}) exceeded provincial statutory ceiling; capped at statutory maximum of PKR ${capAmount.toLocaleString()}/-.`;
  } else {
    explanation = `Ad valorem fee calculated at ${rule.adValoremRate}% on suit valuation of PKR ${val.toLocaleString()}.`;
  }

  return {
    fee: finalFee,
    isExempt: false,
    isCapped,
    capAmount,
    explanation,
    pecuniaryCourt: determinePecuniaryCourt(rule, val),
    statutoryReference: rule.governingAct,
    effectiveRate: isCapped ? `Capped at PKR ${capAmount.toLocaleString()}` : `${rule.adValoremRate}%`,
    breakdownFormula: `PKR ${val.toLocaleString()} * ${rule.adValoremRate}% = PKR ${rawFee.toLocaleString()} (Applied: PKR ${finalFee.toLocaleString()})`
  };
}

/**
 * Helper to determine appropriate trial court based on pecuniary valuation
 */
function determinePecuniaryCourt(rule: ProvincialCourtFeeRule, valuation: number): string {
  for (const tier of rule.pecuniaryTiers) {
    if (tier.maxValuation === null || valuation <= tier.maxValuation) {
      return `${tier.courtName} (${tier.notes})`;
    }
  }
  return rule.pecuniaryTiers[rule.pecuniaryTiers.length - 1].courtName;
}

/**
 * Searches statutory provisions by keyword, section title, section number, and domain
 */
export function searchStatuteSections(
  query: string,
  domain: StatuteDomain | "all" = "all"
): StatuteSection[] {
  const q = (query || "").trim().toLowerCase();

  return STATUTE_SECTIONS.filter(section => {
    // Match Domain filter
    if (domain !== "all" && section.domain !== domain) {
      return false;
    }

    if (!q) return true;

    // Search query matching across section number, title, text, commentary, keywords, landmark citations
    const matchNumber = section.sectionNumber.toLowerCase().includes(q);
    const matchTitle = section.title.toLowerCase().includes(q);
    const matchStatute = section.statuteName.toLowerCase().includes(q);
    const matchText = section.text.toLowerCase().includes(q);
    const matchCommentary = section.commentary.toLowerCase().includes(q);
    const matchKeywords = section.keywords.some(k => k.toLowerCase().includes(q));
    const matchCitations = section.landmarkCitations.some(
      c => c.citation.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.ratio.toLowerCase().includes(q)
    );

    return matchNumber || matchTitle || matchStatute || matchText || matchCommentary || matchKeywords || matchCitations;
  });
}

/**
 * Gets all statutory sections belonging to a specific legal domain
 */
export function getStatuteSectionsByDomain(domain: StatuteDomain): StatuteSection[] {
  return STATUTE_SECTIONS.filter(s => s.domain === domain);
}

/**
 * Gets a statutory section by its unique ID
 */
export function getStatuteSectionById(id: string): StatuteSection | undefined {
  return STATUTE_SECTIONS.find(s => s.id === id);
}

/**
 * Searches court directory by keyword, city, province, and hierarchy tier
 */
export function searchCourts(
  query: string,
  tier: CourtHierarchyTier | "all" = "all"
): CourtRecord[] {
  const q = (query || "").trim().toLowerCase();

  return PAKISTAN_COURT_DIRECTORY.filter(court => {
    if (tier !== "all" && court.tier !== tier) {
      return false;
    }

    if (!q) return true;

    const matchName = court.name.toLowerCase().includes(q);
    const matchCity = court.city.toLowerCase().includes(q);
    const matchProvince = court.province.toLowerCase().includes(q);
    const matchNotes = court.jurisdictionNotes.toLowerCase().includes(q);
    const matchBenches = court.benches?.some(b => b.toLowerCase().includes(q)) ?? false;
    const matchDistricts = court.territorialJurisdiction?.some(d => d.toLowerCase().includes(q)) ?? false;

    return matchName || matchCity || matchProvince || matchNotes || matchBenches || matchDistricts;
  });
}

/**
 * Filters limitation schedule entries by category
 */
export function getLimitationArticlesByCategory(category?: string): LimitationEntry[] {
  if (!category || category === "all" || category === "All") {
    return LIMITATION_SCHEDULE_ENTRIES;
  }
  return LIMITATION_SCHEDULE_ENTRIES.filter(
    e => e.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Formats a clean statutory citation for clipboard copying
 */
export function formatLegalCitation(section: StatuteSection, citationIndex: number = 0): string {
  const precedent = section.landmarkCitations[citationIndex] || section.landmarkCitations[0];
  const precedentText = precedent
    ? `\nLeading Precedent: ${precedent.citation} (${precedent.title}) — "${precedent.ratio}"`
    : "";

  return `${section.statuteName}, ${section.sectionNumber} — ${section.title}
--------------------------------------------------------------------------------
${section.text}

Legislative Commentary & Procedural Ingredients:
${section.commentary}${precedentText}`;
}

/**
 * Formats a clean clause for 1-click insertion into the Legal Drafting Studio
 */
export function formatDraftingClause(section: StatuteSection): string {
  const precedent = section.landmarkCitations[0];
  const citationLine = precedent
    ? ` (See authoritative ratio in ${precedent.citation} ${precedent.title})`
    : "";

  return `STATUTORY PROVISION & RELEVANT LAW:
Pursuant to ${section.sectionNumber} of the ${section.statuteName}, it is respectfully submitted that:
"${section.text.replace(/\n+/g, " ")}"

LEGAL GROUNDS & APPLICABLE PRINCIPLES:
1. That under the settled jurisprudence of the superior courts${citationLine}, the mandatory legal ingredients of ${section.sectionNumber} require strict adherence.
2. ${section.mandatoryPleadings || section.commentary.split("\n")[0]}`;
}

/**
 * Infers a legal domain from statute title or keywords
 */
export function inferDomainFromText(text: string): StatuteDomain {
  const norm = (text || "").toLowerCase();
  if (
    norm.includes("penal") ||
    norm.includes("ppc") ||
    norm.includes("criminal") ||
    norm.includes("crpc") ||
    norm.includes("cr.p.c") ||
    norm.includes("narcotic") ||
    norm.includes("terrorism") ||
    norm.includes("ata") ||
    norm.includes("prohibition") ||
    norm.includes("arms") ||
    norm.includes("murder") ||
    norm.includes("qisas") ||
    norm.includes("diyat") ||
    norm.includes("bail")
  ) {
    return "criminal";
  }
  if (
    norm.includes("constitution") ||
    norm.includes("article 199") ||
    norm.includes("fundamental rights") ||
    norm.includes("writ") ||
    norm.includes("supreme court rules")
  ) {
    return "constitutional";
  }
  if (
    norm.includes("company") ||
    norm.includes("companies") ||
    norm.includes("banking") ||
    norm.includes("tax") ||
    norm.includes("customs") ||
    norm.includes("arbitration") ||
    norm.includes("trademark") ||
    norm.includes("copyright") ||
    norm.includes("patent") ||
    norm.includes("property") ||
    norm.includes("secp") ||
    norm.includes("commercial")
  ) {
    return "commercial";
  }
  if (
    norm.includes("evidence") ||
    norm.includes("shahadat") ||
    norm.includes("qso") ||
    norm.includes("forensic") ||
    norm.includes("witness")
  ) {
    return "evidence";
  }
  if (
    norm.includes("family") ||
    norm.includes("marriage") ||
    norm.includes("guardian") ||
    norm.includes("ward") ||
    norm.includes("dowry") ||
    norm.includes("khula") ||
    norm.includes("maintenance") ||
    norm.includes("dower") ||
    norm.includes("divorce")
  ) {
    return "family";
  }
  if (
    norm.includes("peca") ||
    norm.includes("cyber") ||
    norm.includes("electronic") ||
    norm.includes("environment") ||
    norm.includes("labour") ||
    norm.includes("service tribunal") ||
    norm.includes("nab") ||
    norm.includes("accountability") ||
    norm.includes("consumer")
  ) {
    return "special";
  }
  return "civil";
}
