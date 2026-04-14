import fs from "node:fs";

async function main(): Promise<void> {
  const baseUrl = (process.env.VALIDATION_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
  const cookiePath = process.env.VALIDATION_COOKIE_PATH || "/tmp/alwakeelo_validation_cookie.txt";
  
  let cookieHeader = "";
  if (fs.existsSync(cookiePath)) {
    const raw = fs.readFileSync(cookiePath, "utf8");
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const cookies: string[] = [];
    for (const line of lines) {
      if (line.startsWith("#") && !line.startsWith("#HttpOnly_")) continue;
      const normalizedLine = line.startsWith("#HttpOnly_") ? line.replace(/^#HttpOnly_/, "") : line;
      const parts = normalizedLine.split("\t");
      if (parts.length < 7) continue;
      cookies.push(`${parts[5]}=${parts[6]}`);
    }
    cookieHeader = cookies.join("; ");
  }

  if (!cookieHeader) {
    console.warn("No validation cookie found. Running without auth (may fail 401).");
  }

  const prompt = "What are the grounds for post-arrest bail in a murder case under Pakistani law?";
  const models = [
    { name: "Standard", aiMode: "standard", turbo: false },
    { name: "Turbo", aiMode: "turbo", turbo: true },
    { name: "Apex Pro", aiMode: "apex", apexModel: "apex-pro" },
    { name: "Apex Agent", aiMode: "apex", apexModel: "apex-agent" }
  ];

  console.log(`Starting latency test at ${new Date().toISOString()}`);
  console.log(`Prompt: "${prompt}"\n`);

  for (const model of models) {
    console.log(`Testing model: ${model.name}...`);
    const start = Date.now();
    try {
      const response = await fetch(`${baseUrl}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": cookieHeader
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          type: "al-wakeelo",
          aiMode: model.aiMode,
          apexModel: model.apexModel,
          turbo: model.turbo,
          stream: false
        })
      });

      const duration = Date.now() - start;
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Success: ${duration}ms`);
        console.log(`   Used Model: ${data.model || "unknown"}`);
        console.log(`   Response length: ${data.content?.length || 0} chars`);
        if (data.timings) {
            console.log(`   Server timings: ${JSON.stringify(data.timings)}`);
        }
      } else {
        const text = await response.text();
        console.log(`❌ Failed: ${duration}ms (Status: ${response.status})`);
        console.log(`   Error: ${text.substring(0, 200)}`);
      }
    } catch (err: any) {
      const duration = Date.now() - start;
      console.log(`❌ Error: ${duration}ms - ${err.message}`);
    }
    console.log("-".repeat(40));
  }
}

main().catch(console.error);
