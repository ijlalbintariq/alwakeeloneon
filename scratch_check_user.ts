import { db } from "./server/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const userRows = await db.select().from(users).where(eq(users.id, 2));
  console.log(userRows);
  process.exit(0);
}
main();
