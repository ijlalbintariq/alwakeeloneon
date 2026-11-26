/**
 * Records high-signal MCP searches, research queries, and drafts into the
 * user-facing activity tables (`search_history` and `documents`) with
 * deduplication and burst throttling so multi-call AI tool turns never flood
 * the Chamber Dashboard Activity Stream.
 */

import { db } from "./db";
import { documents, searchHistory } from "@shared/schema";
import { desc, eq, and, gte } from "drizzle-orm";
import { formatMcpActivityQuery, parseActivityQuery, type McpActivityKind } from "@shared/mcp-activity";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEDUP_WINDOW_MS = 10 * 60 * 1000;
const BURST_WINDOW_MS = 2 * 60 * 1000;
const MAX_MCP_ITEMS_PER_BURST = 3;

export interface RecordMcpActivityOptions {
  userId: string;
  kind: McpActivityKind;
  query: string;
  judgmentId?: string;
  citation?: string | null;
  title?: string | null;
}

function normalizeText(value: string): string {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildMcpDisplayQuery(opts: Omit<RecordMcpActivityOptions, "userId">): string {
  const citation = String(opts.citation || "").trim();
  const title = String(opts.title || "").trim();
  if (citation && title && !/^judgment identity unverified$/i.test(title)) {
    const shortTitle = title.length > 70 ? `${title.slice(0, 67)}...` : title;
    return `${citation} — ${shortTitle}`;
  }
  if (citation) return citation;

  const raw = String(opts.query || "").replace(/\s+/g, " ").trim();
  // Never emit bare internal UUIDs as user-facing search history entries.
  if (!raw || UUID_RE.test(raw)) return "";
  return raw;
}

export function mapMcpKindToSearchType(kind: McpActivityKind): "judgment" | "statute" | "chat" {
  if (kind === "statute") return "statute";
  if (kind === "research") return "chat";
  return "judgment";
}

export async function recordMcpActivity(
  opts: RecordMcpActivityOptions,
  deps?: {
    getRecent?: (userId: string, since: Date) => Promise<Array<{ id: number; type: string; query: string; createdAt: Date | null }>>;
    insertEntry?: (entry: { userId: string; type: "judgment" | "statute" | "chat"; query: string }) => Promise<void>;
  },
): Promise<{ recorded: boolean; reason?: string; storedQuery?: string }> {
  try {
    const userId = String(opts.userId || "").trim();
    if (!userId) return { recorded: false, reason: "missing-user" };

    const displayQuery = buildMcpDisplayQuery(opts);
    if (!displayQuery) return { recorded: false, reason: "unreadable-query" };

    const searchType = mapMcpKindToSearchType(opts.kind);
    const storedQuery = formatMcpActivityQuery(opts.kind, displayQuery, opts.judgmentId);
    const now = Date.now();
    const dedupSince = new Date(now - DEDUP_WINDOW_MS);

    const getRecent = deps?.getRecent ?? (async (uid, since) => {
      return await db
        .select({
          id: searchHistory.id,
          type: searchHistory.type,
          query: searchHistory.query,
          createdAt: searchHistory.createdAt,
        })
        .from(searchHistory)
        .where(and(eq(searchHistory.userId, uid), gte(searchHistory.createdAt, since)))
        .orderBy(desc(searchHistory.createdAt))
        .limit(20);
    });

    const recent = await getRecent(userId, dedupSince);
    const normDisplay = normalizeText(displayQuery);
    const normCitation = normalizeText(opts.citation || "");

    let recentBurstCount = 0;
    for (const row of recent) {
      const parsed = parseActivityQuery(row.query);
      const rowNorm = normalizeText(parsed.displayQuery);

      if (rowNorm === normDisplay) {
        return { recorded: false, reason: "duplicate-query" };
      }
      if (opts.judgmentId && parsed.judgmentId && parsed.judgmentId.toLowerCase() === opts.judgmentId.toLowerCase()) {
        return { recorded: false, reason: "duplicate-judgment" };
      }
      if (normCitation && rowNorm.includes(normCitation) && row.type === searchType) {
        return { recorded: false, reason: "citation-already-logged" };
      }

      if (parsed.isMcp && row.type === searchType && row.createdAt && (now - new Date(row.createdAt).getTime()) <= BURST_WINDOW_MS) {
        recentBurstCount++;
      }
    }

    if (recentBurstCount >= MAX_MCP_ITEMS_PER_BURST) {
      return { recorded: false, reason: "burst-throttled" };
    }

    const insertEntry = deps?.insertEntry ?? (async (entry) => {
      await db.insert(searchHistory).values(entry);
    });
    await insertEntry({ userId, type: searchType, query: storedQuery });
    return { recorded: true, storedQuery };
  } catch (err) {
    console.warn("[MCP Activity] Failed to record activity:", err instanceof Error ? err.message : String(err));
    return { recorded: false, reason: "error" };
  }
}

export async function saveMcpDraftDocument(params: {
  userId: string;
  title: string;
  content: string;
}): Promise<void> {
  try {
    await db.insert(documents).values({
      userId: params.userId,
      title: params.title,
      content: params.content,
      sourceType: "mcp-draft",
      mimeType: "text/plain",
      detectedDomain: "legal",
      detectedDomainLabel: "Legal Draft",
      classificationMethod: "mcp-draft",
    });
  } catch (err) {
    console.warn("[MCP Activity] Failed to save MCP draft document:", err instanceof Error ? err.message : String(err));
  }
}
