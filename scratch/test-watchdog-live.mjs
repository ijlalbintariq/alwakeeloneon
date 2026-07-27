import { isOpenRouterAvailable } from "../server/openrouter.js";
import { isDeepSeekAvailable } from "../server/deepseek-ai.js";

async function runTest() {
  console.log("=== WATCHDOG MODULE COMPILATION AND LOAD TEST ===");
  console.log("OpenRouter available:", isOpenRouterAvailable());
  console.log("DeepSeek available:", isDeepSeekAvailable());
  console.log("SUCCESS: Both modules load cleanly without any syntax, runtime, or import errors!");
}

runTest().catch((err) => {
  console.error("TEST FAILED WITH ERROR:", err);
  process.exit(1);
});
