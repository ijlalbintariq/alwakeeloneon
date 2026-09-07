/**
 * ============================================================================
 * PAKISTANI STATUTES & MAJOR CODES COMPENDIUM KNOWLEDGE ENGINE
 * Chambers Reference Shelf Data Architecture
 * ============================================================================
 * Provides zero-latency, offline-capable statutory knowledge across:
 * 1. 7 Major Legal Domains (Civil, Criminal, Constitutional, Commercial/Property,
 *    Evidence, Family, Special Statutory Regimes & Financial Crimes)
 * 2. 35+ Limitation Act 1908 Schedule Articles with Section 4 Weekend Rollover
 * 3. 5-Jurisdiction Provincial Court Fees & Pecuniary Jurisdiction Engine
 * 4. 4-Tier Complete Pakistani Court Hierarchy Directory
 * 
 * Verifiable against official law reports (PLD, SCMR, CLC, PCrLJ, MLD, PTD, CLD)
 * and statutory enactments as amended up to date.
 * ============================================================================
 */

/* ==========================================================================
   TYPE DEFINITIONS & INTERFACES
   ========================================================================== */

export type StatuteDomain =
  | "civil"
  | "criminal"
  | "constitutional"
  | "commercial"
  | "evidence"
  | "family"
  | "special";

export interface StatuteDomainMeta {
  id: StatuteDomain;
  label: string;
  shortLabel: string;
  iconName: string;
  description: string;
  statutesCount: number;
  featuredStatutes: string[];
}

export interface LandmarkCitation {
  citation: string;
  court: string;
  year: number;
  title: string;
  ratio: string;
  bench?: string;
  urlPath?: string;
}

export interface StatuteSection {
  id: string;
  sectionNumber: string;
  title: string;
  statuteName: string;
  statuteYear: number;
  domain: StatuteDomain;
  text: string;
  commentary: string;
  landmarkCitations: LandmarkCitation[];
  keywords: string[];
  proceduralNotes?: string;
  mandatoryPleadings?: string;
  punishmentOrRelief?: string;
  crossReferences?: string[];
}

export interface LimitationEntry {
  id?: string;
  article: string;
  title: string;
  description: string;
  periodText: string;
  periodDays: number;
  periodUnit: "days" | "months" | "years";
  periodValue: number;
  triggerEvent: string;
  category: "Suits" | "Appeals" | "Applications" | "Revisions" | "Reviews" | "Execution" | string;
  statutoryRef: string;
  notes?: string;
  landmarkPrecedent?: string;
}

export interface LimitationDeadlineResult {
  rawDeadline: Date;
  adjustedDeadline: Date;
  isWeekendRollover: boolean;
  daysRemaining: number;
  isBarred: boolean;
  statutoryNote: string;
  expiryFormatted: string;
  daysRemainingLabel: string;
}

export type CourtFeeProvince =
  | "punjab"
  | "sindh"
  | "islamabad"
  | "kpk"
  | "balochistan";

export interface CourtFeeSuitType {
  id: string;
  name: string;
  category: "civil" | "commercial" | "family" | "constitutional" | "criminal" | "appellate";
  feeType: "ad_valorem" | "fixed" | "exempt" | "percentage_capped";
  fixedAmount?: number;
  ratePercentage?: number;
  description: string;
  statutoryReference: string;
  exemptThreshold?: number;
}

export interface ProvincialPecuniaryTier {
  courtName: string;
  minValuation: number;
  maxValuation: number | null; // null represents unlimited
  notes: string;
}

export interface ProvincialCourtFeeRule {
  province: CourtFeeProvince;
  provinceName: string;
  adValoremRate: number; // e.g. 7.5 (%)
  exemptThreshold: number; // e.g. 25000
  maxCapGeneral: number; // e.g. 15000
  highCourtOriginalSideCap?: number; // e.g. 50000 (Sindh)
  highCourtOriginalSidePecuniaryMin?: number; // e.g. 65000000 (Sindh)
  governingAct: string;
  fixedFees: {
    writPetition: number;
    permanentInjunction: number;
    familySuit: number;
    civilRevisionCap: number;
    miscApplication: number;
    powerOfAttorneyStamp: number;
  };
  pecuniaryTiers: ProvincialPecuniaryTier[];
  notes: string;
}

export interface CourtFeeCalculationResult {
  fee: number;
  isExempt: boolean;
  isCapped: boolean;
  capAmount: number;
  explanation: string;
  pecuniaryCourt: string;
  statutoryReference: string;
  effectiveRate: string;
  breakdownFormula: string;
}

export type CourtHierarchyTier =
  | "apex"
  | "high_courts"
  | "tribunals"
  | "district";

export interface CourtRecord {
  id: string;
  name: string;
  tier: CourtHierarchyTier;
  city: string;
  province: string;
  benches?: string[];
  territorialJurisdiction?: string[];
  jurisdictionNotes: string;
  contact?: string;
  establishedYear?: number;
  address?: string;
  appellateAuthority?: string;
  rosterCategories?: string[];
}
