import "../load-env";
import { db } from "../db";
import { statutes } from "../../shared/schema";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Standard Pakistani legal abbreviations (manually prioritized)
const MANUAL_ABBREVIATIONS: Record<string, string> = {
  ppc: "Pakistan Penal Code",
  crpc: "Code of Criminal Procedure",
  cpc: "Code of Civil Procedure",
  qso: "Qanun-e-Shahadat Order 1984",
  qe: "Qanun-e-Shahadat Order 1984",
  mflo: "Muslim Family Laws Ordinance 1961",
  gwa: "Guardians and Wards Act 1890",
  fca: "Family Courts Act 1964",
  ata: "Anti-Terrorism Act 1997",
  nao: "National Accountability Ordinance 1999",
  poca: "Prevention of Corruption Act 1947",
  cnsa: "Control of Narcotic Substances Act 1997",
  peca: "Prevention of Electronic Crimes Act 2016",
  fia: "Federal Investigation Agency Act 1974",
  tpa: "Transfer of Property Act 1882",
  ra: "Registration Act 1908",
  ito: "Income Tax Ordinance 2001",
  sta: "Sales Tax Act 1990",
  ira: "Industrial Relations Act 2012",
  ca: "Companies Act 2017",
  fcra: "Foreign Contributions Regulation Act",
  aa: "Arms Act 1878",
  mvoa: "Motor Vehicles Ordinance 1965",
  pa: "Partnership Act 1932",
  contract: "Contract Act 1872",
  sra: "Specific Relief Act 1877",
  arbitration: "Arbitration Act 1940",
};

// Words to ignore when generating acronyms
const STOPWORDS = new Set([
  "of",
  "and",
  "the",
  "act",
  "ordinance",
  "laws",
  "rules",
  "order",
  "orders",
  "amendment",
  "special",
  "provisions",
  "west",
  "east",
  "punjab",
  "sindh",
  "balochistan",
  "pakistan",
  "provincial",
  "federal",
]);

function generateAcronym(title: string): string | null {
  // Strip year and parenthesis info
  const cleaned = title
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.toLowerCase().split(" ").filter((w) => w.length > 0);
  const acronymWords = words.filter((w) => !STOPWORDS.has(w));

  if (acronymWords.length >= 2) {
    return acronymWords.map((w) => w[0]).join("");
  }
  return null;
}

async function main() {
  console.log("=== Generating Intent Classifier Mappings from Statutes ===");

  // 1. Fetch all unique statute short titles from the DB
  const rows = (await db
    .select({ shortTitle: statutes.shortTitle })
    .from(statutes)) as any[];

  const uniqueTitles: string[] = Array.from(
    new Set(rows.map((r: any) => String(r.shortTitle || "").trim()).filter((t: string) => t.length > 0))
  );

  console.log(`Found ${uniqueTitles.length} unique statute titles in database.`);

  // 2. Build abbreviation map starting with manual ones
  const abbreviationMap: Record<string, string> = { ...MANUAL_ABBREVIATIONS };

  for (const title of uniqueTitles) {
    // Generate an acronym for each unique title
    const acronym = generateAcronym(title);
    if (acronym && acronym.length >= 2 && acronym.length <= 6) {
      // If not already defined manually, map it
      if (!abbreviationMap[acronym]) {
        abbreviationMap[acronym] = title;
      }
    }
  }

  // 3. Prepare the generated code block
  let codeBlock = "// @abbreviation-map-start\n";
  codeBlock += "export const STATUTE_ABBREVIATION_MAP: Record<string, string> = {\n";
  
  // First write manual ones so they are easy to read
  codeBlock += "  // --- Manual Standard Abbreviations ---\n";
  for (const [abbr, val] of Object.entries(MANUAL_ABBREVIATIONS)) {
    codeBlock += `  ${JSON.stringify(abbr)}: ${JSON.stringify(val)},\n`;
  }

  // Then write auto-generated ones
  codeBlock += "  // --- Auto-Generated Database Mappings ---\n";
  for (const [abbr, val] of Object.entries(abbreviationMap)) {
    if (!(abbr in MANUAL_ABBREVIATIONS)) {
      codeBlock += `  ${JSON.stringify(abbr)}: ${JSON.stringify(val)},\n`;
    }
  }

  codeBlock += "};\n";
  codeBlock += "// @abbreviation-map-end";

  // 4. Read intent-classifier.ts and replace the block
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const filePath = path.resolve(__dirname, "../pipeline/intent-classifier.ts");
  let content = fs.readFileSync(filePath, "utf8");

  const startMarker = "// @abbreviation-map-start";
  const endMarker = "// @abbreviation-map-end";

  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.error("Could not find markers in intent-classifier.ts");
    process.exit(1);
  }

  const before = content.slice(0, startIndex);
  const after = content.slice(endIndex + endMarker.length);

  const updatedContent = before + codeBlock + after;
  fs.writeFileSync(filePath, updatedContent, "utf8");

  console.log("Successfully updated STATUTE_ABBREVIATION_MAP in intent-classifier.ts!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Generator failed:", err);
  process.exit(1);
});
