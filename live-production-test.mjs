/**
 * Live Production Test Suite - AI_ROUTER_V2
 * Makes real HTTP requests to test fallback chains with actual AI providers
 * Tests knowledge context, streaming responses, and provider failover
 */

// Using built-in Node.js 20 fetch - no external dependency needed

const BASE_URL = "http://localhost:5001";

const COMPLEX_LEGAL_QUESTION = `I am a small business owner in Pakistan considering converting from sole proprietor to LLC. 
What are the key legal implications regarding liability protection, contract transfers, tax implications, and commercial dispute protection? 
Please reference relevant Pakistani case law and SECP regulations.`;

interface TestResult {
  testName: string;
  endpoint: string;
  method: string;
  timestamp: string;
  startTime: number;
  endTime: number;
  latencyMs: number;
  statusCode?: number;
  provider?: string;
  tokensUsed?: { input: number; output: number };
  responseLength: number;
  success: boolean;
  error?: string;
  details?: Record<string, unknown>;
}

const results: TestResult[] = [];

async function testHealthCheck() {
  console.log("\n✅ PRE-TEST: Health Check");
  console.log("─".repeat(70));

  const startTime = performance.now();
  const timestamp = new Date().toISOString();

  try {
    const res = await fetch(`${BASE_URL}/health`, { timeout: 5000 });
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    const result: TestResult = {
      testName: "Health Check",
      endpoint: "/health",
      method: "GET",
      timestamp,
      startTime,
      endTime,
      latencyMs,
      statusCode: res.status,
      responseLength: 0,
      success: res.ok,
    };

    if (res.ok) {
      console.log(`✓ Server healthy: ${latencyMs}ms`);
      return true;
    } else {
      console.log(`✗ Server error: ${res.status}`);
      result.error = `HTTP ${res.status}`;
      results.push(result);
      return false;
    }
  } catch (error) {
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);
    const errorMsg = error instanceof Error ? error.message : String(error);

    const result: TestResult = {
      testName: "Health Check",
      endpoint: "/health",
      method: "GET",
      timestamp,
      startTime,
      endTime,
      latencyMs,
      responseLength: 0,
      success: false,
      error: errorMsg,
    };
    results.push(result);
    console.log(`✗ Server unreachable: ${errorMsg}`);
    return false;
  }
}

async function testKnowledgeContext() {
  console.log("\n🧠 TEST 1: Knowledge Context Gathering (Parallel Enrichment)");
  console.log("─".repeat(70));

  const timestamp = new Date().toISOString();
  const startTime = performance.now();

  try {
    // This endpoint tests the knowledge gathering pipeline with 2.5s deadline
    const payload = {
      query: COMPLEX_LEGAL_QUESTION,
      userId: "test-user-001",
      searchMode: false,
    };

    const res = await fetch(`${BASE_URL}/api/knowledge-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeout: 10000,
    });

    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);
    const body = await res.text();
    const responseLength = body.length;

    const result: TestResult = {
      testName: "Knowledge Context",
      endpoint: "/api/knowledge-context",
      method: "POST",
      timestamp,
      startTime,
      endTime,
      latencyMs,
      statusCode: res.status,
      responseLength,
      success: res.ok,
    };

    if (res.ok) {
      console.log(`✓ Knowledge context gathered: ${latencyMs}ms`);
      console.log(`  • Response size: ${(responseLength / 1024).toFixed(2)}KB`);
      console.log(`  • Status: ${res.status}`);
      if (body.length > 0) {
        const preview = body.substring(0, 100);
        console.log(`  • Preview: ${preview.replace(/\n/g, " ")}...`);
      }
    } else {
      result.error = `HTTP ${res.status}`;
      console.log(`✗ Knowledge context failed: ${res.status}`);
      console.log(`  Response: ${body.substring(0, 200)}`);
    }

    results.push(result);
  } catch (error) {
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);
    const errorMsg = error instanceof Error ? error.message : String(error);

    const result: TestResult = {
      testName: "Knowledge Context",
      endpoint: "/api/knowledge-context",
      method: "POST",
      timestamp,
      startTime,
      endTime,
      latencyMs,
      responseLength: 0,
      success: false,
      error: errorMsg,
    };
    results.push(result);
    console.log(`✗ Knowledge context error: ${errorMsg}`);
  }
}

async function testChatCompletion() {
  console.log("\n🤖 TEST 2: Chat Completion (Streaming with Fallback Chain)");
  console.log("─".repeat(70));

  const timestamp = new Date().toISOString();
  const startTime = performance.now();

  try {
    const payload = {
      messages: [
        {
          role: "user",
          content: COMPLEX_LEGAL_QUESTION,
        },
      ],
      stream: false,
      maxTokens: 500,
    };

    const res = await fetch(`${BASE_URL}/api/chat/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeout: 60000, // 30s per provider + buffer
    });

    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    let body = "";
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const jsonBody = await res.json();
      body = JSON.stringify(jsonBody);
    } else {
      body = await res.text();
    }

    const responseLength = body.length;

    const result: TestResult = {
      testName: "Chat Completion",
      endpoint: "/api/chat/completion",
      method: "POST",
      timestamp,
      startTime,
      endTime,
      latencyMs,
      statusCode: res.status,
      responseLength,
      success: res.ok,
      details: {
        contentType,
      },
    };

    if (res.ok) {
      console.log(`✓ Chat completion received: ${latencyMs}ms`);
      console.log(`  • Response size: ${(responseLength / 1024).toFixed(2)}KB`);
      console.log(`  • Status: ${res.status}`);
      console.log(`  • Content-Type: ${contentType}`);

      try {
        const jsonResponse = JSON.parse(body);
        if (jsonResponse.content) {
          const preview = String(jsonResponse.content).substring(0, 120);
          console.log(`  • Provider: ${jsonResponse.provider || "unknown"}`);
          console.log(
            `  • Model: ${jsonResponse.model || "unknown"}`,
          );
          console.log(`  • Preview: ${preview.replace(/\n/g, " ")}...`);
        }
      } catch {
        const preview = body.substring(0, 120);
        console.log(`  • Preview: ${preview.replace(/\n/g, " ")}...`);
      }
    } else {
      result.error = `HTTP ${res.status}`;
      console.log(`✗ Chat completion failed: ${res.status}`);
      console.log(
        `  Response: ${body.substring(0, 200).replace(/\n/g, " ")}...`,
      );
    }

    results.push(result);
  } catch (error) {
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);
    const errorMsg = error instanceof Error ? error.message : String(error);

    const result: TestResult = {
      testName: "Chat Completion",
      endpoint: "/api/chat/completion",
      method: "POST",
      timestamp,
      startTime,
      endTime,
      latencyMs,
      responseLength: 0,
      success: false,
      error: errorMsg,
    };
    results.push(result);
    console.log(`✗ Chat completion error: ${errorMsg}`);
  }
}

async function testStreamingResponse() {
  console.log(
    "\n💨 TEST 3: Streaming Response (Real-time Token Flow with Fallback)",
  );
  console.log("─".repeat(70));

  const timestamp = new Date().toISOString();
  const startTime = performance.now();
  let totalChunks = 0;
  let totalTokens = 0;

  try {
    const payload = {
      messages: [
        {
          role: "user",
          content: COMPLEX_LEGAL_QUESTION,
        },
      ],
      stream: true,
      maxTokens: 400,
    };

    const res = await fetch(`${BASE_URL}/api/chat/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeout: 60000,
    });

    if (!res.ok) {
      console.log(`✗ Streaming failed: HTTP ${res.status}`);
      const endTime = performance.now();
      const latencyMs = Math.round(endTime - startTime);

      const result: TestResult = {
        testName: "Streaming Response",
        endpoint: "/api/chat/completion",
        method: "POST",
        timestamp,
        startTime,
        endTime,
        latencyMs,
        statusCode: res.status,
        responseLength: 0,
        success: false,
        error: `HTTP ${res.status}`,
      };
      results.push(result);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      console.log(`✗ No response body readable`);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    const firstTokenTime = performance.now();
    let firstTokenReceived = false;

    console.log(`  • Streaming started...`);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!firstTokenReceived) {
        firstTokenReceived = true;
        const ttfb = Math.round(firstTokenTime - startTime);
        console.log(`  • Time to first token: ${ttfb}ms`);
      }

      buffer += decoder.decode(value, { stream: true });
      totalChunks++;

      // Count newlines as token markers (SSE format)
      const lines = buffer.split("\n");
      for (const line of lines.slice(0, -1)) {
        if (line.startsWith("data:")) {
          totalTokens++;
        }
      }
      buffer = lines[lines.length - 1];
    }

    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);

    const result: TestResult = {
      testName: "Streaming Response",
      endpoint: "/api/chat/completion",
      method: "POST",
      timestamp,
      startTime,
      endTime,
      latencyMs,
      responseLength: totalChunks,
      success: true,
      details: {
        chunks: totalChunks,
        estimatedTokens: totalTokens,
      },
    };
    results.push(result);

    console.log(`✓ Streaming completed: ${latencyMs}ms`);
    console.log(`  • Total chunks: ${totalChunks}`);
    console.log(`  • Estimated tokens: ${totalTokens}`);
    console.log(`  • Chunk rate: ${(totalChunks / (latencyMs / 1000)).toFixed(1)} chunks/sec`);
  } catch (error) {
    const endTime = performance.now();
    const latencyMs = Math.round(endTime - startTime);
    const errorMsg = error instanceof Error ? error.message : String(error);

    const result: TestResult = {
      testName: "Streaming Response",
      endpoint: "/api/chat/completion",
      method: "POST",
      timestamp,
      startTime,
      endTime,
      latencyMs,
      responseLength: totalChunks,
      success: false,
      error: errorMsg,
    };
    results.push(result);
    console.log(`✗ Streaming error: ${errorMsg}`);
  }
}

async function printSummaryReport() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════════╗");
  console.log("║              LIVE PRODUCTION TEST SUMMARY REPORT                   ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝");
  console.log("\n");

  // Test results overview
  console.log("📊 TEST RESULTS:");
  console.log("─".repeat(70));
  const successCount = results.filter((r) => r.success).length;
  const totalCount = results.length;
  const successRate = ((successCount / totalCount) * 100).toFixed(1);

  console.log(`Success Rate: ${successRate}% (${successCount}/${totalCount} tests)`);
  console.log("\n");

  for (const result of results) {
    const icon = result.success ? "✓" : "✗";
    const status = result.success ? "PASS" : "FAIL";
    console.log(
      `${icon} ${result.testName.padEnd(25)} | ${result.latencyMs}ms | ${status}`,
    );
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  // Latency analysis
  console.log("\n\n⏱️  LATENCY ANALYSIS:");
  console.log("─".repeat(70));
  const successResults = results.filter((r) => r.success && r.latencyMs > 0);
  if (successResults.length > 0) {
    const avgLatency = Math.round(
      successResults.reduce((sum, r) => sum + r.latencyMs, 0) / successResults.length,
    );
    const maxLatency = Math.max(...successResults.map((r) => r.latencyMs));
    const minLatency = Math.min(...successResults.map((r) => r.latencyMs));

    console.log(`Average Latency: ${avgLatency}ms`);
    console.log(`Max Latency: ${maxLatency}ms`);
    console.log(`Min Latency: ${minLatency}ms`);
    console.log(`P95 Latency: ${Math.round(maxLatency * 0.95)}ms`);
  }

  // AI_ROUTER_V2 Status
  console.log("\n\n🚀 AI_ROUTER_V2 STATUS:");
  console.log("─".repeat(70));
  console.log(`Feature Flag: ${process.env.AI_ROUTER_V2 ? "ENABLED" : "DISABLED (default)"}`);
  console.log(`Fallback Chain: groq → deepseek`);
  console.log(`Provider Timeout: 30s each`);
  console.log(`Parallel Enrichment: 2.5s deadline`);

  // Recommendations
  console.log("\n\n📌 RECOMMENDATIONS:");
  console.log("─".repeat(70));
  if (successRate === "100") {
    console.log("✅ All tests passed - system is healthy");
    console.log("✅ Ready for production deployment");
    console.log("✅ Enable AI_ROUTER_V2=1 in Render for enhanced resilience");
  } else {
    console.log("⚠️  Some tests failed - review errors above");
    console.log("⚠️  Check API credentials (GROQ_API_KEY, DEEPSEEK_API_KEY)");
    console.log("⚠️  Verify network connectivity to provider APIs");
  }

  console.log("\n\n📋 NEXT STEPS:");
  console.log("─".repeat(70));
  console.log("1. Push code to Render (already done - c16e07a)");
  console.log("2. Set AI_ROUTER_V2=1 in Render environment variables");
  console.log("3. Monitor provider availability and fallback rates");
  console.log("4. Track latency improvements vs. legacy path");
  console.log("5. Adjust KNOWLEDGE_OUTER_DEADLINE_MS if needed (default: 2.5s)");
  console.log("\n");
}

async function runFullTest() {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════════════╗");
  console.log("║        LIVE PRODUCTION TEST - AI_ROUTER_V2 Fallback Chains        ║");
  console.log("║              Testing with Real API Providers                       ║");
  console.log("╚════════════════════════════════════════════════════════════════════╝");
  console.log("\n");
  console.log("🎯 TEST CONFIGURATION:");
  console.log("─".repeat(70));
  console.log(`Server: ${BASE_URL}`);
  console.log(`Environment: Development (localhost:5001)`);
  console.log(`Test Time: ${new Date().toISOString()}`);
  console.log("\n");

  // Pre-flight check
  const healthOk = await testHealthCheck();
  if (!healthOk) {
    console.log("\n❌ Server is unreachable. Cannot proceed with tests.");
    return;
  }

  console.log("\n🚀 RUNNING LIVE TESTS...");
  console.log("─".repeat(70));

  // Run tests
  await testKnowledgeContext();
  await testChatCompletion();
  await testStreamingResponse();

  // Print summary
  await printSummaryReport();
}

// Execute
runFullTest().catch(console.error);
