import { storage } from "./storage";
import { queueAutoExtraction } from "./auto-extract-caselaw";
import { extractText } from "unpdf";

const GITHUB_REPO = "ijlalbintariq/law";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;
const SUPPORTED_EXTENSIONS = [".txt", ".json", ".csv", ".pdf"];
const PROD_DEFAULT_SYNC_ENABLED = false;

function envBool(name: string, defaultValue: boolean): boolean {
  const raw = (process.env[name] || "").trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function envInt(name: string, defaultValue: number, min: number, max: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return defaultValue;
  return Math.min(max, Math.max(min, Math.floor(raw)));
}

function shouldRunGithubSync(): boolean {
  const defaultEnabled = process.env.NODE_ENV === "production" ? PROD_DEFAULT_SYNC_ENABLED : true;
  return envBool("GITHUB_SYNC_ENABLED", defaultEnabled);
}

const MAX_GITHUB_FILE_BYTES = envInt("GITHUB_SYNC_MAX_FILE_BYTES", 2 * 1024 * 1024, 64 * 1024, 50 * 1024 * 1024);
const MAX_GITHUB_TEXT_CHARS = envInt("GITHUB_SYNC_MAX_TEXT_CHARS", 200_000, 10_000, 2_000_000);
const MAX_GITHUB_FILES = envInt("GITHUB_SYNC_MAX_FILES", 400, 1, 5_000);
const SYNC_BATCH_SIZE = envInt("GITHUB_SYNC_BATCH_SIZE", process.env.NODE_ENV === "production" ? 2 : 5, 1, 25);
const GITHUB_SYNC_AUTO_EXTRACT = envBool("GITHUB_SYNC_AUTO_EXTRACT", process.env.NODE_ENV !== "production");

interface GithubItem {
  name: string;
  path: string;
  download_url: string | null;
  size: number;
  type: "file" | "dir";
}

function deriveTitle(filepath: string): string {
  const filename = filepath.split("/").pop() || filepath;
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

async function fetchDirectoryContents(path: string = ""): Promise<GithubItem[]> {
  const url = path
    ? `${GITHUB_API_BASE}/contents/${encodeURIComponent(path)}`
    : `${GITHUB_API_BASE}/contents`;

  const res = await fetch(url, {
    headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "AlWakeelo-LegalBot" },
  });
  if (!res.ok) {
    console.error(`[GitHub Sync] API error for path "${path}": ${res.status} ${res.statusText}`);
    return [];
  }
  return await res.json();
}

async function fetchAllFilesRecursively(path: string = "", acc: GithubItem[] = []): Promise<GithubItem[]> {
  if (acc.length >= MAX_GITHUB_FILES) return acc;
  const items = await fetchDirectoryContents(path);

  for (const item of items) {
    if (acc.length >= MAX_GITHUB_FILES) break;
    if (item.type === "file" && item.download_url) {
      const ext = "." + (item.name.split(".").pop() || "").toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext) && item.size <= MAX_GITHUB_FILE_BYTES) {
        acc.push(item);
      }
    } else if (item.type === "dir") {
      await fetchAllFilesRecursively(item.path, acc);
    }
  }

  return acc;
}

async function fetchFileContent(file: GithubItem): Promise<string | null> {
  if (!file.download_url) return null;
  if (file.size > MAX_GITHUB_FILE_BYTES) {
    console.warn(`[GitHub Sync] Skipping large file (${file.size} bytes): ${file.path}`);
    return null;
  }
  try {
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
    const res = await fetch(file.download_url, {
      headers: { "User-Agent": "AlWakeelo-LegalBot" },
    });
    if (!res.ok) return null;

    if (ext === ".pdf") {
      const buffer = await res.arrayBuffer();
      const uint8 = new Uint8Array(buffer);
      const pdfResult = await extractText(uint8, { mergePages: true });
      const text = (pdfResult.text || "").trim().slice(0, MAX_GITHUB_TEXT_CHARS);
      if (!text) {
        console.warn(`[GitHub Sync] PDF has no extractable text: ${file.path}`);
        return null;
      }
      return text;
    }

    const text = await res.text();
    if (text.length > MAX_GITHUB_TEXT_CHARS) {
      return text.slice(0, MAX_GITHUB_TEXT_CHARS);
    }
    return text;
  } catch (err) {
    console.error(`[GitHub Sync] Failed to fetch ${file.path}:`, err);
    return null;
  }
}

export async function syncGithubKnowledge(): Promise<void> {
  try {
    if (!shouldRunGithubSync()) {
      console.log("[GitHub Sync] Disabled by configuration. Skipping startup sync.");
      return;
    }
    const existingCount = await storage.getGithubKnowledgeCount();

    console.log("[GitHub Sync] Scanning repository for all files...");
    const files = await fetchAllFilesRecursively();

    if (files.length === 0) {
      console.log("[GitHub Sync] No files found or API unavailable.");
      return;
    }

    console.log(`[GitHub Sync] Found ${files.length} files in repository.`);

    if (existingCount >= files.length) {
      console.log(`[GitHub Sync] Knowledge base already synced (${existingCount} documents).`);
      return;
    }

    console.log(`[GitHub Sync] Syncing ${files.length} legal documents from GitHub...`);

    const batchSize = SYNC_BATCH_SIZE;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const items = await Promise.all(
        batch.map(async (file) => {
          const content = await fetchFileContent(file);
          if (!content) return null;
          return {
            filename: file.path,
            title: deriveTitle(file.path),
            content: content.replace(/\x00/g, ""),
          };
        })
      );

      const validItems = items.filter((item): item is NonNullable<typeof item> => item !== null);
      if (validItems.length > 0) {
        await storage.upsertGithubKnowledge(validItems);
        if (GITHUB_SYNC_AUTO_EXTRACT) {
          for (const item of validItems) {
            if (item.content.length > 200) {
              queueAutoExtraction(item.content, `github:${item.filename}`);
            }
          }
        }
      }

      console.log(`[GitHub Sync] Progress: ${Math.min(i + batchSize, files.length)}/${files.length} files processed.`);
    }

    const finalCount = await storage.getGithubKnowledgeCount();
    console.log(`[GitHub Sync] Complete. ${finalCount} legal documents indexed.`);
  } catch (err) {
    console.error("[GitHub Sync] Error during sync:", err);
  }
}
