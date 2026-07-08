import "../server/load-env.ts";
import { db } from "../server/db.ts";
import { users } from "../shared/schema.ts";
import { eq } from "drizzle-orm";
import axios from "axios";

const EMAIL = "ijlalbintariq420@gmail.com";
const PASSWORD = "admin12345678";
const LOCAL_URL = "http://localhost:5001";

async function run() {
  try {
    // 1. Upgrade user to chamber tier in local db so they can use turbo
    console.log(`Setting subscriptionTier to 'chamber' for user ${EMAIL}...`);
    await db.update(users).set({ subscriptionTier: "chamber" }).where(eq(users.email, EMAIL));
    console.log(`Subscription tier updated successfully.`);

    // 2. Login to get session cookie
    console.log(`Logging in to ${LOCAL_URL}...`);
    const loginRes = await axios.post(`${LOCAL_URL}/api/auth/login`, {
      email: EMAIL,
      password: PASSWORD,
    }, {
      headers: { "Content-Type": "application/json" },
    });

    const setCookie = loginRes.headers["set-cookie"];
    if (!setCookie) {
      throw new Error("No session cookie returned!");
    }
    const cookie = setCookie[0].split(";")[0];
    console.log(`Logged in. Cookie: ${cookie.substring(0, 30)}...`);

    // 3. Call chat endpoint with turbo mode - non-streaming with new query to bypass cache
    console.log(`Sending non-streaming chat request with new query...`);
    const chatStart = Date.now();
    const chatRes = await axios.post(`${LOCAL_URL}/api/ai/chat`, {
      messages: [{ role: "user", content: "Explain the difference between Section 302 PPC and Section 324 PPC under Pakistani law." }],
      type: "al-wakeelo",
      aiMode: "turbo",
      stream: false
    }, {
      headers: {
        "Content-Type": "application/json",
        "Cookie": cookie
      },
      timeout: 120000 // 120s timeout in test client
    });

    console.log(`Non-streaming completed in ${Date.now() - chatStart}ms`);
    console.log(`Response model:`, chatRes.data.model);
    console.log(`Response text preview:`, chatRes.data.content?.substring(0, 250));

  } catch (err) {
    console.error("Test failed:", err.response?.data || err.message);
  }
}

run();
