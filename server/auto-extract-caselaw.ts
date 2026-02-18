import { GoogleGenAI } from "@google/genai";
import { storage } from "./storage";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY! });

const EXTRACTION_PROMPT = `You are a Pakistani legal research expert. Analyze the following legal document text and extract ALL individual court cases/judgments found in it.

For EACH case you find, extract:
1. citation - The official case citation (e.g., "PLD 2024 Supreme Court 123", "2023 SCMR 456", "2024 YLR 789"). Use official law report abbreviations: PLD, SCMR, YLR, MLD, CLC, PCRLJ, PLJ.
2. court - The court name (e.g., "Supreme Court of Pakistan", "Lahore High Court", "Sindh High Court")
3. title - The case title/name (e.g., "State vs Muhammad Ahmed", "Sughran Bibi vs Government of Punjab")
4. summary - A concise 1-3 sentence summary of the legal principle established or the key holding
5. keywords - An array of 3-8 relevant legal keywords

CRITICAL RULES:
- Extract EVERY distinct case/judgment you can identify in the text
- If you cannot determine a field with certainty, use your best professional judgment based on context
- For citations, use the exact format found in the text
- Do NOT invent or fabricate cases — only extract what is actually present in the document
- If the document contains commentary or analysis alongside cases, focus on extracting the actual cases referenced

Respond with ONLY valid JSON in this exact format (no markdown, no explanation):
{"cases":[{"citation":"...","court":"...","title":"...","summary":"...","keywords":["..."]}]}

If no cases can be identified, respond with: {"cases":[]}`;

const MAX_CHARS = 200000;
const MAX_QUEUE_SIZE = 200;

interface ExtractedCase {
  citation: string;
  court: string;
  title: string;
  summary: string;
  keywords: string[];
}

let extractionQueue: Array<{ text: string; source: string }> = [];
let isProcessing = false;
const knownCitations = new Set<string>();
let knownCitationsLoaded = false;

async function loadKnownCitations(): Promise<void> {
  if (knownCitationsLoaded) return;
  try {
    const existing = await storage.getCaseLawCitations();
    for (const c of existing) {
      knownCitations.add(c);
    }
    knownCitationsLoaded = true;
  } catch (err: any) {
    console.error("[Auto-Extract] Failed to load known citations:", err?.message);
  }
}

export function queueAutoExtraction(text: string, source: string): void {
  if (!text || text.length < 100) return;
  if (extractionQueue.length >= MAX_QUEUE_SIZE) {
    console.log(`[Auto-Extract] Queue full (${MAX_QUEUE_SIZE}), skipping: ${source}`);
    return;
  }
  extractionQueue.push({ text, source });
  if (!isProcessing) {
    processQueue();
  }
}

async function processQueue(): Promise<void> {
  if (isProcessing || extractionQueue.length === 0) return;
  isProcessing = true;

  await loadKnownCitations();

  while (extractionQueue.length > 0) {
    const item = extractionQueue.shift()!;
    await extractAndSave(item.text, item.source);
  }

  isProcessing = false;
}

async function extractAndSave(text: string, source: string): Promise<void> {
  try {
    const textForAI = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) : text;

    const completion = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: [{ role: "user", parts: [{ text: textForAI }] }],
      config: {
        maxOutputTokens: 16384,
        systemInstruction: EXTRACTION_PROMPT,
        temperature: 0.1,
      },
    });

    const responseText = (completion.text || "").trim();
    let jsonText = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    let parsed: { cases: ExtractedCase[] };
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.log(`[Auto-Extract] Could not parse AI response for source: ${source}`);
      return;
    }

    if (!parsed.cases || !Array.isArray(parsed.cases) || parsed.cases.length === 0) {
      return;
    }

    const newCases: ExtractedCase[] = [];
    for (const c of parsed.cases) {
      if (!c.citation || !c.title) continue;
      const key = c.citation.toLowerCase().trim();
      if (knownCitations.has(key)) continue;
      knownCitations.add(key);
      newCases.push(c);
    }

    if (newCases.length === 0) {
      return;
    }

    const entries = newCases.map(c => ({
      citation: c.citation.trim(),
      court: (c.court || "").trim(),
      title: c.title.trim(),
      summary: (c.summary || "").trim(),
      keywords: Array.isArray(c.keywords) ? c.keywords : [],
    }));

    await storage.bulkCreateCaseLaw(entries);
    console.log(`[Auto-Extract] Added ${entries.length} new case law entries from: ${source}`);
  } catch (err: any) {
    console.error(`[Auto-Extract] Error processing ${source}:`, err?.message || err);
  }
}

export async function extractFromAllExistingSources(): Promise<void> {
  console.log("[Auto-Extract] Scanning all knowledge sources for case law...");

  try {
    await loadKnownCitations();

    const allGithubDocs = await storage.getAllGithubKnowledge();
    let githubQueued = 0;
    for (const doc of allGithubDocs) {
      if (doc.content && doc.content.length > 200) {
        queueAutoExtraction(doc.content, `github:${doc.filename}`);
        githubQueued++;
      }
    }
    console.log(`[Auto-Extract] Queued ${githubQueued} GitHub knowledge documents`);

    const adminDocs = await storage.getAllAdminKnowledge();
    let adminQueued = 0;
    for (const doc of adminDocs) {
      if (doc.content && doc.content.length > 200) {
        queueAutoExtraction(doc.content, `admin:${doc.filename}`);
        adminQueued++;
      }
    }
    console.log(`[Auto-Extract] Queued ${adminQueued} admin knowledge documents`);

    const statuteDocs = await storage.getAllStatuteDocuments();
    let statuteQueued = 0;
    for (const doc of statuteDocs) {
      if (doc.content && doc.content.length > 200) {
        queueAutoExtraction(doc.content, `statute:${doc.filename}`);
        statuteQueued++;
      }
    }
    console.log(`[Auto-Extract] Queued ${statuteQueued} statute documents`);
  } catch (err: any) {
    console.error("[Auto-Extract] Error scanning sources:", err?.message || err);
  }
}
