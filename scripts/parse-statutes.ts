import "../server/load-env";
import { db, pool } from "../server/db";
import { statuteDocuments, statuteDocumentFiles } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";
import * as fs from "fs/promises";
import * as path from "path";
import { isR2StorageEnabled, getR2ObjectText } from "../server/r2-storage";

type ExtractedSection = {
  shortTitle: string;
  section: string;
  description: string;
  punishment: string;
};

// Clean text helper
function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u2013/g, "–")
    .replace(/\u2014/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract punishment details from description text
function extractPunishment(desc: string): string {
  const cleanDesc = desc.toLowerCase();
  
  // Look for common punishment patterns in Pakistani law
  if (cleanDesc.includes("punished with death") || cleanDesc.includes("punishable with death")) {
    const match = desc.match(/(?:punished|punishable)\s+with\s+death[^\.]*/i);
    return match ? cleanText(match[0]) : "Death";
  }
  
  if (cleanDesc.includes("imprisonment for life") || cleanDesc.includes("imprison for life")) {
    const match = desc.match(/(?:imprisonment|punished)\s+with\s+imprisonment\s+for\s+life[^\.]*/i) ||
                  desc.match(/imprisonment\s+for\s+life[^\.]*/i);
    return match ? cleanText(match[0]) : "Imprisonment for life";
  }

  if (cleanDesc.includes("imprisonment of either description") || cleanDesc.includes("rigorous imprisonment") || cleanDesc.includes("shall be punished with imprisonment")) {
    const match = desc.match(/(?:punished|punishable)\s+with\s+imprisonment\s+of\s+either\s+description[^\.]*/i) ||
                  desc.match(/(?:punished|punishable)\s+with\s+imprisonment[^\.]*/i) ||
                  desc.match(/imprisonment\s+which\s+may\s+extend\s+to[^\.]*/i);
    if (match) return cleanText(match[0]);
  }

  if (cleanDesc.includes("shall be punished with fine") || cleanDesc.includes("punishable with fine")) {
    const match = desc.match(/(?:punished|punishable)\s+with\s+fine[^\.]*/i);
    if (match) return cleanText(match[0]);
  }

  // General fallback search for "imprisonment" or "fine" sentences
  const sentenceRegex = /[^.!?]*\b(?:imprisonment|punished|punishable|fine|diyat|qisas|ta'zir)\b[^.!?]*/i;
  const sentenceMatch = desc.match(sentenceRegex);
  if (sentenceMatch) {
    const s = cleanText(sentenceMatch[0]);
    if (s.length > 10 && s.length < 150) return s;
  }

  return "Not specified";
}

// Highly precise regex-based extractor for individual documents
export function parseSectionsFromText(title: string, text: string): ExtractedSection[] {
  const sections: ExtractedSection[] = [];
  const cleanTitle = title.replace(/,?\s*\d{4}.*$/, "").trim(); // clean year suffix from title
  
  // Standard Clean
  const bodyText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Strategy 1: CPC Order/Rule specific pattern (e.g. "O RDER IX Appearance... 1. Parties...")
  const isCpc = title.toLowerCase().includes("civil procedure") || 
                bodyText.toLowerCase().includes("order i") || 
                bodyText.toLowerCase().includes("o rder i") ||
                bodyText.toLowerCase().includes("order ix") ||
                bodyText.toLowerCase().includes("o rder ix");

  if (isCpc) {
    // Look for Orders: "ORDER IX" or similar
    const orderRegex = /(?:O\s*R\s*D\s*E\s*R\s+)([IVXLCDM]+)/gi;
    let orderMatch;
    let orderPositions: { order: string; index: number }[] = [];
    while ((orderMatch = orderRegex.exec(bodyText)) !== null) {
      orderPositions.push({
        order: orderMatch[1].toUpperCase(),
        index: orderMatch.index
      });
    }

    for (let i = 0; i < orderPositions.length; i++) {
      const current = orderPositions[i];
      const nextIndex = i + 1 < orderPositions.length ? orderPositions[i + 1].index : bodyText.length;
      const orderChunk = bodyText.substring(current.index, nextIndex);
      
      // Now parse rules within this order chunk: e.g. "1. Who may be joined..."
      const ruleRegex = /(?:^|\n|\s)(\d+)\.\s+([^.\n]{3,120})(?:\.|\s+[\-–—]|\s+\.\s*|\s*–\s*|\s*—\s*)\s*([\s\S]+?)(?=(?:\n|\s)\d+\.\s+[^.\n]{3,120}(?:\.|\s+[\-–—])|$)/g;
      let ruleMatch;
      while ((ruleMatch = ruleRegex.exec(orderChunk)) !== null) {
        const ruleNum = ruleMatch[1];
        const ruleTitle = cleanText(ruleMatch[2]);
        const ruleBody = cleanText(ruleMatch[3]);
        
        if (ruleBody.length > 15 && ruleTitle.length > 2) {
          sections.push({
            shortTitle: title,
            section: `Order ${current.order} Rule ${ruleNum}`,
            description: `${ruleTitle}: ${ruleBody}`,
            punishment: "Not specified"
          });
        }
      }
    }
  }

  // Strategy 2: Standard En-dash separator pattern (e.g. "34. Acts done...– When a criminal...")
  // We match digit(s) optionally followed by letters/dashes, followed by a dot, spaces, title, dash, and content.
  if (sections.length === 0) {
    const enDashRegex = /(?:^|\n)\s*(\d+(?:-[A-Za-z0-9]+)?)\.?\s+((?:(?!(?:\s+[-–—]\s+|[–—]))[^\n]){3,120})\s*(?:\s+[-–—]\s+|[–—])\s*([\s\S]+?)(?=(?:\n\s*\d+(?:-[A-Za-z0-9]+)?\.?\s+((?:(?!(?:\s+[-–—]\s+|[–—]))[^\n]){3,120})(?:\s+[-–—]\s+|[–—]))|$)/g;
    let match;
    while ((match = enDashRegex.exec(bodyText)) !== null) {
      const secNum = match[1].trim();
      const secTitle = cleanText(match[2]);
      const secBody = cleanText(match[3]);
      
      if (secBody.length > 20 && secTitle.length > 3) {
        sections.push({
          shortTitle: title,
          section: `Section ${secNum}`,
          description: `${secTitle}: ${secBody}`,
          punishment: extractPunishment(secBody)
        });
      }
    }
  }

  // Strategy 3: Dot separator pattern (e.g. "34. Acts done. When a...")
  if (sections.length === 0) {
    const dotRegex = /(?:^|\n)\s*(\d+(?:-[A-Za-z0-9]+)?)\.?\s+([A-Z][a-zA-Z0-9\s,()\'"‟“”\-]{3,80})\.\s+([\s\S]+?)(?=(?:\n\s*\d+(?:-[A-Za-z0-9]+)?\.?\s+[A-Z])|$)/g;
    let match;
    while ((match = dotRegex.exec(bodyText)) !== null) {
      const secNum = match[1].trim();
      const secTitle = cleanText(match[2]);
      const secBody = cleanText(match[3]);
      
      if (secBody.length > 20 && secTitle.length > 3) {
        sections.push({
          shortTitle: title,
          section: `Section ${secNum}`,
          description: `${secTitle}: ${secBody}`,
          punishment: extractPunishment(secBody)
        });
      }
    }
  }

  // Strategy 4: Resilient Line/Paragraph Fallback
  if (sections.length === 0) {
    const lines = bodyText.split("\n");
    let currentSection: { section: string; bodyLines: string[] } | null = null;

    const finalizeCurrentSection = () => {
      if (currentSection) {
        const fullBodyText = currentSection.bodyLines.join(" ");
        // Split by en-dash, em-dash, or standard hyphen with spaces around it, or special combinations
        const parts = fullBodyText.split(/\s+[-–—]\s+|–|—|:-|\.-/);
        let secTitle = `Section ${currentSection.section}`;
        let secBody = fullBodyText;

        if (parts.length > 1) {
          secTitle = cleanText(parts[0]);
          secBody = cleanText(parts.slice(1).join(" – "));
        } else {
          // Fallback split by first dot
          const firstDot = fullBodyText.indexOf(".");
          if (firstDot > 5 && firstDot < 60) {
            secTitle = cleanText(fullBodyText.substring(0, firstDot));
            secBody = cleanText(fullBodyText.substring(firstDot + 1));
          }
        }

        if (secBody.length > 15 && secTitle.length > 2) {
          sections.push({
            shortTitle: title,
            section: `Section ${currentSection.section}`,
            description: `${secTitle}: ${secBody}`,
            punishment: extractPunishment(secBody)
          });
        }
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = cleanText(lines[i]);
      // Matches e.g. "Section 12. Short title..." or "12. Definitions:..."
      const standardSectionMatch = line.match(/^Section\s+(\d+(?:-[A-Za-z0-9]+)?)\.?\s+(.*)$/i) || 
                                   line.match(/^(\d+(?:-[A-Za-z0-9]+)?)\.\s+(.*)$/);
      if (standardSectionMatch) {
        finalizeCurrentSection();
        const secNum = standardSectionMatch[1].trim();
        const rest = cleanText(standardSectionMatch[2]);
        currentSection = {
          section: secNum,
          bodyLines: rest ? [rest] : []
        };
      } else {
        if (currentSection && line.trim().length > 0) {
          currentSection.bodyLines.push(line);
        }
      }
    }
    finalizeCurrentSection();
  }

  return sections;
}

// Export extractPunishment as well
export { extractPunishment };

async function main() {
  console.log("==========================================");
  console.log("🚀 STARTING STATUTE SECTION EXTRACTION");
  console.log("==========================================");

  // Finding 2: Query ONLY id and title metadata initially
  const allDocuments = await db.select({
    id: statuteDocuments.id,
    title: statuteDocuments.title
  }).from(statuteDocuments);

  console.log(`Retrieved ${allDocuments.length} master documents from database.`);

  const allExtractedSections: ExtractedSection[] = [];
  let processedCount = 0;
  let totalSectionsExtracted = 0;

  // Process documents in batches of 50 to prevent memory leaks and run efficiently
  const batchSize = 50;
  for (let i = 0; i < allDocuments.length; i += batchSize) {
    const batch = allDocuments.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1}...`);
    
    const batchIds = batch.map(doc => doc.id);
    // Dynamically query the content field only for the active batch's document IDs
    const batchWithContent = batchIds.length > 0 
      ? await db.select({
          id: statuteDocuments.id,
          title: statuteDocuments.title,
          content: statuteDocuments.content
        })
        .from(statuteDocuments)
        .where(inArray(statuteDocuments.id, batchIds))
      : [];

    for (const doc of batchWithContent) {
      processedCount++;
      let docText = doc.content;

      // Try to load full un-truncated text from R2 if configured
      if (isR2StorageEnabled()) {
        try {
          const files = await db.select().from(statuteDocumentFiles).where(eq(statuteDocumentFiles.statuteDocumentId, doc.id));
          if (files.length > 0 && files[0].extractedTextKey) {
            const r2Text = await getR2ObjectText(files[0].extractedTextKey);
            if (r2Text) {
              docText = r2Text;
              console.log(`[R2] Loaded full text for "${doc.title}" (${docText.length} chars)`);
            }
          }
        } catch (err: any) {
          console.warn(`[R2] Failed to load full text for ID ${doc.id}:`, err?.message || err);
        }
      }

      if (!docText) continue;

      const extracted = parseSectionsFromText(doc.title, docText);
      totalSectionsExtracted += extracted.length;

      // Add to array
      allExtractedSections.push(...extracted);

      // Print status every 50 documents
      if (processedCount % 50 === 0 || processedCount === allDocuments.length) {
        console.log(`Progress: ${processedCount}/${allDocuments.length} documents. Cumulative Extracted: ${allExtractedSections.length} sections.`);
      }
    }
  }

  // Deduplicate entries by shortTitle + section
  const dedupedMap = new Map<string, ExtractedSection>();
  for (const s of allExtractedSections) {
    const key = `${s.shortTitle.toLowerCase().trim()}|${s.section.toLowerCase().trim()}`;
    if (!dedupedMap.has(key)) {
      dedupedMap.set(key, s);
    } else {
      // Keep the one with the longer description
      const existing = dedupedMap.get(key)!;
      if (s.description.length > existing.description.length) {
        dedupedMap.set(key, s);
      }
    }
  }

  const dedupedSections = Array.from(dedupedMap.values());

  console.log("==========================================");
  console.log("📊 EXTRACTION SUMMARY");
  console.log(`Total raw sections extracted: ${totalSectionsExtracted}`);
  console.log(`Total unique sections (deduped): ${dedupedSections.length}`);
  console.log("==========================================");

  // Save the result to a JSON file
  const outputPath = path.resolve(process.cwd(), "parsed_sections.json");
  await fs.writeFile(outputPath, JSON.stringify(dedupedSections, null, 2));
  console.log(`🎉 Saved ${dedupedSections.length} unique sections to: ${outputPath}`);

  await pool.end();
}

// Guard main execution so it only runs when invoked directly
const isMain = process.argv[1] && (
  process.argv[1].endsWith("parse-statutes.ts") || 
  process.argv[1].endsWith("parse-statutes")
);

if (isMain) {
  main().catch(async (err) => {
    console.error("Fatal Error in extractor:", err);
    await pool.end();
  });
}

