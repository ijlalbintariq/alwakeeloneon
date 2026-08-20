import axios from "axios";
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

export class IhcCourtAdapter implements CourtAdapter {
  readonly courtCode: CourtCode = "IHC";
  readonly courtName = "Islamabad High Court";
  readonly supportedBenches = ["Principal Seat"];

  async discoverLists(targetDate: string): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    const listTypes: ListType[] = ["regular", "urgent", "supplementary"];

    for (const listType of listTypes) {
      const url = `https://mis.ihc.gov.pk/cause_list?date=${targetDate}&type=${listType}`;
      documents.push({
        court: this.courtCode,
        bench: "Principal Seat",
        listType,
        targetDate,
        sourceUrl: url,
        sourceFormat: "pdf",
      });
    }

    return documents;
  }

  async downloadDocument(
    doc: ScrapedDocument
  ): Promise<{ buffer: Buffer; mimeType: string; hash: string }> {
    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.get(doc.sourceUrl, {
          headers: BROWSER_HEADERS,
          responseType: "arraybuffer",
          timeout: 15_000,
          validateStatus: (status) => status === 200 || status === 404,
        });

        if (response.status === 404) {
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
      `[IhcCourtAdapter] Failed to download document from ${doc.sourceUrl} after ${maxRetries} attempts: ${lastError?.message}`
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
      const response = await axios.get("https://mis.ihc.gov.pk/", {
        headers: BROWSER_HEADERS,
        timeout: 10_000,
        validateStatus: () => true,
      });

      const latencyMs = Date.now() - startTime;
      const healthy = response.status >= 200 && response.status < 400;

      return {
        healthy,
        latencyMs,
        message: healthy
          ? `IHC portal responsive (HTTP ${response.status})`
          : `IHC portal returned HTTP ${response.status}`,
        endpoint: "https://mis.ihc.gov.pk/",
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: `IHC connection failed: ${err.message}`,
        endpoint: "https://mis.ihc.gov.pk/",
      };
    }
  }
}
