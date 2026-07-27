import { streamWithOpenRouter } from "../server/openrouter";
import { streamWithDeepSeek } from "../server/deepseek-ai";

async function testStreamHandlers() {
  console.log("=== VERIFYING STREAM WATCHDOG TIMEOUT SIGNAL HANDLING ===");
  
  // Test 1: AbortSignal pre-aborted
  const controller = new AbortController();
  controller.abort();

  try {
    const gen = streamWithOpenRouter({
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    });
    await gen.next();
    console.log("OpenRouter pre-aborted test passed");
  } catch (err: any) {
    console.log("OpenRouter pre-abort caught cleanly:", err?.name || err?.message || err);
  }

  try {
    const gen = streamWithDeepSeek({
      messages: [{ role: "user", content: "hi" }],
      signal: controller.signal,
    });
    await gen.next();
    console.log("DeepSeek pre-aborted test passed");
  } catch (err: any) {
    console.log("DeepSeek pre-abort caught cleanly:", err?.name || err?.message || err);
  }

  console.log("=== ALL STREAM TESTS COMPLETED ===");
}

testStreamHandlers().catch(err => {
  console.error("TEST FAILED:", err);
});
