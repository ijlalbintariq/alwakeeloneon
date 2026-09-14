import { db } from "./server/db";
import { users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function run() {
  const adminUsers = await db.select().from(users).limit(1);
  console.log(adminUsers[0]);
  process.exit(0);
}
run();
