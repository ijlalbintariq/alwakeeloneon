import "../server/load-env";
import crypto from "crypto";
import { db } from "../server/db";
import { apiKeys, users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../server/storage";
import { mcpUserContext } from "../server/mcp-server";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpServer } from "../server/mcp-server";
import express from "express";

async function parseSseResponse(response: Response): Promise<any> {
  const text = await response.text();
  console.log("Raw SSE Body:\n", text);
  const lines = text.split("\n");
  const dataLine = lines.find(l => l.startsWith("data: "));
  if (!dataLine) {
    throw new Error(`Invalid SSE response format. Raw body was: ${text}`);
  }
  const jsonStr = dataLine.substring(6).trim();
  return JSON.parse(jsonStr);
}

async function runTests() {
  console.log("=== Starting MCP End-to-End Tests ===");

  // 1. Fetch a test user from DB
  const [testUser] = await db.select().from(users).limit(1);
  if (!testUser) {
    console.error("No test user found in database. Please run seed or create a user first.");
    process.exit(1);
  }
  console.log(`Using test user: ${testUser.id} (${testUser.email})`);

  // 2. Generate a test token
  const testToken = `aw_live_test_${crypto.randomBytes(16).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(testToken).digest("hex");

  // Create API key in DB
  console.log("Creating API key in database...");
  await db.insert(apiKeys).values({
    userId: testUser.id,
    name: "E2E Test Key",
    keyHash,
    isActive: true,
  });

  // 3. Mock the Express server and register the routes
  const app = express();
  app.use(express.json());

  // Instantiate stateful transport and connect server
  const mcpTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
  });
  await mcpServer.connect(mcpTransport);

  // Register MCP unified route
  app.all(["/api/mcp", "/mcp", "/api/mcp/:token", "/mcp/:token"], async (req: any, res: any) => {
    let token = "";
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    } else if (req.query.token) {
      token = String(req.query.token).trim();
    } else if (req.params.token) {
      token = String(req.params.token).trim();
    }

    if (!token) {
      return res.status(401).json({ error: "Missing/invalid authorization" });
    }
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const record = await storage.getApiKeyByHash(tokenHash);
    if (!record) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    await mcpUserContext.run(record.userId, async () => {
      await mcpTransport.handleRequest(req, res, req.body);
    });
  });

  // Start the server on a test port
  const PORT = 54321;
  const serverInstance = app.listen(PORT, async () => {
    console.log(`Test server listening on port ${PORT}`);

    try {
      // Test Case A: Invalid token
      console.log("\n--- Test Case 1: Unauthorized access (Invalid Token) ---");
      const res1 = await fetch(`http://localhost:${PORT}/api/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Authorization": "Bearer aw_live_invalid_token",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "E2ETest", version: "1.0" }
          }
        }),
      });
      console.log("Status Code (Expected 401):", res1.status);
      if (res1.status !== 401) throw new Error("Unauthorized test failed");
      console.log("Success: Invalid token rejected.");

      // Test Case B: Initialize (Authorized, gets Session ID)
      console.log("\n--- Test Case 2: Initialize Session (Authorized) ---");
      const res2 = await fetch(`http://localhost:${PORT}/api/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Authorization": `Bearer ${testToken}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "E2ETest", version: "1.0" }
          }
        }),
      });
      console.log("Status Code (Expected 200):", res2.status);
      const sessionId = res2.headers.get("mcp-session-id") || "";
      console.log("Mcp-Session-Id:", sessionId);
      const initResult = await parseSseResponse(res2);
      console.log("Initialize Response JSON:", JSON.stringify(initResult));
      if (res2.status !== 200 || !sessionId) throw new Error("Initialization failed");
      console.log("Success: Session initialized.");

      // Test Case C: List tools (Authorized, with Session ID)
      console.log("\n--- Test Case 3: List tools ---");
      const res3 = await fetch(`http://localhost:${PORT}/api/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Authorization": `Bearer ${testToken}`,
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/list",
        }),
      });
      console.log("Status Code (Expected 200):", res3.status);
      const data3 = await parseSseResponse(res3);
      console.log("Response tools:", JSON.stringify(data3.result?.tools?.map((t: any) => t.name)));
      if (res3.status !== 200 || !data3.result?.tools) throw new Error("List tools test failed");
      console.log("Success: Tools listed.");

      // Test Case D: Call search_case_law tool
      console.log("\n--- Test Case 4: Call search_case_law ---");
      const res4 = await fetch(`http://localhost:${PORT}/api/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Authorization": `Bearer ${testToken}`,
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "search_case_law",
            arguments: {
              query: "tax appeal",
              limit: 2,
            }
          }
        }),
      });
      console.log("Status Code (Expected 200):", res4.status);
      const data4 = await parseSseResponse(res4);
      console.log("Call result text:", data4.result?.content?.[0]?.text);
      if (res4.status !== 200 || data4.error) {
        console.error("Error payload:", data4.error);
        throw new Error("search_case_law failed");
      }
      console.log("Success: search_case_law returned structured content.");

      // Test Case E: Call search_statutes tool
      console.log("\n--- Test Case 5: Call search_statutes ---");
      const res5 = await fetch(`http://localhost:${PORT}/api/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "Authorization": `Bearer ${testToken}`,
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: {
            name: "search_statutes",
            arguments: {
              query: "murder",
              limit: 2,
            }
          }
        }),
      });
      console.log("Status Code (Expected 200):", res5.status);
      const data5 = await parseSseResponse(res5);
      console.log("Call result text:", data5.result?.content?.[0]?.text);
      if (res5.status !== 200 || data5.error) {
        console.error("Error payload:", data5.error);
        throw new Error("search_statutes failed");
      }
      console.log("Success: search_statutes returned statutory info.");

      // Test Case F: Call search_statutes tool via query parameter token (URL-only)
      console.log("\n--- Test Case 6: Call search_statutes via Query Parameter Token ---");
      const res6 = await fetch(`http://localhost:${PORT}/api/mcp?token=${testToken}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          "mcp-session-id": sessionId,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: {
            name: "search_statutes",
            arguments: {
              query: "murder",
              limit: 1,
            }
          }
        }),
      });
      console.log("Status Code (Expected 200):", res6.status);
      const data6 = await parseSseResponse(res6);
      console.log("Call result text:", data6.result?.content?.[0]?.text);
      if (res6.status !== 200 || data6.error) {
        console.error("Error payload:", data6.error);
        throw new Error("Query Parameter Token authentication failed");
      }
      console.log("Success: Query Parameter Token authentication works.");

      console.log("\n=== All Tests Passed Successfully ===");
    } catch (err) {
      console.error("Test execution failed:", err);
      process.exit(1);
    } finally {
      // Clean up key
      console.log("\nCleaning up test API key from database...");
      await db.delete(apiKeys).where(eq(apiKeys.keyHash, keyHash));
      serverInstance.close(() => {
        console.log("Test server closed.");
        process.exit(0);
      });
    }
  });
}

runTests();
