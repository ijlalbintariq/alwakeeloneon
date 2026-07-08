import fetch from "node-fetch";

async function main() {
  console.log("1. Logging in as test.quality.check@example.com...");
  const loginRes = await fetch("http://localhost:5001/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test.quality.check@example.com",
      password: "testpassword123"
    })
  });

  if (!loginRes.ok) {
    throw new Error(`Login failed with status ${loginRes.status}: ${await loginRes.text()}`);
  }

  console.log("Login successful!");
  const setCookie = loginRes.headers.get("set-cookie");
  if (!setCookie) {
    throw new Error("No Set-Cookie header returned on login!");
  }

  // Extract the main session cookie (usually starts with connect.sid)
  const cookie = setCookie.split(";")[0];
  console.log(`Extracted session cookie: ${cookie.slice(0, 20)}...`);

  console.log("2. Sending legal chat query in turbo mode...");
  const startTime = Date.now();
  const chatRes = await fetch("http://localhost:5001/api/ai/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie
    },
    body: JSON.stringify({
      messages: [
        {
          "role": "user",
          "content": "I am a co-sharer in an ancestral agricultural land in Punjab. One of the other co-sharers has sold a specific portion of the undivided joint land to a third party without my consent and without any partition of the property. The buyer has started constructing a structure on that specific portion of the land. Under Pakistani law, what are my legal remedies? Can I seek a permanent injunction to stop the construction? Can I file a suit for partition? What is the status of a sale of a specific portion of undivided joint property by a co-sharer under the Punjab Land Revenue Act 1967 and relevant Supreme Court rulings? Which court has jurisdiction, and what documents are required?"
        }
      ],
      type: "al-wakeelo",
      aiMode: "turbo",
      stream: false
    })
  });
  const duration = Date.now() - startTime;

  if (!chatRes.ok) {
    throw new Error(`Chat request failed with status ${chatRes.status}: ${await chatRes.text()}`);
  }

  const data = await chatRes.json() as { content: string; model: string };
  console.log("3. AI Chat Response received!");
  console.log(`Model used: ${data.model}`);
  console.log(`Response Time: ${duration} ms (${(duration / 1000).toFixed(2)} seconds)`);
  console.log("\nResponse text:");
  console.log(data.content);

  // Parse references block
  const refMatch = data.content.match(/```references\s*([\s\S]*?)```/i);
  if (!refMatch) {
    console.log("No references block found in the AI response.");
    return;
  }

  try {
    const refJson = JSON.parse(refMatch[1].trim());
    console.log("\nParsed References Block JSON:");
    console.log(JSON.stringify(refJson, null, 2));
  } catch (err) {
    console.error("Failed to parse references block:", err);
  }
}

main().catch(console.error);
