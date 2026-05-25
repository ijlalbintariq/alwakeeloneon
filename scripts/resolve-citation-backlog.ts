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
  // If it's a live database connection (supports .execute), run ultra-fast SQL bulk operation
  if (typeof (dbInstance as any).execute === "function") {
    console.log("Detected live database. Running high-performance SQL bulk citation resolver...");
    
    // 1. Get the count of pending matching citations to report as resolved
    const countQuery = await (dbInstance as any).execute(sql`
      SELECT COUNT(*)::integer AS count
      FROM unresolved_citations AS u
      JOIN judgments AS j ON LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation))
      WHERE u.status = 'pending'
    `);
    const totalResolved = countQuery.rows[0]?.count || 0;

    // Get total processed count (all pending unresolved citations)
    const processedQuery = await (dbInstance as any).execute(sql`
      SELECT COUNT(*)::integer AS count
      FROM unresolved_citations
      WHERE status = 'pending'
    `);
    const totalProcessed = processedQuery.rows[0]?.count || 0;

    if (totalResolved > 0) {
      console.log(`Resolving and inserting ${totalResolved} matched citations in bulk...`);
      // 2. Perform bulk insert
      await (dbInstance as any).execute(sql`
        INSERT INTO citation_links (source_judgment_id, target_judgment_id, citation_text, context_excerpt, citation_type, created_at)
        SELECT 
          u.source_judgment_id,
          j.id AS target_judgment_id,
          u.raw_citation,
          u.context_excerpt,
          CASE 
            WHEN LOWER(u.context_excerpt) LIKE '%relied on%' OR 
                 LOWER(u.context_excerpt) LIKE '%relied upon%' OR 
                 LOWER(u.context_excerpt) LIKE '%following%' OR 
                 LOWER(u.context_excerpt) LIKE '%followed%' THEN 'relied_upon'
            WHEN LOWER(u.context_excerpt) LIKE '%distinguish%' OR 
                 LOWER(u.context_excerpt) LIKE '%distinguished%' THEN 'distinguished'
            WHEN LOWER(u.context_excerpt) LIKE '%overrule%' OR 
                 LOWER(u.context_excerpt) LIKE '%overruled%' THEN 'overruled'
            ELSE 'referred_to'
          END AS citation_type,
          NOW()
        FROM unresolved_citations AS u
        JOIN judgments AS j ON LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation))
        WHERE u.status = 'pending'
        ON CONFLICT (source_judgment_id, target_judgment_id, citation_type, citation_text) DO NOTHING
      `);

      console.log("Deleting resolved citations from backlog...");
      // 3. Delete resolved unresolved_citations
      await (dbInstance as any).execute(sql`
        DELETE FROM unresolved_citations
        WHERE id IN (
          SELECT u.id
          FROM unresolved_citations AS u
          JOIN judgments AS j ON LOWER(TRIM(j.citation_string)) = LOWER(TRIM(u.raw_citation))
          WHERE u.status = 'pending'
        )
      `);
    }

    return { totalProcessed, totalResolved };
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
