import type { UnifiedJudgmentResult } from "../../client/src/experimental/lib/judgmentApiClient";

// Synthetic compatibility data for the retired seed-catalog tests, never legal authorities or application fallback data.
export interface SeedJudgmentRecord extends UnifiedJudgmentResult {
  id: string;
  journal: string;
  page: number;
  year: number;
  decisionDate: string;
  bench: string;
  headnotes: string;
  fullText: string;
  citationsMade: NonNullable<UnifiedJudgmentResult["citationsMade"]>;
  citationsReceived: NonNullable<UnifiedJudgmentResult["citationsReceived"]>;
  ratioDecidendi: { result: string; legalPrinciples: string[]; keyFindings: string[]; significance: string };
}

const rows = [
  ["pld-2023-sc-451", "PLD 2023 SC 451", "FEDERATION OF PAKISTAN Vs MUHAMMAD AKRAM", "Supreme Court of Pakistan", "constitutional", 2023, "PLD", 451, "Constitution of Pakistan (1973), Arts. 199 & 184(3) — Article 199 judicial review and constitutional writs."],
  ["2024-scmr-892", "2024 SCMR 892", "TARIQ MEHMOOD Vs THE STATE", "Supreme Court of Pakistan", "criminal", 2024, "SCMR", 892, "Section 497(2) CrPC: Bail, further inquiry and tentative assessment of evidence."],
  ["2023-clc-1204", "2023 CLC 1204", "MUHAMMAD RAFIQ Vs ABDUL GHAFOOR", "Lahore High Court", "civil", 2023, "CLC", 1204, "Specific Relief Act, Section 12: specific performance and civil remedies."],
  ["2025-lhc-639", "2025 LHC 639", "BASHIR AHMAD Vs MST. ZUBAIDA", "Lahore High Court", "civil", 2025, "LHC", 639, "Section 115 CPC: civil revision and jurisdiction."],
  ["2021-ylr-880", "2021 YLR 880", "MST. AISHA BIBI Vs TARIQ MEHMOOD", "Sindh High Court", "family", 2021, "YLR", 880, "Guardians and Wards Act: custody and welfare of a minor."],
  ["2022-cld-780", "2022 CLD 780", "MCB BANK LTD Vs INDUS TEXTILES LTD", "Sindh High Court", "corporate", 2022, "CLD", 780, "Financial Institutions (Recovery of Finances) Ordinance: banking recovery."],
  ["2023-ptd-1105", "2023 PTD 1105", "COMMISSIONER INLAND REVENUE Vs NISHAT MILLS LTD", "Lahore High Court", "tax", 2023, "PTD", 1105, "Income Tax Ordinance, Section 122(5A): tax proceedings."],
  ["2021-plc-340", "2021 PLC 340", "PAKISTAN TELECOMMUNICATION CO. LTD Vs MEMBER NIRC", "Islamabad High Court", "labor", 2021, "PLC", 340, "Industrial Relations Act: labor and employment proceedings."],
  ["pld-1955-fc-240", "PLD 1955 FC 240", "FEDERATION OF PAKISTAN Vs MAULVI TAMIZUDDIN KHAN", "Federal Court of Pakistan", "constitutional", 1955, "PLD", 240, "Constitutional proceedings and historical precedent treatment."],
  ["pld-2012-sc-553", "PLD 2012 SC 553", "BAZ MUHAMMAD KAKAR Vs FEDERATION OF PAKISTAN", "Supreme Court of Pakistan", "constitutional", 2012, "PLD", 553, "Constitution of Pakistan (1973): Trichotomy of Powers and Article 63(1)(c)."],
  ["2023-pcrlj-890", "2023 PCrLJ 890", "TEST PETITIONER Vs TEST RESPONDENT", "Peshawar High Court", "criminal", 2023, "PCRLJ", 890, "Synthetic criminal procedure fixture for the Peshawar court filter."],
  ["2022-mld-1450", "2022 MLD 1450", "TEST PETITIONER Vs TEST RESPONDENT", "Balochistan High Court", "civil", 2022, "MLD", 1450, "Synthetic civil procedure fixture for the Balochistan court filter."],
  ["pld-2022-fsc-1", "PLD 2022 FSC 1", "TEST PETITIONER Vs TEST RESPONDENT", "Federal Shariat Court", "constitutional", 2022, "PLD", 1, "Synthetic fixture for the Federal Shariat Court filter."],
] as const;

export const SEED_JUDGMENTS: SeedJudgmentRecord[] = rows.map(([id, citation, title, court, category, year, journal, page, headnotes]) => ({
  id, citation, title, court, category, year, journal, page, headnotes,
  courtCode: court === "Lahore High Court" ? "LHC" : court === "Sindh High Court" ? "SHC" : court === "Islamabad High Court" ? "IHC" : court === "Peshawar High Court" ? "PHC" : court === "Balochistan High Court" ? "BHC" : court === "Federal Shariat Court" ? "FSC" : "SC",
  petitioner: id === "pld-2023-sc-451" ? "Federation of Pakistan through Secretary Cabinet Division" : title.split(" Vs ")[0],
  respondent: id === "pld-2023-sc-451" ? "Muhammad Akram & others" : title.split(" Vs ")[1],
  summary: headnotes,
  source: "test_fixture",
  decisionDate: id === "pld-2023-sc-451" ? "2023-11-14" : `${year}-06-01`,
  bench: "Qazi Faez Isa, CJ & Jamal Khan Mandokhail, J.",
  keywords: [category, headnotes, "Constitution", "Article 199", "Writs", ...(category === "corporate" ? ["Companies Act 2017"] : [])],
  ratioDecidendi: { result: "Synthetic test disposition.", legalPrinciples: [headnotes, "Extraordinary constitutional writ jurisdiction under Article 199"], keyFindings: ["Fixture finding one.", "Fixture finding two.", "Fixture finding three."], significance: "Synthetic text used to exercise formatting and metadata contracts, not a statement of the law." },
  fullText: ["SYNTHETIC TEST FIXTURE — NOT A LEGAL AUTHORITY", title, headnotes, "The fixture exercises judicial review under Article 199 and paragraph extraction.", "The test reader presents the material facts and submissions.", "This paragraph exercises the reasoning anchor in the reader.", "This final paragraph exercises the operative-order anchor."].map((paragraph, index) => `[${index + 1}] ${paragraph}`).join("\n\n"),
  citationsMade: [
    { id: `${id}-out-1`, linkedCitation: "PLD 2018 SC 189", citationText: "PLD 2018 SC 189", linkedTitle: "Justice Khurshid Anwar v. Federation of Pakistan", citationType: "relied_upon" },
    { id: `${id}-out-2`, linkedCitation: "PLD 2012 SC 553", citationText: "PLD 2012 SC 553", linkedTitle: "Synthetic referred precedent", citationType: "referred_to" },
    ...(id === "pld-2012-sc-553" ? [{ id: `${id}-out-3`, linkedCitation: "PLD 1955 FC 240", citationText: "PLD 1955 FC 240", citationType: "overruled" }] : id === "2025-lhc-639" ? [{ id: `${id}-out-3`, linkedCitation: "PLD 2023 SC 451", citationText: "PLD 2023 SC 451", citationType: "referred_to" }] : []),
  ],
  citationsReceived: id === "pld-1955-fc-240" ? [
    { id: `${id}-in-1`, linkedCitation: "PLD 2012 SC 553", citationText: "PLD 2012 SC 553", citationType: "overruled" },
    { id: `${id}-in-2`, linkedCitation: "PLD 2009 SC 879", citationText: "PLD 2009 SC 879", citationType: "disapproved" },
  ] : [{ id: `${id}-in-1`, linkedCitation: "2025 LHC 639", citationText: "2025 LHC 639", citationType: "referred_to" }, ...(id === "pld-2012-sc-553" ? [{ id: `${id}-in-2`, linkedCitation: "PLD 2023 SC 451", citationText: "PLD 2023 SC 451", citationType: "referred_to" }] : [])],
  isOverruled: id === "pld-1955-fc-240",
  overrulingCitation: id === "pld-1955-fc-240" ? "PLD 2012 SC 553 (synthetic treatment link)" : undefined,
}));

export const getAllSeedJudgments = () => [...SEED_JUDGMENTS];
export const getSeedJudgmentById = (id: string) => SEED_JUDGMENTS.find((judgment) => judgment.id === id);
export const findSeedJudgmentByCitation = (year: number, journal: string, page: number) => SEED_JUDGMENTS.find((judgment) => judgment.year === Number(year) && judgment.journal === journal.toUpperCase() && judgment.page === Number(page));

export function searchSeedJudgments(query = "", journal = "All", court = "All Courts", year?: string | number, sort = "relevance"): SeedJudgmentRecord[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const score = (judgment: SeedJudgmentRecord) => words.filter((word) => `${judgment.title} ${judgment.citation} ${judgment.headnotes} ${judgment.keywords}`.toLowerCase().includes(word)).length;
  return SEED_JUDGMENTS.filter((judgment) =>
    (journal === "All" || judgment.journal === journal.toUpperCase()) &&
    (court === "All Courts" || judgment.court.toLowerCase().includes(court.toLowerCase())) &&
    (!year || year === "All Years" || judgment.year === Number(year)) &&
    (!words.length || score(judgment) > 0)
  ).sort((a, b) => sort === "latest" ? b.decisionDate.localeCompare(a.decisionDate) : sort === "most_cited" ? b.citationsReceived.length - a.citationsReceived.length : score(b) - score(a));
}
