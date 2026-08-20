import { proxyGet } from "../proxy-fetch";
import { CourtAdapter, CourtAdapterHealth } from "../court-adapter";
import {
  CourtCode,
  ScrapedDocument,
  ParsedCauseList,
  ValidationResult,
  ListType,
} from "../types";
import { computeSha256 } from "../document-archiver";
import { validateCauseList } from "../validator";
import { parsePdfCauseListBuffer, parseHtmlCauseList } from "../pdf-roster-parser";

const SCP_BENCH_MAP: Record<string, { code: string; name: string; param: string }> = {
  "principal seat": { code: "ISB", name: "Principal Seat (Islamabad)", param: "islamabad" },
  "branch registry lahore": { code: "LHR", name: "Branch Registry Lahore", param: "lahore" },
  "branch registry karachi": { code: "KHI", name: "Branch Registry Karachi", param: "karachi" },
  "branch registry peshawar": { code: "PEW", name: "Branch Registry Peshawar", param: "peshawar" },
  "branch registry quetta": { code: "UET", name: "Branch Registry Quetta", param: "quetta" },
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Cache-Control": "no-cache",
};

export class ScpCourtAdapter implements CourtAdapter {
  readonly courtCode: CourtCode = "SCP";
  readonly courtName = "Supreme Court of Pakistan";
  readonly supportedBenches = [
    "Principal Seat (Islamabad)",
    "Branch Registry Lahore",
    "Branch Registry Karachi",
    "Branch Registry Peshawar",
    "Branch Registry Quetta",
  ];

  async discoverLists(targetDate: string): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    const listTypes: ListType[] = ["regular", "urgent", "supplementary"];

    for (const [key, benchInfo] of Object.entries(SCP_BENCH_MAP)) {
      for (const listType of listTypes) {
        const url = `https://www.supremecourt.gov.pk/cause-list/?registry=${benchInfo.param}&date=${targetDate}&type=${listType}`;
        documents.push({
          court: this.courtCode,
          bench: benchInfo.name,
          listType,
          targetDate,
          sourceUrl: url,
          sourceFormat: "html",
          rawPayload: {
            registryParam: benchInfo.param,
            registryCode: benchInfo.code,
          },
        });
      }
    }

    return documents;
  }

  async downloadDocument(
    doc: ScrapedDocument
  ): Promise<{ buffer: Buffer; mimeType: string; hash: string }> {
    let lastError: Error | null = null;
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await proxyGet(doc.sourceUrl, {
          headers: BROWSER_HEADERS,
          responseType: "arraybuffer",
          timeout: 60_000,
          validateStatus: (status) => status === 200 || status === 404 || status === 403,
        });

        if (response.status === 404 || response.status === 403) {
          return { buffer: Buffer.alloc(0), mimeType: "text/html", hash: "" };
        }

        const buffer = Buffer.from(response.data);
        const contentType = String(response.headers["content-type"] || "application/pdf");
        const hash = computeSha256(buffer);

        return { buffer, mimeType: contentType, hash };
      } catch (err: any) {
        lastError = err;
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(
      `[ScpCourtAdapter] Failed to download document from ${doc.sourceUrl} after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  async parseDocument(
    buffer: Buffer,
    doc: ScrapedDocument
  ): Promise<ParsedCauseList[]> {
    if (buffer.length === 0) return [];

    const isHtml =
      doc.sourceUrl.endsWith(".html") ||
      doc.sourceUrl.endsWith(".php") ||
      buffer.slice(0, 200).toString("utf-8").toLowerCase().includes("<html") ||
      buffer.slice(0, 200).toString("utf-8").toLowerCase().includes("<!doctype html");

    if (isHtml) {
      const htmlText = buffer.toString("utf-8");
      return parseHtmlCauseList(htmlText, this.courtCode, doc.bench, doc.targetDate, doc.listType);
    }

    return parsePdfCauseListBuffer(
      buffer,
      this.courtCode,
      doc.bench,
      doc.targetDate,
      doc.listType
    );
  }

  validate(parsed: ParsedCauseList): ValidationResult {
    return validateCauseList(parsed);
  }

  async healthCheck(): Promise<CourtAdapterHealth> {
    const startTime = Date.now();
    try {
      const response = await proxyGet("https://www.supremecourt.gov.pk/cause-list/", {
        headers: BROWSER_HEADERS,
        timeout: 60_000,
        validateStatus: () => true,
      });

      const latencyMs = Date.now() - startTime;
      const healthy = response.status >= 200 && response.status < 400;

      return {
        healthy,
        latencyMs,
        message: healthy
          ? `Supreme Court portal responsive (HTTP ${response.status})`
          : `Supreme Court portal returned HTTP ${response.status}`,
        endpoint: "https://www.supremecourt.gov.pk/cause-list/",
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: `Supreme Court connection failed: ${err.message}`,
        endpoint: "https://www.supremecourt.gov.pk/cause-list/",
      };
    }
  }
}
