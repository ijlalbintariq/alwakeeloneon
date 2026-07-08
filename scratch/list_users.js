import "../server/load-env.ts";
import { db } from "../server/db.ts";
import { users } from "../shared/schema.ts";

async function run() {
  try {
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users:`);
    for (const u of allUsers) {
      console.log(`- ID: ${u.id}, Email: ${u.email}, Tier: ${u.tier}`);
    }
  } catch (err) {
    console.error("Failed to query users:", err.message);
  }
}

run();
