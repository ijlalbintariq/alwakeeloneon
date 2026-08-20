import { CourtCode, ScrapedDocument, ParsedCauseList, ValidationResult } from "./types";

export interface CourtAdapterHealth {
  healthy: boolean;
  latencyMs: number;
  message?: string;
  endpoint?: string;
}

export interface CourtAdapter {
  readonly courtCode: CourtCode;
  readonly courtName: string;
  readonly supportedBenches: string[];

  /**
   * Discover and return all available cause list documents/rosters for a given target date (YYYY-MM-DD).
   */
  discoverLists(targetDate: string): Promise<ScrapedDocument[]>;

  /**
   * Download the raw document buffer (PDF or HTML) and return its payload with SHA-256 hash.
   */
  downloadDocument(doc: ScrapedDocument): Promise<{ buffer: Buffer; mimeType: string; hash: string }>;

  /**
   * Parse the downloaded buffer into structured roster headers and individual case rows.
   */
  parseDocument(buffer: Buffer, doc: ScrapedDocument): Promise<ParsedCauseList[]>;

  /**
   * Validate the parsed cause list through the quality gate.
   */
  validate(parsed: ParsedCauseList): ValidationResult;

  /**
   * Perform an active connectivity and health check against the court portal.
   */
  healthCheck(): Promise<CourtAdapterHealth>;
}
