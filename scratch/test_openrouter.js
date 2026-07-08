import OpenAI from "openai";
import "../server/load-env.ts";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error("OPENROUTER_API_KEY is not defined in the environment!");
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL: OPENROUTER_BASE_URL,
});

async function testModel(model) {
  console.log(`\nTesting model: ${model}`);
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Hello! Respond in one word." }],
      max_tokens: 10,
    });
    console.log(`Success! Response:`, response.choices[0]?.message?.content);
  } catch (err) {
    console.error(`Error for ${model}:`, err.message);
  }
}

async function run() {
  await testModel("google/gemini-3-flash-preview");
  await testModel("google/gemini-2.5-flash");
  await testModel("google/gemini-2.5-pro");
  await testModel("google/gemini-flash-1.5");
  await testModel("google/gemini-2.0-flash-exp");
  await testModel("google/gemini-2.0-flash");
}

run();
