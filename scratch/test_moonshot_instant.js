import OpenAI from "openai";
import "../server/load-env.ts";

const client = new OpenAI({
  apiKey: process.env.MOONSHOT_API_KEY,
  baseURL: "https://api.moonshot.ai/v1",
});

async function run() {
  console.log("Testing kimi-k2.6 with thinking: { type: 'disabled' }...");
  try {
    const startTime = Date.now();
    const params = {
      model: "kimi-k2.6",
      messages: [{ role: "user", content: "Tell me a joke." }],
      temperature: 0.6,
      max_tokens: 1000,
      thinking: { type: "disabled" },
    };

    const response = await client.chat.completions.create(params);

    console.log(`Response received in ${Date.now() - startTime}ms`);
    console.log(`Response:`, JSON.stringify(response, null, 2));
  } catch (err) {
    console.error("Failed:", err.message);
  }
}

run();
