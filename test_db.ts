import { db } from "./server/db";
import { resolveCaseCitationFromInternalDb } from "./server/routes";

// We can't easily import resolveCaseCitationFromInternalDb because it's in routes.ts which depends on express.
// But we can just run the DB query directly to see if the record is in the `judgments` table.
