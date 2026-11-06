import crypto from "node:crypto";
import { pool } from "../db";
import { assessJudgmentIdentity, judgmentSourceUrl } from "../citation-verify";
import { embedRepairedTexts, REPAIRED_EMBEDDING_MODEL } from "./embedding-local";
import type { RagMatch } from "./vector-store";

export type RepairReference = { kind: "judgment" | "admin"; id: string; canonicalJudgmentId?: string };
export type RepairSource = RepairReference & {
  userId: string; sourceDocumentId: number; title: string; text: string;
  citation?: string; pdfUrl?: string; fileKey?: string; metadata: Record<string, unknown>;
};
type Reader = { query: (sql: string, values?: any[]) => Promise<any> };
const key = (source: RepairReference) => `${source.kind}:${source.id}`;
export function repairSourceHash(source: RepairSource): string {
  return crypto.createHash("sha256").update(JSON.stringify([
    source.kind, source.id, source.userId, source.title, source.text,
    source.citation || "", source.pdfUrl || "", source.fileKey || "", source.metadata.court || "",
  ])).digest("hex");
}

export function chunkRepairText(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean), chunks: string[] = [];
  for (let start = 0; start < words.length; start += 420) {
    const chunk = words.slice(start, start + 500).join(" ");
    if (chunk.length > 7600) throw new Error("Source contains an oversized embedding chunk");
    chunks.push(chunk);
    if (start + 500 >= words.length) break;
  }
  return chunks;
}

export async function loadRepairSources(reader: Reader, references: RepairReference[]): Promise<Map<string, RepairSource>> {
  const sources = new Map<string, RepairSource>();
  const requestedJudgments = new Set(references.filter(r => r.kind === "judgment").map(r => r.id));
  const judgmentIds = [...new Set(references.flatMap(r => r.kind === "judgment" ? [r.id] : r.canonicalJudgmentId ? [r.canonicalJudgmentId] : []).filter(id => /^[0-9a-f-]{36}$/i.test(id)))];
  const owners = new Map<string, RepairSource>();
  const adminIds = references.filter(r => r.kind === "admin" && /^[1-9]\d*$/.test(r.id)).map(r => Number(r.id));
  if (judgmentIds.length) {
    const { rows } = await reader.query("SELECT id,title,citation_string,full_text,court_name_snapshot,pdf_url,text_status,text_true_citation FROM judgments WHERE id=ANY($1::uuid[])", [judgmentIds]);
    for (const row of rows) {
      const check = assessJudgmentIdentity({ citation: row.citation_string, title: row.title, court: row.court_name_snapshot, opening: row.full_text, textStatus: row.text_status, textTrueCitation: row.text_true_citation });
      if (check.textIntegrity !== "own") continue;
      const source: RepairSource = { kind: "judgment", id: row.id, userId: "global-admin-judgments", sourceDocumentId: Math.abs(parseInt(row.id.replace(/-/g, "").slice(0, 8), 16) | 0), title: row.title, text: row.full_text, citation: row.citation_string, pdfUrl: row.pdf_url || undefined, metadata: { sourceType: "judgment", judgmentId: row.id, citationString: row.citation_string, court: row.court_name_snapshot, title: row.title, sourceUrl: judgmentSourceUrl(row.id), textIntegrity: "own", sourceVerified: false } };
      owners.set(source.id, source);
      if (requestedJudgments.has(source.id)) sources.set(key(source), source);
    }
  }
  if (adminIds.length) {
    const { rows } = await reader.query(`SELECT a.id,a.title,a.content,a.category,f.object_key,f.original_filename
      FROM admin_knowledge a JOIN admin_knowledge_files f ON f.admin_knowledge_id=a.id WHERE a.id=ANY($1::int[])`, [adminIds]);
    for (const row of rows) {
      if (!row.content || row.content.trim().length < 200) continue;
      const isCaseLaw = String(row.category || "").toLowerCase().replace(/[^a-z0-9]/g, "") === "caselaw";
      const source: RepairSource = { kind: "admin", id: String(row.id), userId: isCaseLaw ? "global-admin-case-law" : "global-admin-knowledge", sourceDocumentId: row.id, title: row.title, text: row.content, fileKey: row.object_key, metadata: { sourceType: isCaseLaw ? "admin-case-law" : "admin-knowledge", adminKnowledgeId: row.id, filename: row.original_filename, sourceVerified: false } };
      const alias = references.find(reference => reference.kind === "admin" && reference.id === source.id)?.canonicalJudgmentId;
      if (alias) {
        const owner = owners.get(alias);
        if (!owner || owner.title !== source.title || owner.text !== source.text) continue;
        source.citation = owner.citation;
        source.pdfUrl = owner.pdfUrl;
        source.metadata = { ...source.metadata, judgmentId: owner.id, citationString: owner.citation, court: owner.metadata.court, sourceUrl: owner.metadata.sourceUrl, textIntegrity: "own" };
      }
      sources.set(key(source), source);
    }
  }
  return sources;
}

const queryCache = new Map<string, { expires: number; value: Promise<number[]> }>();
async function queryVector(query: string): Promise<number[]> {
  const cacheKey = `${REPAIRED_EMBEDDING_MODEL}:${query}`;
  const cached = queryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = embedRepairedTexts([query.slice(0, 8000)]).then(rows => rows[0]);
  queryCache.set(cacheKey, { expires: Date.now() + 300000, value });
  value.catch(() => { if (queryCache.get(cacheKey)?.value === value) queryCache.delete(cacheKey); });
  if (queryCache.size > 200) queryCache.delete(queryCache.keys().next().value!);
  return value;
}

export function repairSearchScopes(args: { userId: string; documentIds?: number[]; globalUserIds?: readonly string[]; skipUserScope?: boolean }, globals: readonly string[]): string[] {
  const own = args.skipUserScope ? [] : [args.userId];
  const includeGlobals = !globals.includes(args.userId) && !args.documentIds?.length;
  const allowedGlobals = args.globalUserIds?.length ? globals.filter(id => args.globalUserIds!.includes(id)) : [...globals];
  return [...new Set([...own, ...(includeGlobals ? allowedGlobals : [])])];
}

export async function retrieveRepairedMatches(args: {
  userIds: string[]; query: string; sourceDocumentIds?: number[]; metadataFilters?: Record<string, string>; topK: number;
}): Promise<RagMatch[]> {
  if (!pool || !args.userIds.length || !args.query.trim()) return [];
  try {
    const available = await pool.query("SELECT 1 FROM rag_repaired_chunks WHERE model=$1 AND user_id=ANY($2::text[]) LIMIT 1", [REPAIRED_EMBEDDING_MODEL, args.userIds]);
    if (!available.rows.length) return [];
    const embedding = await queryVector(args.query);
    // shortcut: exact search is appropriate for the bounded repair set; add ANN only if that scope expands.
    const { rows } = await pool.query(`WITH eligible AS MATERIALIZED (
      SELECT c.*,min(id) OVER (PARTITION BY user_id,source_kind,source_id) AS document_id
      FROM rag_repaired_chunks c WHERE model=$1 AND user_id=ANY($2::text[])
        AND ($3::int[] IS NULL OR source_document_id=ANY($3::int[])) AND metadata @> $4::jsonb
    ) SELECT *,1-(embedding <=> $5::halfvec) AS similarity FROM eligible
      ORDER BY embedding <=> $5::halfvec,id LIMIT $6`, [REPAIRED_EMBEDDING_MODEL, args.userIds, args.sourceDocumentIds?.length ? args.sourceDocumentIds : null, JSON.stringify(args.metadataFilters || {}), `[${embedding.join(",")}]`, Math.max(20, args.topK * 4)]);
    const current = await loadRepairSources(pool, rows.map((row: any) => ({ kind: row.source_kind, id: row.source_id, canonicalJudgmentId: row.source_kind === "admin" ? row.metadata?.judgmentId : undefined })));
    const perSource = new Map<string, number>(), seenChunks = new Set<string>(), matches: RagMatch[] = [];
    for (const row of rows) {
      const source = current.get(`${row.source_kind}:${row.source_id}`);
      if (!args.userIds.includes(row.user_id) || (args.sourceDocumentIds?.length && !args.sourceDocumentIds.includes(row.source_document_id)) || row.model !== REPAIRED_EMBEDDING_MODEL || !source || source.userId !== row.user_id || repairSourceHash(source) !== row.source_hash || Number(row.similarity) < 0.5) continue;
      const sourceKey = crypto.createHash("sha256").update(source.text).digest("hex");
      const chunkKey = `${sourceKey}:${row.chunk_text}`;
      if (seenChunks.has(chunkKey)) continue;
      if ((perSource.get(sourceKey) || 0) >= 2) continue;
      seenChunks.add(chunkKey);
      perSource.set(sourceKey, (perSource.get(sourceKey) || 0) + 1);
      matches.push({ id: -Number(row.id), ragDocumentId: -Number(row.document_id), sourceDocumentId: row.source_document_id, title: source.title, chunkIndex: row.chunk_index, tokenCount: row.chunk_text.split(/\s+/).length, chunkText: row.chunk_text, matchedText: row.chunk_text, metadata: { ...source.metadata, repairedEmbeddingModel: REPAIRED_EMBEDDING_MODEL }, score: Number(row.similarity), vectorScore: Number(row.similarity), keywordScore: 0 });
    }
    return matches.slice(0, args.topK);
  } catch (error: any) {
    if (error?.code !== "42P01") console.warn(`[RAG] Repaired-source search unavailable: ${error?.message || error}`);
    return [];
  }
}

/** Fuse ranks, never distances from incompatible embedding models. */
export function mergeRepairResults(legacy: RagMatch[], repaired: RagMatch[], limit: number): RagMatch[] {
  if (!repaired.length) return legacy.slice(0, limit);
  if (!legacy.length) return repaired.slice(0, limit);
  const ranked = [...legacy.map((match, rank) => ({ match, rank, cohort: 0 })), ...repaired.map((match, rank) => ({ match, rank, cohort: 1 }))]
    .sort((a, b) => a.rank - b.rank || a.cohort - b.cohort);
  const seen = new Set<string>(), matches: RagMatch[] = [];
  for (const { match } of ranked) {
    const identity = `${match.metadata.judgmentId || match.metadata.adminKnowledgeId || match.ragDocumentId}:${match.chunkText}`;
    if (seen.has(identity)) continue;
    seen.add(identity); matches.push(match);
    if (matches.length === limit) break;
  }
  return matches;
}
