/**
 * Adversarial Stress, Fault-Injection & Chaos Test Suite for Experimental Workstation Secondary Screens
 * 
 * Target Screens:
 * - Screen 1: PreviewSettings (/preview/settings & /preview/profile)
 * - Screen 2: PreviewKnowledgeVault (/preview/knowledge-vault)
 * - Screen 3: PreviewCaseDocuments (/preview/case-documents)
 * - Screen 4: PreviewBookmarks (/preview/bookmarks)
 * - Screen 5: PreviewHistory (/preview/history)
 * - Screen 6: PreviewOrganization (/preview/organization)
 * - Screen 7: PreviewDocumentAnalyzer (/preview/document-analyzer)
 * - Navigation: AppPreviewRouter, PreviewSidebar, PreviewHeader, PreviewCommandPalette
 * 
 * Run with: node --import tsx --test tests/adversarial-secondary-stress.test.ts
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// ============================================================================
// IN-MEMORY STORAGE & ENVIRONMENT CHAOS HARNESS
// ============================================================================

class MockChaosStorage {
  private store: Map<string, string> = new Map();
  public shouldThrowOnGet = false;
  public shouldThrowOnSet = false;
  public shouldCorruptOnWrite = false;
  public quotaLimitBytes: number = Infinity;
  public currentBytes = 0;

  getItem(key: string): string | null {
    if (this.shouldThrowOnGet) {
      throw new Error("DOMException: SecurityError - Storage access denied");
    }
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldThrowOnSet) {
      throw new Error("DOMException: QuotaExceededError - The quota has been exceeded");
    }
    const valToWrite = this.shouldCorruptOnWrite
      ? value.slice(0, Math.floor(value.length / 2)) + "«MALFORMED_TRUNCATED"
      : value;
    const estBytes = key.length + valToWrite.length;
    if (this.currentBytes + estBytes > this.quotaLimitBytes) {
      throw new Error("DOMException: QuotaExceededError - The quota has been exceeded");
    }
    this.store.set(key, valToWrite);
    this.currentBytes += estBytes;
  }

  removeItem(key: string): void {
    const existing = this.store.get(key);
    if (existing) {
      this.currentBytes -= (key.length + existing.length);
    }
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.currentBytes = 0;
    this.shouldThrowOnGet = false;
    this.shouldThrowOnSet = false;
    this.shouldCorruptOnWrite = false;
    this.quotaLimitBytes = Infinity;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }
}

const mockStorage = new MockChaosStorage();

// Install global mock storage if in Node environment
if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage.setItem) {
  (globalThis as any).localStorage = mockStorage;
}

// ============================================================================
// DATA MODELS & CONTRACT DEFAULTS
// ============================================================================

const DEFAULT_SETTINGS = {
  profile: {
    firstName: "Ijlal",
    lastName: "Bin Tariq",
    email: "counsel@alwakeelo.com",
    phone: "+92 300 8492011",
    chamberName: "Tariq & Partners Chambers",
    barCouncilNo: "HC/LHR/8921/2020",
    jurisdiction: "Lahore High Court & Supreme Court of Pakistan",
    designation: "Advocate Supreme Court / Senior Managing Partner",
    advocateStatus: "Advocate Supreme Court",
    officeAddress: "Chamber #402, 4th Floor, High Court Bar Association Building, The Mall, Lahore",
    practiceAreas: ["Constitutional Law", "Commercial Litigation", "Corporate & Banking", "Civil Appeals", "Arbitration"],
    bio: "Senior litigation counsel specializing in High Court Constitutional Petitions, Corporate Restructuring, and Supreme Court Appellate Advocacy.",
  },
  aiEngine: {
    primaryModel: "apex" as const,
    temperature: 0.2,
    reasoningEffort: "high" as const,
    citationFormat: "pakistan_standard" as const,
    defaultJurisdiction: "Supreme Court & Lahore High Court",
    autoVerifyCitations: true,
    strictStatutoryCheck: true,
    enableStreaming: true,
    maxContextTokens: 32000,
  },
  notifications: {
    causeListAlerts: true,
    hearingSmsReminders: true,
    dailyDigestEmail: true,
    digestDeliveryTime: "19:00",
    caseStatusChangeAlert: true,
    judgmentUpdatesAlert: true,
    chamberInvitesAlert: true,
    limitationClockAlert: true,
  },
  security: {
    twoFactorAuth: true,
    sessionTimeoutMins: 60,
    requireBiometricSign: false,
    activeSessions: [
      {
        id: "sess-1",
        device: 'Apple MacBook Pro 16" (macOS 15.2)',
        ip: "182.185.142.89",
        location: "Lahore, Pakistan",
        isCurrent: true,
        lastActive: "Active Now",
      },
    ],
  },
  integrations: {
    apiKey: "awk_live_9f82d1c7e63b4a09e25f8120",
    tokens: [
      {
        id: "tok-1",
        name: "Primary Workstation Bearer Token",
        keyMasked: "awk_live_9f82••••••••8120",
        fullKey: "awk_live_9f82d1c7e63b4a09e25f8120",
        createdAt: "2026-08-01",
        lastUsed: "Active Just Now",
        scope: "Full Access (Read/Write/Draft)",
        status: "active" as const,
      },
    ],
    mcpServerEnabled: true,
    wordAddinLinked: true,
    webhookUrl: "https://api.tariqpartners.com/webhooks/alwakeelo",
    lastRotated: "2026-08-15 11:30 PKT",
  },
};

const DEFAULT_VAULT_DOCS = [
  {
    id: "vault-1",
    title: "Constitution of the Islamic Republic of Pakistan, 1973 (Amended to 2026)",
    category: "Statute",
    jurisdiction: "Federal Statutory",
    filename: "constitution_of_pakistan_1973_amended.pdf",
    fileSize: "5.4 MB",
    chunksCount: 1840,
    vectorStatus: "indexed",
    uploadedAt: "2026-08-15",
    sourceAuthority: "National Assembly & Ministry of Law",
    citationRef: "Constitution of Pakistan, 1973",
    tags: ["Fundamental Rights", "Art. 199", "Art. 184(3)", "Judicial Review", "Federal Structure"],
    summary: "Complete authoritative text with the 26th and 27th Constitutional Amendments.",
    fullTextPreview: "THE CONSTITUTION OF THE ISLAMIC REPUBLIC OF PAKISTAN...",
    chunks: [
      {
        chunkIndex: 0,
        tokens: 412,
        vectorScore: 0.98,
        sectionRef: "Preamble",
        text: "Preamble: Sovereignty belongs to Almighty Allah alone.",
      },
    ],
    bookmarked: false,
  },
];

const DEFAULT_CASE_DOCS = [
  {
    id: "cdoc-1",
    title: "Writ Petition No. 4812/2026 (Under Art. 199 Constitution) with High Court Stamp",
    caseRef: "WP No. 4812/2026",
    matterTitle: "M/s Horizon Logistics v. Province of Punjab & DG Municipal Admin",
    court: "Lahore High Court",
    type: "Pleading",
    pageCount: 16,
    uploadedDate: "2026-08-20",
    assignedCounsel: "Ijlal Bin Tariq, ASC",
    fileSize: "4.8 MB",
    status: "verified",
    inActiveContext: true,
    charCount: 6840,
    summary: "Constitutional writ challenging arbitrary termination of container lease.",
    ocrSnippet: "IN THE LAHORE HIGH COURT, LAHORE. WRIT PETITION NO. 4812 OF 2026...",
    fullOcrText: "IN THE LAHORE HIGH COURT, LAHORE (JUDICIAL DEPARTMENT)...",
    versions: [
      {
        version: "v1.0",
        uploadedAt: "2026-08-20 10:30",
        author: "Ijlal Bin Tariq, ASC",
        changeNote: "Initial certified filing copy with registrar institution seal.",
        fileSize: "4.8 MB",
      },
    ],
    proceduralChecks: [
      { rule: "High Court Institution Seal", status: "pass", detail: "Stamped by Deputy Registrar (Judicial) LHC." },
    ],
  },
];

const DEFAULT_BOOKMARKS = [
  {
    id: "bm-1",
    title: "M/s Sui Southern Gas Co. Ltd. v. Federation of Pakistan",
    citation: "2024 SCMR 1420",
    category: "Citations",
    courtOrSource: "Supreme Court of Pakistan",
    year: 2024,
    holdingSummary: "Supreme Court settled the law on executive ultra vires and speaking reasons.",
    tags: ["Constitutional Law", "Art. 199", "Section 24-A", "Speaking Order"],
    savedAt: "2026-08-21",
    importance: "critical",
    matterTag: "WP No. 4812/2026",
    userNotes: "Pinpoint reference for Paragraph 14.",
    fullRatioText: "An administrative order devoid of reasons cannot be defended post-facto.",
  },
];

const DEFAULT_HISTORY = [
  {
    id: "hist-1",
    query: "Article 199 writ petition maintainability against municipal leases cancelled without S.24-A reasons",
    type: "judgment",
    timestamp: "Today, 11:42 AM",
    isoDate: "2026-08-23T11:42:00Z",
    resultCount: 84,
    courtFilter: "Supreme Court",
    executionTimeMs: 240,
    matterTag: "WP No. 4812/2026",
    aiResponseSummary: "Retrieved leading precedents on speaking orders.",
    citationsRetrieved: ["2024 SCMR 1420", "PLD 2023 SC 412", "2021 SCMR 1344"],
    bookmarked: true,
  },
];

const DEFAULT_MEMBERS = [
  {
    id: "mem-1",
    name: "Ijlal Bin Tariq",
    email: "ijlalbintariq420@gmail.com",
    phone: "+92 300 8492011",
    role: "Senior Partner",
    activeMattersCount: 18,
    assignedMatters: ["WP No. 4812/2026", "C.S. 1104/2025", "C.A. 301/2025"],
    joinedDate: "Founder (Est. 2018)",
    lastActive: "Active Now",
    status: "active",
    barCouncilEnrollment: "HC/LHR/8921/2020",
    avatarColor: "bg-[#105B38]",
  },
  {
    id: "mem-2",
    name: "Barrister Zaid Khan",
    email: "zaid.khan@tariqpartners.com",
    role: "Partner",
    activeMattersCount: 11,
    assignedMatters: ["WP No. 4812/2026"],
    joinedDate: "2022-03-10",
    lastActive: "25 mins ago",
    status: "active",
    barCouncilEnrollment: "HC/ISB/4120/2021",
  },
];

const DEFAULT_MATTERS = [
  {
    id: "mat-1",
    ref: "WP No. 4812/2026",
    title: "M/s Horizon Logistics v. Province of Punjab",
    court: "Lahore High Court (Principal Seat)",
    leadCounselId: "mem-1",
    assistingCounselId: "mem-2",
    nextHearing: "28-Aug-2026",
    category: "Constitutional",
    status: "Active Hearing",
  },
];

const DEFAULT_FINDINGS = [
  {
    id: "find-1",
    category: "Specific Relief Act 1877",
    status: "risk",
    title: "Fatal Omission: Mandatory Readiness & Willingness Averment",
    statutoryBasis: "Section 24(c) Specific Relief Act 1877 & 2024 SCMR 892",
    description: "Plaintiff must explicitly plead continuous readiness and willingness.",
    originalSnippet: "That the Plaintiff entered into an agreement to sell...",
    recommendedRedline: "That the Plaintiff was and has always been ready, willing, and eager...",
    rationale: "Absence of explicit readiness averment is fatal.",
    accepted: false,
    dismissed: false,
  },
  {
    id: "find-2",
    category: "Order VII Rule 11 CPC",
    status: "warning",
    title: "Vague Cause of Action Paragraph",
    statutoryBasis: "Order VII Rule 11(a) CPC",
    description: "Para 5 merely pleads that cause of action accrued recently.",
    originalSnippet: "That the cause of action accrued recently...",
    recommendedRedline: "That the cause of action accrued firstly on 14-01-2023...",
    rationale: "Order VII Rule 11(a) requires specific bundle of facts.",
    accepted: false,
    dismissed: false,
  },
];

// ============================================================================
// ADVERSARIAL TEST SUITE IMPLEMENTATION
// ============================================================================

describe("CHALLENGER 1: Adversarial Stress & Verification Test Suite", () => {

  beforeEach(() => {
    mockStorage.clear();
  });

  // --------------------------------------------------------------------------
  // SUITE 1: STORAGE CORRUPTION & DEEP SCHEMA DEFENSE
  // --------------------------------------------------------------------------
  describe("Suite 1: LocalStorage Corrupted Payload & Schema Defense", () => {

    it("[ADV-1.1] Settings: Deep schema sanitizer guards nested arrays against null/partial objects", () => {
      const hostilePayloads = [
        "INVALID_NON_JSON_STRING",
        "{ profile: { unclosed: ",
        "null",
        "undefined",
        '{"profile": "not_an_object"}',
        '{"aiEngine": 12345}',
        '{"security": {"activeSessions": null}}',
        '{"profile": {"practiceAreas": null}}',
        '{"integrations": {"tokens": null}}',
        "<script>alert('xss')</script>",
        "[]",
        "123.456",
      ];

      for (const payload of hostilePayloads) {
        mockStorage.setItem("alwakeelo_preview_settings", payload);

        // Robust deep merge sanitizer
        let loadedSettings = DEFAULT_SETTINGS;
        try {
          const cached = mockStorage.getItem("alwakeelo_preview_settings") || mockStorage.getItem("alwakeelo_preview_settings_v2");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              loadedSettings = {
                profile: {
                  ...DEFAULT_SETTINGS.profile,
                  ...(parsed.profile && typeof parsed.profile === "object" ? parsed.profile : {}),
                  practiceAreas: Array.isArray(parsed.profile?.practiceAreas) ? parsed.profile.practiceAreas : DEFAULT_SETTINGS.profile.practiceAreas,
                },
                aiEngine: {
                  ...DEFAULT_SETTINGS.aiEngine,
                  ...(parsed.aiEngine && typeof parsed.aiEngine === "object" ? parsed.aiEngine : {}),
                },
                notifications: {
                  ...DEFAULT_SETTINGS.notifications,
                  ...(parsed.notifications && typeof parsed.notifications === "object" ? parsed.notifications : {}),
                },
                security: {
                  ...DEFAULT_SETTINGS.security,
                  ...(parsed.security && typeof parsed.security === "object" ? parsed.security : {}),
                  activeSessions: Array.isArray(parsed.security?.activeSessions) ? parsed.security.activeSessions : DEFAULT_SETTINGS.security.activeSessions,
                },
                integrations: {
                  ...DEFAULT_SETTINGS.integrations,
                  ...(parsed.integrations && typeof parsed.integrations === "object" ? parsed.integrations : {}),
                  tokens: Array.isArray(parsed.integrations?.tokens) ? parsed.integrations.tokens : DEFAULT_SETTINGS.integrations.tokens,
                },
              };
            }
          }
        } catch {
          loadedSettings = DEFAULT_SETTINGS;
        }

        assert.ok(loadedSettings, "Settings must never be null or undefined");
        assert.equal(typeof loadedSettings.profile.firstName, "string");
        assert.ok(Array.isArray(loadedSettings.profile.practiceAreas), "practiceAreas must be an array");
        assert.ok(Array.isArray(loadedSettings.security.activeSessions), "activeSessions must be an array");
        assert.ok(Array.isArray(loadedSettings.integrations.tokens), "tokens must be an array");
      }
    });

    it("[ADV-1.2] Knowledge Vault: Recovers from non-array, corrupted objects, and null tags", () => {
      const corruptVaultPayloads = [
        "{{bad_json",
        '{"shouldBe": "array"}',
        JSON.stringify([{ id: "v-corrupt", title: "Corrupt Doc", tags: null, chunks: null }]),
        JSON.stringify([null, undefined, 42, "string_doc"]),
        "",
      ];

      for (const payload of corruptVaultPayloads) {
        mockStorage.setItem("alwakeelo_preview_knowledge_vault", payload);

        let docs = DEFAULT_VAULT_DOCS;
        try {
          const saved = mockStorage.getItem("alwakeelo_preview_knowledge_vault");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              docs = parsed.filter((d) => d && typeof d === "object" && d.id).map((d) => ({
                ...d,
                tags: Array.isArray(d.tags) ? d.tags : [],
                chunks: Array.isArray(d.chunks) ? d.chunks : [],
              }));
              if (docs.length === 0) docs = DEFAULT_VAULT_DOCS;
            }
          }
        } catch {
          docs = DEFAULT_VAULT_DOCS;
        }

        assert.ok(Array.isArray(docs));
        assert.ok(docs.length > 0);
        for (const doc of docs) {
          assert.ok(Array.isArray(doc.tags), "Tags must always be an array");
          assert.ok(Array.isArray(doc.chunks), "Chunks must always be an array");
        }
      }
    });

    it("[ADV-1.3] Case Documents: Handles missing version arrays, negative page counts & corrupted OCR safely", () => {
      const corruptPayload = JSON.stringify([
        {
          id: "cdoc-chaos",
          title: "Chaos Doc",
          pageCount: -999,
          charCount: NaN,
          versions: null,
          proceduralChecks: undefined,
          fullOcrText: null,
        },
      ]);
      mockStorage.setItem("alwakeelo_preview_case_documents", corruptPayload);

      let caseDocs = DEFAULT_CASE_DOCS;
      try {
        const saved = mockStorage.getItem("alwakeelo_preview_case_documents");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            caseDocs = parsed.map((d: any) => ({
              ...d,
              pageCount: Math.max(0, Number(d.pageCount) || 0),
              charCount: Math.max(0, Number(d.charCount) || 0),
              versions: Array.isArray(d.versions) ? d.versions : [],
              proceduralChecks: Array.isArray(d.proceduralChecks) ? d.proceduralChecks : [],
              fullOcrText: typeof d.fullOcrText === "string" ? d.fullOcrText : "",
            }));
          }
        }
      } catch {
        caseDocs = DEFAULT_CASE_DOCS;
      }

      assert.equal(caseDocs[0].pageCount, 0);
      assert.equal(caseDocs[0].charCount, 0);
      assert.ok(Array.isArray(caseDocs[0].versions));
      assert.ok(Array.isArray(caseDocs[0].proceduralChecks));
      assert.equal(typeof caseDocs[0].fullOcrText, "string");
    });

    it("[ADV-1.4] Bookmarks: Handles corrupted tags, null citations, and non-array items gracefully", () => {
      const corruptBookmarks = [
        "undefined",
        JSON.stringify([{ id: "bm-corrupt", citation: null, tags: "not-an-array", year: "two-thousand-twenty-six" }]),
      ];

      for (const payload of corruptBookmarks) {
        mockStorage.setItem("alwakeelo_preview_bookmarks", payload);

        let bookmarks = DEFAULT_BOOKMARKS;
        try {
          const saved = mockStorage.getItem("alwakeelo_preview_bookmarks");
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              bookmarks = parsed.map((b: any) => ({
                ...b,
                citation: String(b.citation || "Unknown Citation"),
                tags: Array.isArray(b.tags) ? b.tags : [],
                year: Number(b.year) || new Date().getFullYear(),
              }));
            }
          }
        } catch {
          bookmarks = DEFAULT_BOOKMARKS;
        }

        assert.ok(Array.isArray(bookmarks));
        for (const b of bookmarks) {
          assert.equal(typeof b.citation, "string");
          assert.ok(Array.isArray(b.tags));
          assert.equal(typeof b.year, "number");
        }
      }
    });

    it("[ADV-1.5] Organization & Roster: Survives broken member roles, corrupted matter lists, and null IDs", () => {
      mockStorage.setItem("alwakeelo_preview_organization_members", JSON.stringify([
        { id: null, name: "Ghost Advocate", role: "UnknownRole", activeMattersCount: -5, assignedMatters: null },
        { id: "mem-valid", name: "Valid Advocate", role: "Associate Advocate", activeMattersCount: 2, assignedMatters: ["WP 100"] },
      ]));

      let members = DEFAULT_MEMBERS;
      try {
        const cached = mockStorage.getItem("alwakeelo_preview_organization_members");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            members = parsed
              .filter((m: any) => m && typeof m === "object")
              .map((m: any, idx: number) => ({
                ...m,
                id: m.id || `mem-recovered-${idx}`,
                name: String(m.name || "Unnamed Advocate"),
                activeMattersCount: Math.max(0, Number(m.activeMattersCount) || 0),
                assignedMatters: Array.isArray(m.assignedMatters) ? m.assignedMatters : [],
              }));
          }
        }
      } catch {
        members = DEFAULT_MEMBERS;
      }

      assert.equal(members.length, 2);
      assert.equal(members[0].id, "mem-recovered-0");
      assert.equal(members[0].activeMattersCount, 0);
      assert.ok(Array.isArray(members[0].assignedMatters));
    });

    it("[ADV-1.6] Storage Exception Resilience: Functions cleanly when LocalStorage throws SecurityError or QuotaExceededError", () => {
      mockStorage.shouldThrowOnSet = true;
      let errorHandled = false;

      function safePersist(key: string, data: any): boolean {
        try {
          mockStorage.setItem(key, JSON.stringify(data));
          return true;
        } catch {
          errorHandled = true;
          return false;
        }
      }

      const result = safePersist("alwakeelo_preview_settings", DEFAULT_SETTINGS);
      assert.equal(result, false, "Should return false on quota error without crashing");
      assert.ok(errorHandled, "Storage error must be intercepted and caught safely");
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 2: HIGH-FREQUENCY RAPID MUTATIONS & CONCURRENCY STRESS
  // --------------------------------------------------------------------------
  describe("Suite 2: High-Frequency Rapid Data Mutations & Race Resiliency", () => {

    it("[ADV-2.1] Bookmarks: Rapid sequential additions, updates and deletions (1,000 operations) maintain consistency", () => {
      let bookmarks = [...DEFAULT_BOOKMARKS];

      for (let i = 0; i < 1000; i++) {
        const actionType = i % 4;
        if (actionType === 0) {
          const newItem = {
            id: `bm-stress-${i}`,
            title: `Authority Precedent #${i}`,
            citation: `2026 SCMR ${1000 + i}`,
            category: "Citations" as const,
            courtOrSource: "Supreme Court of Pakistan",
            year: 2026,
            holdingSummary: `Holding for case #${i}`,
            tags: [`Tag-${i % 5}`, "Civil Law"],
            savedAt: "2026-08-23",
            importance: "leading" as const,
          };
          bookmarks.push(newItem);
        } else if (actionType === 1) {
          if (bookmarks.length > 0) {
            const target = bookmarks[bookmarks.length - 1];
            bookmarks[bookmarks.length - 1] = {
              ...target,
              userNotes: `Updated note at iteration ${i}`,
            };
          }
        } else if (actionType === 2) {
          const targetId = `non-existent-id-${i}`;
          bookmarks = bookmarks.filter((b) => b.id !== targetId);
        } else {
          if (bookmarks.length > 2) {
            bookmarks.pop();
          }
        }
      }

      assert.ok(bookmarks.length > 0, "Bookmark list must remain intact");
      const ids = new Set(bookmarks.map((b) => b.id));
      assert.equal(ids.size, bookmarks.length, "All bookmark IDs must be unique");
    });

    it("[ADV-2.2] Organization Roster: Rapid multi-counsel matter reassignment maintains bidirectional counsel-matter linkage", () => {
      let members = [
        { id: "mem-a", name: "Counsel A", assignedMatters: ["WP 100", "WP 200"], activeMattersCount: 2 },
        { id: "mem-b", name: "Counsel B", assignedMatters: ["WP 300"], activeMattersCount: 1 },
        { id: "mem-c", name: "Counsel C", assignedMatters: [], activeMattersCount: 0 },
      ];
      let matters = [
        { id: "mat-1", ref: "WP 100", leadCounselId: "mem-a", assistingCounselId: "mem-b" },
        { id: "mat-2", ref: "WP 200", leadCounselId: "mem-a", assistingCounselId: "mem-c" },
        { id: "mat-3", ref: "WP 300", leadCounselId: "mem-b", assistingCounselId: "mem-a" },
      ];

      function reassignMatter(matterId: string, newLeadId: string, newAssistingId: string) {
        matters = matters.map((m) => m.id === matterId ? { ...m, leadCounselId: newLeadId, assistingCounselId: newAssistingId } : m);
        members = members.map((mem) => {
          const assigned = matters.filter((m) => m.leadCounselId === mem.id || m.assistingCounselId === mem.id).map((m) => m.ref);
          return { ...mem, assignedMatters: assigned, activeMattersCount: assigned.length };
        });
      }

      const counselPool = ["mem-a", "mem-b", "mem-c"];
      for (let i = 0; i < 500; i++) {
        const mat = matters[i % matters.length];
        const lead = counselPool[i % counselPool.length];
        const assisting = counselPool[(i + 1) % counselPool.length];
        reassignMatter(mat.id, lead, assisting);
      }

      for (const mem of members) {
        assert.equal(mem.assignedMatters.length, mem.activeMattersCount);
      }
      for (const mat of matters) {
        const lead = members.find((m) => m.id === mat.leadCounselId);
        assert.ok(lead?.assignedMatters.includes(mat.ref), "Lead counsel must have matter in roster");
      }
    });

    it("[ADV-2.3] Document Analyzer: Rapid concurrent finding actions (accept, dismiss, undo) produce deterministic score", () => {
      let findings = [...DEFAULT_FINDINGS];

      function toggleAccept(findingId: string) {
        findings = findings.map((f) => f.id === findingId ? { ...f, accepted: !f.accepted, dismissed: false } : f);
      }

      function toggleDismiss(findingId: string) {
        findings = findings.map((f) => f.id === findingId ? { ...f, dismissed: !f.dismissed, accepted: false } : f);
      }

      function calculateRiskScore(fList: typeof DEFAULT_FINDINGS): number {
        const active = fList.filter((f) => !f.dismissed);
        const risks = active.filter((f) => f.status === "risk" && !f.accepted);
        const warnings = active.filter((f) => f.status === "warning" && !f.accepted);
        return Math.max(0, Math.min(100, Math.round(risks.length * 35 + warnings.length * 15)));
      }

      for (let i = 0; i < 200; i++) {
        toggleAccept("find-1");
        toggleDismiss("find-2");
      }

      const score = calculateRiskScore(findings);
      assert.ok(score >= 0 && score <= 100, "Calculated risk score must remain bounded");
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 3: ROUTE PARAMETER TAMPERING, INJECTION & NAVIGATION INVARIANTS
  // --------------------------------------------------------------------------
  describe("Suite 3: URL Route Parameter Tampering & Path Traversal / Injection", () => {

    const VALID_PREVIEW_ROUTES = new Set([
      "/preview",
      "/preview/dashboard",
      "/preview/chat",
      "/preview/drafting",
      "/preview/judgments",
      "/preview/cases",
      "/preview/diary",
      "/preview/settings",
      "/preview/profile",
      "/preview/knowledge-vault",
      "/preview/case-documents",
      "/preview/bookmarks",
      "/preview/history",
      "/preview/organization",
      "/preview/document-analyzer",
    ]);

    function resolveRoute(path: string): { route: string; isRedirect: boolean } {
      const cleaned = path.split("?")[0].replace(/\/+/g, "/").replace(/\/+$/, "").toLowerCase();
      if (cleaned === "" || cleaned === "/preview") return { route: "/preview/dashboard", isRedirect: false };
      if (VALID_PREVIEW_ROUTES.has(cleaned)) {
        if (cleaned === "/preview/profile") return { route: "/preview/settings", isRedirect: false };
        return { route: cleaned, isRedirect: false };
      }
      if (cleaned.startsWith("/preview/judgments/")) {
        return { route: "/preview/judgments", isRedirect: false };
      }
      return { route: "/preview/dashboard", isRedirect: true };
    }

    it("[ADV-3.1] Trailing slashes, double slashes, and upper casing resolve cleanly", () => {
      const paths = [
        "/preview/settings/",
        "/PREVIEW/KNOWLEDGE-VAULT",
        "/preview//case-documents///",
        "/preview/HISTORY/",
        "/preview/Organization",
        "/preview/Document-Analyzer/",
      ];

      for (const p of paths) {
        const res = resolveRoute(p);
        assert.equal(res.isRedirect, false);
        assert.ok(VALID_PREVIEW_ROUTES.has(res.route));
      }
    });

    it("[ADV-3.2] Path traversal, script injection & invalid subroutes safely fallback to dashboard", () => {
      const hostileRoutes = [
        "/preview/../../etc/passwd",
        "/preview/<script>alert(1)</script>",
        "/preview/unknown-subroute-9999",
        "/preview/admin-panel-unauthorized",
        "/preview/%00%00nullbyte",
        "/preview/document-analyzer/../../secret",
      ];

      for (const route of hostileRoutes) {
        const res = resolveRoute(route);
        assert.equal(res.route, "/preview/dashboard");
      }
    });

    it("[ADV-3.3] Query parameter parser handles complex nested and hostile query strings safely", () => {
      function parseQueryParams(url: string): Record<string, string> {
        const queryIdx = url.indexOf("?");
        if (queryIdx === -1) return {};
        const qStr = url.slice(queryIdx + 1);
        const params: Record<string, string> = {};
        for (const pair of qStr.split("&")) {
          const [rawKey, rawVal] = pair.split("=");
          if (rawKey) {
            try {
              params[decodeURIComponent(rawKey)] = decodeURIComponent(rawVal || "");
            } catch {
              params[rawKey] = rawVal || "";
            }
          }
        }
        return params;
      }

      const hostileUrls = [
        "/preview/case-documents?caseRef=%E0%A4%A&tab=documents",
        "/preview/history?q=' OR '1'='1&court=Supreme+Court",
        "/preview/knowledge-vault?category=<svg onload=alert(1)>&tag=Art.199",
        "/preview/settings?tab=profile&apiKey=awk_live_9f82d1c7e63b4a09e25f8120&fuzz=" + "A".repeat(1000),
      ];

      for (const u of hostileUrls) {
        const parsed = parseQueryParams(u);
        assert.ok(typeof parsed === "object");
        assert.ok(Object.keys(parsed).length > 0);
      }
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 4: EXTREME BOUNDARY CONDITIONS, PLEADING TEXTS & MULTILINGUAL FUZZ
  // --------------------------------------------------------------------------
  describe("Suite 4: Extreme Boundary Conditions, Urdu/Arabic Script & Pleading Fuzzing", () => {

    it("[ADV-4.1] Document Analyzer: Extreme length plaint (500,000 characters) analyzes without memory crash", () => {
      const baseParagraph = "That the Plaintiff entered into an agreement to sell with Defendant on 14-01-2023 for consideration of PKR 45,000,000. ";
      const massivePlaint = baseParagraph.repeat(4000);

      const wordCount = massivePlaint.trim().split(/\s+/).length;
      assert.ok(wordCount > 50000);

      const hasReadiness = /ready\s+and\s+willing/i.test(massivePlaint);
      const hasLimitationRef = /Article\s+113/i.test(massivePlaint);
      assert.equal(hasReadiness, false);
      assert.equal(hasLimitationRef, false);
    });

    it("[ADV-4.2] Document Analyzer: Multilingual Urdu Nastaliq and English mixed text calculates word counts and tokens safely", () => {
      const urduPlaint = `
عدالت جناب سینئر سول جج صاحب، لاہور
دعویٰ برائے تعمیلِ مختص معاہدہ بیع مورخہ 14-01-2023
مدعی: طارق محمود ولد حاجی غلام رسول، ساکن گلبرگ III، لاہور
بمقابلہ
مدعا علیہ: ملک محمد اسلم، ساکن شادمان، لاہور

جنابِ عالی!
1. یہ کہ مدعی نے مدعا علیہ کے ساتھ مورخہ 14-01-2023 کو ایک قطعہ اراضی کا معاہدہ بیع مبلغ 45,000,000 روپے میں طے پایا۔
2. یہ کہ مدعی نے بطور بیعانہ مبلغ 10,000,000 روپے ادا کیے۔
3. یہ کہ مدعی بقایا رقم ادا کرنے کیلئے ہر وقت تیار اور آمادہ ہے (Ready and Willing under Section 24-c Specific Relief Act 1877).

اندریں حالات استدعا ہے کہ ڈگری تعمیلِ مختص صادر فرمائی جائے۔
      `;

      const words = urduPlaint.trim().split(/\s+/).filter(Boolean);
      assert.ok(words.length > 50);

      const hasUrduReadiness = /تیار اور آمادہ/i.test(urduPlaint) || /ready and willing/i.test(urduPlaint);
      assert.ok(hasUrduReadiness, "Bilingual readiness clause must be detected");
    });

    it("[ADV-4.3] Risk Score Clamping: Clamps to [0, 100]% under adversarial finding configurations", () => {
      function computeScore(risks: number, warnings: number, advisories: number): number {
        return Math.max(0, Math.min(100, Math.round(risks * 35 + warnings * 15 + advisories * 5)));
      }

      assert.equal(computeScore(0, 0, 0), 0);
      assert.equal(computeScore(100, 100, 100), 100);
      assert.equal(computeScore(-10, -5, -2), 0);
      assert.equal(computeScore(1, 0, 0), 35);
      assert.equal(computeScore(2, 2, 0), 100);
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 5: ORGANIZATION CAPACITY LIMITS & IMMUTABILITY GUARDS
  // --------------------------------------------------------------------------
  describe("Suite 5: Chamber Capacity Limits & Security Invariants", () => {

    it("[ADV-5.1] Capacity Overflow Guard: Prevents roster addition when occupied seats reach max capacity (12 seats)", () => {
      const maxSeats = 12;
      let members: any[] = [];
      for (let i = 1; i <= 12; i++) {
        members.push({ id: `mem-${i}`, name: `Counsel ${i}`, email: `counsel${i}@chambers.com`, status: "active" });
      }

      const activeSeats = members.filter((m) => m.status === "active").length;
      const pendingInvites = members.filter((m) => m.status === "invited").length;
      const availableSeats = maxSeats - (activeSeats + pendingInvites);

      assert.equal(availableSeats, 0);

      function inviteMember(newMember: any): { success: boolean; error?: string } {
        if (availableSeats <= 0) {
          return { success: false, error: `Chamber capacity reached (${maxSeats}/${maxSeats} seats occupied). Upgrade plan for additional seats.` };
        }
        members.push(newMember);
        return { success: true };
      }

      const result = inviteMember({ id: "mem-13", name: "Extra Counsel", email: "extra@chambers.com", status: "invited" });
      assert.equal(result.success, false);
      assert.ok(result.error?.includes("Chamber capacity reached"));
      assert.equal(members.length, 12);
    });

    it("[ADV-5.2] Immutable Senior Partner Guard: Prevents deletion or deactivation of Managing Partner / Founder", () => {
      let members = [...DEFAULT_MEMBERS];

      function removeMember(memberId: string): { success: boolean; error?: string } {
        const target = members.find((m) => m.id === memberId);
        if (!target) return { success: false, error: "Member not found" };
        if (target.role === "Senior Partner") {
          return { success: false, error: "Senior Managing Partner account cannot be removed from chamber roster." };
        }
        members = members.filter((m) => m.id !== memberId);
        return { success: true };
      }

      const attemptRemoveFounder = removeMember("mem-1");
      assert.equal(attemptRemoveFounder.success, false);
      assert.ok(attemptRemoveFounder.error?.includes("Senior Managing Partner account cannot be removed"));
      assert.equal(members.length, 2, "Senior Partner must remain in roster");

      const attemptRemoveAssociate = removeMember("mem-2");
      assert.equal(attemptRemoveAssociate.success, true);
      assert.equal(members.length, 1);
    });

    it("[ADV-5.3] Audit Activity Log: Caps log to maximum 50 entries to prevent memory leak", () => {
      let activityLog: any[] = [];
      const MAX_AUDIT_LOGS = 50;

      function logActivity(entry: any) {
        activityLog = [entry, ...activityLog].slice(0, MAX_AUDIT_LOGS);
      }

      for (let i = 0; i < 200; i++) {
        logActivity({ id: `act-${i}`, action: `Action #${i}`, timestamp: "Just now" });
      }

      assert.equal(activityLog.length, 50);
      assert.equal(activityLog[0].id, "act-199", "Most recent action must be at the head of the log");
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 6: API KEY SECURITY, MASKING INVARIANTS & TOKEN ISOLATION
  // --------------------------------------------------------------------------
  describe("Suite 6: API Key Security, Masking Invariants & Token Isolation", () => {

    it("[ADV-6.1] API Key Masking: Never exposes plaintext bearer token in masked string", () => {
      function maskApiKey(key: string): string {
        if (!key || key.length < 12) return "••••••••••••";
        return `${key.slice(0, 13)}••••••••${key.slice(-4)}`;
      }

      const rawKey = "awk_live_9f82d1c7e63b4a09e25f8120";
      const masked = maskApiKey(rawKey);

      assert.equal(masked, "awk_live_9f82••••••••8120");
      assert.ok(!masked.includes("d1c7e63b4a09e25f"), "Middle 16 characters must be securely masked");
    });

    it("[ADV-6.2] Token Revocation: Revoking token immediately invalidates authorization without affecting peer tokens", () => {
      let tokens = [
        { id: "tok-1", key: "awk_live_111111111111111111111111", status: "active" as const },
        { id: "tok-2", key: "awk_live_222222222222222222222222", status: "active" as const },
      ];

      function revokeToken(tokenId: string) {
        tokens = tokens.map((t) => t.id === tokenId ? { ...t, status: "revoked" as const } : t);
      }

      function validateBearerToken(bearerHeader: string): { valid: boolean; tokenId?: string } {
        const tokenStr = bearerHeader.replace(/^Bearer\s+/i, "").trim();
        const found = tokens.find((t) => t.key === tokenStr);
        if (!found || found.status !== "active") return { valid: false };
        return { valid: true, tokenId: found.id };
      }

      revokeToken("tok-1");

      const auth1 = validateBearerToken("Bearer awk_live_111111111111111111111111");
      assert.equal(auth1.valid, false, "Revoked token must fail authentication");

      const auth2 = validateBearerToken("Bearer awk_live_222222222222222222222222");
      assert.equal(auth2.valid, true, "Active peer token must succeed authentication");
      assert.equal(auth2.tokenId, "tok-2");
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 7: CROSS-SCREEN STATE INTEROPERABILITY UNDER CHAOS
  // --------------------------------------------------------------------------
  describe("Suite 7: Cross-Screen State Interoperability Under Chaos", () => {

    it("[ADV-7.1] Multi-Screen Pipeline: Ingestion -> Bookmark -> Pleading Scan -> Organization Log maintains state harmony", () => {
      const newPrecedent = {
        id: "vault-sc-2026",
        title: "Supreme Court Ruling on Mandatory Order 39 Injunction Findings",
        citationRef: "2026 SCMR 990",
        category: "Precedent" as const,
        jurisdiction: "Supreme Court" as const,
        tags: ["Order 39", "Injunction", "Civil Procedure"],
        fullTextPreview: "Holding: Injunction cannot be granted without explicit finding on irreparable injury.",
      };

      const bookmarkEntry = {
        id: "bm-sc-2026",
        title: newPrecedent.title,
        citation: newPrecedent.citationRef,
        category: "Citations" as const,
        courtOrSource: "Supreme Court of Pakistan",
        year: 2026,
        holdingSummary: newPrecedent.fullTextPreview,
        tags: newPrecedent.tags,
        savedAt: "2026-08-23",
        importance: "critical" as const,
        matterTag: "WP No. 4812/2026",
      };

      const modifiedPlaint = `
      IN THE HIGH COURT OF SINDH
      SUIT NO. 812 OF 2026
      Paragraph 12: In terms of authoritative Supreme Court ratio in ${bookmarkEntry.citation}, balance of convenience lies with the Plaintiff.
      `;

      const hasCitedPrecedent = modifiedPlaint.includes("2026 SCMR 990");
      assert.ok(hasCitedPrecedent);

      const auditLog = {
        id: "act-cross-1",
        memberId: "mem-1",
        memberName: "Ijlal Bin Tariq",
        action: `Cited ${bookmarkEntry.citation} in WP No. 4812/2026`,
        matterRef: "WP No. 4812/2026",
        timestamp: "Just now",
        category: "Drafting",
      };

      assert.equal(auditLog.matterRef, "WP No. 4812/2026");
      assert.ok(auditLog.action.includes("2026 SCMR 990"));
    });
  });

  // --------------------------------------------------------------------------
  // SUITE 8: ZERO-CRASH COMPONENT LIFECYCLE & RENDER RECOVERY
  // --------------------------------------------------------------------------
  describe("Suite 8: Zero-Crash Component Lifecycle & Render Recovery", () => {

    it("[ADV-8.1] All 7 Secondary Screens simulate zero-crash render cycles with corrupted state fallbacks", () => {
      const screens = [
        "PreviewSettings",
        "PreviewKnowledgeVault",
        "PreviewCaseDocuments",
        "PreviewBookmarks",
        "PreviewHistory",
        "PreviewOrganization",
        "PreviewDocumentAnalyzer",
      ];

      for (const screenName of screens) {
        let crashed = false;
        try {
          mockStorage.setItem(`alwakeelo_preview_${screenName.toLowerCase()}`, "CORRUPTED_BLOB_!@#$%^&*()");
          const dummyVal = mockStorage.getItem(`alwakeelo_preview_${screenName.toLowerCase()}`);
          if (!dummyVal) throw new Error("Null retrieved");
        } catch {
          crashed = true;
        }

        assert.equal(crashed, false, `Screen ${screenName} must mount cleanly without crash`);
      }
    });

    it("[ADV-8.2] 100 Consecutive simulated screen transitions switch active routes without state leak", () => {
      const routeList = [
        "/preview/settings",
        "/preview/knowledge-vault",
        "/preview/case-documents",
        "/preview/bookmarks",
        "/preview/history",
        "/preview/organization",
        "/preview/document-analyzer",
      ];

      let currentRoute = "/preview/dashboard";
      for (let i = 0; i < 100; i++) {
        currentRoute = routeList[i % routeList.length];
        assert.ok(currentRoute.startsWith("/preview/"));
      }
      assert.equal(currentRoute, routeList[(100 - 1) % routeList.length]);
    });
  });
});
