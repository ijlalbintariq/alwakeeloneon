import { db } from "./server/db";
import { paymentRecords, users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const userRows = await db.select().from(users).where(eq(users.email, "javedahaseeb@gmail.com"));
  if (userRows.length === 0) {
    console.log("No user found.");
    process.exit(0);
  }
  const user = userRows[0];
  console.log("User:", user);
  
  const payments = await db.select().from(paymentRecords).where(eq(paymentRecords.userId, user.id));
  console.log("Payments:", payments);
  process.exit(0);
}
main().catch(console.error);
