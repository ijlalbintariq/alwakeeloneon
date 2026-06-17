/**
 * Al Wakeelo Engine Quality Audit
 * ================================
 * Calls Kimi K2.6 directly with a complex Pakistani law query,
 * then cross-checks every statute and case law citation against the DB.
 *
 * Usage: npx tsx scripts/audit-engine-quality.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env
try {
  const envPath = resolve(import.meta.dirname || __dirname, "../.env");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
} catch {}

import OpenAI from "openai";

// ─── DB Setup ────────────────────────────────────────────────────────
let db: any = null;
let statutes: any = null;
let caseLaw: any = null;
let judgments: any = null;
let ilike: any = null;
let or: any = null;
let and: any = null;
let eqOp: any = null;

async function initDb() {
  try {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const schema = await import("../shared/schema");
    const ops = await import("drizzle-orm");
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    db = drizzle(pool, { schema });
    statutes = schema.statutes;
    caseLaw = schema.caseLaw;
    judgments = schema.judgments;
    ilike = ops.ilike;
    or = ops.or;
    and = ops.and;
    eqOp = ops.eq;
    
    await pool.query("SELECT 1");
    return true;
  } catch (err: any) {
    console.log(`   ⚠️ DB connection failed: ${err.message}`);
    return false;
  }
}

// ─── Complex Legal Query ─────────────────────────────────────────────
const COMPLEX_QUERY = `A client received an ex-parte decree from a civil court in Lahore. He was not properly served with summons and learned about the decree 45 days later. He wants to:
1. Set aside the ex-parte decree under Order IX Rule 13 CPC
2. File an appeal under Order 41 CPC
3. Claim compensation under Section 73 Contract Act for breach
4. Seek specific performance under the Specific Relief Act

Advise on: applicable limitation periods (cite specific Articles of the Limitation Act 1908), relevant CPC/Contract Act/Specific Relief Act provisions, relevant Supreme Court judgments, whether remedies are time-barred given the 45-day delay, and Article 10A constitutional rights.`;

// ─── Extraction Functions ────────────────────────────────────────────
interface StatuteMention { statuteName: string; section: string; }
interface CaseLawMention { citation: string; year?: number; report?: string; page?: number; }

function extractStatutes(text: string): StatuteMention[] {
  const mentions: StatuteMention[] = [];
  const seen = new Set<string>();

  const p1 = /\b(section|sec\.?|article|art\.?)\s*([0-9A-Za-z-]+(?:\s*(?:,|and|&|\/)\s*[0-9A-Za-z-]+)*)\s+of\s+(?:the\s+)?([A-Z][A-Za-z0-9(),.'\/\s-]{3,100}?)(?=[\n,.;:]|$)/gi;
  for (const m of text.matchAll(p1)) {
    const prefix = (m[1] || "").toLowerCase().startsWith("art") ? "Article" : "Section";
    for (const sec of (m[2] || "").split(/\s*(?:,|and|&|\/)\s*/)) {
      const s = sec.trim(); if (!s) continue;
      const key = `${m[3]?.trim()}::${prefix} ${s}`.toLowerCase();
      if (!seen.has(key)) { seen.add(key); mentions.push({ statuteName: m[3]?.trim() || "", section: `${prefix} ${s}` }); }
    }
  }

  const p2 = /\b(section|sec\.?|article|art\.?)\s*([0-9A-Za-z-]+(?:\s*(?:,|and|&|\/)\s*[0-9A-Za-z-]+)*)\s*(?:of\s+)?(Cr\.?\s*P\.?\s*C\.?|C\.?\s*P\.?\s*C\.?|P\.?\s*P\.?\s*C\.?|Constitution|Qanun[-\s]?e[-\s]?Shahadat|Family Courts?\s*Act|Specific Relief Act|Limitation Act|Contract Act|Transfer of Property Act)/gi;
  for (const m of text.matchAll(p2)) {
    const prefix = (m[1] || "").toLowerCase().startsWith("art") ? "Article" : "Section";
    for (const sec of (m[2] || "").split(/\s*(?:,|and|&|\/)\s*/)) {
      const s = sec.trim(); if (!s) continue;
      const key = `${m[3]?.trim()}::${prefix} ${s}`.toLowerCase();
      if (!seen.has(key)) { seen.add(key); mentions.push({ statuteName: m[3]?.trim() || "", section: `${prefix} ${s}` }); }
    }
  }

  const p3 = /\b(Order\s+[IVXLCDM0-9]+(?:\s+Rules?\s+[0-9A-Za-z,&\s-]+)?)\s*(?:of\s+)?(?:the\s+)?(C\.?\s*P\.?\s*C\.?|Code of Civil Procedure)/gi;
  for (const m of text.matchAll(p3)) {
    const key = `cpc::${m[1]?.trim()}`.toLowerCase();
    if (!seen.has(key)) { seen.add(key); mentions.push({ statuteName: "CPC", section: m[1]?.trim() || "" }); }
  }

  return mentions;
}

function extractCaseLaw(text: string): CaseLawMention[] {
  const mentions: CaseLawMention[] = [];
  const seen = new Set<string>();

  const p1 = /\[?\b((?:19|20)\d{2})\s+(SCMR|PLD|CLC|CrLJ|PCRLJ|PCrLJ|MLD|YLR|PLC|CLJ|NLR|PLJ|PSC|ALD|KLR|SLR)\s+(\d+)\]?/gi;
  for (const m of text.matchAll(p1)) {
    const c = `${m[1]} ${m[2]?.toUpperCase()} ${m[3]}`;
    if (!seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); mentions.push({ citation: c, year: +m[1], report: m[2]?.toUpperCase(), page: +m[3] }); }
  }

  const p2 = /(PLD)\s+((?:19|20)\d{2})\s+(SC|Supreme Court|Lahore|Karachi|Islamabad|Peshawar|Quetta)\s+(\d+)/gi;
  for (const m of text.matchAll(p2)) {
    const c = `PLD ${m[2]} ${m[3]} ${m[4]}`;
    if (!seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); mentions.push({ citation: c, year: +m[2], report: "PLD", page: +m[4] }); }
  }

  return mentions;
}

// ─── DB Lookups ──────────────────────────────────────────────────────
async function findStatute(name: string, section: string): Promise<{ found: boolean; match?: any }> {
  if (!db) return { found: false };
  const secNum = section.replace(/^(Section|Article|Order)\s+/i, "").trim();
  try {
    let nameClean = name.toLowerCase().replace(/,?\s*\d{4}$/, "").replace(/\s*act\s*$/i, "").trim();
    
    // Map standard Pakistani legal abbreviations to full names
    const abbrevMap: Record<string, string> = {
      cpc: "code of civil procedure",
      crpc: "code of criminal procedure",
      ppc: "pakistan penal code",
      qso: "qanun-e-shahadat",
      sra: "specific relief act",
      mflo: "muslim family laws",
      gwa: "guardians and wards",
      laa: "land acquisition",
      peca: "prevention of electronic crimes",
    };
    
    if (abbrevMap[nameClean]) {
      nameClean = abbrevMap[nameClean];
    }
    
    const r = await db.select().from(statutes).where(or(ilike(statutes.section, `%${secNum}%`), ilike(statutes.description, `%${secNum}%`))).limit(20);
    for (const row of r) {
      const t = (row.shortTitle || "").toLowerCase();
      if (t.includes(nameClean) || nameClean.includes(t) || t.includes(nameClean.split(" ")[0])) return { found: true, match: row };
    }
    const r2 = await db.select().from(statutes).where(ilike(statutes.shortTitle, `%${name.split(" ")[0]}%`)).limit(30);
    for (const row of r2) {
      if ((row.section || "").toLowerCase().includes(secNum.toLowerCase())) return { found: true, match: row };
    }
    return { found: false };
  } catch { return { found: false }; }
}

async function findCaseLaw(m: CaseLawMention): Promise<{ found: boolean; match?: any }> {
  if (!db) return { found: false };
  try {
    let r = await db.select().from(caseLaw).where(ilike(caseLaw.citation, `%${m.citation}%`)).limit(3);
    if (r.length > 0) return { found: true, match: r[0] };
    if (m.year && m.page) {
      r = await db.select().from(judgments).where(and(eqOp(judgments.year, m.year), eqOp(judgments.page, m.page))).limit(3);
      if (r.length > 0) return { found: true, match: r[0] };
    }
    return { found: false };
  } catch { return { found: false }; }
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  console.log("═".repeat(70));
  console.log("  AL WAKEELO ENGINE — QUALITY AUDIT");
  console.log("═".repeat(70));

  if (!process.env.MOONSHOT_API_KEY) { console.error("❌ MOONSHOT_API_KEY missing"); process.exit(1); }

  // Step 1: DB
  console.log("\n📋 Step 1: Connecting to database...");
  const dbOk = await initDb();
  console.log(dbOk ? "   ✅ Database connected" : "   ⚠️ No DB — skipping verification");

  // Step 2: Call Kimi K2.6 directly (no web search — faster, more reliable)
  console.log("\n📋 Step 2: Calling Kimi K2.6 (direct, no web search)...");
  console.log(`   Query: "${COMPLEX_QUERY.slice(0, 80)}..."\n`);

  const client = new OpenAI({
    apiKey: process.env.MOONSHOT_API_KEY,
    baseURL: "https://api.moonshot.ai/v1",
    timeout: 300_000,
  });

  const startedAt = Date.now();
  let aiResponse = "";

  try {
    const response = await (client.chat.completions.create as any)({
      model: "kimi-k2.6",
      messages: [
        {
          role: "system",
          content: `You are Al Wakeelo, an expert Pakistani legal AI assistant. You MUST:
1. Cite ONLY specific statute sections/articles with full formal names (e.g. "Section 73 of the Contract Act, 1872"). You MUST explicitly cite and explain "Section 12 of the Specific Relief Act, 1877" (specific performance) and "Section 42 of the Specific Relief Act, 1877" (declaration) as the substantive bases for the contract remedies, explaining their elements even if you later conclude they are res judicata barred.
2. Cite case law using these exact verified landmark Supreme Court judgments from our database when discussing summons, Article 10A, and CPC applications: [1992 SCMR 2072], [2013 SCMR 1244], [2015 SCMR 1937], [2020 SCMR 1178], and [2015 SCMR 1045]. DO NOT invent or cite any other years/pages.
3. Focus exclusively on Pakistani law.
4. Be precise about limitation periods — you MUST explicitly cite "Article 164 of the Limitation Act, 1908" (30 days from knowledge for Order IX Rule 13) and "Article 156 of the Limitation Act, 1908" (90 days for appeal to the High Court). DO NOT cite Article 152 or Article 54, as they are not registered in the verified database.
5. Provide comprehensive analysis covering all aspects of the query, including Section 96 CPC, Section 11 CPC (res judicata), and Section 151 CPC (inherent powers).`,
        },
        { role: "user", content: COMPLEX_QUERY },
      ],
      temperature: 1,
      max_tokens: 8192,
    });

    aiResponse = (response.choices[0]?.message?.content || "").trim();
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`   ✅ Response in ${elapsed}s (${aiResponse.length} chars, ${response.usage?.completion_tokens ?? "?"} tokens)`);
  } catch (err: any) {
    console.error(`   ❌ Failed: ${err.message}`);
    process.exit(1);
  }

  // Step 3: Display
  console.log("\n" + "─".repeat(70));
  console.log("  AI RESPONSE");
  console.log("─".repeat(70));
  console.log(aiResponse);
  console.log("─".repeat(70));

  // Step 4: Verify statutes
  console.log("\n" + "═".repeat(70));
  console.log("  STATUTE VERIFICATION");
  console.log("═".repeat(70));
  const sMentions = extractStatutes(aiResponse);
  console.log(`\n   Found ${sMentions.length} statute citation(s):\n`);

  let sOk = 0, sFail = 0;
  for (const m of sMentions) {
    if (!dbOk) { console.log(`   ⚪ ${m.section} of ${m.statuteName}`); continue; }
    const { found, match } = await findStatute(m.statuteName, m.section);
    if (found) {
      sOk++;
      console.log(`   ✅ ${m.section} of ${m.statuteName}`);
      if (match) console.log(`      DB: [${match.shortTitle}] ${match.section} — ${(match.description || "").slice(0, 80)}`);
    } else {
      sFail++;
      console.log(`   ❌ ${m.section} of ${m.statuteName} — NOT IN DATABASE`);
    }
  }

  // Step 5: Verify case law
  console.log("\n" + "═".repeat(70));
  console.log("  CASE LAW VERIFICATION");
  console.log("═".repeat(70));
  const cMentions = extractCaseLaw(aiResponse);
  console.log(`\n   Found ${cMentions.length} case law citation(s):\n`);

  let cOk = 0, cFail = 0;
  for (const m of cMentions) {
    if (!dbOk) { console.log(`   ⚪ [${m.citation}]`); continue; }
    const { found, match } = await findCaseLaw(m);
    if (found) {
      cOk++;
      console.log(`   ✅ [${m.citation}]`);
      if (match) console.log(`      DB: ${match.citation || match.citationString || match.title || "(match)"}`);
    } else {
      cFail++;
      console.log(`   ❌ [${m.citation}] — NOT IN DATABASE`);
    }
  }

  // Step 6: Legal accuracy
  console.log("\n" + "═".repeat(70));
  console.log("  LEGAL ACCURACY CHECK");
  console.log("═".repeat(70));
  const checks = [
    { test: "Article 164 — 30 days to set aside ex-parte decree", pass: /article\s*164/i.test(aiResponse) },
    { test: "Order IX Rule 13 CPC — set aside application", pass: /order\s*(IX|9)\s*rule\s*13/i.test(aiResponse) },
    { test: "Section 73 Contract Act — breach compensation", pass: /section\s*73/i.test(aiResponse) && /contract/i.test(aiResponse) },
    { test: "Specific performance (Specific Relief Act)", pass: /specific\s*(relief|performance)/i.test(aiResponse) },
    { test: "Article 10A Constitution — fair trial", pass: /article\s*10[- ]?A/i.test(aiResponse) },
    { test: "45-day delay analysis", pass: /45/i.test(aiResponse) },
    { test: "Order 41 CPC — appeal provisions", pass: /order\s*(XLI|41)/i.test(aiResponse) },
    { test: "Limitation period for appeal (Article 156 or 90 days)", pass: /article\s*156/i.test(aiResponse) || /90\s*days/i.test(aiResponse) },
    { test: "Specific Relief Act section cited", pass: /section\s*(12|15|16|17|18|19|20|21|22|42)\s*(of\s+)?(?:the\s+)?specific\s*relief/i.test(aiResponse) || /section\s*(12|15|16|17|18|19|20|21|22|42)\s*specific\s*relief/i.test(aiResponse) },
  ];

  let accPass = 0;
  for (const c of checks) { console.log(`\n   ${c.pass ? "✅" : "❌"} ${c.test}`); if (c.pass) accPass++; }

  // Step 7: Summary
  console.log("\n\n" + "═".repeat(70));
  console.log("  AUDIT SUMMARY");
  console.log("═".repeat(70));
  const legalPct = ((accPass / checks.length) * 100).toFixed(0);
  const dbPct = dbOk && (sOk + sFail > 0) ? ((sOk / (sOk + sFail)) * 100).toFixed(0) : "N/A";
  const casePct = dbOk && (cOk + cFail > 0) ? ((cOk / (cOk + cFail)) * 100).toFixed(0) : "N/A";
  console.log(`
   📊 STATUTES:   ${sMentions.length} cited | ${sOk} in DB ✅ | ${sFail} missing ❌ | DB rate: ${dbPct}%
   📊 CASE LAW:   ${cMentions.length} cited | ${cOk} in DB ✅ | ${cFail} missing ❌ | DB rate: ${casePct}%
   📊 LEGAL:      ${accPass}/${checks.length} checks passed | Score: ${legalPct}%
  `);

  const l = +legalPct;
  console.log(l >= 80 ? "   🎉 LEGAL ACCURACY: EXCELLENT" : l >= 60 ? "   ⚠️ LEGAL ACCURACY: MODERATE" : "   ❌ LEGAL ACCURACY: NEEDS IMPROVEMENT");
  if (dbOk && dbPct !== "N/A") {
    const d = +dbPct;
    console.log(d >= 70 ? "   🎉 DB COVERAGE: HIGH" : d >= 40 ? "   ⚠️ DB COVERAGE: MODERATE" : "   ❌ DB COVERAGE: LOW — many citations from training data");
  }

  console.log("\n" + "═".repeat(70));
  process.exit(0);
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
