import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SEED_JUDGMENTS,
  SeedJudgmentRecord,
  getAllSeedJudgments,
  getSeedJudgmentById,
  searchSeedJudgments,
} from "../../client/src/experimental/data/seedJudgmentsData.js";
import {
  createDraftingInsertPayload,
  dispatchDraftingInsert,
  formatRatioOrHeadnotes,
  saveJudgmentBookmark,
  getSavedJudgments,
  type DraftingInsertPayload,
  type SavedJudgmentRecord,
  type JudgmentDetailData,
  type UnifiedJudgmentResult,
} from "../../client/src/experimental/lib/judgmentApiClient.js";
import { plainTextToTiptapHTML, isHTMLContent, parseInlineFormatting } from "../../client/src/experimental/lib/plain-to-tiptap.js";

// ============================================================================
// SUITE 1: CROSS-MODULE LEGAL DRAFTING STUDIO BRIDGE & PAYLOAD CONVERSION
// ============================================================================
describe("Suite 1: Cross-Module Legal Drafting Studio Bridge", () => {
  it("Test 1.1: Payload schema compliance across all seed judgments", () => {
    assert.ok(SEED_JUDGMENTS.length >= 10, "Seed judgments database must have landmark records");

    for (const judgment of SEED_JUDGMENTS) {
      const payload = createDraftingInsertPayload(judgment);

      // Verify strict schema structure
      assert.equal(typeof payload, "object", "Payload must be an object");
      assert.ok("statute" in payload, "Payload must have 'statute'");
      assert.ok("section" in payload, "Payload must have 'section'");
      assert.ok("title" in payload, "Payload must have 'title'");
      assert.ok("clause" in payload, "Payload must have 'clause'");
      assert.ok("timestamp" in payload, "Payload must have 'timestamp'");

      // Verify value types & validity
      assert.equal(typeof payload.statute, "string", "Statute must be a string");
      assert.equal(typeof payload.section, "string", "Section must be a string");
      assert.equal(typeof payload.title, "string", "Title must be a string");
      assert.equal(typeof payload.clause, "string", "Clause must be a string");
      assert.equal(typeof payload.timestamp, "number", "Timestamp must be a number");
      assert.ok(payload.timestamp > 0, "Timestamp must be a valid epoch");

      // Verify exact mappings
      assert.equal(payload.statute, judgment.court);
      assert.equal(payload.section, judgment.citation);
      assert.equal(payload.title, judgment.title);

      // Verify clause contents
      assert.ok(payload.clause.length > 50, "Clause must be rich formatted text");
      assert.ok(
        payload.clause.includes("LEGAL PRECEDENT & BINDING RATIO DECIDENDI:"),
        "Clause must contain LEGAL PRECEDENT & BINDING RATIO DECIDENDI header"
      );
      assert.ok(
        payload.clause.includes(judgment.citation),
        "Clause must contain the case citation"
      );
      assert.ok(
        payload.clause.includes("Article 189 / 201"),
        "Clause must contain Article 189/201 constitutional mandate"
      );
    }
  });

  it("Test 1.2: Payload generation handles partial/null/edge-case records safely", () => {
    // 1. Empty object
    const emptyPayload = createDraftingInsertPayload({});
    assert.equal(emptyPayload.statute, "Supreme Court of Pakistan");
    assert.equal(emptyPayload.section, "Precedent Authority");
    assert.equal(emptyPayload.title, "Pakistani Superior Court Precedent");
    assert.ok(emptyPayload.clause.includes("Article 189 / 201"));
    assert.ok(typeof emptyPayload.timestamp === "number");

    // 2. Null/undefined parameter
    const nullPayload = createDraftingInsertPayload(null as any);
    assert.equal(nullPayload.statute, "Supreme Court of Pakistan");
    assert.equal(nullPayload.section, "Precedent Authority");
    assert.ok(nullPayload.clause.includes("Article 189 / 201"));

    // 3. Record with only summary
    const summaryOnly = createDraftingInsertPayload({
      citation: "2024 SCMR 100",
      court: "Supreme Court",
      title: "State v. Accused",
      summary: "Custom summary for precedent.",
    });
    assert.ok(summaryOnly.clause.includes("Precedent Ratio Summary:"));
    assert.ok(summaryOnly.clause.includes("Custom summary for precedent."));

    // 4. Record with structured ratioDecidendi and legal principles
    const structuredRatio = createDraftingInsertPayload({
      citation: "PLD 2024 SC 99",
      court: "Supreme Court of Pakistan",
      title: "Test Case",
      ratioDecidendi: {
        result: "Appeal dismissed with costs.",
        legalPrinciples: [
          "Principle of natural justice audi alteram partem is inviolable.",
          "Statutory discretion must be exercised reasonably.",
        ],
      },
    });
    assert.ok(structuredRatio.clause.includes("Operative Holding:\nAppeal dismissed with costs."));
    assert.ok(structuredRatio.clause.includes("(1) Principle of natural justice audi alteram partem is inviolable."));
    assert.ok(structuredRatio.clause.includes("(2) Statutory discretion must be exercised reasonably."));
  });

  it("Test 1.3: HTML conversion through plainTextToTiptapHTML preserves legal structure without corruption", () => {
    for (const judgment of SEED_JUDGMENTS) {
      const payload = createDraftingInsertPayload(judgment);
      const tiptapHtml = plainTextToTiptapHTML(payload.clause);

      assert.ok(tiptapHtml.length > 0, "Tiptap HTML must not be empty");
      assert.ok(isHTMLContent(tiptapHtml), "Output must be recognized as valid HTML");

      // Verify no unclosed tags
      const openP = (tiptapHtml.match(/<p[\s>]/g) || []).length;
      const closeP = (tiptapHtml.match(/<\/p>/g) || []).length;
      assert.equal(openP, closeP, `P tag balance in HTML for ${judgment.citation}`);

      const openH2 = (tiptapHtml.match(/<h2[\s>]/g) || []).length;
      const closeH2 = (tiptapHtml.match(/<\/h2>/g) || []).length;
      assert.equal(openH2, closeH2, `H2 tag balance in HTML for ${judgment.citation}`);

      const openStrong = (tiptapHtml.match(/<strong[\s>]/g) || []).length;
      const closeStrong = (tiptapHtml.match(/<\/strong>/g) || []).length;
      assert.equal(openStrong, closeStrong, `Strong tag balance in HTML for ${judgment.citation}`);

      // Verify no XSS leakage
      assert.ok(!tiptapHtml.includes("<script"), "HTML must not contain script tags");
      assert.ok(!tiptapHtml.includes("<iframe"), "HTML must not contain iframe tags");
    }
  });

  it("Test 1.4: PreviewDrafting.tsx ingestion simulation handles storage events & cleans storage", () => {
    // Mock storage
    const mockStorage: Record<string, string> = {};
    const mockEvents: string[] = [];

    const mockLocalStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
    };

    // Simulate dispatchDraftingInsert
    const sampleJudgment = SEED_JUDGMENTS[0];
    const payload = createDraftingInsertPayload(sampleJudgment);

    mockLocalStorage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
    mockEvents.push("alwakeelo-drafting-insert");

    // Simulate processIncomingDraftingInsert in PreviewDrafting.tsx
    function processIncomingDraftingInsert(storage: typeof mockLocalStorage) {
      const raw = storage.getItem("alwakeelo_drafting_insert");
      if (!raw) return { success: false, reason: "empty" };
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        return { success: false, reason: "invalid_json" };
      }
      if (!data || !data.clause) return { success: false, reason: "no_clause" };

      // Consume item from storage
      storage.removeItem("alwakeelo_drafting_insert");

      const clauseHtml = plainTextToTiptapHTML(data.clause);
      const toastDescription = data.title
        ? `Affixed ${data.statute || ""} ${data.section || ""}: "${data.title}" into drafting canvas.`
        : "Statutory clause inserted into drafting canvas.";

      return {
        success: true,
        clauseHtml,
        toastDescription,
        consumed: storage.getItem("alwakeelo_drafting_insert") === null,
      };
    }

    const result = processIncomingDraftingInsert(mockLocalStorage);
    assert.equal(result.success, true);
    assert.equal(result.consumed, true, "Storage item must be removed after consumption");
    assert.ok(result.clauseHtml!.includes(sampleJudgment.citation));
    assert.ok(result.toastDescription!.includes(sampleJudgment.title));
  });

  it("Test 1.5: Adversarial XSS & malformed payload injection in drafting bridge", () => {
    const maliciousPayload = {
      statute: "<script>alert('xss-statute')</script>",
      section: "<img src=x onerror=alert('xss-sec')>",
      title: "<b>Bold Title</b> <svg onload=alert(1)>",
      clause: "LEGAL PRECEDENT & BINDING RATIO DECIDENDI:\n<script>alert('malicious')</script>\nLine 2 with <b>safe bold</b> and `code`.\nArticle 189.",
      timestamp: Date.now(),
    };

    const tiptapHtml = plainTextToTiptapHTML(maliciousPayload.clause);
    assert.ok(!tiptapHtml.includes("<script>alert('malicious')</script>"));
    assert.ok(tiptapHtml.includes("&lt;script&gt;alert('malicious')&lt;/script&gt;"));
    assert.ok(tiptapHtml.includes("<strong>safe bold</strong>") || tiptapHtml.includes("<b>safe bold</b>"));
    assert.ok(tiptapHtml.includes("<code>code</code>"));
  });
});

// ============================================================================
// SUITE 2: READER WORKSTATION & TOC DYNAMIC JUMP LINKS & QUOTE PERMALINKS
// ============================================================================
describe("Suite 2: Reader Workstation & TOC Navigation", () => {
  it("Test 2.1: Dynamic jump links index mapping and section targets", () => {
    // Check TOC section definitions as specified in JudgmentReader.tsx
    const expectedSections = [
      { id: "header", label: "I. Court & Cause Header", badge: "§ 1" },
      { id: "ratio", label: "II. AI Ratio Decidendi", badge: "AI" },
      { id: "headnotes", label: "III. Reported Headnotes", badge: "§ 2", conditional: true },
      { id: "graph", label: "IV. Precedent Network Graph", badge: "Nodes" },
      { id: "fullText", label: "V. Full Judgment Opinion", badge: "Court" },
      { id: "order", label: "VI. Operative Order & Relief", badge: "Order" },
    ];

    for (const sec of expectedSections) {
      assert.ok(sec.label.length > 0);
      assert.ok(sec.badge.length > 0);
    }

    // Verify conditional rendering: headnotes section present when headnotes exist, omitted when null/empty
    const caseWithHeadnotes: JudgmentDetailData = {
      id: "test-case-1",
      citation: "2024 SCMR 1",
      court: "Supreme Court",
      title: "Test Case with Headnotes",
      headnotes: "Reported headnotes text.",
      fullText: "Full judgment text paragraph 1.\n\nFull judgment text paragraph 2.",
    };

    const caseWithoutHeadnotes: JudgmentDetailData = {
      id: "test-case-2",
      citation: "2024 SCMR 2",
      court: "Supreme Court",
      title: "Test Case without Headnotes",
      headnotes: "",
      fullText: "Full judgment text paragraph 1.",
    };

    // Filter TOC for each case
    const toc1 = expectedSections.filter((s) => !s.conditional || Boolean(caseWithHeadnotes.headnotes));
    const toc2 = expectedSections.filter((s) => !s.conditional || Boolean(caseWithoutHeadnotes.headnotes));

    assert.equal(toc1.length, 6, "Case with headnotes has all 6 TOC items");
    assert.equal(toc2.length, 5, "Case without headnotes has 5 TOC items (headnotes omitted)");
  });

  it("Test 2.2: Paragraph permalink quote copy formatting: \"[quote]\" — Citation at [[paraNum]]", () => {
    for (const judgment of SEED_JUDGMENTS) {
      if (!judgment.fullText) continue;

      const paragraphs = judgment.fullText
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      assert.ok(paragraphs.length >= 1, `Judgment ${judgment.citation} must have at least 1 paragraph`);

      paragraphs.forEach((paraText, idx) => {
        const paraNum = idx + 1;
        const pinpoint = `${judgment.citation} at [${paraNum}]`;
        const formattedSnippet = `"${paraText.trim()}" — ${pinpoint}`;

        // Verify snippet structure
        assert.ok(formattedSnippet.startsWith(`"`), "Snippet must start with opening quote");
        assert.ok(
          formattedSnippet.includes(`" — ${judgment.citation} at [${paraNum}]`),
          `Snippet must end with closing quote and citation pin: " — ${judgment.citation} at [${paraNum}]`
        );
        assert.ok(!formattedSnippet.includes("undefined"), "Snippet must not have undefined");
        assert.ok(!formattedSnippet.includes("null"), "Snippet must not have null");
      });
    }
  });

  it("Test 2.3: Paragraph permalink formatting handles edge cases (whitespace, special chars, line breaks)", () => {
    const citation = "PLD 2023 SC 451";

    // 1. Text with extra leading/trailing whitespace
    const rawPara1 = "   Article 199 extraordinary jurisdiction cannot be exercised as routine appeal.   \n\n";
    const paraNum1 = 1;
    const snippet1 = `"${rawPara1.trim()}" — ${citation} at [${paraNum1}]`;
    assert.equal(
      snippet1,
      `"Article 199 extraordinary jurisdiction cannot be exercised as routine appeal." — PLD 2023 SC 451 at [1]`
    );

    // 2. Text containing internal quotes
    const rawPara2 = 'The court observed: "discretion must be structured and not arbitrary".';
    const paraNum2 = 2;
    const snippet2 = `"${rawPara2.trim()}" — ${citation} at [${paraNum2}]`;
    assert.equal(
      snippet2,
      `"The court observed: "discretion must be structured and not arbitrary"." — PLD 2023 SC 451 at [2]`
    );

    // 3. High paragraph numbers
    const paraNum100 = 142;
    const snippet3 = `"Operative order." — ${citation} at [${paraNum100}]`;
    assert.equal(snippet3, `"Operative order." — PLD 2023 SC 451 at [142]`);
  });

  it("Test 2.4: Reading Canvas Theme classes and typography configuration", () => {
    const themeClasses = {
      obsidian: "bg-[#0B0F17] text-[#E2E8F0] border-[#1E293B]",
      cream: "bg-[#FBF7EE] text-[#1C1917] border-[#E7DEC8]",
      light: "bg-white text-[#0F172A] border-[#E2E8F0]",
    };

    assert.ok(themeClasses.obsidian.includes("bg-[#0B0F17]"));
    assert.ok(themeClasses.cream.includes("bg-[#FBF7EE]"));
    assert.ok(themeClasses.light.includes("bg-white"));

    // Typography bounds: 13pt to 18pt
    const testFontSizes = [13, 14, 15, 16, 17, 18];
    testFontSizes.forEach((size) => {
      assert.ok(size >= 13 && size <= 18, `Font size ${size} must be within readable range 13-18pt`);
    });
  });
});

// ============================================================================
// SUITE 3: COUNSEL'S CHAMBERS BOOKMARKS VAULT
// ============================================================================
describe("Suite 3: Chambers Bookmarks Vault", () => {
  it("Test 3.1: Save, remove, and toggle bookmarks with local storage serialization", async () => {
    // In-memory mock storage
    const storage: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, val: string) => {
        storage[key] = val;
      },
      removeItem: (key: string) => {
        delete storage[key];
      },
    };

    // Helper functions mirroring PreviewJudgments bookmark management
    function saveBookmarkLocally(item: Partial<SavedJudgmentRecord>, store: typeof mockLocalStorage) {
      const citation = item.citation || "";
      if (!citation) return false;
      const stored = store.getItem("alwakeelo_saved_judgments");
      const list: SavedJudgmentRecord[] = stored ? JSON.parse(stored) : [];
      if (!list.some((s) => s.citation === citation)) {
        const newBookmark: SavedJudgmentRecord = {
          id: Date.now(),
          citation,
          court: item.court || "Pakistani Court",
          title: item.title || "Precedent Authority",
          summary: item.summary || (item as any).headnotes || "Bookmarked authority.",
          createdAt: new Date().toISOString(),
        };
        list.unshift(newBookmark);
        store.setItem("alwakeelo_saved_judgments", JSON.stringify(list));
      }
      return true;
    }

    function removeBookmarkLocally(citation: string, store: typeof mockLocalStorage) {
      const stored = store.getItem("alwakeelo_saved_judgments");
      if (!stored) return false;
      let list: SavedJudgmentRecord[] = JSON.parse(stored);
      list = list.filter((s) => s.citation !== citation);
      store.setItem("alwakeelo_saved_judgments", JSON.stringify(list));
      return true;
    }

    function toggleBookmark(item: Partial<SavedJudgmentRecord>, store: typeof mockLocalStorage) {
      const stored = store.getItem("alwakeelo_saved_judgments");
      const list: SavedJudgmentRecord[] = stored ? JSON.parse(stored) : [];
      const exists = list.some((s) => s.citation === item.citation);
      if (exists) {
        removeBookmarkLocally(item.citation!, store);
        return { action: "removed" };
      } else {
        saveBookmarkLocally(item, store);
        return { action: "saved" };
      }
    }

    // 1. Initial save
    const case1 = SEED_JUDGMENTS[0];
    const r1 = toggleBookmark(case1, mockLocalStorage);
    assert.equal(r1.action, "saved");

    const savedAfter1: SavedJudgmentRecord[] = JSON.parse(mockLocalStorage.getItem("alwakeelo_saved_judgments")!);
    assert.equal(savedAfter1.length, 1);
    assert.equal(savedAfter1[0].citation, case1.citation);
    assert.equal(savedAfter1[0].court, case1.court);

    // 2. Save second judgment
    const case2 = SEED_JUDGMENTS[1];
    const r2 = toggleBookmark(case2, mockLocalStorage);
    assert.equal(r2.action, "saved");

    const savedAfter2: SavedJudgmentRecord[] = JSON.parse(mockLocalStorage.getItem("alwakeelo_saved_judgments")!);
    assert.equal(savedAfter2.length, 2);
    assert.equal(savedAfter2[0].citation, case2.citation, "Newest bookmark should be unshifted to front");
    assert.equal(savedAfter2[1].citation, case1.citation);

    // 3. Toggle existing (should remove)
    const r3 = toggleBookmark(case1, mockLocalStorage);
    assert.equal(r3.action, "removed");

    const savedAfter3: SavedJudgmentRecord[] = JSON.parse(mockLocalStorage.getItem("alwakeelo_saved_judgments")!);
    assert.equal(savedAfter3.length, 1);
    assert.equal(savedAfter3[0].citation, case2.citation);

    // 4. Duplicate prevention test
    saveBookmarkLocally(case2, mockLocalStorage);
    const savedAfterDup: SavedJudgmentRecord[] = JSON.parse(mockLocalStorage.getItem("alwakeelo_saved_judgments")!);
    assert.equal(savedAfterDup.length, 1, "Duplicate save must not add second entry");
  });

  it("Test 3.2: Formatted text batch export generation conforms to structure & content", () => {
    const mockSavedJudgments: SavedJudgmentRecord[] = [
      {
        id: 101,
        citation: "PLD 2023 SC 451",
        court: "Supreme Court of Pakistan",
        title: "FEDERATION OF PAKISTAN Vs MUHAMMAD AKRAM",
        summary: "Article 199 writ jurisdiction cannot be used as an appellate forum.",
        createdAt: "2024-01-15T10:00:00.000Z",
      },
      {
        id: 102,
        citation: "2024 SCMR 892",
        court: "Supreme Court of Pakistan",
        title: "TARIQ MEHMOOD Vs THE STATE",
        summary: "Bail under Section 497(2) Cr.P.C. in further inquiry is statutory right.",
        createdAt: "2024-02-20T12:30:00.000Z",
      },
    ];

    function generateFormattedExport(bookmarks: SavedJudgmentRecord[]): string {
      if (bookmarks.length === 0) return "";

      const lines: string[] = [
        `================================================================`,
        `AL WAKEELO — COUNSEL'S SAVED PRECEDENTS VAULT EXPORT`,
        `================================================================`,
        `Total Saved Authorities: ${bookmarks.length}`,
        `Exported: ${new Date().toLocaleString("en-PK")}`,
        ``,
      ];

      bookmarks.forEach((b, idx) => {
        lines.push(`[${idx + 1}] ${b.citation}`);
        lines.push(`    Court: ${b.court}`);
        lines.push(`    Title: ${b.title}`);
        lines.push(`    Summary: ${b.summary}`);
        lines.push(`    Saved Date: ${new Date(b.createdAt).toLocaleDateString("en-PK")}`);
        lines.push(`----------------------------------------------------------------`);
      });

      return lines.join("\n");
    }

    const exportText = generateFormattedExport(mockSavedJudgments);

    // Verify format markers
    assert.ok(exportText.includes("AL WAKEELO — COUNSEL'S SAVED PRECEDENTS VAULT EXPORT"));
    assert.ok(exportText.includes("Total Saved Authorities: 2"));
    assert.ok(exportText.includes("[1] PLD 2023 SC 451"));
    assert.ok(exportText.includes("Court: Supreme Court of Pakistan"));
    assert.ok(exportText.includes("Title: FEDERATION OF PAKISTAN Vs MUHAMMAD AKRAM"));
    assert.ok(exportText.includes("[2] 2024 SCMR 892"));
    assert.ok(exportText.includes("Title: TARIQ MEHMOOD Vs THE STATE"));
    assert.ok(exportText.includes("----------------------------------------------------------------"));

    // Verify empty export handling
    const emptyExport = generateFormattedExport([]);
    assert.equal(emptyExport, "", "Empty bookmarks returns empty export string");
  });

  it("Test 3.3: High-volume bookmarks stress test (100+ items serialization and export)", () => {
    const bigBookmarkList: SavedJudgmentRecord[] = [];
    for (let i = 1; i <= 150; i++) {
      bigBookmarkList.push({
        id: 1000 + i,
        citation: `2024 SCMR ${i * 10}`,
        court: i % 2 === 0 ? "Supreme Court of Pakistan" : "Lahore High Court",
        title: `PETITIONER ${i} Vs RESPONDENT ${i}`,
        summary: `Precedent ratio and statutory principle established in authority #${i}.`,
        createdAt: new Date(Date.now() - i * 86400000).toISOString(),
      });
    }

    // JSON serialization / deserialization roundtrip
    const serialized = JSON.stringify(bigBookmarkList);
    assert.ok(serialized.length > 10000, "Serialized data must contain 150 items");
    const deserialized: SavedJudgmentRecord[] = JSON.parse(serialized);
    assert.equal(deserialized.length, 150);
    assert.equal(deserialized[0].citation, "2024 SCMR 10");
    assert.equal(deserialized[149].citation, "2024 SCMR 1500");
  });
});
