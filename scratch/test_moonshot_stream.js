import { streamWithMoonshot } from "../server/moonshot.ts";
import "../server/load-env.ts";

async function run() {
  console.log("Testing streamWithMoonshot...");
  try {
    const generator = streamWithMoonshot({
      messages: [{ role: "user", content: "Tell me a joke." }],
      maxTokens: 1000,
    });

    let receivedAny = false;
    let textReceived = "";
    const startTime = Date.now();

    for await (const chunk of generator) {
      if (!receivedAny) {
        console.log(`First chunk received after ${Date.now() - startTime}ms`);
        receivedAny = true;
      }
      process.stdout.write(chunk);
      textReceived += chunk;
    }
    console.log(`\nStream finished. Total length: ${textReceived.length}`);
  } catch (err) {
    console.error("Stream failed:", err.message);
  }
}

run();
