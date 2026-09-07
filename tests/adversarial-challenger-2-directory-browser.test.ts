import assert from "node:assert/strict";
import test, { describe, it, beforeEach, afterEach, before } from "node:test";
import { JSDOM } from "jsdom";

// 1. Initialize global DOM environment FIRST
const dom = new JSDOM("<!DOCTYPE html><html><body><div id='root'></div></body></html>", {
  url: "http://localhost:5000",
});

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.window = dom.window as any;
globalThis.document = dom.window.document;
globalThis.Event = dom.window.Event as any;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLSelectElement = dom.window.HTMLSelectElement;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.HTMLButtonElement = dom.window.HTMLButtonElement;
globalThis.customElements = dom.window.customElements;

// Helper to simulate native React input typing
function setNativeInputValue(element: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
  }
  element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function setNativeSelectValue(select: HTMLSelectElement, value: string) {
  select.value = value;
  select.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}

async function flushAsync(cycles: number = 8, delayMs: number = 30) {
  for (let i = 0; i < cycles; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

describe("Adversarial Challenger 2 — DirectoryBrowser Empirical Verification Suite", async () => {
  // Dynamically load React & DirectoryBrowser AFTER DOM globals exist
  const React = await import("react");
  const ReactDOM = await import("react-dom/client");
  const { act } = React;
  const {
    DirectoryBrowser,
    buildDirectorySearchUrl,
    COURTS_DIRECTORY,
    JOURNALS_DIRECTORY,
    CATEGORIES_DIRECTORY,
  } = await import("../client/src/experimental/components/judgments/DirectoryBrowser");

  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    const rootEl = dom.window.document.getElementById("root");
    if (rootEl) {
      rootEl.innerHTML = "";
    }
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    const rootEl = dom.window.document.getElementById("root");
    if (rootEl) {
      rootEl.innerHTML = "";
    }
  });

  // =========================================================================
  // SECTION 1: Combinatorial URL Parameter Mapping & Query Construction
  // =========================================================================
  describe("1. Combinatorial URL Query Construction & Parameter Mapping", () => {
    const courts = ["ALL", "SC", "LHC", "SHC", "IHC", "PHC", "BHC", "FSC"];
    const categories = ["all", "constitutional", "criminal", "civil", "family", "corporate", "tax", "labor"];
    const journals = ["ALL", "PLD", "SCMR", "CLC", "PCRLJ", "YLR", "MLD", "CLD", "PTD", "PLC", "LHC"];
    const years = ["ALL", "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018", "2017", "2012", "1955"];
    const searchInputs = ["", "   ", "bail", "Section 497 CrPC", "special % & chars"];

    it("[P1.1] Grid Test: All Court forum parameters map accurately", () => {
      for (const court of courts) {
        const url = buildDirectorySearchUrl({ courtCode: court, year: "2024" });
        const parsed = new URL(url, "http://localhost:5000");
        if (court === "ALL") {
          assert.equal(parsed.searchParams.has("court"), false, "Court ALL should omit court param when another filter exists");
        } else {
          assert.equal(parsed.searchParams.get("court"), court, `Court ${court} should map to param court=${court}`);
        }
      }
    });

    it("[P1.2] Grid Test: All Law Journal reporters map accurately", () => {
      for (const journal of journals) {
        const url = buildDirectorySearchUrl({ journalCode: journal, year: "2024" });
        const parsed = new URL(url, "http://localhost:5000");
        if (journal === "ALL") {
          assert.equal(parsed.searchParams.has("report"), false, "Journal ALL should omit report param");
        } else {
          assert.equal(parsed.searchParams.get("report"), journal, `Journal ${journal} should map to report=${journal}`);
        }
      }
    });

    it("[P1.3] Grid Test: All Volume Years map accurately", () => {
      for (const year of years) {
        const url = buildDirectorySearchUrl({ year, courtCode: "SC" });
        const parsed = new URL(url, "http://localhost:5000");
        if (year === "ALL") {
          assert.equal(parsed.searchParams.has("year"), false, "Year ALL should omit year param");
        } else {
          assert.equal(parsed.searchParams.get("year"), year, `Year ${year} should map to year=${year}`);
        }
      }
    });

    it("[P1.4] Combinatorial Matrix: Category x Search query merging", () => {
      for (const category of categories) {
        for (const search of searchInputs) {
          const url = buildDirectorySearchUrl({ category, search, courtCode: "SC" });
          const parsed = new URL(url, "http://localhost:5000");
          const q = parsed.searchParams.get("q");

          const trimmedSearch = search.trim();
          const hasSearch = trimmedSearch.length > 0;
          const hasCategory = category !== "all";

          if (!hasSearch && !hasCategory) {
            assert.equal(q, null, `Empty search and category=all should yield no q parameter`);
          } else if (hasSearch && !hasCategory) {
            assert.equal(q, trimmedSearch, `Search '${search}' with category=all should yield q='${trimmedSearch}'`);
          } else if (!hasSearch && hasCategory) {
            assert.equal(q, category, `Empty search with category='${category}' should yield q='${category}'`);
          } else {
            assert.equal(q, `${trimmedSearch} ${category}`, `Search '${search}' with category='${category}' should yield combined q`);
          }
        }
      }
    });

    it("[P1.5] Default Fallback State: Zero active filters defaults to court=SC", () => {
      const defaultUrl = buildDirectorySearchUrl({
        courtCode: "ALL",
        category: "all",
        journalCode: "ALL",
        year: "ALL",
        search: "",
      });
      const parsed = new URL(defaultUrl, "http://localhost:5000");
      assert.equal(parsed.searchParams.get("court"), "SC", "Default empty filter state must set court=SC");
      assert.equal(parsed.searchParams.get("limit"), "50");
      assert.equal(parsed.searchParams.get("sort"), "latest");
      assert.equal(parsed.searchParams.has("report"), false);
      assert.equal(parsed.searchParams.has("year"), false);
      assert.equal(parsed.searchParams.has("q"), false);
    });

    it("[P1.6] Deterministic Oracle: 500 Pseudo-Random Combinatorial Permutations", () => {
      let seed = 42;
      function pseudoRandom() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      }

      for (let i = 0; i < 500; i++) {
        const c = courts[Math.floor(pseudoRandom() * courts.length)];
        const cat = categories[Math.floor(pseudoRandom() * categories.length)];
        const j = journals[Math.floor(pseudoRandom() * journals.length)];
        const y = years[Math.floor(pseudoRandom() * years.length)];
        const s = searchInputs[Math.floor(pseudoRandom() * searchInputs.length)];
        const limit = pseudoRandom() > 0.5 ? 25 : 100;
        const sort = pseudoRandom() > 0.5 ? "relevance" : "latest";

        const state = {
          courtCode: c,
          category: cat,
          journalCode: j,
          year: y,
          search: s,
          limit,
          sort,
        };

        const url = buildDirectorySearchUrl(state);
        const parsed = new URL(url, "http://localhost:5000");

        // Assert Court param
        const trimmedS = s.trim();
        const hasSearchTerms = trimmedS.length > 0 || cat !== "all";
        const isAllFiltersEmpty = (c === "ALL" || !c) && (j === "ALL" || !j) && (y === "ALL" || !y) && !hasSearchTerms;

        if (c && c !== "ALL") {
          assert.equal(parsed.searchParams.get("court"), c);
        } else if (isAllFiltersEmpty) {
          assert.equal(parsed.searchParams.get("court"), "SC");
        } else {
          assert.equal(parsed.searchParams.has("court"), false);
        }

        // Assert Journal param
        if (j && j !== "ALL") {
          assert.equal(parsed.searchParams.get("report"), j);
        } else {
          assert.equal(parsed.searchParams.has("report"), false);
        }

        // Assert Year param
        if (y && y !== "ALL") {
          assert.equal(parsed.searchParams.get("year"), y);
        } else {
          assert.equal(parsed.searchParams.has("year"), false);
        }

        // Assert Query param
        if (hasSearchTerms) {
          const expectedTerms: string[] = [];
          if (trimmedS) expectedTerms.push(trimmedS);
          if (cat !== "all") expectedTerms.push(cat);
          assert.equal(parsed.searchParams.get("q"), expectedTerms.join(" "));
        } else {
          assert.equal(parsed.searchParams.has("q"), false);
        }

        // Assert Limit & Sort
        assert.equal(parsed.searchParams.get("limit"), String(limit));
        assert.equal(parsed.searchParams.get("sort"), sort);
      }
    });
  });

  // =========================================================================
  // SECTION 2: UI Pagination Edge Cases (0, 1, 8, 9, 80 items & Clamping)
  // =========================================================================
  describe("2. UI Pagination Boundary Behavior & Clamping", () => {
    it("[P2.1] Pagination Edge Case: 0 Items renders empty state and NO pagination footer", async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });
      await act(async () => {
        await flushAsync();
      });

      assert.ok(container.innerHTML.includes("0 Precedents Indexed"), "Header must show 0 Precedents Indexed");
      assert.ok(container.innerHTML.includes("No reported judgments match"), "Must render empty state message");
      
      const paginationFooter = container.querySelector("div.border-t.font-mono");
      assert.equal(paginationFooter, null, "Pagination footer must NOT exist when 0 items returned");

      await act(async () => {
        root.unmount();
        container.remove();
      });
    });

    it("[P2.2] Pagination Edge Case: 1 Item renders single card and NO pagination footer", async () => {
      const singleItem = [
        {
          id: 1,
          citation: "2024 SCMR 1",
          title: "Solo Precedent Authority",
          court: "Supreme Court of Pakistan",
        },
      ];

      globalThis.fetch = async () => {
        return new Response(JSON.stringify(singleItem), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });
      await act(async () => {
        await flushAsync();
      });

      assert.ok(container.innerHTML.includes("1 Precedents Indexed"), "Header must show 1 Precedents Indexed");
      assert.ok(container.innerHTML.includes("2024 SCMR 1"), "Must display solo item citation");
      assert.ok(container.innerHTML.includes("Solo Precedent Authority"), "Must display solo item title");

      const paginationFooter = container.querySelector("div.border-t.font-mono");
      assert.equal(paginationFooter, null, "Pagination footer must NOT exist when 1 item returned");

      await act(async () => {
        root.unmount();
        container.remove();
      });
    });

    it("[P2.3] Pagination Edge Case: Exactly 8 Items (1 full page boundary) renders all 8 and NO pagination footer", async () => {
      const eightItems = Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        citation: `2024 SCMR ${101 + i}`,
        title: `Precedent Item ${i + 1}`,
        court: "Supreme Court of Pakistan",
      }));

      globalThis.fetch = async () => {
        return new Response(JSON.stringify(eightItems), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });
      await act(async () => {
        await flushAsync();
      });

      assert.ok(container.innerHTML.includes("8 Precedents Indexed"), "Header must show 8 Precedents Indexed");
      for (let i = 1; i <= 8; i++) {
        assert.ok(container.innerHTML.includes(`Precedent Item ${i}`), `Must display Precedent Item ${i}`);
      }

      // Exactly 8 items = 1 page -> totalPages = 1 -> no pagination footer rendered
      const paginationFooter = container.querySelector("div.border-t.font-mono");
      assert.equal(paginationFooter, null, "Pagination footer must NOT render when item count <= itemsPerPage (8)");

      await act(async () => {
        root.unmount();
        container.remove();
      });
    });

    it("[P2.4] Pagination Edge Case: 9 Items (2 pages boundary + 1) splits 8 on page 1 and 1 on page 2", async () => {
      const nineItems = Array.from({ length: 9 }, (_, i) => ({
        id: i + 1,
        citation: `2024 SCMR ${201 + i}`,
        title: `Precedent Case ${i + 1}`,
        court: "Supreme Court of Pakistan",
      }));

      globalThis.fetch = async () => {
        return new Response(JSON.stringify(nineItems), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });
      await act(async () => {
        await flushAsync();
      });

      // Page 1 Checks
      assert.ok(container.innerHTML.includes("9 Precedents Indexed"), "Header must show 9 Precedents Indexed");
      assert.ok(container.innerHTML.includes("Page 1 of 2 (9 judgments)"), "Pagination must indicate Page 1 of 2");
      for (let i = 1; i <= 8; i++) {
        assert.ok(container.innerHTML.includes(`Precedent Case ${i}`), `Page 1 must render item ${i}`);
      }
      assert.equal(container.innerHTML.includes("Precedent Case 9"), false, "Page 1 must NOT render item 9");

      const paginationButtons = container.querySelectorAll("div.border-t button");
      assert.equal(paginationButtons.length, 2);
      const prevBtn = paginationButtons[0] as HTMLButtonElement;
      const nextBtn = paginationButtons[1] as HTMLButtonElement;

      assert.equal(prevBtn.disabled, true, "Prev button must be disabled on page 1");
      assert.equal(nextBtn.disabled, false, "Next button must be enabled on page 1");

      // Navigate to Page 2
      await act(async () => {
        nextBtn.click();
      });
      await act(async () => {
        await flushAsync();
      });

      // Page 2 Checks
      assert.ok(container.innerHTML.includes("Page 2 of 2 (9 judgments)"), "Pagination must indicate Page 2 of 2");
      assert.ok(container.innerHTML.includes("Precedent Case 9"), "Page 2 must render item 9");
      assert.equal(container.innerHTML.includes("Precedent Case 1<"), false, "Page 2 must NOT render item 1");
      assert.equal(prevBtn.disabled, false, "Prev button must be enabled on page 2");
      assert.equal(nextBtn.disabled, true, "Next button must be disabled on page 2");

      // Navigate back to Page 1
      await act(async () => {
        prevBtn.click();
      });
      await act(async () => {
        await flushAsync();
      });

      assert.ok(container.innerHTML.includes("Page 1 of 2 (9 judgments)"), "Returned to Page 1 of 2");
      assert.ok(container.innerHTML.includes("Precedent Case 1"), "Page 1 renders item 1 again");

      await act(async () => {
        root.unmount();
        container.remove();
      });
    });

    it("[P2.5] Pagination Edge Case: 80 Items (10 full pages) sequential traversal and boundary disablement", async () => {
      const eightyItems = Array.from({ length: 80 }, (_, i) => ({
        id: i + 1,
        citation: `2024 SCMR ${1000 + i}`,
        title: `Judgment Authority #${i + 1}`,
        court: "Supreme Court of Pakistan",
      }));

      globalThis.fetch = async () => {
        return new Response(JSON.stringify(eightyItems), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });
      await act(async () => {
        await flushAsync();
      });

      assert.ok(container.innerHTML.includes("80 Precedents Indexed"));
      assert.ok(container.innerHTML.includes("Page 1 of 10 (80 judgments)"));

      const getButtons = () => container.querySelectorAll("div.border-t button");

      // Step forward through all 10 pages
      for (let page = 1; page <= 10; page++) {
        assert.ok(
          container.innerHTML.includes(`Page ${page} of 10`),
          `DOM should display Page ${page} of 10`
        );
        const firstItemOnPage = (page - 1) * 8 + 1;
        const lastItemOnPage = page * 8;
        assert.ok(
          container.innerHTML.includes(`Judgment Authority #${firstItemOnPage}`),
          `Page ${page} must contain Judgment Authority #${firstItemOnPage}`
        );
        assert.ok(
          container.innerHTML.includes(`Judgment Authority #${lastItemOnPage}`),
          `Page ${page} must contain Judgment Authority #${lastItemOnPage}`
        );

        const [prev, next] = Array.from(getButtons()) as HTMLButtonElement[];
        if (page === 1) {
          assert.equal(prev.disabled, true);
          assert.equal(next.disabled, false);
        } else if (page === 10) {
          assert.equal(prev.disabled, false);
          assert.equal(next.disabled, true);
        } else {
          assert.equal(prev.disabled, false);
          assert.equal(next.disabled, false);
        }

        if (page < 10) {
          await act(async () => {
            next.click();
          });
          await act(async () => {
            await flushAsync();
          });
        }
      }

      // At page 10, clicking next again does nothing
      const [, nextAt10] = Array.from(getButtons()) as HTMLButtonElement[];
      await act(async () => {
        nextAt10.click();
      });
      await act(async () => {
        await flushAsync();
      });
      assert.ok(container.innerHTML.includes("Page 10 of 10"));

      await act(async () => {
        root.unmount();
        container.remove();
      });
    });

    it("[P2.6] Pagination Clamping: Page index is clamped/reset to 1 on any filter change", async () => {
      const eightyItems = Array.from({ length: 80 }, (_, i) => ({
        id: i + 1,
        citation: `2024 SCMR ${1000 + i}`,
        title: `Precedent #${i + 1}`,
        court: "Supreme Court of Pakistan",
      }));

      globalThis.fetch = async () => {
        return new Response(JSON.stringify(eightyItems), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });
      await act(async () => {
        await flushAsync();
      });

      const getNextButton = () => container.querySelectorAll("div.border-t button")[1] as HTMLButtonElement;
      const selects = container.querySelectorAll("select");
      const courtSelect = selects[0] as HTMLSelectElement;
      const catSelect = selects[1] as HTMLSelectElement;
      const journalSelect = selects[2] as HTMLSelectElement;
      const yearSelect = selects[3] as HTMLSelectElement;
      const searchInput = container.querySelector("input[type='text']") as HTMLInputElement;

      // 1. Advance to Page 5
      for (let p = 1; p < 5; p++) {
        await act(async () => {
          getNextButton().click();
        });
        await act(async () => {
          await flushAsync();
        });
      }
      assert.ok(container.innerHTML.includes("Page 5 of 10"), "Should be at Page 5");

      // Change Court -> Page resets to 1
      await act(async () => {
        setNativeSelectValue(courtSelect, "LHC");
      });
      await act(async () => {
        await flushAsync();
      });
      assert.ok(container.innerHTML.includes("Page 1 of 10"), "Court change must reset page to 1");

      // 2. Advance to Page 4
      for (let p = 1; p < 4; p++) {
        await act(async () => {
          getNextButton().click();
        });
        await act(async () => {
          await flushAsync();
        });
      }
      assert.ok(container.innerHTML.includes("Page 4 of 10"), "Should be at Page 4");

      // Change Category -> Page resets to 1
      await act(async () => {
        setNativeSelectValue(catSelect, "criminal");
      });
      await act(async () => {
        await flushAsync();
      });
      assert.ok(container.innerHTML.includes("Page 1 of 10"), "Category change must reset page to 1");

      // 3. Advance to Page 3
      for (let p = 1; p < 3; p++) {
        await act(async () => {
          getNextButton().click();
        });
        await act(async () => {
          await flushAsync();
        });
      }
      assert.ok(container.innerHTML.includes("Page 3 of 10"), "Should be at Page 3");

      // Change Journal -> Page resets to 1
      await act(async () => {
        setNativeSelectValue(journalSelect, "PLD");
      });
      await act(async () => {
        await flushAsync();
      });
      assert.ok(container.innerHTML.includes("Page 1 of 10"), "Journal change must reset page to 1");

      // 4. Advance to Page 2
      await act(async () => {
        getNextButton().click();
      });
      await act(async () => {
        await flushAsync();
      });
      assert.ok(container.innerHTML.includes("Page 2 of 10"), "Should be at Page 2");

      // Change Year -> Page resets to 1
      await act(async () => {
        setNativeSelectValue(yearSelect, "2026");
      });
      await act(async () => {
        await flushAsync();
      });
      assert.ok(container.innerHTML.includes("Page 1 of 10"), "Year change must reset page to 1");

      // 5. Advance to Page 6
      for (let p = 1; p < 6; p++) {
        await act(async () => {
          getNextButton().click();
        });
        await act(async () => {
          await flushAsync();
        });
      }
      assert.ok(container.innerHTML.includes("Page 6 of 10"), "Should be at Page 6");

      // Change Search Input -> Page resets to 1
      await act(async () => {
        setNativeInputValue(searchInput, "bail");
      });
      await act(async () => {
        // Wait for debounce and fetch cycle
        await new Promise((r) => setTimeout(r, 450));
        await flushAsync();
      });
      assert.ok(container.innerHTML.includes("Page 1 of 10"), "Search input change must reset page to 1");

      await act(async () => {
        root.unmount();
        container.remove();
      });
    });
  });

  // =========================================================================
  // SECTION 3: Reset Filters Action & Clean Default Fetch
  // =========================================================================
  describe("3. Reset Filters Action, Button Visibility & Re-trigger", () => {
    it("[P3.1] Reset Filters button visibility toggles dynamically based on active filter state", async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify([{ id: 1, citation: "2024 SCMR 1", title: "T1" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });
      await act(async () => {
        await flushAsync();
      });

      const findResetBtn = () =>
        Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Reset Filters"));

      // Initial clean state: Reset button should NOT exist
      assert.equal(findResetBtn(), undefined, "Reset Filters should be hidden when in default state");

      const selects = container.querySelectorAll("select");
      const courtSelect = selects[0] as HTMLSelectElement;

      // 1. Activate Court filter -> Reset button appears
      await act(async () => {
        setNativeSelectValue(courtSelect, "SHC");
      });
      await act(async () => {
        await flushAsync();
      });
      assert.ok(findResetBtn(), "Reset Filters should be visible when Court is SHC");

      // Click Reset -> Reset button disappears
      await act(async () => {
        findResetBtn()!.click();
      });
      await act(async () => {
        await flushAsync();
      });
      assert.equal(findResetBtn(), undefined, "Reset Filters should disappear after clicking reset");

      // 2. Type in Search input -> Reset button appears
      const searchInput = container.querySelector("input[type='text']") as HTMLInputElement;
      await act(async () => {
        setNativeInputValue(searchInput, "habeas corpus");
      });
      await act(async () => {
        await flushAsync();
      });
      assert.ok(findResetBtn(), "Reset Filters should be visible when search is populated");

      // Click Reset -> Reset button disappears and input is empty
      await act(async () => {
        findResetBtn()!.click();
      });
      await act(async () => {
        await flushAsync();
      });
      assert.equal(findResetBtn(), undefined, "Reset Filters should disappear after reset");
      assert.equal(searchInput.value, "", "Search input must be cleared");

      await act(async () => {
        root.unmount();
        container.remove();
      });
    });

    it("[P3.2] Reset Filters clears all 4 tiers, search string, and re-triggers clean default fetch", async () => {
      const capturedUrls: string[] = [];
      globalThis.fetch = async (input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        capturedUrls.push(url);
        return new Response(JSON.stringify([{ id: 10, citation: "2026 SCMR 10", title: "Clean Result" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(React.createElement(DirectoryBrowser, { onSelectJudgment: () => {} }));
      });
      await act(async () => {
        await flushAsync();
      });

      const selects = container.querySelectorAll("select");
      const courtSelect = selects[0] as HTMLSelectElement;
      const catSelect = selects[1] as HTMLSelectElement;
      const journalSelect = selects[2] as HTMLSelectElement;
      const yearSelect = selects[3] as HTMLSelectElement;
      const searchInput = container.querySelector("input[type='text']") as HTMLInputElement;

      // Set complex compound filter
      await act(async () => {
        setNativeSelectValue(courtSelect, "IHC");
        setNativeSelectValue(catSelect, "family");
        setNativeSelectValue(journalSelect, "CLC");
        setNativeSelectValue(yearSelect, "2023");
        setNativeInputValue(searchInput, "custody");
      });
      await act(async () => {
        // Wait for debounce
        await new Promise((r) => setTimeout(r, 450));
        await flushAsync();
      });

      // Verify filtered query was sent
      const filteredUrl = capturedUrls[capturedUrls.length - 1];
      assert.ok(filteredUrl.includes("court=IHC"));
      assert.ok(filteredUrl.includes("report=CLC"));
      assert.ok(filteredUrl.includes("year=2023"));
      assert.ok(filteredUrl.includes("q="));

      // Click Reset Filters
      const resetBtn = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Reset Filters")
      );
      assert.ok(resetBtn);

      await act(async () => {
        resetBtn!.click();
      });
      await act(async () => {
        await flushAsync();
      });

      // Verify DOM inputs reset
      assert.equal(courtSelect.value, "ALL");
      assert.equal(catSelect.value, "all");
      assert.equal(journalSelect.value, "ALL");
      assert.equal(yearSelect.value, "ALL");
      assert.equal(searchInput.value, "");

      // Verify re-triggered default fetch
      const finalUrl = capturedUrls[capturedUrls.length - 1];
      assert.ok(finalUrl.includes("court=SC"), `Final reset URL must default to court=SC, got ${finalUrl}`);
      assert.equal(finalUrl.includes("court=IHC"), false);
      assert.equal(finalUrl.includes("report=CLC"), false);
      assert.equal(finalUrl.includes("year=2023"), false);

      await act(async () => {
        root.unmount();
        container.remove();
      });
    });
  });

  // =========================================================================
  // SECTION 4: onSelectJudgment Callback Invocation
  // =========================================================================
  describe("4. onSelectJudgment Callback Invocation Across Item Schema Variations", () => {
    it("[P4.1] Card click invokes onSelectJudgment with UUID when judgmentId is provided", async () => {
      let selectedId: string | null = null;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify([
            {
              id: 999,
              judgmentId: "8f7b9c1a-2d3e-4f5a-6b7c-8d9e0f1a2b3c",
              citation: "2024 SCMR 999",
              title: "Apex Constitutional Bench Authority",
              court: "Supreme Court of Pakistan",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);
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
        await flushAsync();
      });

      const card = container.querySelector(".cursor-pointer") as HTMLElement;
      assert.ok(card, "Judgment card should exist");

      await act(async () => {
        card.click();
      });

      assert.equal(selectedId, "8f7b9c1a-2d3e-4f5a-6b7c-8d9e0f1a2b3c");

      await act(async () => {
        root.unmount();
        container.remove();
      });
    });

    it("[P4.2] Card click falls back to stringified item.id when judgmentId is undefined", async () => {
      let selectedId: string | null = null;
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify([
            {
              id: 54321,
              citation: "2023 PLD 450",
              title: "High Court Precedent Without UUID",
              court: "Lahore High Court",
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      };

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);
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
        await flushAsync();
      });

      const card = container.querySelector(".cursor-pointer") as HTMLElement;
      assert.ok(card);

      await act(async () => {
        card.click();
      });

      assert.equal(selectedId, "54321");

      await act(async () => {
        root.unmount();
        container.remove();
      });
    });

    it("[P4.3] Multiple item cards invoke onSelectJudgment with their respective distinct IDs", async () => {
      const invokedIds: string[] = [];
      const testCases = [
        { id: "item-alpha", judgmentId: "uuid-alpha", citation: "2024 SCMR 10", title: "Alpha" },
        { id: "item-beta", judgmentId: "uuid-beta", citation: "2024 SCMR 20", title: "Beta" },
        { id: "item-gamma", judgmentId: "uuid-gamma", citation: "2024 SCMR 30", title: "Gamma" },
      ];

      globalThis.fetch = async () => {
        return new Response(JSON.stringify(testCases), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };

      const container = dom.window.document.createElement("div");
      dom.window.document.body.appendChild(container);
      const root = ReactDOM.createRoot(container);

      await act(async () => {
        root.render(
          React.createElement(DirectoryBrowser, {
            onSelectJudgment: (id: string) => {
              invokedIds.push(id);
            },
          })
        );
      });
      await act(async () => {
        await flushAsync();
      });

      const cards = container.querySelectorAll(".cursor-pointer");
      assert.equal(cards.length, 3);

      // Click card 0, card 2, card 1
      await act(async () => {
        (cards[0] as HTMLElement).click();
      });
      await act(async () => {
        (cards[2] as HTMLElement).click();
      });
      await act(async () => {
        (cards[1] as HTMLElement).click();
      });

      assert.deepEqual(invokedIds, ["uuid-alpha", "uuid-gamma", "uuid-beta"]);

      await act(async () => {
        root.unmount();
        container.remove();
      });
    });
  });
});
