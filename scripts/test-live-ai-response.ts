import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGIN_EMAIL = "ijlalbintariq420@gmail.com";
const LOGIN_PASSWORD = "admin12345678";
const LIVE_URL = "https://www.alwakeelo.com";

// 3 diverse legal queries with a dynamic cache-bypass salt appended at runtime
const QUERIES = {
  inheritance: {
    name: "Islamic Inheritance & Oral Hiba Dispute",
    text: "A Muslim man died leaving behind a widow, two daughters, and a brother. He owned a commercial building and agricultural land in Punjab. During his lifetime, the brother claims the deceased gifted (Hiba) the agricultural land to him via an oral gift (Hiba) followed by a mutation in revenue records. The daughters claim the gift is fraudulent, designed to deprive female heirs of their legal inheritance under Shariat, and that under Section 498-A PPC, depriving women of inheritance is a criminal offense. What are the rules of Islamic inheritance for this family, the legal requirements of a valid oral Hiba (gift) under Muslim personal law, and the burden of proof for the brother's claim? Citing relevant Pakistani statutes and landmark Supreme Court judgments is mandatory. Please analyze specifically under Punjab laws with recently verified judgments."
  },
  constitutional: {
    name: "Article 199 Writ Jurisdiction & Mandamus",
    text: "Under Article 199 of the Constitution of Pakistan, 1973, what are the jurisdictional prerequisites for filing a Constitutional Writ Petition of Mandamus against a federal public authority? Explain the distinction between extraordinary constitutional jurisdiction and an alternate adequate remedy, and describe the requirements for establishing a clear legal right and public duty. Please cite authoritative, verified Supreme Court of Pakistan judgments on writ jurisdiction."
  },
  tax: {
    name: "Corporate Income Tax & Permanent Establishments",
    text: "Under the Income Tax Ordinance, 2001, what constitutes a Permanent Establishment (PE) of a non-resident corporate entity in Pakistan, and what are its tax implications? Explain how double taxation treaties (DTAs) are interpreted and applied under Pakistani tax law to prevent double taxation, and analyze the burden of proof. Please cite relevant statutory sections and verified Supreme Court judgments."
  }
};

async function runTest(key: keyof typeof QUERIES, cookie: string) {
  const queryInfo = QUERIES[key];
  const salt = ` [Salt: ${Date.now()}]`; // Dynamic cache-bypass salt to guarantee fresh execution
  const saltedQuery = queryInfo.text + salt;

  console.log("\n----------------------------------------------------------------------");
  console.log(`🚀 RUNNING TEST: ${queryInfo.name}`);
  console.log(`Salted Query: ${saltedQuery.substring(0, 150)}...`);
  console.log("----------------------------------------------------------------------");

  console.log("💬 Sending query to chat endpoint (this may take up to 60-90 seconds due to parallel hybrid vector search)...");
  const startedAt = Date.now();

  try {
    const chatRes = await axios.post(`${LIVE_URL}/api/ai/chat`, {
      messages: [
        { role: "user", content: saltedQuery }
      ],
      type: "al-wakeelo",
      stream: false
    }, {
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookie
      },
      timeout: 180000 // 3 minutes timeout
    });

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`✅ Response received in ${elapsed} seconds!`);

    const data = chatRes.data;
    const content = data.content || (typeof data === "string" ? data : "");

    const matches = content.match(/```references[\s\S]*?```/);
    if (matches) {
      console.log("📚 References Block Found in Response!");
      console.log(matches[0]);
    } else {
      console.log("⚠️ No references block found in response.");
    }

    // Save to a file for easy review
    const outputPath = path.resolve(__dirname, `../live_response_${key}_test.md`);
    fs.writeFileSync(outputPath, content, "utf-8");
    console.log(`💾 Saved response to: ${outputPath}`);

  } catch (err: any) {
    console.error(`❌ Error running test for ${key}:`, err.response?.data || err.message);
  }
}

async function main() {
  console.log("======================================================================");
  console.log("🚀 STARTING DIVERSE LIVE AL WAKEELO QUALITY TESTS (CACHE BYPASS)");
  console.log(`Live URL: ${LIVE_URL}`);
  console.log("======================================================================\n");

  const mode = process.argv[2] || "all";

  try {
    // 1. Log in to get the session cookie
    console.log("🔑 Authenticating with live website...");
    const loginRes = await axios.post(`${LIVE_URL}/api/auth/login`, {
      email: LOGIN_EMAIL,
      password: LOGIN_PASSWORD,
    }, {
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });

    const setCookie = loginRes.headers["set-cookie"];
    if (!setCookie || setCookie.length === 0) {
      throw new Error("No session cookie returned from login endpoint!");
    }

    const cookie = setCookie[0].split(";")[0];
    console.log(`✅ Authentication successful. Session Cookie: ${cookie.substring(0, 20)}...`);

    // 2. Run selected tests
    if (mode === "all" || mode === "inheritance") {
      await runTest("inheritance", cookie);
    }
    if (mode === "all" || mode === "constitutional") {
      await runTest("constitutional", cookie);
    }
    if (mode === "all" || mode === "tax") {
      await runTest("tax", cookie);
    }

    console.log("\n======================================================================");
    console.log("🎉 ALL REQUESTED LIVE TESTS COMPLETE!");
    console.log("======================================================================");

  } catch (err: any) {
    console.error("❌ Error running live quality test suite:", err.response?.data || err.message);
    process.exit(1);
  }
}

main();
