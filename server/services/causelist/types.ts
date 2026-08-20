export type CourtCode =
  | "LHC"
  | "IHC"
  | "SHC"
  | "SCP"
  | "PHC"
  | "BHC"
  | "LHR_DIST"
  | "ISB_DIST"
  | "RWP_DIST"
  | "KHI_DIST"
  | "FSD_DIST";

export type ListType = "regular" | "urgent" | "supplementary" | "motion" | "objection";

export type DocumentSourceFormat = "pdf" | "html" | "json";

export interface ScrapedDocument {
  court: CourtCode;
  bench: string; // e.g. 'Principal Seat', 'Multan', 'Rawalpindi', 'Bahawalpur'
  targetDate: string; // 'YYYY-MM-DD'
  listType: ListType;
  courtNumber?: string | null; // e.g. 'Court No. 4', 'DB-II'
  judgeName?: string | null; // e.g. 'Mr. Justice Muhammad Ameer Bhatti'
  sourceUrl: string;
  sourceFormat: DocumentSourceFormat;
  rawPayload?: Record<string, any>;
}

export interface ParsedCaseItem {
  serialNumber: number; // Item # 1, 2, 3...
  caseNumber: string; // e.g. 'W.P. No. 12345/2024'
  caseType?: string | null; // 'Writ Petition'
  caseYear?: number | null; // 2024
  caseTitle: string; // 'Muhammad Aslam VS Federation of Pakistan'
  petitioner?: string | null;
  respondent?: string | null;
  petitionerAdvocate?: string | null;
  respondentAdvocate?: string | null;
  fixationPurpose?: string | null; // 'For Arguments', 'For Notice'
  isRedList?: boolean; // Priority/Old case flag
  rawText?: string | null;
}

export interface ParsedCauseList {
  court: CourtCode;
  bench: string;
  hearingDate: Date;
  targetDateStr: string; // 'YYYY-MM-DD'
  courtNumber?: string | null;
  judgeName: string;
  listType: ListType;
  rawPdfUrl?: string | null;
  sourceHash?: string | null; // SHA-256
  storageKey?: string | null;
  items: ParsedCaseItem[];
}

export interface ItemValidationError {
  item: Partial<ParsedCaseItem>;
  field: string;
  reason: string;
}

export interface ValidationResult {
  isValid: boolean;
  validItems: ParsedCaseItem[];
  rejectedItems: ItemValidationError[];
  errorRate: number; // 0.0 - 1.0
  criticalErrors: string[];
}

export interface ScrapeRunStats {
  documentsFound: number;
  documentsParsed: number;
  itemsExtracted: number;
  itemsInserted: number;
  itemsUpdated: number;
  errors: string[];
}

export interface MatchScoreResult {
  userId: string;
  causeListItemId: number;
  confidenceScore: number; // 0.0 - 1.0
  matchTier: "tier1_case_number" | "tier2_advocate_court" | "tier3_advocate_exact" | "tier4_fuzzy";
  matchReason: string;
  caseNumber: string;
  advocateName?: string;
  court: string;
  bench: string;
  judgeName: string;
  courtNumber?: string | null;
  hearingDate: Date;
}
