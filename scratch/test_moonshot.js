import OpenAI from "openai";
import "../server/load-env.ts";

const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1";
const apiKey = process.env.MOONSHOT_API_KEY;

if (!apiKey) {
  console.error("MOONSHOT_API_KEY is not defined in the environment!");
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL: MOONSHOT_BASE_URL,
});

async function run() {
  console.log(`Testing Moonshot/Kimi with model: kimi-k2.6, maxTokens: 1000`);
  try {
    const response = await client.chat.completions.create({
      model: "kimi-k2.6",
      messages: [{ role: "user", content: "Tell me a joke." }],
      max_tokens: 1000,
      temperature: 1.0,
    });
    console.log(`Success! Response choice message content: "${response.choices[0]?.message?.content}"`);
    console.log(`Reasoning content length:`, response.choices[0]?.message?.reasoning_content?.length);
  } catch (err) {
    console.error(`Error for Kimi:`, err.message);
  }
}

run();
