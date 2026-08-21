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

const LHC_BENCH_MAP: Record<string, { code: string; name: string; param: string }> = {
  "principal seat": { code: "LHR", name: "Principal Seat", param: "lahore" },
  "rawalpindi bench": { code: "RWP", name: "Rawalpindi Bench", param: "rawalpindi" },
  "multan bench": { code: "MUL", name: "Multan Bench", param: "multan" },
  "bahawalpur bench": { code: "BWP", name: "Bahawalpur Bench", param: "bahawalpur" },
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

export class LhcCourtAdapter implements CourtAdapter {
  readonly courtCode: CourtCode = "LHC";
  readonly courtName = "Lahore High Court";
  readonly supportedBenches = [
    "Principal Seat",
    "Rawalpindi Bench",
    "Multan Bench",
    "Bahawalpur Bench",
  ];

  /**
   * Discovers daily cause list sources for all 4 LHC benches for the target date
   */
  async discoverLists(targetDate: string): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    const listTypes: ListType[] = ["regular", "urgent", "supplementary"];

    for (const [key, benchInfo] of Object.entries(LHC_BENCH_MAP)) {
      for (const listType of listTypes) {
        // Construct canonical LHC cause list URLs
        const url = `https://data.lhc.gov.pk/case_management/${listType}_cause_list?bench=${benchInfo.param}&date=${targetDate}`;

        documents.push({
          court: this.courtCode,
          bench: benchInfo.name,
          targetDate,
          listType,
          sourceUrl: url,
          sourceFormat: "html",
          rawPayload: {
            benchParam: benchInfo.param,
            benchCode: benchInfo.code,
          },
        });
      }
    }

    return documents;
  }

  /**
   * Downloads the raw document (HTML or PDF) from the court portal with retry logic
   */
  async downloadDocument(
    doc: ScrapedDocument
  ): Promise<{ buffer: Buffer; mimeType: string; hash: string }> {
    const maxRetries = 1;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await proxyGet(doc.sourceUrl, {
          headers: BROWSER_HEADERS,
          timeout: 8_000,
          responseType: "arraybuffer",
          validateStatus: (status) => status === 200 || status === 404,
        });

        if (response.status === 404) {
          // If no list published yet for this type/date, return empty buffer
          const emptyBuf = Buffer.alloc(0);
          return {
            buffer: emptyBuf,
            mimeType: "text/html",
            hash: computeSha256(emptyBuf),
          };
        }

        const buffer = Buffer.from(response.data);
        const contentType = String(response.headers["content-type"] || "").toLowerCase();
        const isPdf = contentType.includes("pdf") || buffer.slice(0, 4).toString() === "%PDF";

        return {
          buffer,
          mimeType: isPdf ? "application/pdf" : "text/html",
          hash: computeSha256(buffer),
        };
      } catch (err: any) {
        lastError = err;
        console.warn(
          `[LHC Adapter] Attempt ${attempt}/${maxRetries} failed for ${doc.bench} (${doc.listType}):`,
          err.message
        );
        if (err?.code === "ENOTFOUND" || err?.message?.includes("ENOTFOUND")) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const emptyBuf = Buffer.alloc(0);
    return {
      buffer: emptyBuf,
      mimeType: "text/html",
      hash: computeSha256(emptyBuf),
    };
  }

  /**
   * Parses the downloaded buffer (PDF or HTML) into structured ParsedCauseList records
   */
  async parseDocument(
    buffer: Buffer,
    doc: ScrapedDocument
  ): Promise<ParsedCauseList[]> {
    if (buffer.length === 0) {
      return [];
    }

    const isPdf = buffer.slice(0, 4).toString() === "%PDF";
    let parsedLists: ParsedCauseList[] = [];

    if (isPdf) {
      parsedLists = await parsePdfCauseListBuffer(
        buffer,
        this.courtCode,
        doc.bench,
        doc.targetDate,
        doc.listType
      );
    } else {
      const htmlText = buffer.toString("utf-8");
      parsedLists = parseHtmlCauseList(
        htmlText,
        this.courtCode,
        doc.bench,
        doc.targetDate,
        doc.listType
      );
    }

    // Attach raw source hash and URL to all parsed lists
    const hash = computeSha256(buffer);
    for (const list of parsedLists) {
      list.sourceHash = hash;
      list.rawPdfUrl = doc.sourceUrl;
    }

    return parsedLists;
  }

  /**
   * Validates parsed cause list through quality gate
   */
  validate(parsed: ParsedCauseList): ValidationResult {
    return validateCauseList(parsed);
  }

  /**
   * Health check to ensure LHC portal is reachable
   */
  async healthCheck(): Promise<CourtAdapterHealth> {
    const start = Date.now();
    try {
      const res = await proxyGet("https://data.lhc.gov.pk/case_management/regular_cause_list", {
        headers: BROWSER_HEADERS,
        timeout: 60_000,
        validateStatus: () => true,
      });
      const latencyMs = Date.now() - start;
      return {
        healthy: res.status >= 200 && res.status < 400,
        latencyMs,
        endpoint: "https://data.lhc.gov.pk/case_management/regular_cause_list",
        message: `HTTP ${res.status} in ${latencyMs}ms`,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      return {
        healthy: false,
        latencyMs,
        endpoint: "https://data.lhc.gov.pk/case_management/regular_cause_list",
        message: err?.message || "Connection failed",
      };
    }
  }
}
