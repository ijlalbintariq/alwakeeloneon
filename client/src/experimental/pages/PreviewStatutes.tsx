/**
 * ============================================================================
 * PAKISTANI STATUTES & MAJOR CODES EXPERIMENTAL WORKSTATION
 * Chambers Reference Shelf & 83,117 Sections Catalog
 * ============================================================================
 * Strictly isolated in client/src/experimental/
 * ============================================================================
 * Features:
 * 1. Universal Instant Search across all 83,117 sections and 5,887 Acts with <15ms token scoring.
 * 2. Major Enactment Sequential Browser (PPC [612], CrPC [642], Constitution [304], etc.).
 * 3. Hybrid Precedent Engine: Tier 1 0ms instant Apex ratios + Tier 2 live DB resolution & LRU cache.
 * 4. Universal Legal Action Hub: 1-click Copy Citation, Copy Clause, Insert into Drafting Studio.
 * 5. Limitation Act Calculator with Section 4 Weekend Rollover Engine.
 * 6. 5-Jurisdiction Provincial Court Fees & Pecuniary Calculator with Sindh dual-cap.
 * 7. 4-Tier Complete Pakistani Courts Directory.
 * ============================================================================
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import { LivePrecedentModal } from "@/experimental/components/LivePrecedentModal";
import { ActSelector } from "@/experimental/components/statutes/ActSelector";
import { LandmarkAuthorityCard } from "@/experimental/components/statutes/LandmarkAuthorityCard";
import { CleanStatuteViewer } from "@/experimental/components/statutes/CleanStatuteViewer";
import { sanitizeStatuteText } from "@/experimental/lib/statuteSanitizer";
import { useSectionPrecedents } from "@/experimental/hooks/useSectionPrecedents";
import { useStatuteSearch } from "@/experimental/hooks/useStatuteSearch";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  Scale,
  ShieldAlert,
  Landmark,
  Building2,
  FileCheck,
  Users,
  Cpu,
  Hourglass,
  Coins,
  Search,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Layers,
  FileText,
  Gavel,
  X,
  Database,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Shield,
  ArrowRight,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STATUTE_DOMAINS,
  STATUTE_SECTIONS,
  LIMITATION_SCHEDULE_ENTRIES,
  COURT_FEE_SUIT_TYPES,
  PROVINCIAL_COURT_FEE_RULES,
  PAKISTAN_COURT_DIRECTORY,
  computeLimitationDeadline,
  calculateProvincialCourtFee,
  searchStatuteSections,
  searchCourts,
  formatLegalCitation,
  formatDraftingClause,
  inferDomainFromText,
  type StatuteDomain,
  type StatuteSection,
  type LimitationEntry,
  type CourtFeeProvince,
  type CourtHierarchyTier,
  type LandmarkCitation,
} from "@/experimental/data/statutesCompendiumData";
import {
  MAJOR_ENACTMENTS_DATA,
  getSectionsForEnactment,
  getMajorSectionById,
  type StatutorySection,
} from "@/experimental/data/majorEnactmentsData";
import { TOTAL_PAKISTANI_ACTS_COUNT } from "@/experimental/data/actsManifest";
import {
  loadSectionsForAct,
  getCachedSectionsForAct,
  getSectionByIdAcrossAllActs,
} from "@/experimental/lib/actSectionLoader";

const extractYear = (name: string) => parseInt(name.match(/\b(18|19|20)\d{2}\b/)?.[0] || "0") || 1860;

// Helper: Convert number to Pakistani English words (Lakhs/Crores)
function numberToWordsPk(amount: number): string {
  if (amount <= 0) return "Nil";
  if (amount >= 10000000) {
    const crore = (amount / 10000000).toFixed(2);
    return `${crore} Crore`;
  }
  if (amount >= 100000) {
    const lakh = (amount / 100000).toFixed(2);
    return `${lakh} Lakh`;
  }
  if (amount >= 1000) {
    const thousand = (amount / 1000).toFixed(0);
    return `${thousand} Thousand`;
  }
  return amount.toString();
}

// Icon helper for Statute Domains
function DomainIcon({ domain, className }: { domain: StatuteDomain; className?: string }) {
  switch (domain) {
    case "civil":
      return <Scale className={className} />;
    case "criminal":
      return <ShieldAlert className={className} />;
    case "constitutional":
      return <Landmark className={className} />;
    case "commercial":
      return <Building2 className={className} />;
    case "evidence":
      return <FileCheck className={className} />;
    case "family":
      return <Users className={className} />;
    case "special":
      return <Cpu className={className} />;
    default:
      return <BookOpen className={className} />;
  }
}

// Domain Badge Styling
const DOMAIN_STYLES: Record<StatuteDomain, { bg: string; text: string; border: string; label: string }> = {
  civil: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "Civil Law" },
  criminal: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", label: "Criminal Law" },
  constitutional: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", label: "Constitutional" },
  commercial: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Property & Commercial" },
  evidence: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Evidence & Forensics" },
  family: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", label: "Family Law" },
  special: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200", label: "Special & Cyber" },
};

// Unified Section Model for UI
interface UnifiedSection {
  id: string;
  sectionNumber: string;
  title: string;
  statuteName: string;
  statuteYear: number;
  domain: StatuteDomain;
  text: string;
  commentary: string;
  punishmentOrRelief?: string | null;
  mandatoryPleadings?: string;
  proceduralNotes?: string;
  landmarkCitations: LandmarkCitation[];
  keywords: string[];
  crossReferences?: string[];
  isLiveDb?: boolean;
}

export const PreviewStatutes: React.FC = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Read URL search params on mount if available
  const [activeTab, setActiveTab] = useState<"statutes" | "limitation" | "court-fees" | "courts">(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["statutes", "limitation", "court-fees", "courts"].includes(tabParam)) {
        return tabParam as any;
      }
    } catch {}
    return "statutes";
  });

  // ─── TAB 1: STATUTES WORKSTATION STATE ─────────────────────────────────────
  const [selectedStatute, setSelectedStatute] = useState<string>("Pakistan Penal Code 1860");
  const [selectedStatuteShortCode, setSelectedStatuteShortCode] = useState<string>("PPC");
  const [statuteDomain, setStatuteDomain] = useState<StatuteDomain | "all">("all");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("ppc-sec-302");
  const [inActFilter, setInActFilter] = useState<string>("");
  const [searchLimit, setSearchLimit] = useState<number>(60);

  // ─── TAB 1: STATUTES SEARCH ENGINE & BROWSER ───────────────────────────────
  const {
    query: universalSearchQuery,
    setQuery: setUniversalSearchQuery,
    debouncedQuery: debouncedSearch,
    results: searchResults,
    isSearching: isSearchLoading,
    latencyMs: searchLatency,
    clearSearch,
  } = useStatuteSearch({
    initialQuery: "",
    category: statuteDomain,
    enableLiveDbFallback: true,
    limit: searchLimit,
  });

  // Action Hub Copy States
  const [copiedCitation, setCopiedCitation] = useState<boolean>(false);
  const [copiedClause, setCopiedClause] = useState<boolean>(false);

  // Precedent Modal State
  const [precedentModalOpen, setPrecedentModalOpen] = useState<boolean>(false);
  const [selectedPrecedentCitation, setSelectedPrecedentCitation] = useState<string | null>(null);
  const [selectedPrecedentInitial, setSelectedPrecedentInitial] = useState<any | null>(null);

  // Dynamic Act Section Loader State (for all 5,887 Acts)
  const [loadedActSections, setLoadedActSections] = useState<StatutorySection[]>(() => {
    const defaultStatute = "Pakistan Penal Code 1860";
    const cached = getCachedSectionsForAct(defaultStatute);
    return cached || getSectionsForEnactment(defaultStatute);
  });
  const [isLoadingActSections, setIsLoadingActSections] = useState<boolean>(false);

  // On-demand loader effect when selectedStatute changes
  useEffect(() => {
    let isMounted = true;
    const loadAct = async () => {
      const cached = getCachedSectionsForAct(selectedStatute);
      if (cached && cached.length > 0) {
        setLoadedActSections(cached);
        if (!selectedSectionId || !cached.some((s) => s.id === selectedSectionId)) {
          setSelectedSectionId(cached[0].id);
        }
        return;
      }

      setIsLoadingActSections(true);
      try {
        const sections = await loadSectionsForAct(selectedStatute);
        if (isMounted && sections.length > 0) {
          setLoadedActSections(sections);
          setSelectedSectionId(sections[0].id);
        }
      } catch (err) {
        console.warn("[PreviewStatutes] Failed to load sections for act:", err);
      } finally {
        if (isMounted) setIsLoadingActSections(false);
      }
    };

    loadAct();
    return () => {
      isMounted = false;
    };
  }, [selectedStatute]);

  // Handle Act selection from ActSelector
  const handleSelectAct = async (statuteTitle: string, shortCode?: string) => {
    setSelectedStatute(statuteTitle);
    if (shortCode) setSelectedStatuteShortCode(shortCode);
    clearSearch();
    setInActFilter("");

    // Auto-select first section of chosen Act
    const cached = getCachedSectionsForAct(statuteTitle);
    if (cached && cached.length > 0) {
      setLoadedActSections(cached);
      setSelectedSectionId(cached[0].id);
    } else {
      setIsLoadingActSections(true);
      try {
        const sections = await loadSectionsForAct(statuteTitle);
        if (sections.length > 0) {
          setLoadedActSections(sections);
          setSelectedSectionId(sections[0].id);
        }
      } finally {
        setIsLoadingActSections(false);
      }
    }
  };

  // Sections for sequential browsing in the left pane
  const sequentialSections = useMemo(() => {
    const list = loadedActSections.length > 0 ? loadedActSections : getSectionsForEnactment(selectedStatute);
    if (!inActFilter.trim()) return list;

    const q = inActFilter.trim().toLowerCase();
    return list.filter(
      (s) =>
        s.section.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
    );
  }, [selectedStatute, loadedActSections, inActFilter]);

  // Unified active section resolution
  const activeSection: UnifiedSection = useMemo(() => {
    // 1. Check in Compendium (Tier 1 provisions)
    const compMatch = STATUTE_SECTIONS.find((s) => s.id === selectedSectionId);
    if (compMatch) {
      return {
        id: compMatch.id,
        sectionNumber: compMatch.sectionNumber,
        title: compMatch.title,
        statuteName: compMatch.statuteName,
        statuteYear: compMatch.statuteYear,
        domain: compMatch.domain,
        text: compMatch.text,
        commentary: compMatch.commentary,
        punishmentOrRelief: compMatch.punishmentOrRelief,
        mandatoryPleadings: compMatch.mandatoryPleadings,
        proceduralNotes: compMatch.proceduralNotes,
        landmarkCitations: compMatch.landmarkCitations,
        keywords: compMatch.keywords,
        crossReferences: compMatch.crossReferences,
        isLiveDb: compMatch.isLiveDb,
      };
    }

    // 2. Check in Major Enactments Dataset (4,100 sections)
    const majorMatch = getMajorSectionById(selectedSectionId);
    if (majorMatch) {
      return {
        id: majorMatch.id,
        sectionNumber: majorMatch.section.startsWith("Section") || majorMatch.section.startsWith("Art")
          ? majorMatch.section
          : `Section ${majorMatch.section}`,
        title: majorMatch.title,
        statuteName: majorMatch.statute,
        statuteYear: extractYear(majorMatch.statute),
        domain: inferDomainFromText(majorMatch.statute + " " + (majorMatch.category || "")),
        text: majorMatch.description,
        commentary: majorMatch.punishment
          ? `Statutory Punishment & Legal Penalty:\n${majorMatch.punishment}\n\nEnacted under ${majorMatch.statute}.`
          : `Section ${majorMatch.section} of ${majorMatch.statute}. Official legislative enactment.`,
        punishmentOrRelief: majorMatch.punishment || undefined,
        landmarkCitations: (majorMatch.landmarkCitations || []) as LandmarkCitation[],
        keywords: [majorMatch.statute, majorMatch.section, majorMatch.title].filter(Boolean),
        isLiveDb: majorMatch.liveDbMatch,
      };
    }

    // 2.5 Check in Dynamic Loaded Act Sections (all 5,887 Acts)
    const allActsMatch =
      getSectionByIdAcrossAllActs(selectedSectionId) ||
      loadedActSections.find((s) => s.id === selectedSectionId);
    if (allActsMatch) {
      return {
        id: allActsMatch.id,
        sectionNumber: allActsMatch.section.startsWith("Section") || allActsMatch.section.startsWith("Art")
          ? allActsMatch.section
          : `Section ${allActsMatch.section}`,
        title: allActsMatch.title,
        statuteName: allActsMatch.statute,
        statuteYear: extractYear(allActsMatch.statute),
        domain: inferDomainFromText(allActsMatch.statute + " " + (allActsMatch.category || "")),
        text: allActsMatch.description,
        commentary: allActsMatch.punishment
          ? `Statutory Punishment & Legal Penalty:\n${allActsMatch.punishment}\n\nEnacted under ${allActsMatch.statute}.`
          : `Section ${allActsMatch.section} of ${allActsMatch.statute}. Official legislative enactment.`,
        punishmentOrRelief: allActsMatch.punishment || undefined,
        landmarkCitations: (allActsMatch.landmarkCitations || []) as LandmarkCitation[],
        keywords: [allActsMatch.statute, allActsMatch.section, allActsMatch.title].filter(Boolean),
        isLiveDb: allActsMatch.liveDbMatch,
      };
    }

    // 3. Check in Universal Search results
    const searchMatch = searchResults.find((r) => r.section.id === selectedSectionId);
    if (searchMatch) {
      const s = searchMatch.section;
      return {
        id: s.id,
        sectionNumber: s.section.startsWith("Section") || s.section.startsWith("Art") ? s.section : `Section ${s.section}`,
        title: s.title,
        statuteName: s.statute,
        statuteYear: extractYear(s.statute),
        domain: inferDomainFromText(s.statute + " " + (s.category || "")),
        text: s.description,
        commentary: s.punishment
          ? `Statutory Punishment:\n${s.punishment}`
          : "Retrieved from Pakistani Statutes Catalog (83,117 sections index).",
        punishmentOrRelief: s.punishment || undefined,
        landmarkCitations: (s.landmarkCitations || []) as LandmarkCitation[],
        keywords: [s.statute, s.section, s.title].filter(Boolean),
        isLiveDb: s.liveDbMatch,
      };
    }

    // Default fallback
    const firstSec = STATUTE_SECTIONS[0];
    return {
      id: firstSec.id,
      sectionNumber: firstSec.sectionNumber,
      title: firstSec.title,
      statuteName: firstSec.statuteName,
      statuteYear: firstSec.statuteYear,
      domain: firstSec.domain,
      text: firstSec.text,
      commentary: firstSec.commentary,
      punishmentOrRelief: firstSec.punishmentOrRelief,
      mandatoryPleadings: firstSec.mandatoryPleadings,
      proceduralNotes: firstSec.proceduralNotes,
      landmarkCitations: firstSec.landmarkCitations,
      keywords: firstSec.keywords,
      crossReferences: firstSec.crossReferences,
    };
  }, [selectedSectionId, searchResults]);

  // Hook: Resolve Hybrid Precedents (Query live database with real DB seed fallback)
  const {
    precedents: livePrecedents,
    isLoading: isPrecedentsLoading,
    source: precedentSource,
    latencyMs: precedentLatency,
  } = useSectionPrecedents(activeSection.statuteName, activeSection.sectionNumber, {
    title: activeSection.title,
    category: activeSection.domain,
    autoFetch: true,
  });

  // Open Precedent Modal
  const handleOpenPrecedent = (citation?: string, initial?: any) => {
    setSelectedPrecedentCitation(citation || null);
    setSelectedPrecedentInitial(initial || null);
    setPrecedentModalOpen(true);
  };

  // 1-Click Copy Citation
  const handleCopyCitation = () => {
    const sanitized = sanitizeStatuteText(activeSection.text, activeSection.statuteName, activeSection.sectionNumber);
    const text = `${activeSection.statuteName}, ${sanitized.cleanSection} — ${sanitized.cleanTitle || activeSection.title}
--------------------------------------------------------------------------------
${sanitized.cleanText}

Legislative Commentary & Procedural Ingredients:
${activeSection.commentary}${
      livePrecedents.length > 0
        ? `\nLeading Precedent: ${livePrecedents[0].citation} (${livePrecedents[0].title}) — "${livePrecedents[0].ratio}"`
        : ""
    }`;

    navigator.clipboard.writeText(text);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 2000);
    toast({
      title: "Citation Copied",
      description: `Copied ${activeSection.statuteName} ${sanitized.cleanSection} citation to clipboard.`,
    });
  };

  // 1-Click Copy Clause
  const handleCopyClause = () => {
    const sanitized = sanitizeStatuteText(activeSection.text, activeSection.statuteName, activeSection.sectionNumber);
    const cleanClauseText = sanitized.cleanText.replace(/\n+/g, " ").trim();
    const precedent = livePrecedents[0];
    const citationLine = precedent
      ? ` (See authoritative ratio in ${precedent.citation} ${precedent.title})`
      : "";

    const text = `STATUTORY PROVISION & RELEVANT LAW:
Pursuant to ${sanitized.cleanSection} of the ${activeSection.statuteName}, it is respectfully submitted that:
"${cleanClauseText}"

LEGAL GROUNDS & APPLICABLE PRINCIPLES:
1. That under the settled jurisprudence of the superior courts${citationLine}, the mandatory legal ingredients of ${sanitized.cleanSection} require strict adherence.
2. ${activeSection.mandatoryPleadings || activeSection.commentary.split("\n")[0]}`;

    navigator.clipboard.writeText(text);
    setCopiedClause(true);
    setTimeout(() => setCopiedClause(false), 2000);
    toast({
      title: "Statutory Clause Copied",
      description: `Copied court-ready drafting clause for ${sanitized.cleanSection} to clipboard.`,
    });
  };

  // 1-Click Insert into Legal Drafting Studio
  const handleInsertIntoDrafting = () => {
    const sanitized = sanitizeStatuteText(activeSection.text, activeSection.statuteName, activeSection.sectionNumber);
    const cleanClauseText = sanitized.cleanText.replace(/\n+/g, " ").trim();
    const precedent = livePrecedents[0];
    const citationLine = precedent
      ? ` (See authoritative ratio in ${precedent.citation} ${precedent.title})`
      : "";

    const draftingClause = `STATUTORY PROVISION & RELEVANT LAW:
Pursuant to ${sanitized.cleanSection} of the ${activeSection.statuteName}, it is respectfully submitted that:
"${cleanClauseText}"

LEGAL GROUNDS & APPLICABLE PRINCIPLES:
1. That under the settled jurisprudence of the superior courts${citationLine}, the mandatory legal ingredients of ${sanitized.cleanSection} require strict adherence.
2. ${activeSection.mandatoryPleadings || activeSection.commentary.split("\n")[0]}`;

    const payload = {
      statute: activeSection.statuteName,
      section: sanitized.cleanSection,
      title: sanitized.cleanTitle || activeSection.title,
      clause: draftingClause,
      formattedCitation: `${activeSection.statuteName}, ${sanitized.cleanSection}`,
      timestamp: Date.now(),
    };

    localStorage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("alwakeelo-drafting-insert", { detail: payload }));
    setLocation("/preview/drafting");
    toast({
      title: "Inserted into Legal Drafting Studio",
      description: `Transferred ${sanitized.cleanSection} clause into the active drafting canvas.`,
    });
  };

  // ─── TAB 2: LIMITATION CALCULATOR STATE ────────────────────────────────────
  const [limitationSearch, setLimitationSearch] = useState<string>("");
  const [limitationCategory, setLimitationCategory] = useState<string>("all");
  const [selectedArticleKey, setSelectedArticleKey] = useState<string>("Art. 113");
  const [accrualDate, setAccrualDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [applySection4, setApplySection4] = useState<boolean>(true);
  const [copiedLimitation, setCopiedLimitation] = useState<boolean>(false);

  const filteredLimitationEntries = useMemo(() => {
    const q = limitationSearch.trim().toLowerCase();
    return LIMITATION_SCHEDULE_ENTRIES.filter((entry) => {
      const matchCat =
        limitationCategory === "all" ||
        entry.category.toLowerCase() === limitationCategory.toLowerCase();
      if (!matchCat) return false;
      if (!q) return true;
      return (
        entry.article.toLowerCase().includes(q) ||
        entry.title.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.triggerEvent.toLowerCase().includes(q) ||
        (entry.notes || "").toLowerCase().includes(q)
      );
    });
  }, [limitationSearch, limitationCategory]);

  const activeLimitationEntry: LimitationEntry = useMemo(() => {
    const found = LIMITATION_SCHEDULE_ENTRIES.find((e) => e.article === selectedArticleKey);
    return found || filteredLimitationEntries[0] || LIMITATION_SCHEDULE_ENTRIES[0];
  }, [selectedArticleKey, filteredLimitationEntries]);

  const limitationResult = useMemo(() => {
    const parsedDate = new Date(accrualDate + "T00:00:00");
    const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    return computeLimitationDeadline(activeLimitationEntry, validDate, applySection4);
  }, [activeLimitationEntry, accrualDate, applySection4]);

  const handleCopyLimitationSummary = () => {
    const summary = `LIMITATION PERIOD ASSESSMENT (Limitation Act, 1908):
Article: ${activeLimitationEntry.article} — ${activeLimitationEntry.title}
Statutory Period: ${activeLimitationEntry.periodText} (${activeLimitationEntry.category})
Commencement Trigger: ${activeLimitationEntry.triggerEvent}
Date of Accrual: ${accrualDate}
Statutory Deadline: ${limitationResult.expiryFormatted}
Current Status: ${limitationResult.daysRemainingLabel}
Section 4 Rollover Applied: ${
      limitationResult.isWeekendRollover
        ? "Yes (Court closed on raw deadline; rolled to next court sitting day)"
        : "No"
    }
Statutory Authority: ${limitationResult.statutoryNote}
${activeLimitationEntry.landmarkPrecedent ? `Landmark Authority: ${activeLimitationEntry.landmarkPrecedent}` : ""}`;

    navigator.clipboard.writeText(summary);
    setCopiedLimitation(true);
    setTimeout(() => setCopiedLimitation(false), 2000);
    toast({
      title: "Limitation Assessment Copied",
      description: `Copied calculation for ${activeLimitationEntry.article} to clipboard.`,
    });
  };

  const handleInsertLimitationGround = () => {
    const limitationClause = `GROUND ON LIMITATION & TIMELINESS:
That the present ${
      activeLimitationEntry.category.toLowerCase().includes("appeal")
        ? "appeal"
        : activeLimitationEntry.category.toLowerCase().includes("application")
        ? "application"
        : "suit"
    } has been instituted within the prescribed period of limitation under ${
      activeLimitationEntry.article
    } of the First Schedule to the Limitation Act, 1908.
The cause of action / right to apply accrued on ${accrualDate} (${
      activeLimitationEntry.triggerEvent
    }), and the statutory limitation expires on ${limitationResult.expiryFormatted}. ${
      limitationResult.isWeekendRollover
        ? "Pursuant to Section 4 of the Limitation Act 1908 read with Section 10 of General Clauses Act 1897, the filing on the reopening date is within time."
        : ""
    }
As such, the matter is well within time and free from any statutory bar.`;

    const payload = {
      statute: "Limitation Act, 1908",
      section: activeLimitationEntry.article,
      title: `Limitation Ground — ${activeLimitationEntry.title}`,
      clause: limitationClause,
      timestamp: Date.now(),
    };

    localStorage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("alwakeelo-drafting-insert", { detail: payload }));
    setLocation("/preview/drafting");
    toast({
      title: "Limitation Ground Inserted",
      description: `Transferred ${activeLimitationEntry.article} ground into Legal Drafting Studio.`,
    });
  };

  // ─── TAB 3: PROVINCIAL COURT FEES STATE ────────────────────────────────────
  const [selectedProvince, setSelectedProvince] = useState<CourtFeeProvince>("punjab");
  const [selectedSuitTypeId, setSelectedSuitTypeId] = useState<string>("recovery_money");
  const [claimValuation, setClaimValuation] = useState<number>(500000);
  const [copiedFeeClause, setCopiedFeeClause] = useState<boolean>(false);

  const activeProvinceRule = PROVINCIAL_COURT_FEE_RULES[selectedProvince];
  const activeSuitType =
    COURT_FEE_SUIT_TYPES.find((s) => s.id === selectedSuitTypeId) || COURT_FEE_SUIT_TYPES[0];

  const courtFeeResult = useMemo(() => {
    return calculateProvincialCourtFee(selectedProvince, selectedSuitTypeId, claimValuation);
  }, [selectedProvince, selectedSuitTypeId, claimValuation]);

  const generatePlaintValuationClause = () => {
    return `SUIT VALUATION & COURT FEES:
That the value of the suit for the purpose of court fee and pecuniary jurisdiction is fixed at PKR ${claimValuation.toLocaleString()}/- (Rupees ${numberToWordsPk(
      claimValuation
    )}), on which statutory court fee of PKR ${courtFeeResult.fee.toLocaleString()}/- is affixed as prescribed under the ${
      activeProvinceRule.governingAct
    }.
That in terms of pecuniary and territorial jurisdiction, the subject matter falls within the jurisdiction of the ${
      courtFeeResult.pecuniaryCourt
    }.`;
  };

  const handleCopyPlaintValuationClause = () => {
    const clause = generatePlaintValuationClause();
    navigator.clipboard.writeText(clause);
    setCopiedFeeClause(true);
    setTimeout(() => setCopiedFeeClause(false), 2000);
    toast({
      title: "Court Fee Clause Copied",
      description: "Copied formal Plaint Valuation & Court Fee paragraph to clipboard.",
    });
  };

  const handleInsertValuationIntoDrafting = () => {
    const clause = generatePlaintValuationClause();
    const payload = {
      statute: activeProvinceRule.governingAct,
      section: "Section 7 / Suits Valuation",
      title: `Suit Valuation & Court Fees (${activeProvinceRule.provinceName})`,
      clause,
      timestamp: Date.now(),
    };

    localStorage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("alwakeelo-drafting-insert", { detail: payload }));
    setLocation("/preview/drafting");
    toast({
      title: "Valuation Clause Inserted",
      description: `Affixed ${activeProvinceRule.provinceName} court fees clause into Drafting Studio.`,
    });
  };

  // ─── TAB 4: COURTS DIRECTORY STATE ─────────────────────────────────────────
  const [courtQuery, setCourtQuery] = useState<string>("" );
  const [courtTier, setCourtTier] = useState<CourtHierarchyTier | "all">("all");

  const filteredCourts = useMemo(() => {
    return searchCourts(courtQuery, courtTier);
  }, [courtQuery, courtTier]);

  const isSearchingGlobal = Boolean(debouncedSearch.length >= 2);

  return (
    <PreviewShell>
      <div className="max-w-7xl mx-auto space-y-5 pb-12">
        {/* ── Header Banner ─────────────────────────────────────────────────── */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#105B38]/10 text-[#105B38] text-[9px] sm:text-[10px] font-bold tracking-wide uppercase">
              <BookOpen className="w-3 h-3" />
              <span>Pakistani Statutory Knowledge Base & Procedural Guide</span>
            </div>

            <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 font-semibold">
              <Database className="h-3 w-3 text-emerald-600" />
              <span>83,117 Sections</span>
              <span className="text-slate-400">•</span>
              <span>{TOTAL_PAKISTANI_ACTS_COUNT.toLocaleString()} Acts</span>
            </div>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Statutes, Major Codes & Procedural Guides
          </h1>
          <p className="text-[11px] sm:text-xs text-[#64748B] max-w-3xl leading-relaxed">
            Authoritative repository of Pakistani primary legislation, 83k statutory sections, 21 major codes, Limitation Act schedule calculator, provincial court fees & apex-to-district court directory.
          </p>
        </div>

        {/* ── 4 Module Tabs Navigation ───────────────────────────────────────── */}
        <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab("statutes")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
              activeTab === "statutes"
                ? "bg-[#105B38] text-white shadow-xs"
                : "bg-white text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] border border-[#E2E8F0]"
            )}
          >
            <Scale className="w-4 h-4" />
            <span>Statutes & Major Codes</span>
            <span
              className={cn(
                "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                activeTab === "statutes" ? "bg-white/20 text-white" : "bg-[#F1F5F9] text-[#64748B]"
              )}
            >
              83.1k
            </span>
          </button>

          <button
            onClick={() => setActiveTab("limitation")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
              activeTab === "limitation"
                ? "bg-[#105B38] text-white shadow-xs"
                : "bg-white text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] border border-[#E2E8F0]"
            )}
          >
            <Hourglass className="w-4 h-4" />
            <span>Limitation Calculator</span>
            <span
              className={cn(
                "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                activeTab === "limitation" ? "bg-white/20 text-white" : "bg-[#F1F5F9] text-[#64748B]"
              )}
            >
              {LIMITATION_SCHEDULE_ENTRIES.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("court-fees")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
              activeTab === "court-fees"
                ? "bg-[#105B38] text-white shadow-xs"
                : "bg-white text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] border border-[#E2E8F0]"
            )}
          >
            <Coins className="w-4 h-4" />
            <span>Provincial Court Fees & Pecuniary</span>
            <span
              className={cn(
                "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                activeTab === "court-fees" ? "bg-white/20 text-white" : "bg-[#F1F5F9] text-[#64748B]"
              )}
            >
              5 Provinces
            </span>
          </button>

          <button
            onClick={() => setActiveTab("courts")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer",
              activeTab === "courts"
                ? "bg-[#105B38] text-white shadow-xs"
                : "bg-white text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] border border-[#E2E8F0]"
            )}
          >
            <Landmark className="w-4 h-4" />
            <span>Pakistani Courts Directory</span>
            <span
              className={cn(
                "ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                activeTab === "courts" ? "bg-white/20 text-white" : "bg-[#F1F5F9] text-[#64748B]"
              )}
            >
              {PAKISTAN_COURT_DIRECTORY.length}
            </span>
          </button>
        </div>

        {/* ── TAB 1: STATUTES & MAJOR CODES COMPENDIUM ────────────────────────── */}
        {activeTab === "statutes" && (
          <div className="space-y-5">
            {/* Universal 83k Search Bar & Acronym Expansion */}
            <div className="p-4.5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
              <div className="relative">
                {isSearchLoading ? (
                  <Loader2 className="w-5 h-5 text-[#105B38] animate-spin absolute left-3.5 top-1/2 -translate-y-1/2" />
                ) : (
                  <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                )}
                <input
                  type="text"
                  value={universalSearchQuery}
                  onChange={(e) => setUniversalSearchQuery(e.target.value)}
                  placeholder="Universal Search across 83,117 sections (e.g. PPC 302, CrPC 497, O.7 R.11 CPC, SRA 24(c), Art 199, PECA 11, cheque)..."
                  className="w-full pl-11 pr-24 py-3 rounded-xl bg-slate-50/70 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#105B38] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#105B38]/20 transition-all font-medium"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {universalSearchQuery ? (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="rounded-lg p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : (
                    <span className="hidden sm:inline-flex items-center gap-0.5 rounded-md bg-slate-200/60 px-2 py-0.5 text-[11px] font-mono font-semibold text-slate-500">
                      ⌘K
                    </span>
                  )}
                  {searchLatency > 0 && (
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-mono font-semibold text-emerald-700 border border-emerald-200">
                      {searchLatency}ms ⚡
                    </span>
                  )}
                </div>
              </div>

              {/* Act & Enactment Selector Component */}
              <ActSelector
                selectedStatute={selectedStatute}
                onSelectAct={handleSelectAct}
              />

            </div>

            {/* Two-Pane Master-Detail Workstation Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-230px)] min-h-[640px]">
            {/* Left Pane: Sequential Section List or Search Results */}
            <div className="lg:col-span-4 flex flex-col rounded-2xl bg-white border border-[#E2E8F0] shadow-xs overflow-hidden">
              {/* Left Pane Header */}
              <div className="p-3.5 border-b border-slate-200 bg-slate-50/80 space-y-2 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {isSearchingGlobal
                      ? `Search Results (${searchResults.length})`
                      : `${selectedStatute} (${sequentialSections.length})`}
                  </span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                    {isSearchingGlobal ? "Global Index" : selectedStatuteShortCode || "Act"}
                  </span>
                </div>

                {!isSearchingGlobal && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={inActFilter}
                      onChange={(e) => setInActFilter(e.target.value)}
                      placeholder="Filter sections in this Act..."
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#105B38] focus:outline-hidden"
                    />
                    {inActFilter && (
                      <button
                        type="button"
                        onClick={() => setInActFilter("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Scrollable Section Items List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-[#105B38] scrollbar-track-slate-100 hover:scrollbar-thumb-[#0a4227]">
                {isSearchingGlobal ? (
                  searchResults.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-800">No matching sections found</p>
                      <p className="text-[11px] mt-1 text-slate-500">
                        Try searching with standard acronyms (e.g. PPC 302, CrPC 497, CPC O.7 R.11).
                      </p>
                    </div>
                  ) : (
                    <>
                    {searchResults.map((item) => {
                      const sec = item.section;
                      const isSelected = sec.id === activeSection.id;
                      const dom = inferDomainFromText(sec.statute + " " + (sec.category || ""));
                      const domStyle = DOMAIN_STYLES[dom];

                      return (
                        <div
                          key={sec.id}
                          onClick={() => setSelectedSectionId(sec.id)}
                          className={cn(
                            "p-3.5 cursor-pointer transition-all border-l-4 text-left group",
                            isSelected
                              ? "bg-emerald-50/70 border-l-[#105B38] text-slate-900"
                              : "hover:bg-slate-50 border-l-transparent text-slate-700"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-extrabold text-[#105B38] group-hover:underline">
                              {sec.section.startsWith("Section") || sec.section.startsWith("Art")
                                ? sec.section
                                : `Sec. ${sec.section}`}
                            </span>
                            {sec.liveDbMatch ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                <Database className="w-2.5 h-2.5" />
                                <span>Live DB</span>
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0",
                                  domStyle.bg,
                                  domStyle.text,
                                  domStyle.border
                                )}
                              >
                                {domStyle.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-900 line-clamp-1">
                            {sec.title}
                          </p>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                            {sec.statute}
                          </p>
                          {item.matchedHighlights?.snippet && (
                            <p className="mt-1 text-[11px] text-slate-600 line-clamp-1 italic">
                              {item.matchedHighlights.snippet}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    {universalSearchQuery.length >= 2 && !isSearchLoading && searchResults.length >= searchLimit && (
                      <div className="pt-2 pb-4 flex justify-center">
                        <button
                          onClick={() => setSearchLimit(prev => prev + 60)}
                          className="px-4 py-1.5 bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#105B38] text-[#0F172A] rounded-xl text-[11px] font-bold transition-all shadow-sm flex items-center gap-2"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                          Load More Sections
                        </button>
                      </div>
                    )}
                  </>
                  )
                ) : sequentialSections.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-800">No sections found</p>
                    <p className="text-[11px] mt-1 text-slate-500">
                      No sections matching filter &ldquo;{inActFilter}&rdquo;.
                    </p>
                  </div>
                ) : (
                  sequentialSections.map((sec) => {
                    const isSelected = sec.id === activeSection.id;
                    const dom = inferDomainFromText(sec.statute + " " + (sec.category || ""));
                    const domStyle = DOMAIN_STYLES[dom];

                    return (
                      <div
                        key={sec.id}
                        onClick={() => setSelectedSectionId(sec.id)}
                        className={cn(
                          "p-3.5 cursor-pointer transition-all border-l-4 text-left group",
                          isSelected
                            ? "bg-emerald-50/70 border-l-[#105B38] text-slate-900"
                            : "hover:bg-slate-50 border-l-transparent text-slate-700"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-extrabold text-[#105B38] group-hover:underline">
                            {sec.section.startsWith("Section") || sec.section.startsWith("Art")
                              ? sec.section
                              : `Sec. ${sec.section}`}
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0",
                              domStyle.bg,
                              domStyle.text,
                              domStyle.border
                            )}
                          >
                            {domStyle.label}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 line-clamp-1">
                          {sec.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                          {sec.punishment ? (
                            <span className="text-rose-700 font-semibold flex items-center gap-0.5">
                              <Gavel className="w-2.5 h-2.5" />
                              Penalty
                            </span>
                          ) : (
                            <span>Civil / Procedural</span>
                          )}
                          <span>•</span>
                          <span className="truncate">{sec.statute}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Pane: Section Detail View & Universal Legal Action Hub */}
            <div className="lg:col-span-8 flex flex-col rounded-2xl bg-white border border-[#E2E8F0] shadow-xs overflow-hidden">
              {/* Detail Header & Action Hub Toolbar */}
              <div className="p-5 border-b border-slate-200 bg-linear-to-r from-slate-50/90 to-white shrink-0">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-extrabold border inline-flex items-center gap-1.5",
                      DOMAIN_STYLES[activeSection.domain].bg,
                      DOMAIN_STYLES[activeSection.domain].text,
                      DOMAIN_STYLES[activeSection.domain].border
                    )}
                  >
                    <DomainIcon domain={activeSection.domain} className="w-3.5 h-3.5" />
                    <span>{DOMAIN_STYLES[activeSection.domain].label}</span>
                  </span>
                  {activeSection.isLiveDb && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5 shadow-2xs">
                      <Database className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Live Database</span>
                    </span>
                  )}
                  <span className="text-xs text-slate-500 font-mono">
                    {activeSection.statuteName}
                  </span>
                </div>

                <h2 className="text-xl font-extrabold text-slate-900 leading-snug">
                  {activeSection.sectionNumber}: {activeSection.title}
                </h2>
                <p className="text-xs font-bold text-[#105B38] mt-0.5">
                  {activeSection.statuteName}
                </p>

                {/* 3 Universal Action Hub Buttons — own row so they never get chopped */}
                <div className="flex items-center gap-2.5 flex-wrap mt-3 pt-3 border-t border-slate-100">
                  {/* 1. Copy Citation */}
                  <button
                    type="button"
                    onClick={handleCopyCitation}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-sm font-semibold text-slate-900 shadow-2xs transition-all cursor-pointer whitespace-nowrap"
                    title="Copy Section Text and Leading Precedent Citation"
                  >
                    {copiedCitation ? (
                      <>
                        <Check className="w-4 h-4 text-[#105B38]" />
                        <span className="text-[#105B38] font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-500" />
                        <span>Copy Citation</span>
                      </>
                    )}
                  </button>

                  {/* 2. Search Precedents Modal Trigger */}
                  <button
                    type="button"
                    onClick={() => handleOpenPrecedent(livePrecedents[0]?.citation || `${activeSection.statuteName} ${activeSection.sectionNumber}`, livePrecedents[0])}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-sm font-semibold text-[#105B38] transition-all cursor-pointer whitespace-nowrap"
                    title="Search case laws and precedent citation graphs for this statute section"
                  >
                    <Search className="w-4 h-4 text-[#105B38]" />
                    <span>Search Precedents</span>
                  </button>

                  {/* 3. Insert into Legal Drafting Studio */}
                  <button
                    type="button"
                    onClick={handleInsertIntoDrafting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-sm font-bold shadow-xs transition-all cursor-pointer whitespace-nowrap"
                    title="Pass this statutory ground directly into the Legal Drafting Studio"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Insert into Drafting</span>
                  </button>
                </div>
              </div>

              {/* Detail Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-[#105B38] scrollbar-track-slate-100 hover:scrollbar-thumb-[#0a4227]">
                {/* 1. Structured Clean Statute Viewer & Landmark Authorities */}
                <CleanStatuteViewer
                  statuteName={activeSection.statuteName}
                  sectionNumber={activeSection.sectionNumber}
                  rawTitle={activeSection.title}
                  rawDescription={activeSection.text}
                  rawPunishment={activeSection.punishmentOrRelief}
                  category={typeof activeSection.domain === "string" ? activeSection.domain : "Statute"}
                  isLiveDb={Boolean(activeSection.isLiveDb)}
                  onExploreJudgment={(cit, jId) => handleOpenPrecedent(cit, livePrecedents.find(p => p.citation === cit))}
                  onInsertDrafting={() => setLocation("/preview/drafting")}
                />

                {/* 2. Additional Legislative Commentary & Procedural Ingredients (if present) */}
                {activeSection.commentary && !activeSection.commentary.includes("Official legislative enactment") && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#105B38]" />
                      <span>Legislative Commentary & Procedural Ingredients</span>
                    </h3>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line space-y-2">
                      {activeSection.commentary}
                    </div>
                  </div>
                )}

                {/* 3. Mandatory Pleading Requirements & Procedural Notes (if present) */}
                {(activeSection.mandatoryPleadings || activeSection.proceduralNotes) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {activeSection.mandatoryPleadings && (
                      <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 mb-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Mandatory Pleading Averments</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          {activeSection.mandatoryPleadings}
                        </p>
                      </div>
                    )}

                    {activeSection.proceduralNotes && (
                      <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Procedural Guidance & Forum</span>
                        </div>
                        <p className="text-[11px] text-blue-800 leading-relaxed">
                          {activeSection.proceduralNotes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Keywords & Cross References */}
                <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-800">Keywords:</span>
                    {activeSection.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                  {activeSection.crossReferences && activeSection.crossReferences.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-800">Related:</span>
                      {activeSection.crossReferences.map((refId) => (
                        <button
                          key={refId}
                          type="button"
                          onClick={() => setSelectedSectionId(refId)}
                          className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold hover:underline"
                        >
                          {refId}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: LIMITATION DEADLINE CALCULATOR ──────────────────────────── */}
      {activeTab === "limitation" && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                  <Hourglass className="w-5 h-5 text-[#105B38]" />
                  <span>Limitation Act 1908 Schedule Calculator & Section 4 Rollover Engine</span>
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Real-time statutory deadline computation with automated Section 4 court closure / weekend rollover.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyLimitationSummary}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] shadow-2xs transition-all cursor-pointer"
                >
                  {copiedLimitation ? <Check className="w-3.5 h-3.5 text-[#105B38]" /> : <Copy className="w-3.5 h-3.5 text-[#64748B]" />}
                  <span>{copiedLimitation ? "Copied" : "Copy Assessment"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleInsertLimitationGround}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Insert into Drafting</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#105B38]" />
                  <span>Date of Accrual / Order / Decree:</span>
                </label>
                <input
                  type="date"
                  value={accrualDate}
                  onChange={(e) => setAccrualDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:border-[#105B38] focus:outline-hidden"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#105B38]" />
                  <span>Section 4 Weekend / Court Closure Rollover:</span>
                </label>
                <div className="flex items-center gap-3 pt-1.5">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#0F172A] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applySection4}
                      onChange={(e) => setApplySection4(e.target.checked)}
                      className="rounded border-[#CBD5E1] text-[#105B38] focus:ring-[#105B38]"
                    />
                    <span>Roll deadline forward if expired on Saturday/Sunday</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A]">Filter Limitation Category:</label>
                <select
                  value={limitationCategory}
                  onChange={(e) => setLimitationCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:border-[#105B38] focus:outline-hidden"
                >
                  <option value="all">All Categories ({LIMITATION_SCHEDULE_ENTRIES.length})</option>
                  <option value="Suits">Suits</option>
                  <option value="Appeals">Appeals</option>
                  <option value="Applications">Applications & Execution</option>
                  <option value="Revisions">Revisions & Reviews</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-[calc(100vh-320px)] min-h-[500px]">
            <div className="lg:col-span-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs overflow-hidden flex flex-col">
              <div className="p-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <input
                  type="text"
                  value={limitationSearch}
                  onChange={(e) => setLimitationSearch(e.target.value)}
                  placeholder="Search limitation article (e.g. 113, 156, appeal)..."
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:border-[#105B38] focus:outline-hidden"
                />
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-[#F1F5F9] custom-scrollbar">
                {filteredLimitationEntries.map((entry) => {
                  const isSelected = entry.article === activeLimitationEntry.article;
                  return (
                    <div
                      key={entry.article}
                      onClick={() => setSelectedArticleKey(entry.article)}
                      className={cn(
                        "p-3.5 cursor-pointer transition-all border-l-4 text-left",
                        isSelected
                          ? "bg-[#F0FDF4] border-l-[#105B38] text-[#0F172A]"
                          : "hover:bg-[#F8FAFC] border-l-transparent text-[#334155]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-extrabold text-[#105B38]">
                          {entry.article}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[10px] font-bold text-[#64748B]">
                          {entry.periodText}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-[#0F172A] line-clamp-1">{entry.title}</p>
                      <p className="text-[11px] text-[#64748B] line-clamp-1 mt-0.5">
                        Trigger: {entry.triggerEvent}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-7 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
                <div>
                  <span className="text-xs font-mono text-[#105B38] font-bold">
                    {activeLimitationEntry.article}
                  </span>
                  <h3 className="text-lg font-extrabold text-[#0F172A]">
                    {activeLimitationEntry.title}
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                  {activeLimitationEntry.periodText}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Statutory Prescribed Deadline
                  </span>
                  <p className="text-lg font-black text-[#0F172A] mt-1">
                    {limitationResult.expiryFormatted}
                  </p>
                </div>

                <div
                  className={cn(
                    "p-4 rounded-xl border",
                    limitationResult.isBarred
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : "bg-emerald-50 border-emerald-200 text-emerald-900"
                  )}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    Time-Bar Status
                  </span>
                  <p className="text-lg font-black mt-1">
                    {limitationResult.daysRemainingLabel}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs leading-relaxed space-y-2 text-slate-800">
                <p>
                  <strong>Statutory Provision:</strong> {activeLimitationEntry.description}
                </p>
                <p>
                  <strong>Time Commences From:</strong> {activeLimitationEntry.triggerEvent}
                </p>
                <p>
                  <strong>Section 4 Note:</strong> {limitationResult.statutoryNote}
                </p>
                {activeLimitationEntry.landmarkPrecedent && (
                  <p className="text-emerald-900 font-semibold pt-1 border-t border-slate-200">
                    <strong>Leading Precedent:</strong> {activeLimitationEntry.landmarkPrecedent}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: PROVINCIAL COURT FEES CALCULATOR ────────────────────────── */}
      {activeTab === "court-fees" && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                  <Coins className="w-5 h-5 text-[#105B38]" />
                  <span>5-Jurisdiction Provincial Court Fees & Pecuniary Engine</span>
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Calculates ad valorem court fees (7.5%), exemptions (PKR 25k), statutory caps (PKR 15k / PKR 50k Sindh dual-cap) & pecuniary jurisdiction.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPlaintValuationClause}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-semibold text-[#0F172A] shadow-2xs transition-all cursor-pointer"
                >
                  {copiedFeeClause ? <Check className="w-3.5 h-3.5 text-[#105B38]" /> : <Copy className="w-3.5 h-3.5 text-[#64748B]" />}
                  <span>{copiedFeeClause ? "Copied" : "Copy Valuation Clause"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleInsertValuationIntoDrafting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Insert into Drafting</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A]">Select Jurisdiction / Province:</label>
                <select
                  value={selectedProvince}
                  onChange={(e) => setSelectedProvince(e.target.value as CourtFeeProvince)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:border-[#105B38] focus:outline-hidden capitalize"
                >
                  <option value="punjab">Punjab (Court Fees Act 1870)</option>
                  <option value="sindh">Sindh (SHC Original Side Dual-Cap)</option>
                  <option value="islamabad">Islamabad Capital Territory</option>
                  <option value="kpk">Khyber Pakhtunkhwa</option>
                  <option value="balochistan">Balochistan</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A]">Suit Type & Relief Nature:</label>
                <select
                  value={selectedSuitTypeId}
                  onChange={(e) => setSelectedSuitTypeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:border-[#105B38] focus:outline-hidden"
                >
                  {COURT_FEE_SUIT_TYPES.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} ({st.feeType === "fixed" ? `Fixed PKR ${st.fixedAmount}` : "7.5% Ad Valorem"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#0F172A]">Claim / Plaint Valuation (PKR):</label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  value={claimValuation}
                  onChange={(e) => setClaimValuation(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] focus:border-[#105B38] focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Statutory Court Fee Required
              </span>
              <p className="text-2xl font-black text-[#105B38]">
                PKR {courtFeeResult.fee.toLocaleString()}/-
              </p>
              <p className="text-xs text-[#64748B]">{courtFeeResult.explanation}</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Competent Pecuniary Forum
              </span>
              <p className="text-base font-bold text-[#0F172A]">
                {courtFeeResult.pecuniaryCourt}
              </p>
              <p className="text-xs text-[#64748B]">Governing Act: {activeProvinceRule.governingAct}</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Statutory Exemption / Cap Status
              </span>
              <p className="text-sm font-semibold text-slate-800">
                {claimValuation <= 25000
                  ? "100% Exempted (<= PKR 25,000)"
                  : courtFeeResult.isCapped
                  ? "Statutory Ceiling Cap Applied"
                  : "Standard Ad Valorem Rate"}
              </p>
              <p className="text-xs text-slate-500">
                {selectedProvince === "sindh"
                  ? "Sindh Dual-Cap: PKR 15k (District) / PKR 50k (SHC Original Side > 65M)"
                  : "Standard Provincial Cap: PKR 15,000"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: PAKISTANI COURTS DIRECTORY ───────────────────────────────── */}
      {activeTab === "courts" && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-extrabold text-[#0F172A] flex items-center gap-2">
                <Landmark className="w-5 h-5 text-[#105B38]" />
                <span>Pakistani 4-Tier Court Directory & Registry Hierarchy</span>
              </h2>
              <p className="text-xs text-[#64748B] mt-0.5">
                Complete directory of the Supreme Court of Pakistan, Federal Shariat Court, 5 High Courts, Divisional Benches, and Special Tribunals.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={courtQuery}
                  onChange={(e) => setCourtQuery(e.target.value)}
                  placeholder="Search by court name, city (e.g. Islamabad, Lahore, Karachi, Peshawar, Quetta), bench..."
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#105B38] focus:bg-white focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setCourtTier("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border cursor-pointer",
                    courtTier === "all"
                      ? "bg-[#105B38] text-white border-[#105B38]"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  All ({PAKISTAN_COURT_DIRECTORY.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCourtTier("apex")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border cursor-pointer",
                    courtTier === "apex"
                      ? "bg-[#105B38] text-white border-[#105B38]"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  Apex Courts
                </button>
                <button
                  type="button"
                  onClick={() => setCourtTier("high_courts")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border cursor-pointer",
                    courtTier === "high_courts"
                      ? "bg-[#105B38] text-white border-[#105B38]"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  High Courts
                </button>
                <button
                  type="button"
                  onClick={() => setCourtTier("tribunals")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border cursor-pointer",
                    courtTier === "tribunals"
                      ? "bg-[#105B38] text-white border-[#105B38]"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  Tribunals
                </button>
                <button
                  type="button"
                  onClick={() => setCourtTier("district")}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all border cursor-pointer",
                    courtTier === "district"
                      ? "bg-[#105B38] text-white border-[#105B38]"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  District
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCourts.map((court) => (
              <div
                key={court.id}
                className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200 uppercase tracking-wide">
                      {court.tier.replace("_", " ")}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-1">
                      {court.name}
                    </h3>
                  </div>
                  <span className="text-xs font-bold text-[#105B38] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    {court.city}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {court.jurisdictionNotes}
                </p>

                <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{court.address}</span>
                  </p>
                  {court.contact && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{court.contact}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* In-Situ Live Precedent Explorer Modal */}
      <LivePrecedentModal
        isOpen={precedentModalOpen}
        onClose={() => setPrecedentModalOpen(false)}
        citation={selectedPrecedentCitation}
        initialPrecedent={selectedPrecedentInitial}
      />
      </div>
    </PreviewShell>
  );
};
export default PreviewStatutes;
