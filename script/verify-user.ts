import "dotenv/config";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function verify() {
  await db.update(users).set({ emailVerified: true }).where(eq(users.email, "test_advocate_2027@gmail.com"));
  console.log("Verified");
  process.exit(0);
}

verify().catch(console.error);
