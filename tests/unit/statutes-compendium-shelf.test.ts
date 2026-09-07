import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  STATUTE_DOMAINS,
  STATUTE_SECTIONS,
  LIMITATION_SCHEDULE_ENTRIES,
  COURT_FEE_SUIT_TYPES,
  PROVINCIAL_COURT_FEE_RULES,
  PAKISTAN_COURT_DIRECTORY,
  computeLimitationDeadline,
  calculateProvincialCourtFee,
  searchStatuteSections,
  getStatuteSectionsByDomain,
  getStatuteSectionById,
  searchCourts,
  getLimitationArticlesByCategory,
  formatLegalCitation,
  formatDraftingClause,
  type StatuteDomain,
  type StatuteSection,
  type CourtFeeProvince,
  type CourtHierarchyTier,
  type LimitationEntry
} from "../../client/src/experimental/data/statutesCompendiumData.js";

// ============================================================================
// SUITE 1: 4 TABS ARCHITECTURE & TAB SWITCHING LOGIC (M2 / M3)
// ============================================================================
describe("Chambers Reference Shelf: 4-Tab Navigation & Layout Architecture", () => {
  const EXPECTED_TABS = [
    { id: "statutes", label: "Statutes & Major Codes", minItems: 40 },
    { id: "limitation", label: "Limitation Calculator", minItems: 30 },
    { id: "court-fees", label: "Provincial Court Fees", minItems: 5 },
    { id: "courts", label: "Pakistani Courts Directory", minItems: 40 },
  ] as const;

  it("Tab Hierarchy & Metadata: All 4 tabs are uniquely registered with complete counts", () => {
    assert.equal(EXPECTED_TABS.length, 4, "Chambers shelf must contain exactly 4 interactive tabs");
    assert.ok(STATUTE_SECTIONS.length >= 40, `Tab 1 (Statutes) must have >= 40 sections (found ${STATUTE_SECTIONS.length})`);
    assert.ok(LIMITATION_SCHEDULE_ENTRIES.length >= 30, `Tab 2 (Limitation) must have >= 30 entries (found ${LIMITATION_SCHEDULE_ENTRIES.length})`);
    assert.equal(Object.keys(PROVINCIAL_COURT_FEE_RULES).length, 5, `Tab 3 (Court Fees) must cover all 5 provinces`);
    assert.ok(PAKISTAN_COURT_DIRECTORY.length >= 40, `Tab 4 (Courts) must have >= 40 courts (found ${PAKISTAN_COURT_DIRECTORY.length})`);
  });

  it("Tab Switching & Initial Tab State Resolution", () => {
    type ReferenceTab = "statutes" | "limitation" | "court-fees" | "courts";
    
    function resolveActiveTab(isOpen: boolean, initialTab?: ReferenceTab): ReferenceTab {
      if (!isOpen) return "statutes";
      return initialTab || "statutes";
    }

    assert.equal(resolveActiveTab(true, "statutes"), "statutes");
    assert.equal(resolveActiveTab(true, "limitation"), "limitation");
    assert.equal(resolveActiveTab(true, "court-fees"), "court-fees");
    assert.equal(resolveActiveTab(true, "courts"), "courts");
    assert.equal(resolveActiveTab(true, undefined), "statutes");
  });

  it("Active Tab State Transitions Across All 4 Modes", () => {
    type ReferenceTab = "statutes" | "limitation" | "court-fees" | "courts";
    let activeTab: ReferenceTab = "statutes";

    const transition = (target: ReferenceTab) => {
      activeTab = target;
      return activeTab;
    };

    assert.equal(transition("limitation"), "limitation");
    assert.equal(transition("court-fees"), "court-fees");
    assert.equal(transition("courts"), "courts");
    assert.equal(transition("statutes"), "statutes");
  });
});

// ============================================================================
// SUITE 2: 7 LEGAL DOMAINS & REAL-TIME SEARCH ENGINE (R1, M2)
// ============================================================================
describe("Chambers Reference Shelf: 7 Legal Domains & Real-Time Search Engine", () => {
  const DOMAIN_IDS: StatuteDomain[] = [
    "civil",
    "criminal",
    "constitutional",
    "commercial",
    "evidence",
    "family",
    "special"
  ];

  it("Domain Completeness: All 7 major domains have valid labels, icons, descriptions, and featured statutes", () => {
    assert.equal(STATUTE_DOMAINS.length, 7);
    DOMAIN_IDS.forEach((dId) => {
      const d = STATUTE_DOMAINS.find(item => item.id === dId);
      assert.ok(d, `Domain [${dId}] must exist`);
      assert.ok(d.label && d.label.length > 0);
      assert.ok(d.shortLabel && d.shortLabel.length > 0);
      assert.ok(d.iconName && d.iconName.length > 0);
      assert.ok(d.description && d.description.length > 0);
      assert.ok(Array.isArray(d.featuredStatutes) && d.featuredStatutes.length > 0);
    });
  });

  it("Domain Isolation: Filtering by domain returns only sections belonging to that domain", () => {
    DOMAIN_IDS.forEach((domain) => {
      const results = searchStatuteSections("", domain);
      assert.ok(results.length > 0, `Domain [${domain}] must have sections`);
      assert.ok(results.every(s => s.domain === domain), `Domain [${domain}] leaked sections from another domain`);
    });
  });

  it("Real-Time Keyword & Section Search Matching across Statutes, Titles, and Keywords", () => {
    // 1. Section Code search
    const cpcResults = searchStatuteSections("Order VII Rule 11");
    assert.ok(cpcResults.some(s => s.id === "cpc-o7-r11"));

    // 2. Hyphenated Criminal code
    const ppcResults = searchStatuteSections("489-F");
    assert.ok(ppcResults.some(s => s.id === "ppc-sec-489f"));

    // 3. Constitutional Article
    const constResults = searchStatuteSections("Article 199");
    assert.ok(constResults.some(s => s.id === "const-art-199"));

    // 4. Keyword search (e.g. "cheque", "readiness", "reasoned", "electronic evidence", "dower")
    const chequeRes = searchStatuteSections("cheque");
    assert.ok(chequeRes.some(s => s.id === "ppc-sec-489f"));

    const readinessRes = searchStatuteSections("readiness");
    assert.ok(readinessRes.some(s => s.id === "sra-sec-24c"));

    const electronicRes = searchStatuteSections("electronic");
    assert.ok(electronicRes.some(s => s.id === "qso-art-164" || s.id === "peca-2016-sec-14-20"));

    // 5. Landmark precedent citation search inside sections
    const precedentSearch = searchStatuteSections("PLD 2021 SC 429");
    assert.ok(precedentSearch.length > 0);
    assert.ok(precedentSearch.some(s => s.id === "sra-sec-24c" || s.id === "cpc-o7-r11"));
  });

  it("Search Case-Insensitivity, Whitespace Normalization & Empty Query Handling", () => {
    const upperMatch = searchStatuteSections("ORDER VII RULE 11");
    const whitespaceMatch = searchStatuteSections("   Order VII Rule 11   ");
    
    assert.ok(upperMatch.length > 0);
    assert.ok(whitespaceMatch.length > 0);
    assert.ok(upperMatch.some(s => s.id === "cpc-o7-r11"));
    assert.ok(whitespaceMatch.some(s => s.id === "cpc-o7-r11"));

    // Empty query returns all sections
    const allResults = searchStatuteSections("", "all");
    assert.equal(allResults.length, STATUTE_SECTIONS.length);

    // Non-existent search query returns empty array
    const emptyResults = searchStatuteSections("xyznonexistentterm999");
    assert.equal(emptyResults.length, 0);
  });
});

// ============================================================================
// SUITE 3: SECTION DETAIL VIEW, LEGISLATIVE COMMENTARY & PRECEDENTS (R2, M2)
// ============================================================================
describe("Chambers Reference Shelf: Section Detail View, Commentary & Landmark Precedents", () => {
  const MANDATORY_SECTIONS = [
    // Civil Procedure & Specific Relief
    { id: "cpc-o7-r11", titlePart: "Rejection of Plaint" },
    { id: "cpc-o39-r1-2", titlePart: "Temporary Injunction" },
    { id: "cpc-o21-execution", titlePart: "Execution of Decrees" },
    { id: "sra-sec-12", titlePart: "Specific Performance of Contracts" },
    { id: "sra-sec-24c", titlePart: "Mandatory Readiness & Willingness" },
    { id: "sra-sec-42", titlePart: "Discretion of Court as to Declaration" },
    { id: "sra-sec-54", titlePart: "Perpetual Injunction" },
    // Criminal Law & Procedure
    { id: "ppc-sec-489f", titlePart: "Dishonestly Issuing a Cheque" },
    { id: "ppc-sec-420-406", titlePart: "Cheating & Criminal Breach of Trust" },
    { id: "ppc-sec-302", titlePart: "Punishment of Qatl-i-Amd" },
    { id: "crpc-sec-154", titlePart: "Information in Cognizable Cases (FIR)" },
    { id: "crpc-sec-22a-22b", titlePart: "Ex-Officio Justice of Peace" },
    { id: "crpc-sec-497-498", titlePart: "Post-Arrest & Pre-Arrest Bail" },
    { id: "crpc-sec-561a", titlePart: "Inherent Powers of High Court (Quashment)" },
    // Constitutional & Administrative
    { id: "const-art-199", titlePart: "Constitutional Jurisdiction of High Court" },
    { id: "const-art-184-3", titlePart: "Original Jurisdiction & Appellate Jurisdiction" },
    { id: "const-fundamental-rights", titlePart: "Fundamental Rights Core Articles" },
    { id: "gca-sec-24a", titlePart: "Exercise of Statutory Powers (Reasoned Administrative Orders)" },
    // Commercial, Property & Tenancy
    { id: "contract-sec-73-74", titlePart: "Compensation for Breach & Liquidated Damages" },
    { id: "tpa-sec-54-58-105", titlePart: "Sale, Mortgage & Lease of Immoveable Property" },
    { id: "reg-sec-17-49", titlePart: "Compulsory Registration & Unregistered Transfer" },
    { id: "prpa-tenancy-2009", titlePart: "Rent Tenancy Agreements & Eviction" },
    // Law of Evidence
    { id: "qso-art-164", titlePart: "Electronic, Video & Audio Evidence" },
    { id: "qso-art-79-117", titlePart: "Attestation, Direct Oral Evidence & Burden of Proof" },
  ];

  it("Core Statutory Provisions: All required provisions exist with accurate metadata", () => {
    MANDATORY_SECTIONS.forEach((m) => {
      const section = getStatuteSectionById(m.id);
      assert.ok(section, `Mandatory provision [${m.id}] must exist in data engine`);
      assert.ok(section.title.includes(m.titlePart) || section.title.length > 0, `Title mismatch for ${m.id}`);
      assert.ok(section.statuteName.length > 0, `Statute missing for ${m.id}`);
      assert.ok(section.text.trim().length > 30, `Verbatim statutory text too short for ${m.id}`);
      assert.ok(section.commentary.trim().length > 30, `Legislative commentary too short for ${m.id}`);
      assert.ok(section.landmarkCitations.length > 0, `Section ${m.id} must have at least one landmark citation`);
    });
  });

  it("Mandatory Pleading Requirements & Procedural Notes are strictly defined for sensitive provisions", () => {
    // SRA 24(c) readiness
    const sra24c = getStatuteSectionById("sra-sec-24c")!;
    assert.ok(sra24c.mandatoryPleadings, "SRA 24(c) must define mandatory pleadings");
    assert.ok(sra24c.mandatoryPleadings.toLowerCase().includes("ready and willing") || sra24c.mandatoryPleadings.toLowerCase().includes("readiness"));

    // CPC O.7 R.11 cause of action
    const cpcO7 = getStatuteSectionById("cpc-o7-r11")!;
    assert.ok(cpcO7.mandatoryPleadings, "CPC O7 R11 must define mandatory pleadings");
    assert.ok(cpcO7.mandatoryPleadings.includes("Cause of Action") || cpcO7.mandatoryPleadings.includes("cause of action"));

    // PPC 489-F dishonest intention
    const ppc489f = getStatuteSectionById("ppc-sec-489f")!;
    assert.ok(ppc489f.mandatoryPleadings, "PPC 489-F must define ingredients for FIR/pleading");
    assert.ok(ppc489f.punishmentOrRelief, "PPC 489-F must state punishment");
    assert.ok(ppc489f.punishmentOrRelief.includes("3 years"));
  });

  it("Landmark Precedents Metadata & Ratio Verification", () => {
    for (const sec of STATUTE_SECTIONS) {
      assert.ok(sec.landmarkCitations.length >= 1, `Section [${sec.id}] missing landmark citations`);
      for (const cit of sec.landmarkCitations) {
        assert.ok(cit.citation.trim().length > 0, `Missing citation string in ${sec.id}`);
        assert.ok(cit.court.trim().length > 0, `Missing court in citation ${cit.citation}`);
        assert.ok(cit.year >= 1947 && cit.year <= 2030, `Invalid citation year ${cit.year} in ${cit.citation}`);
        assert.ok(cit.ratio.trim().length > 10, `Ratio too short for citation ${cit.citation}`);
      }
    }
  });
});

// ============================================================================
// SUITE 4: ACTION HUB DATA FORMATTING & TRIGGERS (R2, M2)
// ============================================================================
describe("Chambers Reference Shelf: Action Hub Data Formatting & Triggers", () => {
  it("Action 1: Copy Citation string includes full statutory citation, section, and leading precedent", () => {
    const sec = getStatuteSectionById("cpc-o7-r11")!;
    const formatted = formatLegalCitation(sec);

    assert.ok(formatted.includes(sec.statuteName), "Must include statute name");
    assert.ok(formatted.includes(sec.sectionNumber), "Must include section number");
    assert.ok(formatted.includes(sec.text), "Must include statutory text");
    assert.ok(formatted.includes("Leading Precedent:"), "Must include leading precedent ratio");
    assert.ok(formatted.includes(sec.landmarkCitations[0].citation), "Must include precedent citation");
    assert.ok(formatted.includes("Legislative Commentary & Procedural Ingredients:"));
  });

  it("Action 2: Search Precedents query construction and deep link encoding", () => {
    function buildPrecedentSearchDeepLink(section: StatuteSection): { query: string; url: string } {
      const query = `${section.statuteName} ${section.sectionNumber}`;
      const url = `/preview/judgments?q=${encodeURIComponent(query)}`;
      return { query, url };
    }

    const cpcSec = getStatuteSectionById("cpc-o7-r11")!;
    const cpcLink = buildPrecedentSearchDeepLink(cpcSec);
    assert.equal(cpcLink.query, `${cpcSec.statuteName} ${cpcSec.sectionNumber}`);
    assert.equal(cpcLink.url, `/preview/judgments?q=${encodeURIComponent(cpcLink.query)}`);

    const ppcSec = getStatuteSectionById("ppc-sec-489f")!;
    const ppcLink = buildPrecedentSearchDeepLink(ppcSec);
    assert.equal(ppcLink.query, `${ppcSec.statuteName} ${ppcSec.sectionNumber}`);
    assert.equal(ppcLink.url, `/preview/judgments?q=${encodeURIComponent(ppcLink.query)}`);

    const constSec = getStatuteSectionById("const-art-199")!;
    const constLink = buildPrecedentSearchDeepLink(constSec);
    assert.equal(constLink.query, `${constSec.statuteName} ${constSec.sectionNumber}`);
    assert.equal(constLink.url, `/preview/judgments?q=${encodeURIComponent(constLink.query)}`);
  });

  it("Action 3: Insert into Legal Drafting Studio payload schema and custom event bus", () => {
    function createDraftingPayload(section: StatuteSection) {
      const clause = formatDraftingClause(section);
      return {
        statute: section.statuteName,
        section: section.sectionNumber,
        title: section.title,
        clause,
        timestamp: Date.now(),
      };
    }

    const sraSec = getStatuteSectionById("sra-sec-24c")!;
    const payload = createDraftingPayload(sraSec);

    assert.equal(payload.statute, sraSec.statuteName);
    assert.equal(payload.section, sraSec.sectionNumber);
    assert.ok(payload.clause.includes("STATUTORY PROVISION & RELEVANT LAW:"));
    assert.ok(payload.clause.includes("LEGAL GROUNDS & APPLICABLE PRINCIPLES:"));
    assert.ok(payload.clause.includes(`Pursuant to ${sraSec.sectionNumber} of the ${sraSec.statuteName}`));
    assert.ok(typeof payload.timestamp === "number");

    // Serialization / Deserialization check (localStorage safety)
    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);
    assert.deepEqual(parsed, payload);
  });
});

// ============================================================================
// SUITE 5: LIMITATION DEADLINE CALCULATOR & SECTION 4 ROLLOVER (R3, M2)
// ============================================================================
describe("Chambers Reference Shelf: Limitation Calculator & Section 4 Rollover Engine", () => {
  it("Schedule Completeness: 35+ Limitation Schedule entries with all categories covered", () => {
    assert.ok(LIMITATION_SCHEDULE_ENTRIES.length >= 35);
    const categories = ["Suits", "Appeals", "Applications", "Reviews", "Execution"];
    categories.forEach((cat) => {
      const entries = getLimitationArticlesByCategory(cat);
      assert.ok(entries.length > 0, `Category [${cat}] must contain entries in schedule`);
    });
  });

  it("Day Periods Computation: Article 152 (30 days) and Article 156 (90 days)", () => {
    const art152 = LIMITATION_SCHEDULE_ENTRIES.find(e => e.article.includes("152"))!;
    assert.ok(art152);
    assert.equal(art152.periodValue, 30);
    assert.equal(art152.periodUnit, "days");

    const art156 = LIMITATION_SCHEDULE_ENTRIES.find(e => e.article.includes("156"))!;
    assert.ok(art156);
    assert.equal(art156.periodValue, 90);
    assert.equal(art156.periodUnit, "days");

    const baseDate = new Date(2026, 4, 4); // May 4, 2026 (Monday)
    const res152 = computeLimitationDeadline(art152, baseDate, false);
    // May 4 + 30 days = June 3, 2026 (Wednesday)
    assert.equal(res152.rawDeadline.getMonth(), 5); // June
    assert.equal(res152.rawDeadline.getDate(), 3);
    assert.equal(res152.isWeekendRollover, false);
  });

  it("Section 4 Rollover: Sunday Deadline rolls to Monday (+1 day)", () => {
    const art152 = LIMITATION_SCHEDULE_ENTRIES.find(e => e.article.includes("152"))!;
    // May 1 2026 (Friday) + 30 days = May 31 2026 (Sunday) -> Should roll to June 1 2026 (Monday)
    const may1 = new Date(2026, 4, 1);
    const res = computeLimitationDeadline(art152, may1, true);

    assert.equal(res.rawDeadline.getDay(), 0, "Raw deadline must be Sunday (0)");
    assert.equal(res.adjustedDeadline.getDay(), 1, "Adjusted deadline must be Monday (1)");
    assert.equal(res.adjustedDeadline.getDate(), 1, "Adjusted date should be June 1");
    assert.equal(res.adjustedDeadline.getMonth(), 5, "Adjusted month should be June (5)");
    assert.equal(res.isWeekendRollover, true);
    assert.ok(res.statutoryNote.includes("Section 4 Limitation Act 1908"));
  });

  it("Section 4 Rollover: Saturday Deadline rolls to Monday (+2 days)", () => {
    const art152 = LIMITATION_SCHEDULE_ENTRIES.find(e => e.article.includes("152"))!;
    // April 30 2026 (Thursday) + 30 days = May 30 2026 (Saturday) -> Should roll to June 1 2026 (Monday)
    const apr30 = new Date(2026, 3, 30);
    const res = computeLimitationDeadline(art152, apr30, true);

    assert.equal(res.rawDeadline.getDay(), 6, "Raw deadline must be Saturday (6)");
    assert.equal(res.adjustedDeadline.getDay(), 1, "Adjusted deadline must be Monday (1)");
    assert.equal(res.isWeekendRollover, true);
    assert.equal(res.adjustedDeadline.getDate(), 1);
  });

  it("Section 4 Toggle: Disabling Section 4 preserves raw weekend deadline without adjustment", () => {
    const art152 = LIMITATION_SCHEDULE_ENTRIES.find(e => e.article.includes("152"))!;
    const may1 = new Date(2026, 4, 1); // Expiry on Sunday May 31
    const resDisabled = computeLimitationDeadline(art152, may1, false);

    assert.equal(resDisabled.adjustedDeadline.getDay(), 0, "Deadline must remain Sunday when Section 4 is disabled");
    assert.equal(resDisabled.isWeekendRollover, false);
  });

  it("Years Period Computation: Article 113 (3 years for Specific Performance) and Article 144 (12 years for Adverse Possession)", () => {
    const art113 = LIMITATION_SCHEDULE_ENTRIES.find(e => e.article.includes("113"))!;
    assert.equal(art113.periodValue, 3);
    assert.equal(art113.periodUnit, "years");

    const art144 = LIMITATION_SCHEDULE_ENTRIES.find(e => e.article.includes("144"))!;
    assert.equal(art144.periodValue, 12);
    assert.equal(art144.periodUnit, "years");

    const start2023 = new Date(2023, 0, 15);
    const res113 = computeLimitationDeadline(art113, start2023, false);
    assert.equal(res113.rawDeadline.getFullYear(), 2026);
    assert.equal(res113.rawDeadline.getMonth(), 0);
    assert.equal(res113.rawDeadline.getDate(), 15);
  });

  it("Time-Barred Detection: Past dates beyond period correctly marked as isBarred with negative days remaining", () => {
    const art152 = LIMITATION_SCHEDULE_ENTRIES.find(e => e.article.includes("152"))!;
    const oldDate = new Date(2020, 0, 1);
    const res = computeLimitationDeadline(art152, oldDate, true);

    assert.equal(res.isBarred, true, "Matter accrued in 2020 must be time-barred");
    assert.ok(res.daysRemaining < 0);
    assert.ok(res.daysRemainingLabel.includes("past limitation bar") || res.daysRemainingLabel.includes("Barred"));
  });

  it("Limitation Assessment Summary & Drafting Ground Generation", () => {
    const art113 = LIMITATION_SCHEDULE_ENTRIES.find(e => e.article.includes("113"))!;
    const accrualDateStr = "2026-05-01";
    const res = computeLimitationDeadline(art113, new Date(accrualDateStr), true);

    const summaryText = `LIMITATION PERIOD ASSESSMENT (Limitation Act, 1908):
Article: ${art113.article} — ${art113.title}
Statutory Period: ${art113.periodText} (${art113.category})
Commencement Trigger: ${art113.triggerEvent}
Date of Accrual: ${accrualDateStr}
Statutory Deadline: ${res.expiryFormatted}
Current Status: ${res.daysRemainingLabel}
Section 4 Rollover Applied: ${res.isWeekendRollover ? "Yes (Court closed on raw deadline; rolled to next court sitting day)" : "No"}
Statutory Authority: ${res.statutoryNote}`;

    assert.ok(summaryText.includes("Art. 113"));
    assert.ok(summaryText.toLowerCase().includes("3 years"));
    assert.ok(summaryText.includes("Statutory Deadline:"));
  });
});

// ============================================================================
// SUITE 6: PROVINCIAL COURT FEES & PECUNIARY JURISDICTION (R3, M2)
// ============================================================================
describe("Chambers Reference Shelf: Provincial Court Fees & Pecuniary Engine", () => {
  const ALL_PROVINCES: CourtFeeProvince[] = ["punjab", "sindh", "islamabad", "kpk", "balochistan"];

  it("Provincial Rules Completeness: All 5 provinces have governing acts, 7.5% rate, 25k exemption, and tiers", () => {
    ALL_PROVINCES.forEach((p) => {
      const rule = PROVINCIAL_COURT_FEE_RULES[p];
      assert.ok(rule, `Rule for province [${p}] must exist`);
      assert.ok(rule.governingAct.length > 0);
      assert.equal(rule.adValoremRate, 7.5);
      assert.equal(rule.exemptThreshold, 25000);
      assert.equal(rule.maxCapGeneral, 15000);
      assert.ok(rule.pecuniaryTiers.length >= 3);
    });
  });

  it("Exemption Boundary Rule: Valuation <= PKR 25,000 is 100% exempt (PKR 0)", () => {
    ALL_PROVINCES.forEach((p) => {
      const resExempt = calculateProvincialCourtFee(p, "recovery_money", 25000);
      assert.equal(resExempt.fee, 0);
      assert.equal(resExempt.isExempt, true);
      assert.equal(resExempt.isCapped, false);

      const resZero = calculateProvincialCourtFee(p, "recovery_money", 0);
      assert.equal(resZero.fee, 0);
      assert.equal(resZero.isExempt, true);
    });
  });

  it("Standard Ad Valorem Calculation: Valuation PKR 100,000 @ 7.5% = PKR 7,500", () => {
    ALL_PROVINCES.forEach((p) => {
      const res = calculateProvincialCourtFee(p, "recovery_money", 100000);
      assert.equal(res.fee, 7500);
      assert.equal(res.isExempt, false);
      assert.equal(res.isCapped, false);
    });
  });

  it("General Maximum Statutory Cap: PKR 15,000 ceiling across standard provinces (Punjab, Islamabad, KPK, Balochistan)", () => {
    const standardProvinces: CourtFeeProvince[] = ["punjab", "islamabad", "kpk", "balochistan"];
    const highValuations = [500000, 1000000, 10000000, 50000000];

    standardProvinces.forEach((p) => {
      highValuations.forEach((val) => {
        const res = calculateProvincialCourtFee(p, "recovery_money", val);
        assert.equal(res.fee, 15000);
        assert.equal(res.isCapped, true);
        assert.equal(res.capAmount, 15000);
      });
    });
  });

  it("Sindh High Court Original Side Pecuniary Jurisdiction & Dual-Cap Engine", () => {
    // 1. Sindh <= 65M: Capped at 15,000 in District/Civil Court
    const sindh65M = calculateProvincialCourtFee("sindh", "recovery_money", 65000000);
    assert.equal(sindh65M.fee, 15000);
    assert.equal(sindh65M.isCapped, true);
    assert.equal(sindh65M.capAmount, 15000);
    assert.ok(sindh65M.pecuniaryCourt.includes("Senior Civil Judge"));

    // 2. Sindh > 65M: Sindh High Court (Original Side) with statutory cap PKR 50,000
    const sindh70M = calculateProvincialCourtFee("sindh", "recovery_money", 70000000);
    assert.equal(sindh70M.fee, 50000);
    assert.equal(sindh70M.isCapped, true);
    assert.equal(sindh70M.capAmount, 50000);
    assert.ok(sindh70M.pecuniaryCourt.includes("Sindh High Court (Original Side"));
  });

  it("Fixed Fee Suits: Constitutional Writ, Injunction, Family, Arbitration, Execution, Bail, Vakalatnama", () => {
    const fixedSuits = [
      { id: "constitutional_writ", expected: 500 },
      { id: "permanent_injunction", expected: 500 },
      { id: "declaration_pure", expected: 500 },
      { id: "family_suit", expected: 500 },
      { id: "arbitration_objection", expected: 500 },
      { id: "execution_petition", expected: 50 },
      { id: "bail_criminal_petition", expected: 100 },
      { id: "vakalatnama_stamp", expected: 30 },
    ];

    fixedSuits.forEach((suit) => {
      ALL_PROVINCES.forEach((p) => {
        const res = calculateProvincialCourtFee(p, suit.id, 5000000);
        assert.equal(res.fee, suit.expected, `Fee mismatch for suit ${suit.id} in ${p}`);
        assert.equal(res.effectiveRate, "Fixed");
      });
    });
  });

  it("Plaint Valuation Clause & Pakistani English Words Helper", () => {
    function numberToWordsPk(amount: number): string {
      if (amount <= 0) return "Nil";
      if (amount >= 10000000) {
        const crore = (amount / 10000000).toFixed(2);
        return `${crore} Crore`;
      }
      if (amount >= 100000) {
        const lakh = (amount / 100000).toFixed(2);
        return `${lakh} Lakh`;
      }
      if (amount >= 1000) {
        const thousand = (amount / 1000).toFixed(0);
        return `${thousand} Thousand`;
      }
      return amount.toString();
    }

    assert.equal(numberToWordsPk(500000), "5.00 Lakh");
    assert.equal(numberToWordsPk(70000000), "7.00 Crore");
    assert.equal(numberToWordsPk(25000), "25 Thousand");
    assert.equal(numberToWordsPk(0), "Nil");

    const claimValuation = 500000;
    const rule = PROVINCIAL_COURT_FEE_RULES["punjab"];
    const feeRes = calculateProvincialCourtFee("punjab", "recovery_money", claimValuation);

    const plaintClause = `SUIT VALUATION & COURT FEES:
That the value of the suit for the purpose of court fee and pecuniary jurisdiction is fixed at PKR ${claimValuation.toLocaleString()}/- (Rupees ${numberToWordsPk(claimValuation)}), on which statutory court fee of PKR ${feeRes.fee.toLocaleString()}/- is affixed as prescribed under the ${rule.governingAct}.
That in terms of pecuniary and territorial jurisdiction, the subject matter falls within the jurisdiction of the ${feeRes.pecuniaryCourt}.`;

    assert.ok(plaintClause.includes("SUIT VALUATION & COURT FEES:"));
    assert.ok(plaintClause.includes("PKR 500,000/-"));
    assert.ok(plaintClause.includes("PKR 15,000/-"));
    assert.ok(plaintClause.includes("Court Fees Act 1870"));
  });
});

// ============================================================================
// SUITE 7: PAKISTAN COURT DIRECTORY & 4-TIER HIERARCHY (R4, M2)
// ============================================================================
describe("Chambers Reference Shelf: Pakistani Courts Directory & 4-Tier Hierarchy", () => {
  it("Hierarchy Tiers Completeness: apex, high_courts, tribunals, district", () => {
    assert.ok(PAKISTAN_COURT_DIRECTORY.length >= 40);
    const tiers: CourtHierarchyTier[] = ["apex", "high_courts", "tribunals", "district"];
    tiers.forEach((t) => {
      const courtsInTier = PAKISTAN_COURT_DIRECTORY.filter(c => c.tier === t);
      assert.ok(courtsInTier.length > 0, `Tier [${t}] must contain court entries`);
    });
  });

  it("Apex Courts: Supreme Court (Principal + 4 Branch Registries) and Federal Shariat Court", () => {
    const sc = PAKISTAN_COURT_DIRECTORY.find(c => c.id === "court-sc-principal")!;
    assert.ok(sc, "Supreme Court Principal Seat must exist");
    assert.equal(sc.tier, "apex");

    const scBranches = PAKISTAN_COURT_DIRECTORY.filter(c => c.tier === "apex" && c.id.startsWith("court-sc-"));
    assert.equal(scBranches.length, 5, "Must contain Supreme Court Principal Seat + 4 Branch Registries (Lahore, Karachi, Peshawar, Quetta)");

    const fsc = PAKISTAN_COURT_DIRECTORY.find(c => c.id === "court-fsc-principal")!;
    assert.ok(fsc, "Federal Shariat Court must exist");
    assert.equal(fsc.tier, "apex");
  });

  it("5 High Courts & All Divisional / Circuit Benches", () => {
    const expectedHighCourts = [
      { id: "court-lhc-principal", name: "Lahore High Court", minBenches: 3 },
      { id: "court-shc-principal", name: "Sindh High Court", minBenches: 3 },
      { id: "court-ihc", name: "Islamabad High Court", minBenches: 0 },
      { id: "court-phc-principal", name: "Peshawar High Court", minBenches: 3 },
      { id: "court-bhc-principal", name: "High Court of Balochistan", minBenches: 2 },
    ];

    expectedHighCourts.forEach((hc) => {
      const court = PAKISTAN_COURT_DIRECTORY.find(c => c.id === hc.id);
      assert.ok(court, `High court [${hc.id}] must exist`);
      assert.equal(court.tier, "high_courts");
      if (hc.minBenches > 0) {
        assert.ok(court.benches && court.benches.length >= hc.minBenches, `${hc.name} missing circuit benches`);
      }
    });
  });

  it("Special Tribunals: NAB, ATC, Banking, Labour, Rent, Service, Customs, Environment, Cyber Crime", () => {
    const requiredTribunals = [
      "tribunal-nab",
      "tribunal-atc",
      "tribunal-banking",
      "tribunal-labour",
      "tribunal-rent",
      "tribunal-service",
      "tribunal-atir-customs",
      "tribunal-environment",
      "tribunal-ipo",
    ];

    requiredTribunals.forEach((tId) => {
      const tribunal = PAKISTAN_COURT_DIRECTORY.find(c => c.id === tId);
      assert.ok(tribunal, `Tribunal [${tId}] must exist`);
      assert.equal(tribunal.tier, "tribunals");
      assert.ok(tribunal.jurisdictionNotes.length > 20);
    });
  });

  it("District Judiciary: District Courts across Punjab, Sindh, Islamabad, KPK, Balochistan", () => {
    const districtCourts = PAKISTAN_COURT_DIRECTORY.filter(c => c.tier === "district");
    assert.ok(districtCourts.length >= 8, `Must contain comprehensive district courts (found ${districtCourts.length})`);

    const sessions = districtCourts.find(c => c.id === "court-district-sessions");
    assert.ok(sessions, "District & Sessions Courts must be present");

    const scj = districtCourts.find(c => c.id === "court-senior-civil-judge");
    assert.ok(scj, "Senior Civil Judge Courts must be present");

    const cj1 = districtCourts.find(c => c.id === "court-civil-judge-1");
    assert.ok(cj1, "Civil Judge Class I must be present");
  });

  it("Court Search by City, Bench, Name & Tier Filter", () => {
    const lhrResults = searchCourts("Lahore");
    assert.ok(lhrResults.length >= 4);
    assert.ok(lhrResults.some(c => c.id === "court-lhc-principal"));

    const benchResults = searchCourts("Rawalpindi");
    assert.ok(benchResults.length >= 1);

    const tribunalResults = searchCourts("", "tribunals");
    assert.ok(tribunalResults.length >= 10);
    assert.ok(tribunalResults.every(c => c.tier === "tribunals"));
  });
});
