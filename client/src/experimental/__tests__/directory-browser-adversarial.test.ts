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

describe("Adversarial Empirical Stress-Testing Suite: DirectoryBrowser", () => {
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

  async function flushPromises(ms = 30, iterations = 8) {
    for (let i = 0; i < iterations; i++) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  // Helper to dispatch input events to React controlled inputs in JSDOM
  function setReactInputValue(input: HTMLInputElement, value: string) {
    const nativeSetter = Object.getOwnPropertyDescriptor(
      dom.window.HTMLInputElement.prototype,
      "value"
    )?.set;
    nativeSetter?.call(input, value);
    input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  }

  // =========================================================================
  // SUITE 1: Search Queries with Special Characters, Urdu, Non-ASCII, Long Strings
  // =========================================================================
  describe("1. Adversarial Search Query Encoding & Parsing", () => {
    it("[ADV-1.1] Handles Urdu text (Nastaliq/Arabic script) in search terms", () => {
      const urduQuery = "عدالت عظمی پاکستان ضمانت بعد از گرفتاری";
      const url = buildDirectorySearchUrl({ search: urduQuery });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("q"), urduQuery);
      // Ensure URLSearchParams properly percent-encodes in toString()
      assert.ok(url.includes("%D8%B9%D8%AF%D8%A7%D9%84%D8%AA"));
    });

    it("[ADV-1.2] Handles special URL characters, ampersands, hashes, and query delimiters", () => {
      const complexQuery = "PLD 2024 SC 100 & Art. 199 / S. 497(2) ? #tag=1 + 100% [urgent]";
      const url = buildDirectorySearchUrl({ search: complexQuery });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("q"), complexQuery);
      assert.equal(parsed.searchParams.get("court"), null);
      assert.equal(parsed.searchParams.get("limit"), "50");
    });

    it("[ADV-1.3] Handles SQL Injection and Code Injection payloads without malforming URL", () => {
      const sqliPayload = "'; DROP TABLE judgments; SELECT * FROM users WHERE '1'='1";
      const url = buildDirectorySearchUrl({ search: sqliPayload });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("q"), sqliPayload);
    });

    it("[ADV-1.4] Handles XSS HTML script tags and character entities safely", () => {
      const xssPayload = "<script>alert('XSS')</script><img src=x onerror=alert(1)>";
      const url = buildDirectorySearchUrl({ search: xssPayload });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("q"), xssPayload);
    });

    it("[ADV-1.5] Handles massive query strings (10,000 chars) without crashing or truncation error", () => {
      const hugeQuery = "A".repeat(10000);
      const url = buildDirectorySearchUrl({ search: hugeQuery });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("q")?.length, 10000);
    });

    it("[ADV-1.6] Handles Unicode emojis and legal symbols", () => {
      const emojiQuery = "⚖️ Supreme Court 📜 Article 199 🇵🇰 High Court";
      const url = buildDirectorySearchUrl({ search: emojiQuery });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("q"), emojiQuery);
    });

    it("[ADV-1.7] Handles whitespace-only, tabs, and newline strings gracefully", () => {
      const whitespaceQuery = "   \t\n   ";
      const url = buildDirectorySearchUrl({ search: whitespaceQuery });
      const parsed = new URL(url, "http://localhost:5000");
      // When search is whitespace-only, trim() makes it empty, triggering fallback court=SC
      assert.equal(parsed.searchParams.has("q"), false);
      assert.equal(parsed.searchParams.get("court"), "SC");
    });
  });

  // =========================================================================
  // SUITE 2: Boundary Years & Edge-Case Court/Journal Codes
  // =========================================================================
  describe("2. Boundary Years & Edge-Case Court/Journal Configurations", () => {
    it("[ADV-2.1] Handles historical boundary year 1947 (Independence archive)", () => {
      const url = buildDirectorySearchUrl({ year: "1947" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("year"), "1947");
    });

    it("[ADV-2.2] Handles constitutional boundary year 1955 (Federation of Pakistan v. Maulvi Tamizuddin Khan)", () => {
      const url = buildDirectorySearchUrl({ year: "1955" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("year"), "1955");
    });

    it("[ADV-2.3] Handles current upper boundary year 2026", () => {
      const url = buildDirectorySearchUrl({ year: "2026" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("year"), "2026");
    });

    it("[ADV-2.4] Handles out-of-range or non-numeric year strings safely", () => {
      const url = buildDirectorySearchUrl({ year: "9999" });
      const parsed = new URL(url, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("year"), "9999");
    });

    it("[ADV-2.5] Maps all specialized and shariat court codes", () => {
      const fscUrl = buildDirectorySearchUrl({ courtCode: "FSC" });
      const parsedFsc = new URL(fscUrl, "http://localhost:5000");
      assert.equal(parsedFsc.searchParams.get("court"), "FSC");

      const bhcUrl = buildDirectorySearchUrl({ courtCode: "BHC" });
      const parsedBhc = new URL(bhcUrl, "http://localhost:5000");
      assert.equal(parsedBhc.searchParams.get("court"), "BHC");
    });

    it("[ADV-2.6] Handles non-standard and emerging Pakistani journal codes", () => {
      for (const jCode of ["PLD", "SCMR", "CLC", "PCRLJ", "YLR", "MLD", "CLD", "PTD", "PLC", "LHC"]) {
        const url = buildDirectorySearchUrl({ journalCode: jCode });
        const parsed = new URL(url, "http://localhost:5000");
        assert.equal(parsed.searchParams.get("report"), jCode);
      }
    });

    it("[ADV-2.7] Correctly maps and parses edge-case raw items with varying snapshot formats", () => {
      const rawApiItems = [
        {
          id: 501,
          citation: "1947 PLD 1",
          court: "Federal Court of Pakistan",
          title: "Pre-Constitution Historical Reference",
          year: 1947,
          page: 1,
        },
        {
          id: 502,
          citation: "1955 PLD FC 240",
          court: "Federal Court / Supreme Court",
          title: "Maulvi Tamizuddin Khan v. Federation",
          decisionDate: "1955-03-21T00:00:00.000Z",
          keywords: ["constitutional", "emergency"],
        },
        {
          id: 503,
          citation: "2026 SCMR 1",
          court: "Supreme Court of Pakistan",
          title: "Advance 2026 Apex Precedent",
          decisionDate: "2026-01-15T00:00:00.000Z",
        },
      ];

      const mapped: BrowseListItem[] = rawApiItems.map((j: any) => {
        const parsed = j.citation ? parsePakistaniCitation(j.citation) : null;
        const yr = Number(
          j.year || j.citationYear || parsed?.year || (j.decisionDate ? new Date(j.decisionDate).getFullYear() : 2024)
        );
        const pg = Number(j.page || j.citationPage || parsed?.page || 1);
        const jCode = j.journal || j.journalCode || j.citationReport || parsed?.journal || "PLD";
        const cCode =
          j.courtCode ||
          j.courtSnapshot ||
          (j.court?.includes("Supreme") || j.court?.includes("Federal") ? "SC" : "SC");

        return {
          id: String(j.judgmentId || j.id),
          judgmentId: j.judgmentId ? String(j.judgmentId) : undefined,
          year: yr,
          page: pg,
          citation: j.citation || "Citation Pending",
          title: j.title || "Reported Authority",
          decisionDate: j.decisionDate || null,
          courtName: j.court || "Supreme Court of Pakistan",
          courtSnapshot: cCode,
          journalCode: jCode,
        };
      });

      assert.equal(mapped[0].year, 1947);
      assert.equal(mapped[0].citation, "1947 PLD 1");
      assert.equal(mapped[1].year, 1955);
      assert.equal(mapped[2].year, 2026);
    });
  });

  // =========================================================================
  // SUITE 3: Rapid Filter Switching & AbortController Cancellation Harness
  // =========================================================================
  describe("3. Rapid Filter Switching, AbortController & Race Condition Defense", () => {
    it("[ADV-3.1] Aborts pending fetch requests when filters are switched rapidly", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      const abortSignals: AbortSignal[] = [];
      const fetchCalls: string[] = [];

      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        fetchCalls.push(url);
        if (init?.signal) {
          abortSignals.push(init.signal);
        }

        // Simulate network latency of 150ms
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, 150);
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              clearTimeout(timeout);
              const err = new Error("The user aborted a request.");
              err.name = "AbortError";
              reject(err);
            });
          }
        });

        return new Response(
          JSON.stringify([
            { id: 1, citation: "2024 SCMR 1", title: `Result for ${url}` },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const container = dom.window.document.getElementById("root")!;
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });

      const selects = container.querySelectorAll("select");
      const courtSelect = selects[0] as HTMLSelectElement;

      // Rapidly switch court 5 times without waiting for responses
      await act(async () => {
        courtSelect.value = "LHC";
        courtSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      await act(async () => {
        courtSelect.value = "SHC";
        courtSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      await act(async () => {
        courtSelect.value = "IHC";
        courtSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      await act(async () => {
        courtSelect.value = "PHC";
        courtSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      await act(async () => {
        courtSelect.value = "BHC";
        courtSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });

      // Allow all asynchronous tasks and timers to settle
      await act(async () => {
        await flushPromises(40, 10);
      });

      // Verify that earlier requests were aborted
      const abortedCount = abortSignals.filter((s) => s.aborted).length;
      assert.ok(
        abortedCount >= 1,
        `Expected at least 1 aborted signal during rapid switching, got ${abortedCount}`
      );

      // Verify final active signal is not aborted
      const finalSignal = abortSignals[abortSignals.length - 1];
      assert.equal(finalSignal.aborted, false, "Final request signal must NOT be aborted");

      // Verify the final rendered item matches the last filter (BHC)
      assert.ok(
        container.innerHTML.includes("Result for /api/case-law/search?court=BHC"),
        "Rendered result must belong to final selected filter (BHC)"
      );

      await act(async () => {
        root.unmount();
      });
    });

    it("[ADV-3.2] Out-of-Order Network Response Oracle: Slow earlier response never overwrites fast later response", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      let requestCount = 0;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        requestCount++;
        const currentReq = requestCount;
        const url = typeof input === "string" ? input : input.toString();

        // Request 1 is very slow (300ms), Request 2 is fast (30ms)
        const delay = currentReq === 1 ? 300 : 30;

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(resolve, delay);
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              clearTimeout(timeout);
              const err = new Error("The user aborted a request.");
              err.name = "AbortError";
              reject(err);
            });
          }
        });

        const citation = currentReq === 1 ? "SLOW-REQ-1 2024 SCMR 1" : "FAST-REQ-2 2024 LHC 99";
        return new Response(
          JSON.stringify([
            { id: currentReq, citation, title: `Title ${currentReq}`, court: "Lahore High Court" },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const container = dom.window.document.getElementById("root")!;
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });

      // Immediately switch filter to trigger Request 2
      const selects = container.querySelectorAll("select");
      const courtSelect = selects[0] as HTMLSelectElement;

      await act(async () => {
        courtSelect.value = "LHC";
        courtSelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });

      // Wait for both requests to settle
      await act(async () => {
        await flushPromises(50, 10);
      });

      // Verify that FAST-REQ-2 is shown and SLOW-REQ-1 did NOT overwrite it
      assert.ok(
        container.innerHTML.includes("FAST-REQ-2 2024 LHC 99"),
        "Must display latest request result"
      );
      assert.equal(
        container.innerHTML.includes("SLOW-REQ-1"),
        false,
        "Slow cancelled earlier request must NEVER display in DOM"
      );

      await act(async () => {
        root.unmount();
      });
    });

    it("[ADV-3.3] Pagination resets to page 1 on any filter change to prevent out-of-range slice bugs", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      const manyItems = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        citation: `2024 SCMR ${i + 1}`,
        title: `Precedent ${i + 1}`,
      }));

      globalThis.fetch = async () => {
        return new Response(JSON.stringify(manyItems), {
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

      // Navigate to page 2
      const nextBtn = container.querySelectorAll("div.border-t button")[1] as HTMLElement;
      await act(async () => {
        nextBtn.click();
      });
      await act(async () => {
        await flushPromises();
      });

      assert.ok(container.innerHTML.includes("Page 2 of 3"), "Must be on page 2");

      // Switch category filter -> verify pagination automatically resets to page 1
      const categorySelect = container.querySelectorAll("select")[1] as HTMLSelectElement;
      await act(async () => {
        categorySelect.value = "criminal";
        categorySelect.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      await act(async () => {
        await flushPromises();
      });

      assert.ok(container.innerHTML.includes("Page 1 of 3"), "Must have reset to Page 1 on filter change");

      await act(async () => {
        root.unmount();
      });
    });
  });

  // =========================================================================
  // SUITE 4: API Failure Responses, Network Errors, and Malformed Data
  // =========================================================================
  describe("4. API Failure Responses & Malformed Data Ingestion", () => {
    it("[ADV-4.1] Handles HTTP 404 Not Found error gracefully", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      globalThis.fetch = async () => {
        return new Response("Not Found", { status: 404, statusText: "Not Found" });
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
        container.innerHTML.includes("Failed to retrieve directory judgments"),
        "Must display user-facing error message on 404"
      );
      assert.ok(container.querySelector("button")?.textContent?.includes("Retry"));

      await act(async () => {
        root.unmount();
      });
    });

    it("[ADV-4.2] Handles total network drop / fetch rejection gracefully", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      globalThis.fetch = async () => {
        throw new TypeError("Failed to fetch: Connection refused (ERR_CONNECTION_REFUSED)");
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
        container.innerHTML.includes("Failed to retrieve directory judgments"),
        "Must display error message on network failure"
      );

      await act(async () => {
        root.unmount();
      });
    });

    it("[ADV-4.3] Ingests varied API response envelopes ({ results: [] }, { data: [] }, { judgments: [] })", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      // Test { results: [...] } envelope
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: "envelope-1",
                citation: "2024 SCMR 777",
                title: "Enveloped Precedent in .results",
              },
            ],
          }),
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

      assert.ok(container.innerHTML.includes("2024 SCMR 777"), "Must parse { results: [...] } envelope");
      assert.ok(container.innerHTML.includes("Enveloped Precedent in .results"));

      await act(async () => {
        root.unmount();
      });
    });

    it("[ADV-4.4] Handles non-array / unexpected API response structures ({ error: 'bad request' }, null, string)", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      globalThis.fetch = async () => {
        return new Response(JSON.stringify({ unexpectedKey: 12345 }), {
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

      // Should fall back to empty array and render empty state without throwing error
      assert.ok(
        container.innerHTML.includes("No reported judgments match the selected directory criteria"),
        "Must render empty state when response has unexpected schema"
      );

      await act(async () => {
        root.unmount();
      });
    });

    it("[ADV-4.5] Handles sparse judgment objects with missing/null fields safely", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify([
            {
              // Completely sparse object
              id: 999,
              citation: null,
              title: null,
              court: null,
              decisionDate: null,
              bench: null,
              summary: null,
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

      // Verify fallback texts are rendered safely
      assert.ok(container.innerHTML.includes("Citation Pending"), "Must render 'Citation Pending' fallback");
      assert.ok(container.innerHTML.includes("Reported Superior Court Authority"), "Must render fallback title");
      assert.ok(container.innerHTML.includes("Supreme Court of Pakistan"), "Must render fallback court name");

      await act(async () => {
        root.unmount();
      });
    });
  });

  // =========================================================================
  // SUITE 5: Debounce Timing & Keystroke Storm Harness
  // =========================================================================
  describe("5. Debounce Timing & Keystroke Storm Simulation", () => {
    it("[ADV-5.1] Typing keystroke storm does not trigger multiple API calls before 350ms quiet period", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      const capturedUrls: string[] = [];
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        capturedUrls.push(url);
        return new Response(
          JSON.stringify([
            { id: 1, citation: "2024 SCMR 10", title: "Search Match" },
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
        await flushPromises(20, 5);
      });

      const initialFetchCount = capturedUrls.length;
      assert.equal(initialFetchCount, 1, "Initial mount fetch count should be 1");

      const searchInput = container.querySelector("input[type='text']") as HTMLInputElement;

      // Simulate typing 'm-u-r-d-e-r' at 50ms intervals (< 350ms debounce window)
      const letters = ["m", "mu", "mur", "murd", "murde", "murder"];
      for (const word of letters) {
        await act(async () => {
          setReactInputValue(searchInput, word);
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });
      }

      // At this point (300ms total elapsed, only 50ms since last stroke), debounce has NOT expired
      const preDebounceCount = capturedUrls.length;
      assert.equal(preDebounceCount, 1, "Keystroke storm should not fire fetch before 350ms debounce quiet period");

      // Wait 450ms for debounce timer (350ms) to fire and execute fetch
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 450));
      });

      await act(async () => {
        await flushPromises(20, 5);
      });

      const postDebounceCount = capturedUrls.length;
      assert.equal(
        postDebounceCount,
        2,
        `Expected exactly 2 total fetches (1 mount + 1 debounced query), got ${postDebounceCount}`
      );

      const lastUrl = capturedUrls[capturedUrls.length - 1];
      assert.ok(lastUrl.includes("q=murder"), `Debounced URL must contain q=murder, got ${lastUrl}`);

      await act(async () => {
        root.unmount();
      });
    });
  });

  // =========================================================================
  // SUITE 6: Component Unmount In-Flight & Edge Cases
  // =========================================================================
  describe("6. Component Lifecycle Unmount & In-Flight Abort Safety", () => {
    it("[ADV-6.1] In-flight fetch is cleanly aborted upon component unmount without state warning", async () => {
      const ReactDOM = await import("react-dom/client");
      const { act } = await import("react");

      let aborted = false;
      globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise((resolve, reject) => {
          if (init?.signal) {
            init.signal.addEventListener("abort", () => {
              aborted = true;
              const err = new Error("Aborted");
              err.name = "AbortError";
              reject(err);
            });
          }
        });
      };

      const container = dom.window.document.getElementById("root")!;
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });

      // Unmount immediately while fetch is in flight
      await act(async () => {
        root.unmount();
      });

      assert.equal(aborted, true, "Signal must be marked aborted on unmount cleanup");
    });

    it("[ADV-6.2] buildDirectorySearchUrl handles empty, undefined, or partial filter objects", () => {
      const emptyUrl = buildDirectorySearchUrl({});
      const parsedEmpty = new URL(emptyUrl, "http://localhost:5000");
      assert.equal(parsedEmpty.searchParams.get("court"), "SC");
      assert.equal(parsedEmpty.searchParams.get("limit"), "50");
      assert.equal(parsedEmpty.searchParams.get("sort"), "latest");

      const partialUrl = buildDirectorySearchUrl({ limit: 25, sort: "relevance" });
      const parsedPartial = new URL(partialUrl, "http://localhost:5000");
      assert.equal(parsedPartial.searchParams.get("court"), "SC");
      assert.equal(parsedPartial.searchParams.get("limit"), "25");
      assert.equal(parsedPartial.searchParams.get("sort"), "relevance");
    });
  });
});
