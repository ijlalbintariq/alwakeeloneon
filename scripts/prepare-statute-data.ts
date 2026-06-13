/**
 * prepare-statute-data.ts
 *
 * Reads all scraped .md statute files from legal_scraper_data/statutes/
 * and produces two JSON files:
 *   1. statute_docs_to_insert.json   — full documents for statute_documents table
 *   2. statute_sections_to_insert.json — individual sections for statutes table
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATUTES_DIR = "/Users/macbook/Downloads/legal_scraper_data/statutes";
const OUT_DIR = path.resolve(__dirname, "..");
const MIN_FILE_SIZE = 300; // bytes — skip stubs
const MIN_SECTION_CONTENT_CHARS = 20; // skip stub sections

interface StatuteDoc {
  title: string;
  filename: string;
  content: string;
  category: string;
}

interface StatuteSection {
  shortTitle: string;
  section: string;
  description: string;
  punishment: string;
}

function cleanTitle(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSections(content: string, title: string): StatuteSection[] {
  const sections: StatuteSection[] = [];
  // Split by ## headers
  const parts = content.split(/^## /m);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const firstNewline = part.indexOf("\n");
    if (firstNewline === -1) continue;

    const headerLine = part.substring(0, firstNewline).trim();
    let body = part.substring(firstNewline + 1).trim();

    // Remove separator lines
    body = body.replace(/^={10,}\s*$/gm, "").trim();

    // Skip preamble sections
    if (/^preamble/i.test(headerLine)) continue;

    // Parse header: "302 - Punishment of Qatl-i-amd" or "1 - Short title"
    // Also handles: "Section 302 - ..." or just "302"
    const headerMatch = headerLine.match(
      /^(?:section\s+|article\s+|s\.\s*)?([0-9]+[a-zA-Z\-\/]*(?:\([0-9]+\))?)\s*[-–—:]\s*(.*)/i
    );

    let sectionNum: string;
    let sectionTitle: string;

    if (headerMatch) {
      sectionNum = headerMatch[1].trim();
      sectionTitle = headerMatch[2].trim();
    } else {
      // Header might just be a title without section number
      sectionNum = headerLine.replace(/\s*[-–—:]\s*$/, "").trim();
      sectionTitle = "";
    }

    if (!sectionNum) continue;

    // Skip stub sections (content is just "-1" or empty)
    const contentLines = body
      .split("\n")
      .filter((l) => l.trim() && l.trim() !== "-1");
    if (contentLines.length === 0) continue;

    const cleanBody = contentLines.join("\n").trim();
    if (cleanBody.length < MIN_SECTION_CONTENT_CHARS) continue;

    // Build description: title + body, capped at 4000 chars
    const descParts: string[] = [];
    if (sectionTitle) descParts.push(sectionTitle);
    descParts.push(cleanBody);
    let description = descParts.join("\n\n").slice(0, 4000);

    // Try to extract punishment from body
    let punishment = "";
    const punishmentMatch = cleanBody.match(
      /(?:punish(?:ment|ed|able)\s+(?:with|by|under)|shall\s+be\s+(?:punished|liable))[^.]*\./i
    );
    if (punishmentMatch) {
      punishment = punishmentMatch[0].trim().slice(0, 500);
    }

    sections.push({
      shortTitle: title,
      section: sectionNum,
      description,
      punishment,
    });
  }

  return sections;
}

function main() {
  console.log("📖 Reading statute files from:", STATUTES_DIR);

  const allFiles = fs
    .readdirSync(STATUTES_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort();
  console.log(`   Found ${allFiles.length} .md files`);

  const docs: StatuteDoc[] = [];
  const allSections: StatuteSection[] = [];
  let skippedStub = 0;
  let skippedEmpty = 0;

  for (const filename of allFiles) {
    const filepath = path.join(STATUTES_DIR, filename);
    const stat = fs.statSync(filepath);

    if (stat.size <= MIN_FILE_SIZE) {
      skippedStub++;
      continue;
    }

    const content = fs.readFileSync(filepath, "utf-8");
    const title = cleanTitle(filename);

    // Check if content has real text
    const textLines = content
      .split("\n")
      .filter(
        (l) =>
          l.trim() &&
          !l.startsWith("#") &&
          !l.startsWith("==") &&
          l.trim() !== "-1"
      );
    if (textLines.length < 5) {
      skippedEmpty++;
      continue;
    }

    // Full document for statute_documents
    docs.push({
      title,
      filename,
      content: content.trim(),
      category: "general",
    });

    // Parse sections for statutes table
    const sections = parseSections(content, title);
    allSections.push(...sections);
  }

  console.log(`\n📊 Results:`);
  console.log(`   Statute documents: ${docs.length}`);
  console.log(`   Total sections: ${allSections.length}`);
  console.log(`   Skipped (stub/small): ${skippedStub}`);
  console.log(`   Skipped (empty content): ${skippedEmpty}`);

  // Deduplicate sections by (shortTitle, section)
  const sectionKeys = new Set<string>();
  const dedupedSections: StatuteSection[] = [];
  for (const s of allSections) {
    const key = `${s.shortTitle.toLowerCase()}|||${s.section.toLowerCase()}`;
    if (sectionKeys.has(key)) continue;
    sectionKeys.add(key);
    dedupedSections.push(s);
  }
  console.log(`   Deduplicated sections: ${dedupedSections.length}`);

  // Write outputs
  const docsPath = path.join(OUT_DIR, "statute_docs_to_insert.json");
  const sectionsPath = path.join(OUT_DIR, "statute_sections_to_insert.json");

  fs.writeFileSync(docsPath, JSON.stringify(docs));
  fs.writeFileSync(sectionsPath, JSON.stringify(dedupedSections));

  console.log(`\n✅ Written:`);
  console.log(`   ${docsPath} (${(fs.statSync(docsPath).size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`   ${sectionsPath} (${(fs.statSync(sectionsPath).size / 1024 / 1024).toFixed(1)} MB)`);
}

main();
