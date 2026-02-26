import { storage } from "./storage";
import { queueAutoExtraction } from "./auto-extract-caselaw";
import https from "node:https";
import { URL } from "node:url";

const GITHUB_REPO = "ijlalbintariq/law";
const GITHUB_API_BASE = `https://api.github.com/repos/${GITHUB_REPO}`;
const GH_TOKEN = process.env.GITHUB_TOKEN;

function ghHeaders(extra?: Record<string, string>) {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "AlWakeelo-LegalBot",
    ...(extra || {}),
  };
  if (GH_TOKEN) headers.Authorization = `token ${GH_TOKEN}`;
  return headers;
}

const pv = (v?: string) => !!v && (/^base$/i.test(v) || !/^https?:\/\//i.test(v));
["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"].forEach((n) => {
  const val = process.env[n];
  if (pv(val)) delete process.env[n];
});
const noProxyHosts = ["localhost", "127.0.0.1", "::1", ".render.internal", "api.github.com", "raw.githubusercontent.com", "github.com"];
const existingNoProxy = process.env.NO_PROXY || process.env.no_proxy || "";
const list = new Set(existingNoProxy.split(",").map((s) => s.trim()).filter(Boolean).concat(noProxyHosts));
process.env.NO_PROXY = Array.from(list).join(",");

function httpsGet(urlStr: string, headers: Record<string, string>, redirects = 3): Promise<{ status: number; body: string; statusText: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        method: "GET",
        headers,
        timeout: 20000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        const code = res.statusCode || 0;
        const msg = res.statusMessage || "";
        const loc = res.headers.location;
        if ((code === 301 || code === 302 || code === 303 || code === 307 || code === 308) && loc && redirects > 0) {
          const nextUrl = new URL(loc, urlStr).toString();
          res.resume();
          httpsGet(nextUrl, headers, redirects - 1).then(resolve).catch(reject);
          return;
        }
        res.on("data", (d) => chunks.push(Buffer.isBuffer(d) ? d : Buffer.from(d)));
        res.on("end", () => resolve({ status: code, statusText: msg, body: Buffer.concat(chunks).toString("utf8") }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

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

  const res = await httpsGet(url, ghHeaders());
  if (res.status < 200 || res.status >= 300) {
    console.error(`[GitHub Sync] API error for path "${path}": ${res.status} ${res.statusText}`);
    return [];
  }
  try {
    return JSON.parse(res.body);
  } catch {
    return [];
  }
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
    const res = await httpsGet(file.download_url, ghHeaders());
    if (res.status < 200 || res.status >= 300) return null;
    return res.body;
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
