/** Preview by default. Retire only source-proven duplicate identities; vectors stay untouched. */
import "../server/load-env";
import assert from "node:assert/strict";
import { readFile, open, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { recordFingerprint, sha256, verifySourceEvidence, type Repair } from "./repair_judgment_identity";
import { assessJudgmentIdentity, citationCanLinkDirectly, citationIdentifiesJudgment, parseCitation, canonJournalCode } from "../server/citation-verify";
import { cleanCaseTitle } from "../server/storage";
type Row = Record<string, any>;
export type OwnershipRepair = {
    id: string;
    citation: string;
    expectedFingerprint: string;
    ownerId: string;
    ownerCitation: string;
    sourcePath: string;
    sourceSha256: string;
    evidence: Repair["evidence"];
    sourceFile?: Repair["sourceFile"];
};
const words = (text: string) => String(text).replace(/\s+/g, " ").trim();
export async function prepareOwnershipRepair(row: Row, owner: Row, repair: OwnershipRepair) {
    assert.equal(row.id, repair.id);
    assert.equal(row.citation_string, repair.citation);
    assert.equal(recordFingerprint(row), repair.expectedFingerprint, "Duplicate changed since review");
    assert.ok(row.is_active && !row.canonical_judgment_id, "Record is already archived or redirected");
    assert.ok(owner && owner.id === repair.ownerId && owner.id !== row.id, "A different canonical owner is required");
    assert.ok(owner.is_active && !owner.canonical_judgment_id, "The owner must be active and cannot redirect again");
    assert.equal(owner.citation_string, repair.ownerCitation, "Owner citation changed");
    await verifySourceEvidence(repair.evidence);
    assert.ok(repair.evidence.some(source => source.scope === "full_judgment" && source.path === repair.sourcePath && source.sha256 === repair.sourceSha256), "Complete source evidence is required");
    const body = await readFile(repair.sourcePath, "utf8");
    assert.equal(sha256(body), repair.sourceSha256, "Source text encoding changed");
    assert.equal(body, row.full_text, "Duplicate is not the complete original text");
    assert.equal(words(body), words(owner.full_text), "Canonical owner has different judgment words");
    assert.equal(assessJudgmentIdentity({ citation: owner.citation_string, title: owner.title,
        court: owner.effective_court || owner.court_name_snapshot, opening: owner.full_text,
        textStatus: owner.text_status, textTrueCitation: owner.text_true_citation }).textIntegrity, "own", "Canonical owner identity is unverified");
    const title = cleanCaseTitle(String(row.title).replace(/\b(?:JUDGMENT|Reported\s+As|Case\s+No)\b[\s\S]*$/i, "").trim());
    assert.equal(assessJudgmentIdentity({ citation: owner.citation_string, title, court: row.court_name_snapshot,
        opening: body, textStatus: "own" }).textIntegrity, "own", "Stored parties and court do not identify the canonical case");
    return { id: row.id, owner_id: owner.id, owner_citation: owner.citation_string };
}
async function main() {
    const args = process.argv.slice(2), apply = args.includes("--apply");
    const values = args.filter(arg => arg !== "--apply"), options = new Map<string, string>();
    for (let i = 0; i < values.length; i += 2) {
        assert.ok(["--plan", "--backup"].includes(values[i]) && values[i + 1]);
        options.set(values[i], values[i + 1]);
    }
    const planPath = options.get("--plan"), backupPath = options.get("--backup");
    assert.ok(planPath && backupPath, "Use --plan path --backup path [--apply]");
    const plan = JSON.parse(await readFile(planPath, "utf8")) as {
        repairs: OwnershipRepair[];
    };
    assert.ok(plan.repairs.length > 0 && plan.repairs.length <= 100);
    assert.equal(new Set(plan.repairs.map(r => r.id)).size, plan.repairs.length);
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000, query_timeout: 125000 });
    let transaction = false;
    try {
        await client.connect();
        await client.query(apply ? "BEGIN" : "BEGIN READ ONLY");
        transaction = true;
        await client.query("SET LOCAL statement_timeout=120000");
        const lock = apply ? " FOR UPDATE" : "";
        const ids = plan.repairs.map(r => r.id), ownerIds = [...new Set(plan.repairs.map(r => r.ownerId))];
        assert.ok(!ownerIds.some(id => ids.includes(id)), "A canonical owner cannot be retired in the same batch");
        const rows = (await client.query(`SELECT * FROM judgments WHERE id=ANY($1::uuid[]) ORDER BY id${lock}`, [[...new Set([...ids, ...ownerIds])]])).rows;
        assert.equal((await client.query("SELECT id FROM judgments WHERE canonical_judgment_id=ANY($1::uuid[]) LIMIT 1", [ids])).rows.length, 0, "A canonical owner with existing redirects cannot be retired");
        const courts = new Map((await client.query("SELECT id,name FROM courts_ref")).rows.map(r => [r.id, r.name]));
        const before = ids.map(id => rows.find(r => r.id === id));
        assert.ok(before.every(Boolean), "Missing duplicate");
        const owners = ownerIds.map(id => rows.find(r => r.id === id));
        assert.ok(owners.every(Boolean), "Missing owner");
        const corrected = await Promise.all(plan.repairs.map(repair => {
            const owner = rows.find(r => r.id === repair.ownerId)!;
            return prepareOwnershipRepair(rows.find(r => r.id === repair.id)!, { ...owner, effective_court: courts.get(owner.court_id) || owner.court_name_snapshot }, repair);
        }));
        const files = plan.repairs.flatMap(r => r.sourceFile ? [r.sourceFile] : []);
        const sourceRows = files.length ? (await client.query(`SELECT id,admin_knowledge_id,object_key FROM admin_knowledge_files WHERE id=ANY($1::int[])${lock}`, [files.map(f => f.id)])).rows : [];
        for (const file of files) {
            const current = sourceRows.find(r => r.id === file.id);
            assert.ok(current && current.admin_knowledge_id === file.sourceId && current.object_key === file.objectKey, "Source association changed");
        }
        const links = (await client.query(`SELECT * FROM citation_links WHERE source_judgment_id=ANY($1::uuid[]) OR target_judgment_id=ANY($1::uuid[])${lock}`, [ids])).rows;
        const judgeLinks = (await client.query(`SELECT * FROM judge_case_links WHERE judgment_id=ANY($1::uuid[])${lock}`, [ids])).rows;
        const unresolved = (await client.query(`SELECT * FROM unresolved_citations WHERE source_judgment_id=ANY($1::uuid[])${lock}`, [ids])).rows;
        const patterns = before.flatMap(r => [r!.id, r!.citation_string].map(value => `%${value.replace(/[\\%_]/g, "\\$&")}%`));
        const caches = (await client.query(`SELECT * FROM query_cache WHERE query_text ILIKE ANY($1::text[]) OR response ILIKE ANY($1::text[])${lock}`, [patterns])).rows;
        const retired = new Set(ids), reattach: Row[] = [], pending: Row[] = [];
        for (const link of links) {
            if (retired.has(link.source_judgment_id))
                continue;
            const target = owners.find(owner => owner!.id === corrected.find(r => r.id === link.target_judgment_id)?.owner_id);
            if (!target)
                continue;
            if (link.source_judgment_id === target.id)
                continue;
            const valid = citationCanLinkDirectly(link.citation_text) && citationIdentifiesJudgment(link.citation_text, { citation: target.citation_string, court: courts.get(target.court_id) || target.court_name_snapshot });
            (valid ? reattach : pending).push({ ...link, new_target_id: target.id });
        }
        const report = { mode: apply ? "apply" : "preview", repairs: corrected, duplicateRows: corrected.length, owners: owners.length, oldLinks: links.length, reattachableLinks: reattach.length, pendingLinks: pending.length, oldUnresolved: unresolved.length, staleCaches: caches.length, embeddingApiCalls: 0, vectorRowsModified: 0 };
        if (!apply) {
            await client.query("ROLLBACK");
            transaction = false;
            await writeFile(backupPath + ".preview.json", JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
            console.log(JSON.stringify(report));
            return;
        }
        const backup = await open(backupPath, "wx", 0o600);
        try {
            const original = JSON.stringify({ savedAt: new Date().toISOString(), plan, judgments: before, owners, judgeCaseLinks: judgeLinks, sourceFiles: sourceRows, citationLinks: links, unresolvedCitations: unresolved, queryCache: caches });
            await backup.writeFile(backupPath.endsWith(".gz") ? gzipSync(original) : original);
            await backup.sync();
        }
        finally {
            await backup.close();
        }
        const changed = await client.query(`UPDATE judgments j SET canonical_judgment_id=p.owner_id,is_active=false,text_status='mislabeled',text_true_citation=p.owner_citation,updated_at=now() FROM jsonb_to_recordset($1::jsonb) AS p(id uuid,owner_id uuid,owner_citation text) WHERE j.id=p.id`, [JSON.stringify(corrected)]);
        assert.equal(changed.rowCount, corrected.length);
        if (judgeLinks.length) await client.query("DELETE FROM judge_case_links WHERE judgment_id=ANY($1::uuid[])", [ids]);
        if (links.length)
            await client.query("DELETE FROM citation_links WHERE id=ANY($1::int[])", [links.map(r => r.id)]);
        if (unresolved.length)
            await client.query("DELETE FROM unresolved_citations WHERE id=ANY($1::int[])", [unresolved.map(r => r.id)]);
        if (reattach.length)
            await client.query(`INSERT INTO citation_links(source_judgment_id,target_judgment_id,citation_type,treatment,context_excerpt,citation_text,start_offset)
      SELECT p.source_judgment_id,p.new_target_id,'referred_to','cited',p.context_excerpt,p.citation_text,p.start_offset FROM jsonb_to_recordset($1::jsonb) AS p(source_judgment_id uuid,new_target_id uuid,context_excerpt text,citation_text text,start_offset int)
      JOIN judgments s ON s.id=p.source_judgment_id AND s.is_active=true AND s.canonical_judgment_id IS NULL
      WHERE NOT EXISTS(SELECT 1 FROM citation_links e WHERE e.source_judgment_id=p.source_judgment_id AND e.target_judgment_id=p.new_target_id AND e.citation_text=p.citation_text) ON CONFLICT DO NOTHING`, [JSON.stringify(reattach)]);
        if (pending.length) {
            const journalRows = (await client.query("SELECT id,code FROM law_journals")).rows;
            const known = new Set<string>(journalRows.map(r => canonJournalCode(r.code)));
            const values = pending.map(r => { const parsed = parseCitation(r.citation_text, known); return { ...r, year: parsed?.year || null, journal: parsed?.journal || null, page: parsed?.page || null }; });
            await client.query(`INSERT INTO unresolved_citations(source_judgment_id,raw_citation,year,journal_code,page,context_excerpt,status)
        SELECT p.source_judgment_id,p.citation_text,p.year,p.journal,p.page,p.context_excerpt,'pending' FROM jsonb_to_recordset($1::jsonb) AS p(source_judgment_id uuid,citation_text text,year int,journal text,page int,context_excerpt text)
        JOIN judgments s ON s.id=p.source_judgment_id AND s.is_active=true AND s.canonical_judgment_id IS NULL`, [JSON.stringify(values)]);
        }
        if (caches.length)
            await client.query("DELETE FROM query_cache WHERE id=ANY($1::int[])", [caches.map(r => r.id)]);
        await client.query("COMMIT");
        transaction = false;
        await writeFile(backupPath + ".result.json", JSON.stringify({ ...report, committedAt: new Date().toISOString() }, null, 2), { flag: "wx", mode: 0o600 });
        console.log(JSON.stringify(report));
    }
    finally {
        if (transaction)
            await client.query("ROLLBACK").catch(() => { });
        await client.end();
    }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
    main().catch(error => { console.error("Ownership repair failed:", error.code || error.message); process.exitCode = 1; });
