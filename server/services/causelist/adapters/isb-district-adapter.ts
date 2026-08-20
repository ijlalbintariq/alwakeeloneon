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

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

export class IsbDistrictCourtAdapter implements CourtAdapter {
  readonly courtCode: CourtCode = "ISB_DIST";
  readonly courtName = "Islamabad District Courts";
  readonly supportedBenches = [
    "District East (G-11 Judicial Complex)",
    "District West (G-11 Judicial Complex)",
    "Sessions Division Islamabad",
    "Special Courts Islamabad",
  ];

  async discoverLists(targetDate: string): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    const listTypes: ListType[] = ["regular", "urgent", "supplementary"];

    for (const bench of this.supportedBenches) {
      for (const listType of listTypes) {
        const divisionParam = bench.includes("East") ? "east" : "west";
        const url = `https://districts.ihc.gov.pk/cause-list?division=${divisionParam}&date=${targetDate}&type=${listType}`;

        documents.push({
          court: this.courtCode,
          bench,
          listType,
          targetDate,
          sourceUrl: url,
          sourceFormat: "html",
          rawPayload: { division: divisionParam, complex: bench },
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
          validateStatus: (status) =>
            status === 200 ||
            status === 404 ||
            status === 403 ||
            status === 502 ||
            status === 530,
        });

        if (response.status !== 200) {
          return { buffer: Buffer.alloc(0), mimeType: "text/html", hash: "" };
        }

        const buffer = Buffer.from(response.data);
        const contentType = String(response.headers["content-type"] || "text/html");
        const hash = computeSha256(buffer);

        return { buffer, mimeType: contentType, hash };
      } catch (err: any) {
        lastError = err;
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(
      `[IsbDistrictCourtAdapter] Failed to download from ${doc.sourceUrl} after ${maxRetries} attempts: ${lastError?.message}`
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
    const endpoint = "https://ihc.gov.pk/";
    try {
      const response = await proxyGet(endpoint, {
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
          ? `Islamabad District Courts responsive via IHC (HTTP ${response.status})`
          : `Islamabad District Courts returned HTTP ${response.status}`,
        endpoint,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: `Islamabad District Courts connection failed: ${err.message}`,
        endpoint,
      };
    }
  }
}
