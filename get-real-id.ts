import "./server/load-env";
import { db } from './server/db';
import { users } from './shared/schema';

async function run() {
  const u = await db.select().from(users).limit(1);
  console.log(u[0].id);
  process.exit(0);
}
run();
