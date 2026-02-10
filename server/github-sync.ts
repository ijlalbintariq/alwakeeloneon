import { storage } from "./storage";

const GITHUB_REPO = "ijlalbintariq/law";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;

interface GithubFile {
  name: string;
  path: string;
  download_url: string;
  size: number;
  type: string;
}

function deriveTitle(filename: string): string {
  return filename
    .replace(/_extracted\.(txt|json)$/i, "")
    .replace(/\.(txt|json)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

async function fetchFileList(): Promise<GithubFile[]> {
  const res = await fetch(`${GITHUB_API_BASE}/contents`, {
    headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "AlWakeelo-LegalBot" },
  });
  if (!res.ok) {
    console.error(`GitHub API error: ${res.status} ${res.statusText}`);
    return [];
  }
  const files: GithubFile[] = await res.json();
  return files.filter(f => f.type === "file" && f.name.endsWith(".txt"));
}

async function fetchFileContent(file: GithubFile): Promise<string | null> {
  try {
    const res = await fetch(file.download_url, {
      headers: { "User-Agent": "AlWakeelo-LegalBot" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.error(`Failed to fetch ${file.name}:`, err);
    return null;
  }
}

export async function syncGithubKnowledge(): Promise<void> {
  try {
    const existingCount = await storage.getGithubKnowledgeCount();
    
    const files = await fetchFileList();
    if (files.length === 0) {
      console.log("[GitHub Sync] No .txt files found or API unavailable.");
      return;
    }

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
            filename: file.name,
            title: deriveTitle(file.name),
            content,
          };
        })
      );

      const validItems = items.filter((item): item is NonNullable<typeof item> => item !== null);
      if (validItems.length > 0) {
        await storage.upsertGithubKnowledge(validItems);
      }

      console.log(`[GitHub Sync] Progress: ${Math.min(i + batchSize, files.length)}/${files.length} files processed.`);
    }

    const finalCount = await storage.getGithubKnowledgeCount();
    console.log(`[GitHub Sync] Complete. ${finalCount} legal documents indexed.`);
  } catch (err) {
    console.error("[GitHub Sync] Error during sync:", err);
  }
}
