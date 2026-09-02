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
    forum: "High Court of Judicature",
    governingLaw: "Constitution of the Islamic Republic of Pakistan, 1973 (Article 199)",
    description: "Extraordinary constitutional writ challenging illegal administrative orders, demolition notices, or executive excess.",
    tags: ["High Court", "Writ", "Mandamus", "Certiorari", "Fundamental Rights"],
    body: `IN THE HIGH COURT OF JUDICATURE AT LAHORE
(JUDICIAL DEPARTMENT)

Writ Petition No. _________ / 2026

1. Tariq Mahmood s/o Muhammad Bashir,
   CNIC No. 35201-1234567-1,
   Resident of House No. 12, Street 4, Gulberg III, Lahore.
                                                ... PETITIONER

VERSUS

1. Province of Punjab through Chief Secretary,
   Civil Secretariat, Lahore.
2. Director General, Lahore Development Authority (LDA),
   LDA Complex, Johar Town, Lahore.
3. Assistant Director (Town Planning), LDA, Lahore.
                                                ... RESPONDENTS

WRIT PETITION UNDER ARTICLE 199 OF THE CONSTITUTION OF THE ISLAMIC REPUBLIC OF PAKISTAN, 1973

Respectfully Sheweth:

1. That the Petitioner is a law-abiding citizen of Pakistan and the lawful owner in peaceful possession of Commercial Plot No. 45-B, Main Boulevard, Gulberg III, Lahore, purchased vide registered Sale Deed dated 15.03.2018.

2. That on 10.02.2026, Respondent No. 3 arbitrarily and without issuing any show-cause notice or granting an opportunity of hearing, issued Impugned Demolition Notice No. LDA/TP/9876 dated 08.02.2026.

3. That the Impugned Notice is ultra vires, void ab initio, illegal, and contrary to the principles of natural justice guaranteed under Article 10-A of the Constitution on the following:

GROUNDS:
A. That no person shall be condemned unheard. The respondents failed to provide an opportunity of being heard (Audi Alteram Partem), violating Article 10-A.
B. That the petitioner holds approved building plans issued by Respondent No. 2 vide sanction letter dated 12.01.2020.
C. That the impugned action is tainted with mala fide, colorable exercise of power, and arbitrary executive excess.
D. That there is no other alternate, efficacious, or expeditious remedy available under law.

PRAYER:
In view of the above, it is most respectfully prayed that this Honourable Court may graciously be pleased to:
a) Issue an appropriate writ declaring Impugned Notice No. LDA/TP/9876 dated 08.02.2026 illegal, void, and without lawful authority;
b) Restrain Respondents from taking any adverse action or demolishing the Petitioner's property;
c) Grant any other relief deemed just and appropriate.

PETITIONER
Through:
Mian Asim Raza
Advocate High Court
CC No. 45892/LHC`,
  },
  {
    id: "bail_497",
    title: "Post-Arrest Bail Application (Sec. 497 CrPC)",
    category: "Sessions & Criminal",
    forum: "Court of Sessions Judge / High Court",
    governingLaw: "Code of Criminal Procedure, 1898 (Section 497)",
    description: "Post-arrest bail on grounds of further inquiry, delay in FIR, lack of overt role, and completion of investigation.",
    tags: ["Bail", "Section 497", "Criminal", "Sessions Court", "High Court"],
    body: `IN THE COURT OF THE SESSIONS JUDGE, LAHORE

Criminal Misc. (Bail) No. ________ / 2026

Muhammad Usman s/o Abdul Rasheed,
Caste Arain, r/o Mohallah Ghaziabad, Lahore
(Presently confined in Central Jail, Kot Lakhpat, Lahore).
                                                ... APPLICANT / ACCUSED

VERSUS

1. The State
2. Ahmad Raza s/o Ghulam Murtaza, r/o Lahore (Complainant).
                                                ... RESPONDENTS

APPLICATION UNDER SECTION 497 Cr.P.C. FOR GRANT OF POST-ARREST BAIL IN FIR NO. 452/2026 DATED 14.01.2026 U/S 337-A(i), 337-F(i), 148, 149 PPC, POLICE STATION DEFENCE-A, LAHORE.

Respectfully Sheweth:

1. That the Applicant/Accused was arrested by the local police on 20.01.2026 in the above-captioned FIR and has been languishing in judicial custody since then.

2. That the Applicant is innocent and has been falsely implicated due to previous civil litigation over ancestral land.

3. That the Applicant seeks concession of post-arrest bail on the following:

GROUNDS:
a) That there is an unexplained and fatal delay of 48 hours in lodging the FIR, indicating prior consultation and deliberation.
b) That the injury attributed to the applicant falls under bailable provisions and does not fall within the prohibitory clause of Section 497 CrPC.
c) That investigation is complete, the applicant is no longer required for custodial interrogation, and keeping him behind bars would amount to pre-trial punishment.
d) That the case against the applicant requires further inquiry under Section 497(2) CrPC.

PRAYER:
It is respectfully prayed that the applicant may graciously be admitted to post-arrest bail pending trial, subject to furnishing solvent surety bonds.

APPLICANT / ACCUSED
Through Counsel:
Chaudhry Farooq Ahmad
Advocate High Court`,
  },
  {
    id: "bail_498_bba",
    title: "Pre-Arrest Bail / Bail Before Arrest (Sec. 498 CrPC)",
    category: "Sessions & Criminal",
    forum: "High Court / Sessions Court",
    governingLaw: "Code of Criminal Procedure, 1898 (Section 498)",
    description: "Pre-arrest protective bail pleading ulterior motives, harassment, and readiness to join police investigation.",
    tags: ["BBA", "Pre-Arrest Bail", "Section 498", "Mala Fide"],
    body: `IN THE HIGH COURT OF JUDICATURE AT LAHORE

Criminal Misc. No. ________-B / 2026

Bilal Hassan s/o Muhammad Hassan,
CNIC: 35202-7654321-3, r/o Model Town, Lahore.
                                                ... PETITIONER

VERSUS

1. The State
2. Station House Officer (SHO), P.S. Gulberg, Lahore.
                                                ... RESPONDENTS

APPLICATION UNDER SECTION 498 Cr.P.C. FOR AD-INTERIM PRE-ARREST BAIL IN CASE FIR NO. 112/2026 U/S 489-F PPC, P.S. GULBERG, LAHORE.

Respectfully Sheweth:

1. That the Petitioner is a respectable businessman and apprehends his imminent arrest at the hands of Respondent No. 2 at the behest of political rivals.

2. That the impugned cheque was issued merely as security for a supply contract which has since been rescinded.

3. That the Petitioner has never been a previous convict or proclaimed offender and is ready to join investigation.

GROUNDS:
A. That the arrest is motivated by ulterior motive and humiliation.
B. That the ingredients of Section 489-F PPC (dishonestly issuing a cheque towards repayment of loan or fulfilment of an obligation) are completely lacking.
C. That the petitioner is ready to submit solvent surety bonds.

PRAYER:
It is most respectfully prayed that ad-interim pre-arrest bail may kindly be granted to the Petitioner.

PETITIONER
Through Counsel`,
  },
  {
    id: "civil_plaint_injunction",
    title: "Civil Plaint: Declaration & Permanent Injunction",
    category: "Civil Court",
    forum: "Court of Senior Civil Judge",
    governingLaw: "Code of Civil Procedure, 1908 (Order VII Rule 1) & Specific Relief Act, 1877 (s.42, 54)",
    description: "Suit for declaration of lawful title, cancellation of fraudulent registered mutation, and permanent restraint.",
    tags: ["Plaint", "Declaration", "Injunction", "Specific Relief", "Civil"],
    body: `IN THE COURT OF SENIOR CIVIL JUDGE, LAHORE

Civil Suit No. ________ / 2026

Malik Khalid Mahmood s/o Malik Noor Muhammad,
r/o House 89, Cavalry Ground, Lahore Cantt.
                                                ... PLAINTIFF

VERSUS

1. Tariq Jameel s/o Jameel Akhtar, r/o Lahore.
2. Sub-Registrar, Cantt Town, Lahore.
3. Tehsildar / Halqa Patwari, Mouza Mian Mir, Lahore.
                                                ... DEFENDANTS

SUIT FOR DECLARATION, CANCELLATION OF REGISTERED SALE DEED NO. 4589 DATED 04.11.2024, AND PERMANENT INJUNCTION

Respectfully Sheweth:

1. That the Plaintiff is the absolute and lawful owner in possession of agricultural land measuring 16 Kanals situated at Khasra No. 124, Mouza Mian Mir, Lahore.

2. That Defendant No. 1, in active connivance with revenue staff, managed to fabricate a forged General Power of Attorney and executed Impugned Sale Deed No. 4589 without lawful consideration.

3. That the cause of action accrued on 05.01.2026 when Defendant No. 1 threatened to dispossess the Plaintiff.

4. That the valuation of the suit for the purposes of court fee and jurisdiction is fixed at PKR 200/-, and court fee of PKR 10/- is affixed under the Court Fees Act, 1870.

PRAYER:
It is respectfully prayed that a decree for declaration and permanent injunction be passed in favour of Plaintiff against Defendants.

PLAINTIFF
Through Counsel

VERIFICATION:
Verified on oath at Lahore this 22nd day of August, 2026 that contents of paras 1 to 3 are true to my knowledge and para 4 is based on legal advice received.

DEPONENT`,
  },
  {
    id: "stay_order39",
    title: "Application for Temporary Injunction (Order 39 R 1,2)",
    category: "Civil Court",
    forum: "Court of Civil Judge",
    governingLaw: "Code of Civil Procedure, 1908 (Order XXXIX Rules 1 & 2)",
    description: "Interlocutory injunction application satisfying the statutory triple test (prima facie, balance of convenience, irreparable loss).",
    tags: ["Order 39", "Stay Order", "Injunction", "Interim Relief"],
    body: `IN THE COURT OF THE SENIOR CIVIL JUDGE, LAHORE

In Re: Civil Suit No. ________ / 2026
Malik Khalid Mahmood vs Tariq Jameel etc.

APPLICATION UNDER ORDER XXXIX RULES 1 & 2 READ WITH SECTION 151 C.P.C. FOR GRANT OF AD-INTERIM TEMPORARY INJUNCTION

Respectfully Sheweth:

1. That the Applicant has filed the accompanying suit for declaration and permanent injunction, the contents whereof may kindly be treated as part and parcel of this application.

2. That the Applicant has a strong prima facie arguable case with high probability of success.

3. That the balance of convenience lies entirely in favour of the Applicant as he is in physical settled possession of the suit property.

4. That if the ad-interim injunction is not granted, the Applicant will suffer irreparable loss and injury which cannot be compensated in terms of money.

PRAYER:
It is respectfully prayed that the Respondents may be restrained from alienating, selling, transferring, or interfering with Applicant's possession till final disposal of the suit.

APPLICANT
Through Counsel`,
  },
  {
    id: "execution_order21",
    title: "Execution Application for Decree (Order XXI)",
    category: "Civil Court",
    forum: "Court of Senior Civil Judge / Executing Court",
    governingLaw: "Code of Civil Procedure, 1908 (Order XXI Rule 11)",
    description: "Tabular execution petition seeking attachment, auction sale of judgment debtor's assets, and coercive recovery.",
    tags: ["Execution", "Order 21", "Decree", "Recovery"],
    body: `IN THE COURT OF THE SENIOR CIVIL JUDGE (EXECUTING COURT), LAHORE

Execution Petition No. ________ / 2026

Al-Madina Commercial Bank Ltd.
                                                ... DECREE HOLDER

VERSUS

M/s Zenith Industrial Corp. & others
                                                ... JUDGMENT DEBTORS

EXECUTION APPLICATION UNDER ORDER XXI RULE 11(2) OF THE CODE OF CIVIL PROCEDURE, 1908

1. Suit No.: Civil Suit No. 892/2022
2. Name of Parties: Al-Madina Bank vs Zenith Industrial Corp.
3. Date of Decree: 14.11.2025
4. Whether any Appeal preferred: No appeal or stay operating.
5. Amount with Interest: Principal: PKR 14,500,000/- plus costs PKR 150,000/-.
6. Mode of Execution: By attachment and auction sale of movable & immovable properties of Judgment Debtors and arrest & detention in civil prison.

PRAYER:
It is prayed that warrants of attachment and sale of properties of Judgment Debtors be issued forthwith.

DECREE HOLDER
Through Counsel`,
  },
  {
    id: "criminal_misc_22a",
    title: "Application U/S 22-A/22-B CrPC (Ex-Officio Justice of Peace)",
    category: "Sessions & Criminal",
    forum: "Court of Sessions Judge / Ex-Officio Justice of Peace",
    governingLaw: "Code of Criminal Procedure, 1898 (Sections 22-A & 22-B)",
    description: "Application seeking directions to Police SHO for registration of FIR regarding a cognizable offence.",
    tags: ["22-A", "Justice of Peace", "FIR Registration", "CrPC"],
    body: `IN THE COURT OF SESSIONS JUDGE / EX-OFFICIO JUSTICE OF PEACE, LAHORE

Criminal Misc. No. ________ / 2026

Khurram Shehzad s/o Abdul Majeed, r/o Lahore.
                                                ... PETITIONER

VERSUS

1. Ex-Officio Justice of Peace / Sessions Judge, Lahore.
2. Station House Officer (SHO), P.S. Faisal Town, Lahore.
3. Salman Butt s/o Khalid Butt, r/o Lahore.
                                                ... RESPONDENTS

APPLICATION UNDER SECTION 22-A & 22-B Cr.P.C. SEEKING DIRECTIONS TO RESPONDENT NO. 2 FOR REGISTRATION OF CRIMINAL CASE (FIR).

Respectfully Sheweth:

1. That on 01.08.2026, Respondent No. 3 along with four unknown armed accomplices forcibly entered Petitioner's warehouse and snatched PKR 850,000/- at gunpoint.

2. That the Petitioner immediately approached Respondent No. 2 with written complaint, but Respondent No. 2 refused to register the FIR under Section 154 CrPC due to Respondent No. 3's political influence.

PRAYER:
It is respectfully prayed that Respondent No. 2 be directed to record Petitioner's statement and register an FIR under relevant sections of PPC.

PETITIONER
Through Counsel`,
  },
  {
    id: "sessions_crim_appeal",
    title: "Sessions Criminal Appeal (Sec. 408 CrPC)",
    category: "Sessions & Criminal",
    forum: "Court of Sessions Judge",
    governingLaw: "Code of Criminal Procedure, 1898 (Section 408)",
    description: "Appeal challenging conviction and sentence passed by Judicial Magistrate Section 30.",
    tags: ["Criminal Appeal", "Sessions", "Section 408"],
    body: `IN THE COURT OF THE SESSIONS JUDGE, LAHORE

Criminal Appeal No. ________ / 2026

Zahid Hussain s/o Manzoor Hussain
                                                ... APPELLANT

VERSUS

1. The State
2. Complainant
                                                ... RESPONDENTS

CRIMINAL APPEAL UNDER SECTION 408 Cr.P.C. AGAINST JUDGMENT AND ORDER DATED 10.08.2026 PASSED BY JUDICIAL MAGISTRATE SECTION 30, LAHORE.

Respectfully Sheweth:

1. That vide impugned judgment, the Appellant was convicted u/s 379 PPC and sentenced to 2 years rigorous imprisonment.

2. That the impugned conviction is based on misreading and non-reading of evidence, uncorroborated testimony of interested witnesses, and failure of prosecution to prove guilt beyond reasonable doubt.

PRAYER:
It is prayed that the appeal be accepted, impugned judgment set aside, and Appellant acquitted.

APPELLANT
Through Counsel`,
  },
  {
    id: "high_court_appeal_rfa",
    title: "High Court Regular First Appeal (RFA Sec. 96 CPC)",
    category: "High Court",
    forum: "High Court of Judicature",
    governingLaw: "Code of Civil Procedure, 1908 (Section 96 & Order XLI)",
    description: "First appeal on both facts and law against preliminary or final civil decree of Additional District Judge.",
    tags: ["RFA", "High Court", "Section 96", "Civil Appeal"],
    body: `IN THE HIGH COURT OF JUDICATURE AT LAHORE
(APPELLATE SIDE)

R.F.A. No. ________ / 2026

National Logistics Ltd.
                                                ... APPELLANT

VERSUS

Frontier Construction Co.
                                                ... RESPONDENT

REGULAR FIRST APPEAL UNDER SECTION 96 C.P.C. AGAINST JUDGMENT AND DECREE DATED 15.06.2026 PASSED BY LEARNED ADDITIONAL DISTRICT JUDGE, LAHORE.

Respectfully Sheweth:

1. That the learned trial court erred in failing to appreciate documentary evidence placed on record.
2. That the decree passed by the court below is contrary to law and settled precedents.

PRAYER:
That the appeal be allowed, impugned judgment and decree dated 15.06.2026 set aside, and the suit dismissed with costs.

APPELLANT
Through Counsel`,
  },
  {
    id: "supreme_court_cpla",
    title: "Supreme Court Civil Petition for Leave to Appeal (CPLA)",
    category: "Supreme Court",
    forum: "Supreme Court of Pakistan",
    governingLaw: "Constitution of the Islamic Republic of Pakistan (Article 185(3))",
    description: "Apex court petition seeking leave to appeal against final High Court judgment involving questions of law.",
    tags: ["Supreme Court", "CPLA", "Article 185", "Apex Court"],
    body: `IN THE SUPREME COURT OF PAKISTAN
(APPELLATE JURISDICTION)

Civil Petition for Leave to Appeal No. ________ of 2026

Haji Abdul Ghafoor & sons
                                                ... PETITIONER(S)

VERSUS

Government of Pakistan & others
                                                ... RESPONDENT(S)

CIVIL PETITION UNDER ARTICLE 185(3) OF THE CONSTITUTION FOR LEAVE TO APPEAL AGAINST FINAL JUDGMENT DATED 02.05.2026 PASSED BY LAHORE HIGH COURT IN W.P. NO. 4500/2024.

Respectfully Sheweth:
1. That substantial questions of law of public importance arise for determination before this Apex Court.
2. That the High Court misconstrued the statutory provisions of the applicable enactment.

PRAYER:
Leave to appeal may graciously be granted and the operation of the impugned judgment suspended in the interim.

ADVOCATE-ON-RECORD / ASC`,
  },
  {
    id: "family_suit_khula",
    title: "Family Suit for Dissolution of Marriage (Khula) & Dower",
    category: "Family & Personal",
    forum: "Family Court",
    governingLaw: "West Pakistan Family Courts Act, 1964 & Dissolution of Muslim Marriages Act, 1939",
    description: "Suit for Khula on grounds of cruelty, non-maintenance, and recovery of prompt dower and dowry articles.",
    tags: ["Family", "Khula", "Maintenance", "Dower", "Dowry"],
    body: `IN THE FAMILY COURT AT LAHORE

Family Suit No. ________ / 2026

Mst. Sadia Bibi d/o Muhammad Yaqoob,
r/o Model Town, Lahore.
                                                ... PLAINTIFF

VERSUS

Kamran Akram s/o Muhammad Akram,
r/o Faisal Town, Lahore.
                                                ... DEFENDANT

SUIT FOR DISSOLUTION OF MARRIAGE ON BASIS OF KHULA, RECOVERY OF PROMPT DOWER (10 TOLAS GOLD), RECOVERY OF DOWRY ARTICLES, AND PAST/FUTURE MAINTENANCE.

Respectfully Sheweth:

1. That the Nikah of Plaintiff was solemnized with Defendant on 12.11.2021 against prompt dower of 10 tolas gold which remains unpaid.

2. That due to persistent cruelty and neglect, the Plaintiff has developed severe aversion and hatred and cannot live with Defendant within the limits prescribed by Allah Almighty.

PRAYER:
Decree for dissolution of marriage on basis of Khula and recovery of dower/dowry articles.

PLAINTIFF
Through Counsel`,
  },
  {
    id: "guardians_custody_s25",
    title: "Custody Petition U/S 25 Guardians and Wards Act",
    category: "Family & Personal",
    forum: "Court of Guardian Judge",
    governingLaw: "Guardians and Wards Act, 1890 (Section 25)",
    description: "Custody petition for minor children centering upon the statutory welfare of the minor test.",
    tags: ["Guardians", "Custody", "Minor", "Hizanat"],
    body: `IN THE COURT OF GUARDIAN JUDGE, LAHORE

Guardian Petition No. ________ / 2026

Mst. Ayesha Khan
                                                ... PETITIONER

VERSUS

Shahid Mahmood
                                                ... RESPONDENT

PETITION UNDER SECTION 25 OF THE GUARDIANS AND WARDS ACT, 1890 FOR CUSTODY OF MINOR CHILD 'HAMZA' (AGED 5 YEARS).

Respectfully Sheweth:

1. That the minor is in tender age of 5 years and requires maternal affection and care.
2. That welfare of the minor is the paramount consideration under law.

PRAYER:
Permanent custody of the minor be handed over to the Petitioner mother.

PETITIONER`,
  },
  {
    id: "vakalatnama_high_court",
    title: "Standard High Court Vakalatnama",
    category: "Affidavits & Notices",
    forum: "High Court / Civil & Sessions Courts",
    governingLaw: "Legal Practitioners and Bar Councils Act, 1973 & High Court Rules",
    description: "Advocate appointment authorization form with power to plead, act, compromise, and file appeals.",
    tags: ["Vakalatnama", "Power of Attorney", "Counsel Authorisation"],
    body: `IN THE HIGH COURT OF JUDICATURE AT LAHORE

Case Title: _____________________________________________

VAKALATNAMA / ADVOCATE AUTHORISATION

I/We, the undersigned, do hereby appoint:
MIAN ASIM RAZA (Advocate High Court, CC No. 45892/LHC)
CHAMBERS OF AL-WAKEEL LAW ASSOCIATES

to be the advocate(s) for me/us in the above case. I authorize counsel to plead, act, compromise, refer to arbitration, receive deposited monies, file appeals/revisions, and execute all necessary legal instruments.

Dated: 22nd August, 2026

EXECUTANT(S):
Signature/Thumb Impression: ____________________
Name: _________________________________________
CNIC: _________________________________________

ACCEPTED BY:
Mian Asim Raza, Advocate High Court`,
  },
  {
    id: "affidavit_oath_comm",
    title: "Sworn Attested Affidavit (Oath Commissioner)",
    category: "Affidavits & Notices",
    forum: "All Courts & Tribunals",
    governingLaw: "Qanun-e-Shahadat Order, 1984 & Code of Civil Procedure (Order XIX)",
    description: "Standard formal sworn affidavit format with verification and Oath Commissioner attestation block.",
    tags: ["Affidavit", "Oath Commissioner", "Verification", "Sworn Statement"],
    body: `IN THE COURT OF THE SENIOR CIVIL JUDGE, LAHORE

In Re: Malik Khalid vs Tariq Jameel

AFFIDAVIT

I, Malik Khalid Mahmood s/o Malik Noor Muhammad, Muslim, adult, resident of House 89, Cavalry Ground, Lahore Cantt, do hereby solemnly affirm and declare on oath as under:

1. That I am the Plaintiff in the above suit and am fully conversant with the facts of the case.
2. That the contents of the accompanying application may kindly be read as integral part of this affidavit.
3. That whatever is stated above is true and correct to the best of my knowledge, information, and belief, and nothing material has been concealed.

DEPONENT

VERIFICATION:
Verified on solemn affirmation at Lahore on this 22nd day of August, 2026 that the contents of this affidavit are true and correct.

DEPONENT

ATTESTED BY OATH COMMISSIONER`,
  },
  {
    id: "notice_489f_cheque",
    title: "Cheque Dishonour Statutory Demand Notice (489-F PPC)",
    category: "Affidavits & Notices",
    forum: "Pre-Litigation Demand",
    governingLaw: "Pakistan Penal Code (Section 489-F) & Negotiable Instruments Act, 1881",
    description: "15-day statutory payment demand notice before lodging criminal FIR and summary recovery suit.",
    tags: ["489-F PPC", "Cheque Dishonour", "Legal Notice", "Criminal Demand"],
    body: `REGISTERED A.D. / TCS COURIER
LEGAL NOTICE UNDER SECTION 489-F PPC & NEGOTIABLE INSTRUMENTS ACT, 1881

To:
Mr. Tariq Jameel,
Resident of House 14-C, Gulberg II, Lahore.

Under instructions from and on behalf of our client, M/s Al-Noor Traders, Lahore, we hereby serve you with the following Legal Notice:

1. That you issued Cheque No. 98765432 dated 01.08.2026 for PKR 2,500,000/- drawn on Habib Bank Limited in discharge of your admitted commercial debt.

2. That upon presentation, the said cheque was returned dishonoured by the bank on 05.08.2026 with return memo stating "FUNDS INSUFFICIENT".

3. You are hereby called upon to pay the sum of PKR 2,500,000/- within 15 days of this notice, failing which criminal proceedings u/s 489-F PPC and civil suit u/o XXXVII CPC will be initiated against you at your sole cost and consequence.

LEGAL ADVISOR
Advocate High Court`,
  },
  {
    id: "suit_order37_summary",
    title: "Summary Suit for Money Recovery (Order XXXVII CPC)",
    category: "Civil Court",
    forum: "District / High Court Original Side",
    governingLaw: "Code of Civil Procedure, 1908 (Order XXXVII)",
    description: "Fast-track summary recovery suit based on promissory note, bill of exchange, or dishonoured cheque.",
    tags: ["Order 37", "Summary Suit", "Recovery", "Cheque", "Promissory Note"],
    body: `IN THE COURT OF THE DISTRICT JUDGE, LAHORE

Summary Suit No. ________ / 2026

Al-Noor Traders through Sole Proprietor
                                                ... PLAINTIFF

VERSUS

Tariq Jameel
                                                ... DEFENDANT

SUIT UNDER ORDER XXXVII RULES 1 & 2 C.P.C. FOR RECOVERY OF PKR 2,500,000/- BASED ON DISHONOURED CHEQUE ALONG WITH STATUTORY MARK-UP AND COSTS.

Respectfully Sheweth:

1. That Defendant issued Cheque No. 98765432 dated 01.08.2026 for PKR 2,500,000/- which was dishonoured on presentation.
2. That statutory legal notice was duly served on Defendant on 10.08.2026 but Defendant failed to pay.

PRAYER:
Summary decree in sum of PKR 2,500,000/- along with costs and statutory interest/markup.

PLAINTIFF
Through Counsel`,
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

