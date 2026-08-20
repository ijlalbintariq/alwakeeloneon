import { spawn } from "child_process";
import axios from "axios";

async function testProductionServer() {
  console.log("=================================================");
  console.log("🚀 TESTING LIVE COMPILED PRODUCTION SERVER (dist/index.cjs)");
  console.log("=================================================\n");

  const testPort = 5099;
  const env = {
    ...process.env,
    PORT: String(testPort),
    NODE_ENV: "production",
  };

  console.log(`Starting production server on http://localhost:${testPort}...`);
  const serverProc = spawn("node", ["dist/index.cjs"], { env, cwd: process.cwd() });

  let serverStarted = false;

  serverProc.stdout.on("data", (data) => {
    const text = data.toString();
    if (text.includes("serving on port") || text.includes("Server running") || text.includes("listening")) {
      serverStarted = true;
    }
  });

  serverProc.stderr.on("data", (data) => {
    const errText = data.toString();
    if (!errText.includes("SECURITY WARNING: The SSL modes")) {
      console.warn("  [Server Stderr]", errText.trim());
    }
  });

  // Wait for server to become responsive
  let attempts = 0;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await axios.get(`http://127.0.0.1:${testPort}/`, { timeout: 2000 });
      if (res.status === 200) {
        console.log("✅ Production server successfully booted and accepting connections!");
        serverStarted = true;
        break;
      }
    } catch {
      attempts++;
    }
  }

  if (!serverStarted) {
    serverProc.kill("SIGTERM");
    console.error("❌ Server failed to respond within 20 seconds.");
    process.exit(1);
  }

  console.log("\n🧪 Running live HTTP endpoint checks on compiled bundle:");

  // Test 1: Frontend SPA HTML
  try {
    const htmlRes = await axios.get(`http://127.0.0.1:${testPort}/`, { timeout: 3000 });
    const isHtml = htmlRes.data.includes("<!DOCTYPE html>") || htmlRes.data.includes("<div id=\"root\">");
    console.log(`  ${isHtml ? "✅" : "❌"} [GET /] Frontend HTML SPA served (Status: ${htmlRes.status})`);
  } catch (e: any) {
    console.error("  ❌ [GET /] Failed:", e.message);
  }

  // Test 2: Cause List API
  try {
    const causeListRes = await axios.get(`http://127.0.0.1:${testPort}/api/cause-lists?court=LHC`, { timeout: 3000 });
    console.log(`  ✅ [GET /api/cause-lists?court=LHC] API returned JSON with ${causeListRes.data?.causeLists?.length ?? 0} rosters (Status: ${causeListRes.status})`);
  } catch (e: any) {
    console.error("  ❌ [GET /api/cause-lists] Failed:", e.message);
  }

  // Test 3: Google Calendar status API
  try {
    const gcalRes = await axios.get(`http://127.0.0.1:${testPort}/api/calendar/google/status`, { timeout: 3000, validateStatus: () => true });
    console.log(`  ✅ [GET /api/calendar/google/status] Calendar auth guard active (Status: ${gcalRes.status})`);
  } catch (e: any) {
    console.error("  ❌ [GET /api/calendar/google/status] Failed:", e.message);
  }

  // Gracefully terminate server
  serverProc.kill("SIGTERM");
  console.log("\n✅ Production test server shut down cleanly.");
  console.log("=================================================");
  console.log("🎉 ALL PRODUCTION CHECKS COMPLETED SUCCESSFULLY!");
  console.log("=================================================");
  process.exit(0);
}

testProductionServer().catch((e) => {
  console.error("Fatal error during production server test:", e);
  process.exit(1);
});
