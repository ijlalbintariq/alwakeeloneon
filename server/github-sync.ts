import { storage } from "./storage";
import { queueAutoExtraction } from "./auto-extract-caselaw";

const GITHUB_REPO = "ijlalbintariq/law";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;

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

async function fetchAllFilesRecursively(path: string = ""): Promise<GithubItem[]> {
  const items = await fetchDirectoryContents(path);
  const allFiles: GithubItem[] = [];

  for (const item of items) {
    if (item.type === "file" && item.download_url) {
      allFiles.push(item);
    } else if (item.type === "dir") {
      const subFiles = await fetchAllFilesRecursively(item.path);
      allFiles.push(...subFiles);
    }
  }

  return allFiles;
}

async function fetchFileContent(file: GithubItem): Promise<string | null> {
  if (!file.download_url) return null;
  try {
    const res = await fetch(file.download_url, {
      headers: { "User-Agent": "AlWakeelo-LegalBot" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error(`[GitHub Sync] Failed to fetch ${file.path}:`, err);
    return null;
  }
}

export async function syncGithubKnowledge(): Promise<void> {
  try {
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

    const batchSize = 5;
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
            syncedAt: new Date(),
          };
        })
      );

      const validItems = items.filter((item): item is NonNullable<typeof item> => item !== null);
      if (validItems.length > 0) {
        await storage.upsertGithubKnowledge(validItems);
        for (const item of validItems) {
          if (item.content.length > 200) {
            queueAutoExtraction(item.content, `github:${item.filename}`);
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
