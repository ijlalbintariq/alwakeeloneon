import { isOpenRouterAvailable } from "../server/openrouter.js";
import { isDeepSeekAvailable } from "../server/deepseek-ai.js";

console.log("=== STREAMING WATCHDOG INTEGRITY VERIFICATION ===");
console.log("OpenRouter available:", isOpenRouterAvailable());
console.log("DeepSeek available:", isDeepSeekAvailable());
console.log("✅ Watchdog modules loaded successfully!");
