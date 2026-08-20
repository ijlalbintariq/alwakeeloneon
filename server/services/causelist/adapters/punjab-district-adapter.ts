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

interface DistrictConfig {
  code: CourtCode;
  name: string;
  subdomain: string;
  benches: string[];
}

const PUNJAB_DISTRICTS: Record<string, DistrictConfig> = {
  LHR_DIST: {
    code: "LHR_DIST",
    name: "Lahore District Courts",
    subdomain: "lahoredc",
    benches: [
      "Aiwan-e-Adl (Sessions Division)",
      "Civil Courts Complex",
      "Model Town Courts",
      "Cantt Courts",
      "Family & Guardian Courts",
      "Special / Banking Courts",
    ],
  },
  RWP_DIST: {
    code: "RWP_DIST",
    name: "Rawalpindi District Courts",
    subdomain: "rawalpindidc",
    benches: [
      "Judicial Complex Rawalpindi",
      "Civil Courts Rawalpindi",
      "Gujar Khan Courts",
      "Taxila Courts",
    ],
  },
  FSD_DIST: {
    code: "FSD_DIST",
    name: "Faisalabad District Courts",
    subdomain: "faisalabaddc",
    benches: [
      "Sessions Division Faisalabad",
      "Civil Courts Faisalabad",
      "Jaranwala Complex",
      "Sammundri Complex",
      "Tandlianwala Complex",
    ],
  },
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
};

export class PunjabDistrictCourtAdapter implements CourtAdapter {
  readonly courtCode: CourtCode;
  readonly courtName: string;
  readonly supportedBenches: string[];
  private readonly districtConfig: DistrictConfig;

  constructor(districtKey: "LHR_DIST" | "RWP_DIST" | "FSD_DIST" = "LHR_DIST") {
    this.districtConfig = PUNJAB_DISTRICTS[districtKey] || PUNJAB_DISTRICTS.LHR_DIST;
    this.courtCode = this.districtConfig.code;
    this.courtName = this.districtConfig.name;
    this.supportedBenches = this.districtConfig.benches;
  }

  async discoverLists(targetDate: string): Promise<ScrapedDocument[]> {
    const documents: ScrapedDocument[] = [];
    const listTypes: ListType[] = ["regular", "urgent", "supplementary"];

    for (const bench of this.supportedBenches) {
      for (const listType of listTypes) {
        const slug = bench.toLowerCase().replace(/[^a-z0-9]/g, "-");
        const url = `https://${this.districtConfig.subdomain}.punjab.gov.pk/cause-lists?court_complex=${slug}&date=${targetDate}&type=${listType}`;

        documents.push({
          court: this.courtCode,
          bench,
          listType,
          targetDate,
          sourceUrl: url,
          sourceFormat: "html",
          rawPayload: {
            district: this.districtConfig.subdomain,
            complex: bench,
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
      `[${this.courtName}] Failed to download from ${doc.sourceUrl} after ${maxRetries} attempts: ${lastError?.message}`
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
    const endpoint = "https://data.lhc.gov.pk/";
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
          ? `${this.courtName} portal responsive via PITB (HTTP ${response.status})`
          : `${this.courtName} portal returned HTTP ${response.status}`,
        endpoint,
      };
    } catch (err: any) {
      return {
        healthy: false,
        latencyMs: Date.now() - startTime,
        message: `${this.courtName} connection failed: ${err.message}`,
        endpoint,
      };
    }
  }
}
