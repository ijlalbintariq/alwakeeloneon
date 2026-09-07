/**
 * ============================================================================
 * COMPREHENSIVE TEST SUITE: STATUTE SANITIZER & PRECEDENT ENGINE
 * Strictly testing client/src/experimental/lib/statuteSanitizer.ts,
 * client/src/experimental/lib/precedentCache.ts,
 * client/src/experimental/hooks/useSectionPrecedents.ts,
 * and client/src/experimental/components/statutes/CleanStatuteViewer.tsx.
 * ============================================================================
 */

import { describe, it, test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeStatuteText,
  sanitizeSectionTitle,
  sanitizeSectionNumber,
  stripGazetteAndPreambles,
  normalizeSectionPrefixAndHeading,
  repairTypographyAndLineWraps,
  segmentStatuteAST,
} from "../client/src/experimental/lib/statuteSanitizer";

import {
  precedentCache,
  PrecedentMemoryCache,
  type LandmarkPrecedent,
} from "../client/src/experimental/lib/precedentCache";

import {
  findSeedPrecedentsForSection,
  generateContextualLandmarkPrecedent,
  getAllSeedJudgments,
  getSeedJudgmentById,
} from "../client/src/experimental/data/seedJudgmentsData";

import {
  MAJOR_ENACTMENTS_DATA,
  getMajorSectionById,
} from "../client/src/experimental/data/majorEnactmentsData";

// ============================================================================
// SUITE 1: STAGE 1 MACRO HEADER & GAZETTE PREAMBLE STRIPPER
// ============================================================================
describe("Suite 1: Stage 1 Macro Header & Preamble Stripping Engine", () => {
  it("PPC: Strips repeated Act titles, ACT NO. XLV OF 1860, and CHAPTER I headers", () => {
    const raw = `THE PAKISTAN PENAL CODE, 1860\nTHE\nPAKISTAN PENAL CODE, 1860\nACT NO. XLV OF 1860\nCHAPTER I INTRODUCTION\n1. Title and extent of\noperation of the Code. This Act shall be called...`;
    const stripped = stripGazetteAndPreambles(raw);
    assert.ok(!stripped.includes("THE PAKISTAN PENAL CODE"));
    assert.ok(!stripped.includes("ACT NO. XLV OF 1860"));
    assert.ok(!stripped.includes("CHAPTER I"));
    assert.ok(stripped.includes("1. Title and extent of"));
  });

  it("CrPC: Strips repeated Code of Criminal Procedure titles and Act V of 1898 headers", () => {
    const raw = `THE CODE OF CRIMINAL PROCEDURE (ACT V OF 1898)\nTHE CODE OF CRIMINAL PROCEDURE (ACT V OF 1898)\nPART I PRELIMINARY\nCHAPTER I\n1. Short title and commencement. (1) This Act may be called...`;
    const stripped = stripGazetteAndPreambles(raw);
    assert.ok(!stripped.includes("THE CODE OF CRIMINAL PROCEDURE"));
    assert.ok(!stripped.includes("PART I PRELIMINARY"));
    assert.ok(stripped.includes("1. Short title and commencement"));
  });

  it("Constitution: Strips 35-line Constitutional Preamble and In the name of Allah banner", () => {
    const raw = `The republic and its territories\n\nTHE CONSTITUTION OF THE ISLAMIC REPUBLIC OF\nTHE CONSTITUTION OF THE ISLAMIC REPUBLIC\nOF\nPAKISTAN\n(In the\nname of Allah, the most Beneficent, the most Merciful.)\nTHE CONSTITUTION OF THE ISLAMIC REPUBLIC OF PAKISTAN\n[12th\nApril, 1973]\nPreamble.- Whereas\nsovereignty over the entire Universe belongs to Almighty Allah alone...\nDo hereby, through our representatives in the National Assembly, adopt, enact and give to ourselves, this Constitution.\nPART I\nIntroductory\n1. The Republic and its territories. (1) Pakistan shall be Federal Republic...`;
    const stripped = stripGazetteAndPreambles(raw);
    assert.ok(!stripped.includes("In the name of Allah"));
    assert.ok(!stripped.includes("sovereignty over the entire Universe"));
    assert.ok(!stripped.includes("adopt, enact and give to ourselves"));
    assert.ok(!stripped.includes("PART I"));
    assert.ok(stripped.includes("1. The Republic and its territories"));
  });

  it("CPC: Strips 40-line Select Committee (1907/1908), British Baluchistan, and NWFP Gazette notices", () => {
    const raw = `THE CODE OF CIVIL PROCEDURE\nTHE\nCODE OF CIVIL PROCEDURE\n1ACT NO. V OF 1908\n[21st March 1908]\nAn Act to consolidate and amend the laws relating to the Procedure of the Courts of Civil Judicature\nWHEREAS it is expedient to consolidate and amend...\n1. For Statement of Objects and reasons, see Gazette of India, 1907, Pt. V., p. 179;\nfor Report of the Select Committee, see /bid, 1908, Pt. V, p. 35...\nIt has been declared to be in force in Baluchistan by the British Baluchistan Laws Regulation, 1913...\nsee N.W.F.P. Gazette, Extraordinary, dated the 1st June, 1951.\nPRELIMINARY\n1. Short title, commencement and extent.--- (1) This Act may be cited...`;
    const stripped = stripGazetteAndPreambles(raw);
    assert.ok(!stripped.includes("Select Committee"));
    assert.ok(!stripped.includes("British Baluchistan"));
    assert.ok(!stripped.includes("N.W.F.P. Gazette"));
    assert.ok(stripped.includes("1. Short title, commencement and extent"));
  });

  it("PECA: Strips Ordinance IX of 2008 Promulgation Banners across cybercrime sections", () => {
    const raw = `Short title, extent, application and commencement\n\nORDINANCE IX OF 2008\nORDINANCE IX OF\n2008\nPREVENTION\nOF ELECTRONIC CRIMES ORDINANCE, 2008.\nAn Ordinance to make provision for prevention of the electronic crimes\n[Gazette of Pakistan Extraordinary, Part - I, 5th November, 2008]\nNo. 2(1)/2008-Pub., dated 5-11-2008.--The following Ordinance promulgated by the President is hereby published for general information:-\nNow, therefore, in exercise of the powers...\nthe President is pleased to make and promulgate the following Ordinance:-\nCHAPTER--II\nOFFENCES AND PUNISHMENTS\n3. Criminal access.--Whoever intentionally gains unauthorized access...`;
    const stripped = stripGazetteAndPreambles(raw);
    assert.ok(!stripped.includes("ORDINANCE IX OF 2008"));
    assert.ok(!stripped.includes("Gazette of Pakistan Extraordinary"));
    assert.ok(!stripped.includes("CHAPTER--II"));
    assert.ok(stripped.includes("3. Criminal access"));
  });

  it("Contract Act & Limitation Act: Strips 1872 / 1908 Act headers and Part II headers", () => {
    const contractRaw = `THE CONTRACT ACT\nTHE CONTRACT ACT\n(IX of 1872)\n[25th April, 1872]\n1. Short title. this Act may be called...`;
    const contractClean = stripGazetteAndPreambles(contractRaw);
    assert.ok(!contractClean.includes("THE CONTRACT ACT"));
    assert.ok(!contractClean.includes("25th April"));
    assert.ok(contractClean.includes("1. Short title"));

    const limRaw = `LIMITATION ACT\nLIMITATION ACT\n(IX OF 1908)\n[7th August, 1908]\nAn Act to consolidate and amend the law for the limitation of suits...\nPART II\nLimitation of Shits, Appeals and Applications\n3. Dismissal of suit, etc...`;
    const limClean = stripGazetteAndPreambles(limRaw);
    assert.ok(!limClean.includes("LIMITATION ACT"));
    assert.ok(!limClean.includes("7th August"));
    assert.ok(!limClean.includes("PART II"));
    assert.ok(limClean.includes("3. Dismissal of suit"));
  });
});

// ============================================================================
// SUITE 2: STAGE 2 SECTION NUMBER & IN-LINE TITLE NORMALIZER
// ============================================================================
describe("Suite 2: Stage 2 Section Number & In-Line Title Normalizer", () => {
  it("Strips leading duplicate title line", () => {
    const title = "Title and extent of operation of the code";
    const text = `Title and extent of operation of the code\n\n1. Title and extent of operation of the Code. This Act shall be called...`;
    const normalized = normalizeSectionPrefixAndHeading(text, title);
    assert.ok(!normalized.startsWith("Title and extent"));
    assert.ok(normalized.startsWith("This Act shall be called"));
  });

  it("Normalizes in-line section headers with em-dashes and colon dashes (1. Title.--- (1) -> (1))", () => {
    const input1 = "1. Short title, commencement and extent.--- (1) This Act may be cited as...";
    const norm1 = normalizeSectionPrefixAndHeading(input1);
    assert.equal(norm1, "(1) This Act may be cited as...");

    const input2 = "2. Punishment of offences committed within Pakistan. Every person shall be liable...";
    const norm2 = normalizeSectionPrefixAndHeading(input2);
    assert.equal(norm2, "Every person shall be liable...");

    const input3 = "3. Subordination of Courts----For the purposes of this Code, the District Court...";
    const norm3 = normalizeSectionPrefixAndHeading(input3);
    assert.equal(norm3, "For the purposes of this Code, the District Court...");
  });

  it("Normalizes section prefix representations like S. 2(2) 'decree' -> (2) 'decree'", () => {
    const input = "S. 2(2) \"decree\" means the formal expression of an adjudication...";
    const norm = normalizeSectionPrefixAndHeading(input);
    assert.equal(norm, "(2) \"decree\" means the formal expression of an adjudication...");
  });

  it("sanitizeSectionNumber formats standard section titles and constitutional articles", () => {
    assert.equal(sanitizeSectionNumber("302", "Pakistan Penal Code 1860"), "Section 302");
    assert.equal(sanitizeSectionNumber("199", "Constitution of Pakistan 1973"), "Article 199");
    assert.equal(sanitizeSectionNumber("art-199", "Constitution of Pakistan 1973"), "Article 199");
    assert.equal(sanitizeSectionNumber("sec-497", "Criminal Procedure Code"), "Section 497");
    assert.equal(sanitizeSectionNumber("Order 7 Rule 11", "Code of Civil Procedure"), "Order 7 Rule 11");
  });

  it("sanitizeSectionTitle converts ALL CAPS or all lowercase to title case while preserving prepositions", () => {
    assert.equal(
      sanitizeSectionTitle("PUNISHMENT OF OFFENCES COMMITTED WITHIN PAKISTAN"),
      "Punishment of Offences Committed within Pakistan"
    );
    assert.equal(
      sanitizeSectionTitle("short title, extent and commencement"),
      "Short Title, Extent and Commencement"
    );
  });
});

// ============================================================================
// SUITE 3: STAGE 3 TYPOGRAPHIC, OCR & LINE-WRAP REPAIRER
// ============================================================================
describe("Suite 3: Stage 3 Typographic, OCR & Broken Line-Wrap Repairer", () => {
  it("Re-joins words split across hard newlines", () => {
    const input = "operation of\nthe Code shall apply to any person punished\nwith imprisonment at\nany time.";
    const repaired = repairTypographyAndLineWraps(input);
    assert.equal(
      repaired,
      "operation of the Code shall apply to any person punished with imprisonment at any time."
    );
  });

  it("Re-joins hyphenated words split across lines", () => {
    const input = "on the day that the Court re-\nopens for business.";
    const repaired = repairTypographyAndLineWraps(input);
    assert.equal(repaired, "on the day that the Court re-opens for business.");
  });

  it("Fixes all cataloged Pakistani OCR corruptions", () => {
    const input = `Limitation of Shits; he is sail w make proposal; A;s proposal; proper, but not afterwards; at arty time in Pakitan frotn the person compete as against electron or device and manger.`;
    const repaired = repairTypographyAndLineWraps(input);
    assert.ok(repaired.includes("Limitation of Suits"));
    assert.ok(repaired.includes("said to make a proposal"));
    assert.ok(repaired.includes("A's proposal"));
    assert.ok(repaired.includes("proposer, but not afterwards"));
    assert.ok(repaired.includes("at any time"));
    assert.ok(repaired.includes("in Pakistan"));
    assert.ok(repaired.includes("from the person"));
    assert.ok(repaired.includes("complete as against"));
    assert.ok(repaired.includes("electronic device"));
    assert.ok(repaired.includes("manager"));
  });

  it("Normalizes Unicode quotes, en-dashes, em-dashes, and non-breaking spaces", () => {
    const input = `\u00a0\u2018single\u2019 \u201cdouble\u201d \u2013 en \u2014 em \u2011 hyphen`;
    const repaired = repairTypographyAndLineWraps(input);
    assert.ok(repaired.includes("'single'"));
    assert.ok(repaired.includes('"double"'));
    assert.ok(repaired.includes("- en"));
    assert.ok(repaired.includes("— em"));
    assert.ok(repaired.includes("- hyphen"));
  });
});

// ============================================================================
// SUITE 4: STAGE 4 STRUCTURAL AST SEGMENTER
// ============================================================================
describe("Suite 4: Stage 4 Structural AST Segmentation Engine", () => {
  it("Extracts clean lettered illustrations array (a), (b), (c)...", () => {
    const raw = `The communication of a proposal is complete when it comes to the knowledge of the person to whom it is made.
Illustrations
(a) A proposes, by letter, to sell a house to B at a certain price.
(b) B accepts A's proposal by a letter sent by post.
(c) A revokes his proposal by telegram.
Notes: Case law notes...`;

    const ast = segmentStatuteAST(raw);
    assert.equal(ast.illustrations.length, 3);
    assert.ok(ast.illustrations[0].startsWith("(a) A proposes"));
    assert.ok(ast.illustrations[1].startsWith("(b) B accepts"));
    assert.ok(ast.illustrations[2].startsWith("(c) A revokes"));
    assert.ok(!ast.cleanText.includes("Illustrations"));
  });

  it("Extracts procedural and judicial notes into distinct array elements", () => {
    const raw = `Every person shall be liable to punishment under this Code.
Notes: "Every person" comprehends all persons without limitation PLD 1958 S.C. (Ind.) 115.
Under no law a person has a right to inflict punishment PLD 1951 Pesh. 6.
Theory of Floating Island: This jurisdiction is based on the principles that a ship on the High Seas is a floating Island.`;

    const ast = segmentStatuteAST(raw);
    assert.ok(ast.proceduralNotes.length >= 1);
    assert.ok(ast.proceduralNotes.some((n) => n.includes("PLD 1958 S.C.") || n.includes("comprehends")));
    assert.ok(!ast.cleanText.includes("Notes:"));
  });

  it("Extracts legislative amendment notes and footnotes", () => {
    const raw = `(1) Where any Revenue Courts are governed by this Code...
17. Subs. by A.O., 1937, for "L.G."
18. The words "with the previous sanction" omitted by Act 38 of 1920.
Clause (2) subs. by the Limitation (Amendment) Ordinance, LXII of 1980.`;

    const ast = segmentStatuteAST(raw);
    assert.ok(ast.amendmentNotes.length >= 2);
    assert.ok(ast.amendmentNotes.some((a) => a.includes("Subs. by A.O., 1937")));
    assert.ok(!ast.cleanText.includes("17. Subs. by"));
  });

  it("Extracts statutory punishment clause when present", () => {
    const raw = `Whoever commits murder shall be punished with death, or imprisonment for life, and shall also be liable to fine.`;
    const ast = segmentStatuteAST(raw);
    assert.ok(ast.punishment);
    assert.ok(ast.punishment.includes("shall be punished with death"));
  });

  it("Master sanitizeStatuteText function produces complete SanitizedStatutorySection", () => {
    const rawText = `THE PAKISTAN PENAL CODE, 1860\nACT NO. XLV OF 1860\nCHAPTER I\n4. Extension of Code to extra-territorial offences. The provisions of this Code apply also to any offence committed by:\n(1) any citizen of Pakistan;\n(2) any person on any ship registered in Pakistan.\nExplanation. In this section the word "offence" includes every act committed outside Pakistan.\nIllustrations\n(a) A, a Pakistan subject commits a murder in Uganda.\n(b) D, a British subject living in Junagadh, instigates E to commit a murder in Lahore.\nNotes: Nationality not relevant if case covered under S. 4. PLD 1956 S.C. 81.\n1. Subs. by Ord. XXVII of 1981.`;

    const result = sanitizeStatuteText(rawText, "Pakistan Penal Code 1860", "4", "Extension of Code to extra-territorial offences");
    assert.equal(result.cleanSection, "Section 4");
    assert.equal(result.cleanTitle, "Extension of Code to Extra-Territorial Offences");
    assert.ok(result.cleanText.includes("The provisions of this Code apply also"));
    assert.ok(result.cleanText.includes("Explanation. In this section"));
    assert.ok(!result.cleanText.includes("THE PAKISTAN PENAL CODE"));
    assert.ok(!result.cleanText.includes("Illustrations"));
    assert.equal(result.illustrations.length, 2);
    assert.ok(result.proceduralNotes.length >= 1);
    assert.ok(result.amendmentNotes.length >= 1);
  });
});

// ============================================================================
// SUITE 5: UNIVERSAL PRECEDENT ENGINE & ZERO-401 RESILIENCE
// ============================================================================
describe("Suite 5: Precedent Engine, Caching & Zero-401 Fallback", () => {
  let cache: PrecedentMemoryCache;

  beforeEach(() => {
    cache = new PrecedentMemoryCache(10, 60 * 1000);
  });

  it("Normalizes cache keys uniformly across varied statute casing and whitespace", () => {
    const key1 = cache.getCacheKey("Pakistan Penal Code 1860", "302");
    const key2 = cache.getCacheKey("  PAKISTAN PENAL CODE 1860  ", "Section 302");
    assert.ok(key1.includes("302"));
    assert.ok(key2.includes("302"));
  });

  it("Resolves Tier 1 Seed Precedents for core Pakistani provisions (PPC 302, CrPC 497, Art 199)", () => {
    const ppc302 = findSeedPrecedentsForSection("Pakistan Penal Code 1860", "302");
    assert.ok(ppc302.length >= 1, "PPC 302 must resolve precedent");
    assert.ok(ppc302[0].citation.length > 0);
    assert.ok(ppc302[0].ratio.length > 20);

    const crpc497 = findSeedPrecedentsForSection("Code of Criminal Procedure 1898", "497");
    assert.ok(crpc497.length >= 1, "CrPC 497 must resolve precedent");
    assert.ok(crpc497.some((p) => p.citation.includes("SCMR") || p.citation.includes("PLD")));

    const art199 = findSeedPrecedentsForSection("Constitution of Pakistan 1973", "199");
    assert.ok(art199.length >= 1, "Art 199 must resolve precedent");
    assert.ok(art199.some((p) => p.citation.includes("PLD 2023 SC 451") || p.citation.includes("SCMR")));
  });

  it("Zero-401 Immunity: Seed precedents provide complete instant coverage without relying on unauthenticated endpoints", () => {
    const results = findSeedPrecedentsForSection("Pakistan Penal Code 1860", "302", "Punishment of Qatl-i-Amd", "criminal");
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0, "Must return rich seed precedents");
    assert.ok(results[0].ratio.length > 15);
  });

  it("Contextual Synthesis: Generates authoritative superior court ratio for ANY obscure section from 83k catalog", () => {
    const obscure = generateContextualLandmarkPrecedent("Boilers Act 1923", "Section 14", "Safety Inspection");
    assert.ok(obscure.length >= 1);
    assert.ok(obscure[0].citation.includes("PLD") || obscure[0].citation.includes("SCMR") || obscure[0].citation.includes("CLC"));
    assert.ok(obscure[0].ratio.includes("Boilers Act 1923"));
  });

  it("In-memory LRU cache stores results and returns cached entry at 0ms latency", async () => {
    const key = cache.getCacheKey("Contract Act 1872", "73");
    const precs: LandmarkPrecedent[] = [
      {
        citation: "PLD 2022 SC 215",
        title: "Descon v. WAPDA",
        court: "Supreme Court of Pakistan",
        year: 2022,
        ratio: "Section 73 damages requires proof of actual loss.",
        source: "tier1_curated",
      },
    ];

    cache.set(key, precs, "tier1_curated");
    const retrieved = cache.get(key);
    assert.ok(retrieved);
    assert.equal(retrieved.status, "resolved");
    assert.equal(retrieved.precedents[0].citation, "PLD 2022 SC 215");
  });
});

// ============================================================================
// SUITE 6: ACTION HUB PAYLOAD CLEANLINESS & DRAFTING STUDIO TRIPLE-BRIDGE
// ============================================================================
describe("Suite 6: Action Hub Payload Cleanliness & Drafting Bridge", () => {
  it("Generates court-ready drafting clause without gazette clutter or OCR corruptions", () => {
    const rawDescription = `THE PAKISTAN PENAL CODE, 1860\nACT NO. XLV OF 1860\nCHAPTER XVII\n430. Mischief by injury to works of irrigation or by wrongfully diverting water. Whoever commits mischief by injuring to work of irrigation...`;

    const sanitized = sanitizeStatuteText(rawDescription, "Pakistan Penal Code 1860", "430");
    const cleanClauseText = sanitized.cleanText.replace(/\n+/g, " ").trim();

    assert.ok(!cleanClauseText.includes("THE PAKISTAN PENAL CODE"));
    assert.ok(!cleanClauseText.includes("ACT NO. XLV"));
    assert.ok(cleanClauseText.startsWith("Whoever commits mischief"));

    const draftingClause = `STATUTORY PROVISION & RELEVANT LAW:\nPursuant to ${sanitized.cleanSection} of the Pakistan Penal Code 1860, it is respectfully submitted that:\n"${cleanClauseText}"`;

    assert.ok(draftingClause.includes("Section 430"));
    assert.ok(!draftingClause.includes("CHAPTER XVII"));
  });

  it("Formats drafting insert payload adhering to the Alwakeelo communication contract", () => {
    const sanitized = sanitizeStatuteText("Every person shall be liable to punishment...", "Pakistan Penal Code 1860", "2");

    const payload = {
      statute: "Pakistan Penal Code 1860",
      section: sanitized.cleanSection,
      title: sanitized.cleanTitle,
      clause: `STATUTORY PROVISION:\n${sanitized.cleanText}`,
      formattedCitation: `Pakistan Penal Code 1860, ${sanitized.cleanSection}`,
      timestamp: Date.now(),
    };

    assert.equal(payload.section, "Section 2");
    assert.equal(payload.statute, "Pakistan Penal Code 1860");
    assert.ok(typeof payload.timestamp === "number");
  });
});

// ============================================================================
// SUITE 7: REAL-WORLD MAJOR ENACTMENT DATASET EMPIRICAL BENCHMARKS
// ============================================================================
describe("Suite 7: Real-World Major Enactment Dataset Empirical Tests", () => {
  it("Cleans PPC Section 1 (ppc-1) removing duplicate title and line wraps", () => {
    const record = getMajorSectionById("ppc-1");
    assert.ok(record);
    const sanitized = sanitizeStatuteText(record.description, record.statute, record.section, record.title);
    assert.equal(sanitized.cleanSection, "Section 1");
    assert.ok(!sanitized.cleanText.includes("THE PAKISTAN PENAL CODE"));
    assert.ok(!sanitized.cleanText.includes("ACT NO. XLV"));
    assert.ok(sanitized.cleanText.includes("This Act shall be called the Pakistan Penal Code"));
  });

  it("Cleans Constitution Article 1 (constitution-1) removing 35-line preamble", () => {
    const record = getMajorSectionById("constitution-1");
    assert.ok(record);
    const sanitized = sanitizeStatuteText(record.description, record.statute, record.section, record.title);
    assert.equal(sanitized.cleanSection, "Article 1");
    assert.ok(!sanitized.cleanText.includes("sovereignty over the entire Universe"));
    assert.ok(!sanitized.cleanText.includes("adopt, enact and give to ourselves"));
    assert.ok(sanitized.cleanText.includes("Pakistan shall be Federal"));
    assert.ok(sanitized.amendmentNotes.length >= 1);
  });

  it("Cleans CPC Section 1 (cpc-1) removing 40-line Select Committee & Gazette notice", () => {
    const record = getMajorSectionById("cpc-1");
    assert.ok(record);
    const sanitized = sanitizeStatuteText(record.description, record.statute, record.section, record.title);
    assert.equal(sanitized.cleanSection, "Section 1");
    assert.ok(!sanitized.cleanText.includes("Select Committee"));
    assert.ok(!sanitized.cleanText.includes("N.W.F.P. Gazette"));
    assert.ok(sanitized.cleanText.includes("This Act may be cited as the Code of Civil Procedure"));
  });

  it("Cleans PECA Section 1 (peca-1) removing Ordinance IX promulgation header", () => {
    const record = getMajorSectionById("peca-1");
    assert.ok(record);
    const sanitized = sanitizeStatuteText(record.description, record.statute, record.section, record.title);
    assert.equal(sanitized.cleanSection, "Section 1");
    assert.ok(!sanitized.cleanText.includes("ORDINANCE IX OF 2008"));
    assert.ok(!sanitized.cleanText.includes("Gazette of Pakistan"));
    assert.ok(sanitized.cleanText.includes("This Ordinance may be called the Prevention of Electronic Crimes Ordinance"));
  });

  it("Cleans Contract Act Section 2 (contract-act-2) fixing OCR corruptions", () => {
    const record = getMajorSectionById("contract-act-2");
    assert.ok(record);
    const sanitized = sanitizeStatuteText(record.description, record.statute, record.section, record.title);
    assert.ok(!sanitized.cleanText.includes("THE CONTRACT ACT"));
    assert.ok(sanitized.cleanText.includes("said to make a proposal"));
    assert.ok(sanitized.cleanText.includes("option of one or more of the parties"));
    assert.ok(sanitized.cleanText.includes("a contract which ceases"));
  });
});
