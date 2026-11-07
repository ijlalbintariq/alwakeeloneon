import "../server/load-env";
import { db, pool } from "../server/db";
import { unresolvedCitations, judgments, citationLinks } from "../shared/schema";
import { sql, inArray, and, gt, eq, asc } from "drizzle-orm";

/**
 * Helper function to infer the citation type based on keywords in the context excerpt.
 * Checks for case-insensitive keywords:
 * - "relied on", "relied upon", "following", "followed" -> "relied_upon"
 * - "distinguish", "distinguished" -> "distinguished"
 * - "overrule", "overruled" -> "overruled"
 * - Default -> "referred_to"
 */
export function inferCitationType(excerpt: string | null | undefined): string {
  if (!excerpt) {
    return "referred_to";
  }
  const lowerExcerpt = excerpt.toLowerCase();
  if (
    lowerExcerpt.includes("relied on") ||
    lowerExcerpt.includes("relied upon") ||
    lowerExcerpt.includes("following") ||
    lowerExcerpt.includes("followed")
  ) {
    return "relied_upon";
  }
  if (
    lowerExcerpt.includes("distinguish") ||
    lowerExcerpt.includes("distinguished")
  ) {
    return "distinguished";
  }
  if (
    lowerExcerpt.includes("overrule") ||
    lowerExcerpt.includes("overruled")
  ) {
    return "overruled";
  }
  return "referred_to";
}

/**
 * Core backlog resolution engine. Can be called with a custom db instance (for testing).
 */
export async function resolveCitationBacklog(
  dbInstance: typeof db,
  chunkSize = 5000
): Promise<{ totalProcessed: number; totalResolved: number }> {
  // The old raw-string join ignored court sections and case identity.
  if (typeof (dbInstance as any).execute === "function") {
    throw new Error("Unsafe legacy backlog join disabled; use source-checked citation extraction.");
  }

  // Fallback to sequential Drizzle queries for unit test runner mocks
  let lastId = 0;
  let totalProcessed = 0;
  let totalResolved = 0;

  while (true) {
    // Fetch pending unresolved citations sorted by ID ascending
    const chunk = await dbInstance.select()
      .from(unresolvedCitations)
      .where(
        and(
          eq(unresolvedCitations.status, "pending"),
          gt(unresolvedCitations.id, lastId)
        )
      )
      .orderBy(asc(unresolvedCitations.id))
      .limit(chunkSize);

    if (chunk.length === 0) {
      break;
    }

    // Save the last visited ID for next iteration paging
    lastId = chunk[chunk.length - 1].id;
    totalProcessed += chunk.length;

    // Compile a unique list of normalized citation strings in this batch
    const normalizedCitations = [
      ...new Set(
        chunk
          .map((c) => c.rawCitation.toLowerCase().trim())
          .filter(Boolean)
      )
    ];

    if (normalizedCitations.length === 0) {
      continue;
    }

    // Query judgments for matches
    const matchingJudgments = await dbInstance.select({
      id: judgments.id,
      citationString: judgments.citationString
    })
    .from(judgments)
    .where(inArray(sql`lower(trim(${judgments.citationString}))`, normalizedCitations));

    // Construct a map of normalized citationString -> judgmentId
    const citationMap = new Map<string, string>();
    for (const j of matchingJudgments) {
      citationMap.set(j.citationString.toLowerCase().trim(), j.id);
    }

    const linksToInsert: Array<{
      sourceJudgmentId: string;
      targetJudgmentId: string;
      citationText: string;
      contextExcerpt: string | null;
      citationType: string;
    }> = [];

    const resolvedIds: number[] = [];

    // Map each unresolved citation in this chunk to a target judgment
    for (const citation of chunk) {
      const normRaw = citation.rawCitation.toLowerCase().trim();
      const targetId = citationMap.get(normRaw);

      if (targetId) {
        linksToInsert.push({
          sourceJudgmentId: citation.sourceJudgmentId,
          targetJudgmentId: targetId,
          citationText: citation.rawCitation,
          contextExcerpt: citation.contextExcerpt,
          citationType: inferCitationType(citation.contextExcerpt),
        });
        resolvedIds.push(citation.id);
      }
    }

    // Perform database operations inside a transaction if any citations were resolved
    if (linksToInsert.length > 0) {
      await dbInstance.transaction(async (tx: any) => {
        // 1. Insert new links. Use onConflictDoNothing to avoid duplicate failures.
        await tx.insert(citationLinks)
          .values(linksToInsert)
          .onConflictDoNothing();

        // 2. Delete resolved rows from unresolved_citations
        await tx.delete(unresolvedCitations)
          .where(inArray(unresolvedCitations.id, resolvedIds));
      });

      totalResolved += linksToInsert.length;
    }
  }

  return { totalProcessed, totalResolved };
}

async function main() {
  console.log("🚀 Starting Citation Graph Linking Engine...");
  try {
    const { totalProcessed, totalResolved } = await resolveCitationBacklog(db);
    console.log("\n==========================================");
    console.log("🏁 Citation Graph Linking Completed!");
    console.log(`- Total Citations Processed: ${totalProcessed}`);
    console.log(`- Total Citations Resolved:  ${totalResolved}`);
    console.log("==========================================");
  } catch (err) {
    console.error("❌ Error running Citation Graph Linking Engine:", err);
  }
}

// Run main if this is invoked directly in tsx/node (and not from a test runner)
const isMain = process.argv[1] &&
  !process.argv[1].includes(".test.") &&
  (
    process.argv[1].endsWith("resolve-citation-backlog.ts") ||
    process.argv[1].endsWith("resolve-citation-backlog.js") ||
    process.argv[1].endsWith("resolve-citation-backlog")
  );

if (isMain) {
  main()
    .finally(async () => {
      console.log("🔌 Cleaning up connection pool...");
      if (pool) {
        await pool.end();
      }
      console.log("👋 Done!");
    });
}
