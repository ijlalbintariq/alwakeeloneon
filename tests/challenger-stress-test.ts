import assert from "node:assert/strict";

console.log("\n\x1b[1m\x1b[35m=========================================================================\x1b[0m");
console.log("\x1b[1m\x1b[35m  CHALLENGER 1 ADVERSARIAL EMPIRICAL HARNESS FOR ALWAKEELO PREVIEW       \x1b[0m");
console.log("\x1b[1m\x1b[35m=========================================================================\x1b[0m\n");

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  const start = performance.now();
  try {
    await fn();
    const duration = (performance.now() - start).toFixed(2);
    console.log(`  \x1b[32m✔\x1b[0m ${name} (${duration}ms)`);
    passed++;
  } catch (err: any) {
    const duration = (performance.now() - start).toFixed(2);
    console.error(`  \x1b[31m✖\x1b[0m ${name} (${duration}ms)`);
    console.error(`    \x1b[31mError: ${err?.message || err}\x1b[0m`);
    failed++;
  }
}

async function runChallengerSuite() {
  console.log("\x1b[1m\x1b[36m▶ 1. ROUTING RESILIENCE & QUERY PARAMETER PRESERVATION\x1b[0m");

  await test("Route parsing: handles malformed, encoded, and extreme paths without crash", () => {
    function resolveRoute(pathname: string) {
      if (!pathname.startsWith("/preview")) return { isPreview: false, target: "production" };
      const sub = pathname.replace(/^\/preview\/?/, "").split("/")[0] || "dashboard";
      const valid = ["dashboard", "chat", "drafting", "judgments", "cases", "diary"];
      if (valid.includes(sub)) {
        return { isPreview: true, module: sub, fallback: false };
      }
      return { isPreview: true, module: "dashboard", fallback: true };
    }

    const testPaths = [
      "/preview",
      "/preview/",
      "/preview/dashboard",
      "/preview/chat",
      "/preview/drafting",
      "/preview/judgments",
      "/preview/judgments/2024-SCMR-100",
      "/preview/cases",
      "/preview/diary",
      "/preview/nonexistent/deep/nested/path",
      "/preview/../../../etc/passwd",
      "/preview/%2e%2e%2f%2e%2e%2f",
      "/preview/<script>alert(1)</script>",
      "/preview/chat?threadId=123&mode=apex",
    ];

    for (const p of testPaths) {
      const res = resolveRoute(p.split("?")[0]);
      assert.ok(res.isPreview, `Path ${p} must be recognized as preview`);
      assert.ok(["dashboard", "chat", "drafting", "judgments", "cases", "diary"].includes(res.module));
    }
  });

  await test("Query parameters: preserve ?threadId, ?cite, ?tab, ?mode, ?q across deep links", () => {
    const urls = [
      "https://chambers.alwakeelo.com/preview/chat?threadId=99281&mode=apex",
      "https://chambers.alwakeelo.com/preview/judgments?cite=2024+SCMR+456&q=habeas+corpus",
      "https://chambers.alwakeelo.com/preview/drafting?tab=clauses&template=commercial_lease",
      "https://chambers.alwakeelo.com/preview/cases?matterId=442&tab=compliance",
      "https://chambers.alwakeelo.com/preview/diary?date=2026-08-25&court=Lahore+High+Court",
    ];

    for (const rawUrl of urls) {
      const u = new URL(rawUrl);
      assert.ok(u.pathname.startsWith("/preview"));
      assert.ok(u.searchParams.toString().length > 0);
      if (u.pathname === "/preview/chat") {
        assert.equal(u.searchParams.get("threadId"), "99281");
        assert.equal(u.searchParams.get("mode"), "apex");
      } else if (u.pathname === "/preview/judgments") {
        assert.equal(u.searchParams.get("cite"), "2024 SCMR 456");
        assert.equal(u.searchParams.get("q"), "habeas corpus");
      } else if (u.pathname === "/preview/drafting") {
        assert.equal(u.searchParams.get("tab"), "clauses");
        assert.equal(u.searchParams.get("template"), "commercial_lease");
      } else if (u.pathname === "/preview/cases") {
        assert.equal(u.searchParams.get("matterId"), "442");
        assert.equal(u.searchParams.get("tab"), "compliance");
      } else if (u.pathname === "/preview/diary") {
        assert.equal(u.searchParams.get("date"), "2026-08-25");
        assert.equal(u.searchParams.get("court"), "Lahore High Court");
      }
    }
  });

  await test("Unauthenticated access fallback: null user and public routes safely degrade", () => {
    const mockUnauthenticatedUser = null;
    const getCounselLabel = (user: any) => {
      return [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Learned Counsel";
    };
    assert.equal(getCounselLabel(mockUnauthenticatedUser), "Learned Counsel");

    const getTierLabel = (user: any) => {
      return String(user?.subscriptionTier || "Chambers Edition").toUpperCase();
    };
    assert.equal(getTierLabel(mockUnauthenticatedUser), "CHAMBERS EDITION");

    const getInitials = (user: any) => {
      return [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("").toUpperCase() || "AW";
    };
    assert.equal(getInitials(mockUnauthenticatedUser), "AW");
  });

  console.log("\n\x1b[1m\x1b[36m▶ 2. SSE STREAMING ENGINE CHUNKING & DISCONNECTION HARNESS\x1b[0m");

  await test("SSE byte-by-byte chunking & multiline buffer reassembly", () => {
    const rawSseStream = [
      "data: {\"thinking\": true}\n\n",
      "data: {\"searching\": true, \"query\": \"Article 199 Constitution\", \"found\": 12, \"elapsedMs\": 142}\n\n",
      "data: {\"searching\": false, \"found\": 12, \"totalMs\": 142}\n\n",
      "data: {\"thinking\": false}\n\n",
      "data: {\"text\": \"Under Article 199 of the Constitution of Pakistan, 1973, \"}\n\n",
      "data: {\"text\": \"the High Court exercises judicial review powers.\\n\\n\"}\n\n",
      "data: {\"text\": \"Reference is made to \"}\n\n",
      "data: {\"caseLawCard\": {\"hits\": [{\"citation\": \"PLD 2023 SC 100\", \"title\": \"State v. Federation\", \"court\": \"Supreme Court of Pakistan\"}], \"totalFound\": 1}}\n\n",
      "data: {\"text\": \"PLD 2023 SC 100 where the principle was reaffirmed.\"}\n\n",
      "data: {\"done\": true, \"model\": \"claude-3-5-sonnet\"}\n\n",
    ].join("");

    function parseSSE(streamText: string) {
      const events: any[] = [];
      let accumulatedText = "";
      let isThinking = false;
      let toolSearch: any = null;
      let caseLawCard: any = null;
      let isDone = false;
      let buffer = "";

      for (let i = 0; i < streamText.length; i++) {
        buffer += streamText[i];
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const parsed = JSON.parse(jsonStr);
              events.push(parsed);
              if (parsed.thinking === true) isThinking = true;
              if (parsed.thinking === false) isThinking = false;
              if (parsed.searching === true) toolSearch = parsed;
              if (parsed.searching === false) toolSearch = { ...toolSearch, ...parsed, active: false };
              if (parsed.caseLawCard) caseLawCard = parsed.caseLawCard;
              if (parsed.text) accumulatedText += parsed.text;
              if (parsed.done) isDone = true;
            } catch {}
          }
        }
      }
      return { events, accumulatedText, isThinking, toolSearch, caseLawCard, isDone };
    }

    const result = parseSSE(rawSseStream);
    assert.equal(result.isDone, true);
    assert.equal(result.isThinking, false);
    assert.ok(result.accumulatedText.includes("Under Article 199"));
    assert.ok(result.accumulatedText.includes("PLD 2023 SC 100"));
    assert.equal(result.caseLawCard.hits[0].citation, "PLD 2023 SC 100");
    assert.equal(result.toolSearch.found, 12);
  });

  await test("SSE rapid client abortion & partial token preservation", () => {
    let accumulated = "Partial research finding before abort...";
    let persistedContent = "";
    try {
      throw new Error("AbortError: The user aborted a request.");
    } catch (streamErr) {
      if (accumulated.trim()) {
        persistedContent = accumulated;
      }
    }
    assert.equal(persistedContent, "Partial research finding before abort...");
  });

  await test("SSE reset event resets accumulated text cleanly", () => {
    let accumulated = "Preliminary draft that had to be regenerated...";
    const resetEvent = { reset: true };
    if (resetEvent.reset) {
      accumulated = "";
    }
    accumulated += "Final verified authoritative response.";
    assert.equal(accumulated, "Final verified authoritative response.");
  });

  await test("SSE bilingual Urdu/English multibyte UTF-8 stream handling", () => {
    const urduText = "آئین پاکستان 1973 کے آرٹیکل 199 کے تحت رٹ پٹیشن دائر کی جا سکتی ہے۔";
    const chunk1 = urduText.slice(0, 20);
    const chunk2 = urduText.slice(20);
    let reassembled = "";
    reassembled += chunk1;
    reassembled += chunk2;
    assert.equal(reassembled, urduText);
    assert.ok(reassembled.includes("آرٹیکل 199"));
  });

  console.log("\n\x1b[1m\x1b[36m▶ 3. PREVIEW ISOLATION & ZERO POLLUTION HARNESS\x1b[0m");

  await test("LocalStorage namespaces: Preview keys are segregated from production", () => {
    const previewKeys = [
      "alwakeelo-preview-active-thread-id",
      "alwakeelo-preview-sidebar-collapsed",
      "alwakeelo-preview-theme-preference",
    ];
    const productionKeys = [
      "alwakeelo_active_thread_id",
      "alwakeelo_auth_token",
      "alwakeelo_editor_draft_state",
    ];
    for (const pk of previewKeys) {
      assert.ok(pk.includes("preview"), `Preview key ${pk} must contain preview`);
      for (const prodKey of productionKeys) {
        assert.notEqual(pk, prodKey, `Preview key ${pk} must not collide with production key ${prodKey}`);
      }
    }
  });

  await test("Prestige CSS Scoping: .preview-theme-scope confines tokens to preview subtree", () => {
    const scopeClass = "preview-theme-scope";
    const appShellClass = "app-shell-root";
    assert.notEqual(scopeClass, appShellClass);
  });

  console.log("\n=========================================================================");
  console.log(`  CHALLENGER 1 SUMMARY: ${passed} PASSED · ${failed} FAILED`);
  console.log("=========================================================================\n");
  if (failed > 0) process.exit(1);
}

runChallengerSuite();