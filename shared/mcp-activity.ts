/**
 * Shared formatter and parser for MCP activity entries stored in `search_history`.
 * Keeps the existing `search_history` schema untouched while letting Dashboard
 * Activity Stream and History distinguish MCP calls, collapse bursts, and link
 * directly to the resolved judgment or search page.
 */

export type McpActivityKind = "case-law" | "judgment" | "statute" | "research";

export interface ParsedActivityQuery {
  isMcp: boolean;
  mcpKind?: McpActivityKind;
  judgmentId?: string;
  displayQuery: string;
}

const MCP_QUERY_PREFIX_RE =
  /^\[MCP:(case-law|judgment|statute|research)(?::([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?\]\s*(.*)$/i;

export function formatMcpActivityQuery(
  kind: McpActivityKind,
  displayQuery: string,
  judgmentId?: string,
): string {
  const clean = String(displayQuery || "").replace(/\s+/g, " ").trim().slice(0, 220);
  const validUuid = judgmentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(judgmentId)
    ? judgmentId
    : undefined;
  const tag = validUuid && kind === "judgment"
    ? `[MCP:judgment:${validUuid}]`
    : `[MCP:${kind}]`;
  return clean ? `${tag} ${clean}` : tag;
}

export function parseActivityQuery(rawQuery: string | null | undefined): ParsedActivityQuery {
  const raw = String(rawQuery || "").trim();
  const match = raw.match(MCP_QUERY_PREFIX_RE);
  if (!match) {
    return { isMcp: false, displayQuery: raw };
  }
  return {
    isMcp: true,
    mcpKind: match[1].toLowerCase() as McpActivityKind,
    judgmentId: match[2] || undefined,
    displayQuery: (match[3] || "").trim() || "MCP Legal Lookup",
  };
}

export function getActivitySubtitle(parsed: ParsedActivityQuery, dbType: string): string {
  if (parsed.isMcp) {
    if (parsed.mcpKind === "statute") return "MCP Statute";
    if (parsed.mcpKind === "research") return "MCP Research";
    return "MCP Case Law";
  }
  if (dbType === "statute") return "Statute Search";
  if (dbType === "chat") return "AI Consultation";
  return "Judgment Search";
}

export function getActivityHref(parsed: ParsedActivityQuery, dbType: string): string {
  if (parsed.judgmentId) {
    return `/judgment/${encodeURIComponent(parsed.judgmentId)}`;
  }
  if (dbType === "statute" || parsed.mcpKind === "statute") {
    return `/preview/statutes?q=${encodeURIComponent(parsed.displayQuery)}`;
  }
  if (parsed.isMcp && parsed.mcpKind === "research") {
    return `/preview/judgments?q=${encodeURIComponent(parsed.displayQuery)}`;
  }
  if (dbType === "chat") {
    return `/preview/chat?q=${encodeURIComponent(parsed.displayQuery)}`;
  }
  return `/preview/judgments?q=${encodeURIComponent(parsed.displayQuery)}`;
}
