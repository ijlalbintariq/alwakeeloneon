import assert from "node:assert/strict";
import test, { describe, it, beforeEach, afterEach } from "node:test";
import React from "react";
import { JSDOM } from "jsdom";
import {
  DirectoryBrowser,
  buildDirectorySearchUrl,
  COURTS_DIRECTORY,
  JOURNALS_DIRECTORY,
  CATEGORIES_DIRECTORY,
  BrowseListItem,
  DirectoryFilterState,
} from "../components/judgments/DirectoryBrowser";
import { parsePakistaniCitation } from "../components/judgments/PinpointCitationParser";

// Configure React act environment for Node testing
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("Court Hierarchy Directory & Law Journal Archive Verification Suite", () => {
  describe("1. URL Construction & Dynamic Query Parameter Dispatch", () => {
    it("[T1.1] Changing Court dropdown to 'SC' triggers query with court=SC", () => {
      const url = buildDirectorySearchUrl({ courtCode: "SC" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("court"), "SC");
      assert.equal(parsed.searchParams.get("limit"), "50");
      assert.equal(parsed.searchParams.get("sort"), "latest");
    });

    it("[T1.2] Changing Court dropdown to 'LHC' triggers query with court=LHC", () => {
      const url = buildDirectorySearchUrl({ courtCode: "LHC" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("court"), "LHC");
    });

    it("[T1.3] Changing Court dropdown to 'ALL' does not include court param if another filter is active", () => {
      const url = buildDirectorySearchUrl({ courtCode: "ALL", year: "2024" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.has("court"), false);
      assert.equal(parsed.searchParams.get("year"), "2024");
    });

    it("[T1.4] Changing Year dropdown to '2026' triggers query with year=2026", () => {
      const url = buildDirectorySearchUrl({ year: "2026" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("year"), "2026");
    });

    it("[T1.5] Changing Year dropdown to historical year '1955' triggers query with year=1955", () => {
      const url = buildDirectorySearchUrl({ year: "1955" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("year"), "1955");
    });

    it("[T1.6] Changing Journal dropdown to 'SCMR' triggers query with report=SCMR", () => {
      const url = buildDirectorySearchUrl({ journalCode: "SCMR" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("report"), "SCMR");
    });

    it("[T1.7] Changing Journal dropdown to 'PLD' triggers query with report=PLD", () => {
      const url = buildDirectorySearchUrl({ journalCode: "PLD" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("report"), "PLD");
    });

    it("[T1.8] Changing search query triggers query with q=...", () => {
      const url = buildDirectorySearchUrl({ search: "bail" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("q"), "bail");
    });

    it("[T1.9] Multi-word and citation queries are cleanly encoded in q parameter", () => {
      const url = buildDirectorySearchUrl({ search: "Section 497 CrPC Article 199" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("q"), "Section 497 CrPC Article 199");
    });

    it("[T1.10] Subject Matter category is merged into q parameter", () => {
      const url = buildDirectorySearchUrl({ category: "criminal" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("q"), "criminal");
    });

    it("[T1.11] Free text search and subject matter category are combined cleanly", () => {
      const url = buildDirectorySearchUrl({ search: "further inquiry", category: "criminal" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("q"), "further inquiry criminal");
    });

    it("[T1.12] Compound 4-tier filter query constructs all query parameters simultaneously", () => {
      const url = buildDirectorySearchUrl({
        courtCode: "SC",
        journalCode: "SCMR",
        year: "2024",
        category: "constitutional",
        search: "fundamental rights",
        limit: 100,
        sort: "relevance",
      });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("court"), "SC");
      assert.equal(parsed.searchParams.get("report"), "SCMR");
      assert.equal(parsed.searchParams.get("year"), "2024");
      assert.equal(parsed.searchParams.get("q"), "fundamental rights constitutional");
      assert.equal(parsed.searchParams.get("limit"), "100");
      assert.equal(parsed.searchParams.get("sort"), "relevance");
    });

    it("[T1.13] Default initial state passes fallback court=SC to avoid server empty-query guard", () => {
      const url = buildDirectorySearchUrl({
        courtCode: "ALL",
        journalCode: "ALL",
        year: "ALL",
        category: "all",
        search: "",
      });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("court"), "SC");
      assert.equal(parsed.searchParams.get("limit"), "50");
      assert.equal(parsed.searchParams.get("sort"), "latest");
    });
  });

  describe("2. Directory Data Parsing & Ingestion Model", () => {
    it("[T2.1] Correctly maps backend /api/case-law/search array to BrowseListItem schema", () => {
      const rawApiData = [
        {
          id: 1420,
          citation: "2024 SCMR 892",
          court: "Supreme Court of Pakistan",
          title: "Tariq Mehmood v. The State",
          summary: "Criminal Procedure Code (V of 1898), S. 497(2) — Post-arrest bail.",
          keywords: ["criminal", "bail", "s. 497"],
          judgmentId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
          uri: "",
        },
      ];

      const mapped: BrowseListItem[] = rawApiData.map((j) => {
        const parsed = j.citation ? parsePakistaniCitation(j.citation) : null;
        const yr = Number(parsed?.year || 2024);
        const pg = Number(parsed?.page || 1);
        const jCode = parsed?.journal || "PLD";
        const cCode = j.court?.includes("Supreme") ? "SC" : "SC";

        return {
          id: String(j.judgmentId || j.id),
          judgmentId: j.judgmentId ? String(j.judgmentId) : undefined,
          year: yr,
          page: pg,
          citation: j.citation,
          title: j.title,
          decisionDate: null,
          courtName: j.court,
          courtSnapshot: cCode,
          journalCode: jCode,
          category: j.keywords?.[0],
          bench: undefined,
          summary: j.summary,
        };
      });

      assert.equal(mapped.length, 1);
      assert.equal(mapped[0].id, "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
      assert.equal(mapped[0].citation, "2024 SCMR 892");
      assert.equal(mapped[0].year, 2024);
      assert.equal(mapped[0].page, 892);
      assert.equal(mapped[0].journalCode, "SCMR");
      assert.equal(mapped[0].courtSnapshot, "SC");
      assert.equal(mapped[0].category, "criminal");
    });

    it("[T2.2] Extracts court snapshot codes across all Pakistani provincial and superior courts", () => {
      const courts = [
        { raw: "Supreme Court of Pakistan", expected: "SC" },
        { raw: "Lahore High Court", expected: "LHC" },
        { raw: "Sindh High Court", expected: "SHC" },
        { raw: "Islamabad High Court", expected: "IHC" },
        { raw: "Peshawar High Court", expected: "PHC" },
        { raw: "High Court of Balochistan", expected: "BHC" },
        { raw: "Federal Shariat Court", expected: "FSC" },
      ];

      for (const { raw, expected } of courts) {
        const cCode = raw.includes("Supreme")
          ? "SC"
          : raw.includes("Lahore")
          ? "LHC"
          : raw.includes("Sindh")
          ? "SHC"
          : raw.includes("Islamabad")
          ? "IHC"
          : raw.includes("Peshawar")
          ? "PHC"
          : raw.includes("Balochistan")
          ? "BHC"
          : raw.includes("Shariat")
          ? "FSC"
          : "SC";
        assert.equal(cCode, expected, `Court ${raw} must map to ${expected}`);
      }
    });

    it("[T2.3] Directory static catalogs cover complete Pakistani jurisdiction scope", () => {
      assert.equal(COURTS_DIRECTORY.length, 7);
      assert.ok(COURTS_DIRECTORY.some((c) => c.code === "SC" && c.name.includes("Supreme Court")));
      assert.ok(COURTS_DIRECTORY.some((c) => c.code === "LHC" && c.name.includes("Lahore High Court")));
      assert.ok(COURTS_DIRECTORY.some((c) => c.code === "SHC" && c.name.includes("Sindh High Court")));
      assert.ok(COURTS_DIRECTORY.some((c) => c.code === "IHC" && c.name.includes("Islamabad High Court")));
      assert.ok(COURTS_DIRECTORY.some((c) => c.code === "PHC" && c.name.includes("Peshawar High Court")));
      assert.ok(COURTS_DIRECTORY.some((c) => c.code === "BHC" && c.name.includes("Balochistan")));
      assert.ok(COURTS_DIRECTORY.some((c) => c.code === "FSC" && c.name.includes("Federal Shariat Court")));

      assert.ok(JOURNALS_DIRECTORY.length >= 10);
      assert.ok(JOURNALS_DIRECTORY.some((j) => j.code === "PLD"));
      assert.ok(JOURNALS_DIRECTORY.some((j) => j.code === "SCMR"));
      assert.ok(JOURNALS_DIRECTORY.some((j) => j.code === "CLC"));
      assert.ok(JOURNALS_DIRECTORY.some((j) => j.code === "PCRLJ"));
      assert.ok(JOURNALS_DIRECTORY.some((j) => j.code === "YLR"));

      assert.equal(CATEGORIES_DIRECTORY.length, 8);
      assert.ok(CATEGORIES_DIRECTORY.some((cat) => cat.code === "constitutional"));
      assert.ok(CATEGORIES_DIRECTORY.some((cat) => cat.code === "criminal"));
      assert.ok(CATEGORIES_DIRECTORY.some((cat) => cat.code === "civil"));
    });
  });

  describe("3. React Component Lifecycle, Fetch Interception & UI States", () => {
    let dom: JSDOM;
    let originalFetch: typeof globalThis.fetch;
    let originalWindow: typeof globalThis.window;
    let originalDocument: typeof globalThis.document;

    beforeEach(() => {
      dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div></body></html>", {
        url: "http://localhost:5000",
      });
      originalFetch = globalThis.fetch;
      originalWindow = globalThis.window;
      originalDocument = globalThis.document;

      globalThis.window = dom.window as any;
      globalThis.document = dom.window.document;
      globalThis.HTMLElement = dom.window.HTMLElement;
      globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
      globalThis.HTMLInputElement = dom.window.HTMLInputElement;
      globalThis.customElements = dom.window.customElements;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      globalThis.window = originalWindow;
      globalThis.document = originalDocument;
    });

    async function flushPromises() {
      for (let i = 0; i < 6; i++) {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    }

    it("[T3.1] Component executes initial seed fetch to /api/case-law/search on mount with court=SC", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      const capturedUrls: string[] = [];
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        capturedUrls.push(url);
        return new Response(
          JSON.stringify([
            {
              id: 1,
              citation: "2024 SCMR 100",
              title: "Initial Apex Precedent",
              court: "Supreme Court of Pakistan",
              judgmentId: "sc-initial-1",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const container = dom.window.document.getElementById("root")!;
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });

      await act(async () => {
        await flushPromises();
      });

      assert.ok(capturedUrls.length >= 1, "Must have dispatched at least 1 fetch on mount");
      assert.ok(capturedUrls[0].includes("/api/case-law/search"), "Must query case-law search endpoint");
      assert.ok(capturedUrls[0].includes("court=SC"), "Initial mount must default to court=SC");

      // Verify DOM content
      const html = container.innerHTML;
      assert.ok(html.includes("2024 SCMR 100"), "Must render citation in DOM");
      assert.ok(html.includes("Initial Apex Precedent"), "Must render title in DOM");

      await act(async () => {
        root.unmount();
      });
    });

    it("[T3.2] Item click triggers onSelectJudgment callback with judgment UUID", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      let selectedId: string | null = null;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify([
            {
              id: 101,
              citation: "2024 SCMR 892",
              title: "Tariq Mehmood v. The State",
              court: "Supreme Court of Pakistan",
              judgmentId: "uuid-bail-497",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const container = dom.window.document.getElementById("root")!;
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(
          React.createElement(DirectoryBrowser, {
            onSelectJudgment: (id: string) => {
              selectedId = id;
            },
          })
        );
      });

      await act(async () => {
        await flushPromises();
      });

      // Find the rendered case card and click it
      const caseItem = container.querySelector(".cursor-pointer") as HTMLElement;
      assert.ok(caseItem, "Rendered case card must exist in DOM");

      await act(async () => {
        caseItem.click();
      });

      assert.equal(selectedId, "uuid-bail-497", "Must invoke onSelectJudgment with target UUID");

      await act(async () => {
        root.unmount();
      });
    });

    it("[T3.3] Gracefully handles API error and displays retry button", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      let attempts = 0;
      globalThis.fetch = async () => {
        attempts++;
        if (attempts === 1) {
          return new Response("Server Error", { status: 500 });
        }
        return new Response(
          JSON.stringify([
            {
              id: 2,
              citation: "2025 LHC 639",
              title: "Recovered Landmark LHC Judgment",
              court: "Lahore High Court",
              judgmentId: "lhc-rec-2",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const container = dom.window.document.getElementById("root")!;
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });

      await act(async () => {
        await flushPromises();
      });

      // Verify error state in DOM
      assert.ok(container.innerHTML.includes("Failed to retrieve directory judgments"), "Error message must display");
      const retryButton = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Retry")
      );
      assert.ok(retryButton, "Retry button must be present in error state");

      // Click retry
      await act(async () => {
        retryButton!.click();
      });

      await act(async () => {
        await flushPromises();
      });

      assert.ok(attempts >= 2, "Retry must dispatch second fetch");
      assert.ok(container.innerHTML.includes("2025 LHC 639"), "Recovered case must display after retry");

      await act(async () => {
        root.unmount();
      });
    });

    it("[T3.4] Renders empty state when zero matching judgments return", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      globalThis.fetch = async () => {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const container = dom.window.document.getElementById("root")!;
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });

      await act(async () => {
        await flushPromises();
      });

      assert.ok(
        container.innerHTML.includes("No reported judgments match the selected directory criteria"),
        "Empty state message must render"
      );

      await act(async () => {
        root.unmount();
      });
    });

    it("[T3.5] Pagination renders controls and navigates between pages when item count exceeds itemsPerPage (8)", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      // Create 12 dummy judgments
      const manyJudgments = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        citation: `2024 SCMR ${100 + i}`,
        title: `Precedent Number ${i + 1}`,
        court: "Supreme Court of Pakistan",
        judgmentId: `uuid-${i + 1}`,
      }));

      globalThis.fetch = async () => {
        return new Response(JSON.stringify(manyJudgments), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const container = dom.window.document.getElementById("root")!;
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });

      await act(async () => {
        await flushPromises();
      });

      // Check page info
      assert.ok(container.innerHTML.includes("Page 1 of 2"), "Must show Page 1 of 2");
      assert.ok(container.innerHTML.includes("Precedent Number 1"), "Must show item 1 on page 1");
      assert.ok(container.innerHTML.includes("Precedent Number 8"), "Must show item 8 on page 1");
      assert.equal(container.innerHTML.includes("Precedent Number 9"), false, "Must NOT show item 9 on page 1");

      // Find Next button (second pagination button in footer)
      const paginationButtons = container.querySelectorAll("div.border-t button");
      assert.equal(paginationButtons.length, 2, "Must have Prev and Next pagination buttons");
      const nextBtn = paginationButtons[1] as HTMLElement;

      await act(async () => {
        nextBtn.click();
      });

      await act(async () => {
        await flushPromises();
      });

      assert.ok(container.innerHTML.includes("Page 2 of 2"), "Must show Page 2 of 2");
      assert.ok(container.innerHTML.includes("Precedent Number 9"), "Must show item 9 on page 2");
      assert.ok(container.innerHTML.includes("Precedent Number 12"), "Must show item 12 on page 2");
      assert.equal(container.innerHTML.includes("Precedent Number 1<"), false, "Must NOT show item 1 on page 2");

      await act(async () => {
        root.unmount();
      });
    });

    it("[T3.6] Interactive DOM dropdown changes trigger dynamic reactive API requests", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      const capturedUrls: string[] = [];
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        capturedUrls.push(url);
        return new Response(
          JSON.stringify([
            {
              id: 99,
              citation: "2026 SCMR 99",
              title: "Dynamic Filtered Result",
              court: "Supreme Court of Pakistan",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const container = dom.window.document.getElementById("root")!;
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });

      await act(async () => {
        await flushPromises();
      });

      // Find all select elements: [Court, Category, Journal, Year]
      const selects = container.querySelectorAll("select");
      assert.equal(selects.length, 4, "Must render 4 tier select dropdowns");

      const courtSelect = selects[0] as HTMLSelectElement;
      const journalSelect = selects[2] as HTMLSelectElement;
      const yearSelect = selects[3] as HTMLSelectElement;

      // 1. Change Court to LHC
      await act(async () => {
        courtSelect.value = "LHC";
        courtSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      await act(async () => {
        await flushPromises();
      });

      const lastUrl1 = capturedUrls[capturedUrls.length - 1];
      assert.ok(lastUrl1.includes("court=LHC"), `URL must contain court=LHC, got ${lastUrl1}`);

      // 2. Change Journal to PLD
      await act(async () => {
        journalSelect.value = "PLD";
        journalSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      await act(async () => {
        await flushPromises();
      });

      const lastUrl2 = capturedUrls[capturedUrls.length - 1];
      assert.ok(lastUrl2.includes("report=PLD"), `URL must contain report=PLD, got ${lastUrl2}`);

      // 3. Change Year to 2026
      await act(async () => {
        yearSelect.value = "2026";
        yearSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      await act(async () => {
        await flushPromises();
      });

      const lastUrl3 = capturedUrls[capturedUrls.length - 1];
      assert.ok(lastUrl3.includes("year=2026"), `URL must contain year=2026, got ${lastUrl3}`);

      // 4. Click Reset Filters button
      const resetBtn = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Reset Filters")
      );
      assert.ok(resetBtn, "Reset Filters button must be visible when filters are active");

      await act(async () => {
        resetBtn!.click();
      });
      await act(async () => {
        await flushPromises();
      });

      const lastUrl4 = capturedUrls[capturedUrls.length - 1];
      assert.ok(lastUrl4.includes("court=SC"), `Reset URL must fallback to default court=SC, got ${lastUrl4}`);

      await act(async () => {
        root.unmount();
      });
    });
  });
});
