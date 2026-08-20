import { ParsedCaseItem, ParsedCauseList, ValidationResult, ItemValidationError } from "./types";

// Standard Pakistani Case Number prefixes
const CASE_NUMBER_PREFIX_REGEX = /^(?:W\.?P\.?|Crl\.?\s*(?:Misc\.?|A\.?|Rev\.?|Org\.?|Appeal|Bail)?|Civil\s*(?:Appeal|Revision|Petition|Misc)?|C\.?A\.?|C\.?R\.?|C\.?M\.?|B\.?A\.?|B\.?B\.?A\.?|I\.?C\.?A\.?|F\.?A\.?O\.?|R\.?F\.?A\.?|Tax\s*(?:Ref\.?|App\.?)?|Const\.?\s*P\.?|C\.?P\.?|H\.?R\.?C\.?|S\.?M\.?C\.?|Contempt|Execution|EFA|RSA|RFA|Review|Arbitration|COC|Suit|Election)\s*(?:No\.?)?\s*[\d\w\-\.\/]+/i;

const DISALLOWED_JUDGE_NAMES = [
  "daily cause list",
  "court",
  "court room",
  "roster of sittings",
  "division bench",
  "single bench",
  "regular list",
  "urgent list",
  "supplementary list",
  "motion cases",
  "before",
  "coram",
  "honourable",
];

export function validateCaseNumber(caseNum: string): boolean {
  if (!caseNum || typeof caseNum !== "string") return false;
  const trimmed = caseNum.trim();
  if (trimmed.length < 3) return false;
  // Must match standard prefix or contain digits/slash format (e.g. 1234/2024)
  return CASE_NUMBER_PREFIX_REGEX.test(trimmed) || /[\w\.]+\s*\d+\s*[\/-]\s*\d{2,4}/i.test(trimmed);
}

export function validateSerialNumber(sr: any): boolean {
  return typeof sr === "number" && Number.isInteger(sr) && sr > 0 && sr < 10000;
}

export function validateJudgeName(judgeName: string): boolean {
  if (!judgeName || typeof judgeName !== "string") return false;
  const trimmed = judgeName.trim();
  if (trimmed.length < 3) return false;
  
  const lower = trimmed.toLowerCase();
  for (const disallowed of DISALLOWED_JUDGE_NAMES) {
    if (lower === disallowed) return false;
  }

  // Reject if it is just numbers or pure punctuation
  if (/^[\d\s\-\.\,\:\/]+$/.test(trimmed)) return false;

  return true;
}

export function validateCaseItem(item: ParsedCaseItem): ItemValidationError | null {
  if (!validateSerialNumber(item.serialNumber)) {
    return { item, field: "serialNumber", reason: `Invalid serial number: ${item.serialNumber}` };
  }

  if (!validateCaseNumber(item.caseNumber)) {
    return { item, field: "caseNumber", reason: `Unrecognized case number format: "${item.caseNumber}"` };
  }

  if (!item.caseTitle || typeof item.caseTitle !== "string" || item.caseTitle.trim().length < 2) {
    return { item, field: "caseTitle", reason: "Case title is missing or too short" };
  }

  if (item.caseYear !== null && item.caseYear !== undefined) {
    if (item.caseYear < 1947 || item.caseYear > 2035) {
      return { item, field: "caseYear", reason: `Case year ${item.caseYear} is out of realistic range (1947-2035)` };
    }
  }

  return null;
}

export function validateCauseList(parsed: ParsedCauseList): ValidationResult {
  const criticalErrors: string[] = [];
  const rejectedItems: ItemValidationError[] = [];
  const validItems: ParsedCaseItem[] = [];

  // 1. Verify Header fields
  const VALID_COURTS = [
    "LHC",
    "IHC",
    "SHC",
    "SCP",
    "PHC",
    "BHC",
    "LHR_DIST",
    "ISB_DIST",
    "RWP_DIST",
    "KHI_DIST",
    "FSD_DIST",
  ];
  if (!parsed.court || !VALID_COURTS.includes(parsed.court)) {
    criticalErrors.push(`Invalid court code: "${parsed.court}"`);
  }

  if (!parsed.bench || parsed.bench.trim().length < 2) {
    criticalErrors.push(`Invalid or missing bench: "${parsed.bench}"`);
  }

  if (!validateJudgeName(parsed.judgeName)) {
    criticalErrors.push(`Invalid judge name: "${parsed.judgeName}"`);
  }

  if (!parsed.hearingDate || isNaN(parsed.hearingDate.getTime())) {
    criticalErrors.push(`Invalid hearingDate timestamp: ${parsed.hearingDate}`);
  }

  // 2. Validate all case rows
  for (const item of parsed.items) {
    const error = validateCaseItem(item);
    if (error) {
      rejectedItems.push(error);
    } else {
      validItems.push(item);
    }
  }

  const total = parsed.items.length;
  const errorRate = total > 0 ? rejectedItems.length / total : 0;

  if (total === 0) {
    criticalErrors.push("Cause list contains 0 parsed case items");
  }

  // If more than 20% of items fail validation, fail the entire list to prevent corrupted data ingestion
  if (errorRate > 0.20) {
    criticalErrors.push(`Error rate ${(errorRate * 100).toFixed(1)}% exceeds allowable threshold (20%)`);
  }

  const isValid = criticalErrors.length === 0;

  return {
    isValid,
    validItems,
    rejectedItems,
    errorRate,
    criticalErrors,
  };
}
