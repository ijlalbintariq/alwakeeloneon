import React, { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  X,
  Hourglass,
  Landmark,
  Search,
  AlertTriangle,
  CalendarClock,
  MapPin,
  Scale,
  ShieldAlert,
  Building2,
  FileCheck,
  Users,
  Cpu,
  Copy,
  Check,
  ExternalLink,
  BookOpen,
  Calculator,
  Gavel,
  FileEdit,
  Sparkles,
  ChevronRight,
  Shield,
  Layers,
  Coins,
  Receipt,
  Phone,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowRight,
  Info,
  Database,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
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
} from "@/experimental/data/statutesCompendiumData";

/* ==========================================================================
   CHAMBERS REFERENCE SHELF — 4-TAB LEGAL PRACTICE SYSTEM
   Tab 1: Statutes & Major Codes Compendium (7 Domains + Action Hub)
   Tab 2: Interactive Limitation Deadline Calculator (35+ Articles + Sec. 4 Rollover)
   Tab 3: Provincial Court Fees & Pecuniary Jurisdiction (5 Provinces)
   Tab 4: Pakistani Court Hierarchy Directory (Apex, High Courts, Tribunals, District)
   ========================================================================== */

export interface LegalReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "statutes" | "limitation" | "court-fees" | "courts";
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

// Court Hierarchy Tier Styling
const TIER_STYLES: Record<CourtHierarchyTier, { bg: string; text: string; border: string; label: string }> = {
  apex: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", label: "Apex Court" },
  high_courts: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", label: "High Court" },
  tribunals: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Special Tribunal" },
  district: { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200", label: "District Judiciary" },
};

export const LegalReferenceModal: React.FC<LegalReferenceModalProps> = ({
  isOpen,
  onClose,
  initialTab = "statutes",
}) => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Active Reference Tab
  const [activeTab, setActiveTab] = useState<"statutes" | "limitation" | "court-fees" | "courts">(initialTab);

  // Sync initial tab when changed
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // ─── TAB 1: STATUTES COMPENDIUM STATE ──────────────────────────────────────
  const [selectedDomain, setSelectedDomain] = useState<StatuteDomain | "all">("all");
  const [statuteQuery, setStatuteQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");
  const [liveDbSections, setLiveDbSections] = useState<StatuteSection[]>([]);
  const [isLiveFetching, setIsLiveFetching] = useState<boolean>(false);
  const [statuteError, setStatuteError] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("cpc-o7-r11");
  const [copiedCitation, setCopiedCitation] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(statuteQuery.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [statuteQuery]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setLiveDbSections([]);
      setIsLiveFetching(false);
      setStatuteError(null);
      return;
    }

    let isMounted = true;
    setIsLiveFetching(true);
    setStatuteError(null);

    async function fetchLive() {
      try {
        const query = debouncedQuery;
        const converted: StatuteSection[] = [];
        const seenIds = new Set<string>();
        let fetchFailed = false;
        let lastErrorMessage = "";

        try {
          const res1 = await fetch(`/api/statute-lookup?name=${encodeURIComponent(query)}&section=`, {
            credentials: "include",
          });
          if (res1.ok) {
            const data1 = await res1.json();
            if (data1.found && Array.isArray(data1.statutes)) {
              data1.statutes.forEach((st: any, idx: number) => {
                const sNum = st.section ? `Section ${st.section}` : st.shortTitle || "Statutory Provision";
                const sId = `live-modal-pg-${data1.documentId || 'doc'}-${st.section || idx}-${idx}`;
                if (!seenIds.has(sId)) {
                  seenIds.add(sId);
                  converted.push({
                    id: sId,
                    sectionNumber: sNum,
                    title: st.shortTitle ? `${st.shortTitle} — ${sNum}` : sNum,
                    statuteName: st.shortTitle || data1.documentTitle || "Statute of Pakistan",
                    statuteYear: 1860,
                    domain: inferDomainFromText(st.shortTitle || data1.documentTitle || ""),
                    text: st.description || "Verbatim statutory enactment from live database.",
                    commentary: st.punishment
                      ? `Statutory Punishment / Penalty:\n${st.punishment}`
                      : "Retrieved from live legislation database.",
                    punishmentOrRelief: st.punishment,
                    landmarkCitations: [],
                    keywords: [st.shortTitle, st.section, "PostgreSQL", "Live Database"].filter(Boolean) as string[],
                    isLiveDb: true,
                    sourceType: "postgres",
                    documentId: data1.documentId,
                    documentTitle: data1.documentTitle,
                  });
                }
              });
            }
          } else {
            fetchFailed = true;
            lastErrorMessage = `Statute lookup returned HTTP ${res1.status}`;
          }
        } catch (err: any) {
          fetchFailed = true;
          lastErrorMessage = err?.message || "Failed to reach statute lookup endpoint";
        }

        try {
          const res2 = await fetch(`/api/statute/lookup?q=${encodeURIComponent(query)}`, {
            credentials: "include",
          });
          if (res2.ok) {
            const data2 = await res2.json();
            if (data2.found && data2.statute) {
              const sNum = data2.section ? `Section ${data2.section}` : "Statutory Provision";
              const sId = `live-modal-statute-${data2.id || 'doc'}-${data2.section || 'sec'}`;
              if (!seenIds.has(sId)) {
                seenIds.add(sId);
                converted.push({
                  id: sId,
                  sectionNumber: sNum,
                  title: data2.statute.title || `${sNum}`,
                  statuteName: data2.statute.title || "Statute of Pakistan",
                  statuteYear: 1860,
                  domain: inferDomainFromText(data2.statute.category || data2.statute.title || ""),
                  text: data2.statute.content?.slice(0, 3000) || "Statute document text from PostgreSQL.",
                  commentary: "Live statutory enactment retrieved from legislation database.",
                  landmarkCitations: [],
                  keywords: [data2.statute.title, data2.section, "Live Database"].filter(Boolean) as string[],
                  isLiveDb: true,
                  sourceType: "statute_doc",
                  documentId: data2.id,
                  documentTitle: data2.statute.title,
                });
              }
            }
            fetchFailed = false;
          } else {
            if (fetchFailed && converted.length === 0) {
              lastErrorMessage = `Statute lookup returned HTTP ${res2.status}`;
            }
          }
        } catch (err: any) {
          if (converted.length === 0 && fetchFailed) {
            lastErrorMessage = err?.message || "Failed to query statute database";
          }
        }

        if (isMounted) {
          if (fetchFailed && converted.length === 0) {
            setStatuteError(lastErrorMessage || "Failed to retrieve statute records from backend.");
            setLiveDbSections([]);
          } else {
            setStatuteError(null);
            setLiveDbSections(converted);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setStatuteError(err?.message || "Error communicating with legislation service.");
          setLiveDbSections([]);
        }
      } finally {
        if (isMounted) {
          setIsLiveFetching(false);
        }
      }
    }

    fetchLive();
    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

  const filteredSections = useMemo(() => {
    if (statuteError) return [];
    const compendium = searchStatuteSections(statuteQuery, selectedDomain);
    if (liveDbSections.length === 0) return compendium;

    const domainFilteredLive = liveDbSections.filter((s) => {
      if (selectedDomain === "all") return true;
      return s.domain === selectedDomain;
    });

    const compendiumKeySet = new Set(
      compendium.map((c) => `${c.statuteName.toLowerCase()}_${c.sectionNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}`)
    );

    const nonDuplicateLive = domainFilteredLive.filter((ls) => {
      const key = `${ls.statuteName.toLowerCase()}_${ls.sectionNumber.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      return !compendiumKeySet.has(key);
    });

    return [...compendium, ...nonDuplicateLive];
  }, [statuteQuery, selectedDomain, liveDbSections, statuteError]);

  // Active section detail
  const activeSection: StatuteSection = useMemo(() => {
    const found =
      filteredSections.find((s) => s.id === selectedSectionId) ||
      STATUTE_SECTIONS.find((s) => s.id === selectedSectionId) ||
      liveDbSections.find((s) => s.id === selectedSectionId);
    if (found) return found;
    return filteredSections[0] || STATUTE_SECTIONS[0];
  }, [selectedSectionId, filteredSections, liveDbSections]);

  // Action 1: Copy section & citation
  const handleCopyCitation = (section: StatuteSection) => {
    const formatted = formatLegalCitation(section);
    navigator.clipboard.writeText(formatted);
    setCopiedCitation(true);
    setTimeout(() => setCopiedCitation(false), 2000);
    toast({
      title: "Statutory Citation Copied",
      description: `Copied ${section.sectionNumber} (${section.statuteName}) and leading precedent to clipboard.`,
    });
  };

  // Action 2: Deep Link to Precedents Search
  const handleSearchPrecedents = (section: StatuteSection) => {
    const query = `${section.statuteName} ${section.sectionNumber}`;
    onClose();
    setLocation(`/preview/judgments?q=${encodeURIComponent(query)}`);
    toast({
      title: "Searching Landmark Precedents",
      description: `Filtering superior court judgments for ${section.sectionNumber}.`,
    });
  };

  // Action 3: Insert into Legal Drafting Studio
  const handleInsertIntoDrafting = (section: StatuteSection) => {
    const formattedClause = formatDraftingClause(section);
    const payload = {
      statute: section.statuteName,
      section: section.sectionNumber,
      title: section.title,
      clause: formattedClause,
      timestamp: Date.now(),
    };

    localStorage.setItem("alwakeelo_drafting_insert", JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("alwakeelo-drafting-insert", { detail: payload }));
    onClose();
    setLocation("/preview/drafting");
    toast({
      title: "Statutory Clause Transferred",
      description: `Inserted ${section.sectionNumber} clause into Legal Drafting Studio.`,
    });
  };

  // ─── TAB 2: LIMITATION CALCULATOR STATE ────────────────────────────────────
  const [limitationSearch, setLimitationSearch] = useState<string>("");
  const [limitationCategory, setLimitationCategory] = useState<string>("all");
  const [selectedArticleKey, setSelectedArticleKey] = useState<string>("Art. 113");
  const [accrualDate, setAccrualDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
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
    const found = LIMITATION_SCHEDULE_ENTRIES.find(
      (e) => e.article === selectedArticleKey
    );
    return found || filteredLimitationEntries[0] || LIMITATION_SCHEDULE_ENTRIES[0];
  }, [selectedArticleKey, filteredLimitationEntries]);

  // Compute live deadline
  const limitationResult = useMemo(() => {
    const parsedDate = new Date(accrualDate + "T00:00:00");
    const validDate = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    return computeLimitationDeadline(activeLimitationEntry, validDate, applySection4);
  }, [activeLimitationEntry, accrualDate, applySection4]);

  // Copy limitation summary
  const handleCopyLimitationSummary = () => {
    const summary = `LIMITATION PERIOD ASSESSMENT (Limitation Act, 1908):
Article: ${activeLimitationEntry.article} — ${activeLimitationEntry.title}
Statutory Period: ${activeLimitationEntry.periodText} (${activeLimitationEntry.category})
Commencement Trigger: ${activeLimitationEntry.triggerEvent}
Date of Accrual: ${accrualDate}
Statutory Deadline: ${limitationResult.expiryFormatted}
Current Status: ${limitationResult.daysRemainingLabel}
Section 4 Rollover Applied: ${limitationResult.isWeekendRollover ? "Yes (Court closed on raw deadline; rolled to next court sitting day)" : "No"}
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

  // Insert limitation ground into drafting
  const handleInsertLimitationGround = () => {
    const limitationClause = `GROUND ON LIMITATION & TIMELINESS:
That the present ${activeLimitationEntry.category.toLowerCase().includes("appeal") ? "appeal" : activeLimitationEntry.category.toLowerCase().includes("application") ? "application" : "suit"} has been instituted within the prescribed period of limitation under ${activeLimitationEntry.article} of the First Schedule to the Limitation Act, 1908.
The cause of action / right to apply accrued on ${accrualDate} (${activeLimitationEntry.triggerEvent}), and the statutory limitation expires on ${limitationResult.expiryFormatted}. ${limitationResult.isWeekendRollover ? "Pursuant to Section 4 of the Limitation Act 1908 read with Section 10 of General Clauses Act 1897, the filing on the reopening date is within time." : ""}
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
    onClose();
    setLocation("/preview/drafting");
    toast({
      title: "Limitation Ground Inserted",
      description: `Transferred ${activeLimitationEntry.article} ground into Legal Drafting Studio.`,
    });
  };

  // Date Presets Helper
  const setDatePreset = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setAccrualDate(d.toISOString().slice(0, 10));
  };

  // ─── TAB 3: PROVINCIAL COURT FEES STATE ────────────────────────────────────
  const [selectedProvince, setSelectedProvince] = useState<CourtFeeProvince>("punjab");
  const [selectedSuitTypeId, setSelectedSuitTypeId] = useState<string>("recovery_money");
  const [claimValuation, setClaimValuation] = useState<number>(500000);
  const [copiedFeeClause, setCopiedFeeClause] = useState<boolean>(false);

  const activeProvinceRule = PROVINCIAL_COURT_FEE_RULES[selectedProvince];
  const activeSuitType =
    COURT_FEE_SUIT_TYPES.find((s) => s.id === selectedSuitTypeId) ||
    COURT_FEE_SUIT_TYPES[0];

  const courtFeeResult = useMemo(() => {
    return calculateProvincialCourtFee(
      selectedProvince,
      selectedSuitTypeId,
      claimValuation
    );
  }, [selectedProvince, selectedSuitTypeId, claimValuation]);

  const generatePlaintValuationClause = () => {
    return `SUIT VALUATION & COURT FEES:
That the value of the suit for the purpose of court fee and pecuniary jurisdiction is fixed at PKR ${claimValuation.toLocaleString()}/- (Rupees ${numberToWordsPk(claimValuation)}), on which statutory court fee of PKR ${courtFeeResult.fee.toLocaleString()}/- is affixed as prescribed under the ${activeProvinceRule.governingAct}.
That in terms of pecuniary and territorial jurisdiction, the subject matter falls within the jurisdiction of the ${courtFeeResult.pecuniaryCourt}.`;
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
    onClose();
    setLocation("/preview/drafting");
    toast({
      title: "Valuation Clause Inserted",
      description: `Affixed ${activeProvinceRule.provinceName} court fees clause into Drafting Studio.`,
    });
  };

  // ─── TAB 4: COURTS DIRECTORY STATE ─────────────────────────────────────────
  const [courtQuery, setCourtQuery] = useState<string>("");
  const [courtTier, setCourtTier] = useState<CourtHierarchyTier | "all">("all");

  const filteredCourts = useMemo(() => {
    return searchCourts(courtQuery, courtTier);
  }, [courtQuery, courtTier]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chambers-shelf-title"
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
    >
      <div className="bg-white border border-[#E2E8F0] rounded-2xl max-w-6xl w-full h-[92vh] max-h-[900px] flex flex-col shadow-2xl overflow-hidden text-[#0F172A]">
        {/* ── Modal Global Header ── */}
        <div className="px-6 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#105B38]/10 border border-[#105B38]/20 flex items-center justify-center text-[#105B38] shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#105B38] uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Chambers Reference Shelf
                </span>
                <span className="text-[11px] text-[#64748B] hidden sm:inline">
                  Pakistani Practice Manual & Legal Codes
                </span>
              </div>
              <h2 id="chambers-shelf-title" className="text-base sm:text-lg font-bold text-[#0F172A] leading-tight">
                Statutes, Major Codes & Procedural Guides
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]/60 transition-colors"
              aria-label="Close Reference Shelf"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 4 Global Navigation Tabs ── */}
        <div className="flex items-center gap-1.5 px-6 pt-2 border-b border-[#E2E8F0] shrink-0 bg-white overflow-x-auto custom-scrollbar">
          {[
            {
              id: "statutes" as const,
              label: "Statutes & Major Codes",
              subLabel: "40+ Provisions & Precedents",
              icon: BookOpen,
              count: STATUTE_SECTIONS.length,
            },
            {
              id: "limitation" as const,
              label: "Limitation Calculator",
              subLabel: "35+ Schedule Articles & Sec. 4",
              icon: Hourglass,
              count: LIMITATION_SCHEDULE_ENTRIES.length,
            },
            {
              id: "court-fees" as const,
              label: "Provincial Court Fees",
              subLabel: "5 Provincial Fee Schedules",
              icon: Calculator,
              count: "5 Prov.",
            },
            {
              id: "courts" as const,
              label: "Pakistani Courts Directory",
              subLabel: "4-Tier Court Hierarchy",
              icon: Landmark,
              count: PAKISTAN_COURT_DIRECTORY.length,
            },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "group inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-xl border-b-2 transition-all whitespace-nowrap",
                activeTab === t.id
                  ? "border-[#105B38] text-[#105B38] bg-[#105B38]/5 shadow-xs"
                  : "border-transparent text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
              )}
            >
              <t.icon className={cn("w-4 h-4", activeTab === t.id ? "text-[#105B38]" : "text-[#94A3B8]")} />
              <span>{t.label}</span>
              <span
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded-full font-mono font-medium",
                  activeTab === t.id
                    ? "bg-[#105B38] text-white"
                    : "bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#E2E8F0]"
                )}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Modal Body (Active Tab Content) ── */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col bg-white">
          {/* =================================================================
              TAB 1: STATUTES & MAJOR CODES COMPENDIUM
              ================================================================= */}
          {activeTab === "statutes" && (
            <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
              {/* ── Left Master List Pane ── */}
              <div className="w-full md:w-[360px] lg:w-[400px] border-r border-[#E2E8F0] flex flex-col bg-[#F8FAFC] shrink-0 min-h-0">
                {/* Search & Domain Filters Bar */}
                <div className="p-3.5 border-b border-[#E2E8F0] space-y-2.5 bg-white shrink-0">
                  {/* Search input */}
                  <div className="relative">
                    {isLiveFetching ? (
                      <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#105B38] animate-spin" />
                    ) : (
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    )}
                    <input
                      type="text"
                      value={statuteQuery}
                      onChange={(e) => setStatuteQuery(e.target.value)}
                      placeholder="Search section, CPC, PPC, SRA, keywords..."
                      className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#105B38] focus:bg-white shadow-xs"
                    />
                    {statuteQuery && (
                      <button
                        onClick={() => setStatuteQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Domain Filter Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                    <button
                      onClick={() => setSelectedDomain("all")}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors border",
                        selectedDomain === "all"
                          ? "bg-[#105B38] text-white border-[#105B38]"
                          : "bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                      )}
                    >
                      All Domains ({STATUTE_SECTIONS.length})
                    </button>
                    {STATUTE_DOMAINS.map((domain) => (
                      <button
                        key={domain.id}
                        onClick={() => setSelectedDomain(domain.id)}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors border",
                          selectedDomain === domain.id
                            ? "bg-[#105B38] text-white border-[#105B38]"
                            : "bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                        )}
                      >
                        <DomainIcon domain={domain.id} className="w-3 h-3" />
                        <span>{domain.shortLabel}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Section List Header */}
                <div className="px-4 py-2 bg-[#F1F5F9]/60 border-b border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#64748B] shrink-0">
                  <span className="font-semibold">
                    {statuteError
                      ? "Search Error"
                      : `${filteredSections.length} Statutory Provision${filteredSections.length === 1 ? "" : "s"}${liveDbSections.length > 0 ? ` (${liveDbSections.length} live from DB)` : ""}`}
                  </span>
                  <span className="text-[10px] text-[#94A3B8]">Click to view details</span>
                </div>

                {/* Scrollable Section Master List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-[#F1F5F9]">
                  {statuteError ? (
                    <div className="p-6 text-center space-y-3 bg-rose-50/60 m-3 rounded-xl border border-rose-200">
                      <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-rose-900">Statute Lookup Error</p>
                        <p className="text-[11px] text-rose-700 leading-relaxed">{statuteError}</p>
                      </div>
                      <button
                        onClick={() => {
                          setStatuteError(null);
                          setStatuteQuery(statuteQuery);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 transition-colors inline-block"
                      >
                        Retry Search
                      </button>
                    </div>
                  ) : filteredSections.length === 0 ? (
                    <div className="p-8 text-center space-y-2">
                      <BookOpen className="w-8 h-8 text-[#CBD5E1] mx-auto" />
                      <p className="text-xs font-semibold text-[#64748B]">No statutory provisions found</p>
                      <p className="text-[11px] text-[#94A3B8]">
                        Try searching for &quot;O7 R11&quot;, &quot;489-F&quot;, &quot;199&quot;, &quot;readiness&quot;, or change domain.
                      </p>
                      <button
                        onClick={() => {
                          setStatuteQuery("");
                          setSelectedDomain("all");
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-[#105B38] bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors inline-block mt-2"
                      >
                        Reset All Filters
                      </button>
                    </div>
                  ) : (
                    filteredSections.map((sec) => {
                      const isSelected = sec.id === activeSection.id;
                      const style = DOMAIN_STYLES[sec.domain];
                      return (
                        <div
                          key={sec.id}
                          onClick={() => setSelectedSectionId(sec.id)}
                          className={cn(
                            "p-3.5 cursor-pointer transition-all border-l-4 select-none",
                            isSelected
                              ? "bg-[#105B38]/8 border-l-[#105B38] shadow-xs"
                              : "bg-white border-l-transparent hover:bg-[#F8FAFC] hover:border-l-[#CBD5E1]"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="font-mono text-xs font-bold text-[#105B38]">
                              {sec.sectionNumber}
                            </span>
                            {sec.isLiveDb ? (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Live Database</span>
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  "text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0",
                                  style.bg,
                                  style.text,
                                  style.border
                                )}
                              >
                                {style.label}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-[#0F172A] line-clamp-1 mb-1">
                            {sec.title}
                          </p>
                          <p className="text-[11px] text-[#64748B] line-clamp-1">
                            {sec.statuteName} ({sec.statuteYear})
                          </p>
                          {sec.isLiveDb ? (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 w-fit">
                              <Database className="w-2.5 h-2.5 text-emerald-600" />
                              <span>PostgreSQL Record</span>
                            </div>
                          ) : sec.landmarkCitations.length > 0 ? (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#475569] font-mono bg-[#F8FAFC] px-2 py-0.5 rounded border border-[#E2E8F0] w-fit">
                              <Gavel className="w-2.5 h-2.5 text-[#105B38]" />
                              <span>{sec.landmarkCitations[0].citation}</span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* ── Right Detail & Action Hub Pane ── */}
              <div className="flex-1 flex flex-col min-w-0 bg-white overflow-hidden">
                {statuteError ? (
                  <div className="flex-1 flex items-center justify-center p-8 bg-[#F8FAFC]">
                    <div className="max-w-md text-center space-y-3 bg-white p-6 rounded-2xl border border-rose-200 shadow-sm">
                      <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
                      <h3 className="text-base font-bold text-[#0F172A]">Unable to Load Statutes</h3>
                      <p className="text-xs text-[#64748B] leading-relaxed">{statuteError}</p>
                      <button
                        onClick={() => {
                          setStatuteError(null);
                          setStatuteQuery(statuteQuery);
                        }}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#105B38] rounded-xl hover:bg-[#0D4A2E] transition-colors inline-block"
                      >
                        Retry Query
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Detail View Header with Action Hub Buttons */}
                    <div className="px-6 py-4 border-b border-[#E2E8F0] bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className={cn(
                          "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                          DOMAIN_STYLES[activeSection.domain].bg,
                          DOMAIN_STYLES[activeSection.domain].text,
                          DOMAIN_STYLES[activeSection.domain].border
                        )}
                      >
                        {DOMAIN_STYLES[activeSection.domain].label}
                      </span>
                      {activeSection.isLiveDb && (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5 shadow-2xs">
                          <Database className="w-3 h-3 text-emerald-600" />
                          <span>Live Database Record</span>
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-[#64748B]">
                        {activeSection.statuteName} · {activeSection.statuteYear}
                      </span>
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                        In Force & Applicable
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-[#0F172A] tracking-tight">
                      {activeSection.sectionNumber}: {activeSection.title}
                    </h3>
                  </div>

                  {/* 3 Action Hub Buttons */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Action 1: Copy Section & Citation */}
                    <button
                      onClick={() => handleCopyCitation(activeSection)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F8FAFC] hover:border-[#94A3B8] transition-all shadow-xs"
                      title="Copy section text and leading landmark citation to clipboard"
                    >
                      {copiedCitation ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                          <span>Copy Citation</span>
                        </>
                      )}
                    </button>

                    {/* Action 2: Search Precedents */}
                    <button
                      onClick={() => handleSearchPrecedents(activeSection)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-50 border border-blue-200 text-blue-800 hover:bg-blue-100 transition-all shadow-xs"
                      title="Search case law & judgments for this statutory section"
                    >
                      <Search className="w-3.5 h-3.5 text-blue-600" />
                      <span>Search Precedents</span>
                    </button>

                    {/* Action 3: Insert into Legal Drafting Studio */}
                    <button
                      onClick={() => handleInsertIntoDrafting(activeSection)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#105B38] border border-[#105B38] text-white hover:bg-[#0D4A2E] transition-all shadow-xs"
                      title="Directly insert formatted statutory clause into Legal Drafting Studio canvas"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Insert into Drafting</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                  </div>
                </div>

                {/* Scrollable Content Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                  {/* 1. Verbatim Statutory Provision Box */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-[#105B38] uppercase tracking-wider flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        Verbatim Statutory Provision
                      </p>
                      <span className="text-[11px] font-mono text-[#64748B]">
                        {activeSection.statuteName}
                      </span>
                    </div>

                    <div className="relative p-4 rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] shadow-2xs">
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#105B38] rounded-l-xl" />
                      <pre className="font-serif text-sm leading-relaxed text-[#0F172A] whitespace-pre-wrap select-text pl-2">
                        {activeSection.text}
                      </pre>
                    </div>
                  </div>

                  {/* 2. Legislative Commentary & Procedural Ingredients */}
                  <div className="space-y-3">
                    <p className="text-[11px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#105B38]" />
                      Legislative Commentary & Procedural Rules
                    </p>

                    <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white text-xs leading-relaxed text-[#334155] space-y-3 shadow-2xs">
                      {activeSection.commentary.split("\n\n").map((para, idx) => (
                        <p key={idx} className="leading-relaxed">
                          {para}
                        </p>
                      ))}
                    </div>

                    {/* Mandatory Pleading Requirement Callout (e.g. S.24(c) readiness, O.VII R.11 date) */}
                    {activeSection.mandatoryPleadings && (
                      <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/80 text-xs text-amber-900 space-y-1 shadow-2xs">
                        <div className="flex items-center gap-2 font-bold text-amber-950">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Mandatory Pleading Requirement (Strict Compliance)</span>
                        </div>
                        <p className="leading-relaxed pl-6">{activeSection.mandatoryPleadings}</p>
                      </div>
                    )}

                    {/* Procedural Notes */}
                    {activeSection.proceduralNotes && (
                      <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/70 text-xs text-blue-900 space-y-1">
                        <div className="flex items-center gap-2 font-bold text-blue-950">
                          <Shield className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>Procedural Notes & Invalidation Risks</span>
                        </div>
                        <p className="leading-relaxed pl-6">{activeSection.proceduralNotes}</p>
                      </div>
                    )}

                    {/* Relief / Punishment */}
                    {activeSection.punishmentOrRelief && (
                      <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-emerald-900 space-y-1">
                        <div className="flex items-center gap-2 font-bold text-emerald-950">
                          <Gavel className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Statutory Relief / Prescribed Penalty</span>
                        </div>
                        <p className="leading-relaxed pl-6">{activeSection.punishmentOrRelief}</p>
                      </div>
                    )}
                  </div>

                  {/* 3. Landmark Case Law Authorities */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-bold text-[#475569] uppercase tracking-wider flex items-center gap-1.5">
                        <Gavel className="w-3.5 h-3.5 text-[#105B38]" />
                        Landmark Precedent Authorities ({activeSection.landmarkCitations.length})
                      </p>
                      <span className="text-[10px] text-[#64748B]">Supreme Court & High Courts of Pakistan</span>
                    </div>

                    <div className="space-y-3">
                      {activeSection.landmarkCitations.map((citation, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#105B38]/50 transition-all space-y-2 shadow-2xs"
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-[#105B38] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  {citation.citation}
                                </span>
                                <span className="text-xs font-bold text-[#0F172A]">
                                  {citation.title}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#64748B] mt-0.5">
                                {citation.court} · {citation.year}
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                onClose();
                                setLocation(`/preview/judgments?q=${encodeURIComponent(citation.citation)}`);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#105B38] hover:text-[#0D4A2E] hover:underline"
                            >
                              <span>Explore Judgment</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="p-3 rounded-lg bg-white border border-[#E2E8F0] text-xs text-[#334155] leading-relaxed italic">
                            &ldquo;{citation.ratio}&rdquo;
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. Keywords & Cross References */}
                  <div className="pt-4 border-t border-[#E2E8F0] space-y-2">
                    <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
                      Statutory Keywords & Taxonomy
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {activeSection.keywords.map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md text-[11px] bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 2: INTERACTIVE LIMITATION DEADLINE CALCULATOR
              ================================================================= */}
          {activeTab === "limitation" && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {/* Statutory Disclaimer & Section 4 Rule Banner */}
              <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 flex items-start gap-3 text-xs text-amber-950 leading-relaxed shadow-2xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">
                    Limitation Act 1908 Schedule Calculator & Section 4 Court Recess Engine
                  </p>
                  <p className="text-amber-900 text-[11px]">
                    Under <strong>Section 3 of the Limitation Act, 1908</strong>, every suit instituted after the prescribed period shall be dismissed although limitation has not been set up as a defence. Under <strong>Section 4</strong>, where the prescribed period expires on a day when the court is closed (Sundays, gazetted holidays, or court recesses), the suit may be instituted on the day that the court reopens.
                  </p>
                </div>
              </div>

              {/* Calculator Engine Card */}
              <div className="p-5 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] space-y-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 flex-wrap gap-2">
                  <div>
                    <p className="text-[11px] font-bold text-[#105B38] uppercase tracking-wider">
                      Interactive Limitation Clock
                    </p>
                    <h3 className="text-base font-bold text-[#0F172A]">
                      Compute Filing Deadline & Weekend Rollover
                    </h3>
                  </div>

                  {/* Section 4 Rollover Toggle */}
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none bg-white px-3 py-1.5 rounded-xl border border-[#CBD5E1] shadow-2xs">
                    <input
                      type="checkbox"
                      checked={applySection4}
                      onChange={(e) => setApplySection4(e.target.checked)}
                      className="rounded text-[#105B38] focus:ring-[#105B38] w-4 h-4 accent-[#105B38]"
                    />
                    <span className="text-xs font-semibold text-[#0F172A]">
                      Apply Section 4 Weekend Rollover
                    </span>
                  </label>
                </div>

                {/* Inputs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Column 1: Category Filter & Article Selector */}
                  <div className="md:col-span-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#475569]">
                        Select Cause of Action / Limitation Article ({LIMITATION_SCHEDULE_ENTRIES.length}+ Articles)
                      </span>
                    </div>

                    {/* Category Filter Chips */}
                    <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
                      {["all", "Suits", "Appeals", "Applications", "Revisions", "Reviews", "Execution"].map(
                        (cat) => (
                          <button
                            key={cat}
                            onClick={() => setLimitationCategory(cat)}
                            className={cn(
                              "px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors border",
                              limitationCategory === cat
                                ? "bg-[#105B38] text-white border-[#105B38]"
                                : "bg-white text-[#64748B] border-[#E2E8F0] hover:text-[#0F172A]"
                            )}
                          >
                            {cat === "all" ? "All Categories" : cat}
                          </button>
                        )
                      )}
                    </div>

                    {/* Dropdown Selector */}
                    <select
                      value={activeLimitationEntry.article}
                      onChange={(e) => setSelectedArticleKey(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#105B38] shadow-xs"
                    >
                      {filteredLimitationEntries.map((entry) => (
                        <option key={entry.article} value={entry.article}>
                          {entry.article}: {entry.periodText} — {entry.title} ({entry.description.slice(0, 60)}…)
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Column 2: Date of Accrual Datepicker */}
                  <div className="space-y-2">
                    <span className="block text-[11px] font-semibold text-[#475569]">
                      Date of Accrual / Order / Event
                    </span>
                    <input
                      type="date"
                      value={accrualDate}
                      onChange={(e) => setAccrualDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#105B38] shadow-xs"
                    />

                    {/* Quick Date Presets */}
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      <button
                        onClick={() => setDatePreset(0)}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] text-[#475569]"
                      >
                        Today
                      </button>
                      <button
                        onClick={() => setDatePreset(30)}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] text-[#475569]"
                      >
                        30d ago
                      </button>
                      <button
                        onClick={() => setDatePreset(90)}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] text-[#475569]"
                      >
                        90d ago
                      </button>
                      <button
                        onClick={() => setDatePreset(365)}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] text-[#475569]"
                      >
                        1y ago
                      </button>
                      <button
                        onClick={() => setDatePreset(3 * 365)}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] text-[#475569]"
                      >
                        3y ago
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Computation Result Banner ── */}
                <div className="p-4 rounded-xl bg-white border border-[#CBD5E1] space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9] pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[#105B38] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {activeLimitationEntry.article}
                        </span>
                        <span className="text-xs font-bold text-[#0F172A]">
                          {activeLimitationEntry.title}
                        </span>
                        <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded font-mono">
                          {activeLimitationEntry.category}
                        </span>
                      </div>
                      <p className="text-xs text-[#64748B] mt-1">
                        Trigger: <strong>{activeLimitationEntry.triggerEvent}</strong>
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold border",
                          limitationResult.isBarred
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : limitationResult.daysRemaining === 0
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        )}
                      >
                        <CalendarClock className="w-4 h-4" />
                        {limitationResult.daysRemainingLabel}
                      </span>
                    </div>
                  </div>

                  {/* Calculated Dates Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase">Accrual Date</p>
                      <p className="font-mono font-bold text-[#0F172A] mt-0.5">{accrualDate}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase">Prescribed Period</p>
                      <p className="font-mono font-bold text-[#105B38] mt-0.5">
                        {activeLimitationEntry.periodText}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200">
                      <p className="text-[10px] font-bold text-[#105B38] uppercase">Statutory Deadline</p>
                      <p className="font-bold text-[#0F172A] mt-0.5 text-sm">
                        {limitationResult.expiryFormatted}
                      </p>
                    </div>
                  </div>

                  {/* Section 4 Rollover Alert */}
                  {limitationResult.isWeekendRollover && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-300 text-xs text-emerald-950 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Section 4 Weekend Rollover Applied</p>
                        <p className="text-[11px] text-emerald-900 mt-0.5">
                          Raw expiry fell on a Sunday / Court Holiday. Limitation deadline is legally extended to the reopening court day (Monday) under Section 4 Limitation Act 1908 &amp; Section 10 General Clauses Act 1897.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Landmark Precedent on this Article */}
                  {activeLimitationEntry.landmarkPrecedent && (
                    <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#334155] space-y-1">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase flex items-center gap-1">
                        <Gavel className="w-3 h-3 text-[#105B38]" />
                        Leading Precedent Authority
                      </p>
                      <p className="font-mono text-[11px] font-semibold text-[#105B38]">
                        {activeLimitationEntry.landmarkPrecedent}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#F1F5F9] justify-end flex-wrap">
                    <button
                      onClick={handleCopyLimitationSummary}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F8FAFC]"
                    >
                      {copiedLimitation ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Assessment Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                          <span>Copy Assessment</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleInsertLimitationGround}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#105B38] text-white hover:bg-[#0D4A2E] transition-colors shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Insert Ground into Drafting</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Complete Schedule Reference Table ── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                      Limitation Act 1908 First Schedule Master Reference
                    </p>
                    <p className="text-[11px] text-[#64748B]">
                      Click any row to load article into the live calculation clock
                    </p>
                  </div>

                  <div className="w-64">
                    <input
                      type="text"
                      value={limitationSearch}
                      onChange={(e) => setLimitationSearch(e.target.value)}
                      placeholder="Filter articles & keywords..."
                      className="w-full px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#105B38]"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-[#CBD5E1] overflow-hidden bg-white shadow-xs">
                  <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                      <thead className="sticky top-0 bg-[#F8FAFC] border-b border-[#E2E8F0] z-10">
                        <tr>
                          <th className="px-3.5 py-2.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                            Article
                          </th>
                          <th className="px-3.5 py-2.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-3.5 py-2.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                            Matter & Description
                          </th>
                          <th className="px-3.5 py-2.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                            Trigger Event
                          </th>
                          <th className="px-3.5 py-2.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider text-right">
                            Period
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9] text-xs">
                        {filteredLimitationEntries.map((entry) => {
                          const isSelected = entry.article === activeLimitationEntry.article;
                          return (
                            <tr
                              key={entry.article}
                              onClick={() => setSelectedArticleKey(entry.article)}
                              className={cn(
                                "cursor-pointer transition-colors hover:bg-[#F8FAFC]",
                                isSelected && "bg-[#105B38]/8 font-medium"
                              )}
                            >
                              <td className="px-3.5 py-2 font-mono font-bold text-[#105B38] whitespace-nowrap">
                                {entry.article}
                              </td>
                              <td className="px-3.5 py-2 text-[11px] text-[#64748B] whitespace-nowrap">
                                <span className="bg-[#F1F5F9] px-2 py-0.5 rounded border border-[#E2E8F0]">
                                  {entry.category}
                                </span>
                              </td>
                              <td className="px-3.5 py-2 text-[#0F172A]">
                                <p className="font-semibold">{entry.title}</p>
                                <p className="text-[11px] text-[#64748B] line-clamp-1">{entry.description}</p>
                              </td>
                              <td className="px-3.5 py-2 text-[11px] text-[#475569] max-w-[200px] truncate">
                                {entry.triggerEvent}
                              </td>
                              <td className="px-3.5 py-2 font-mono font-bold text-[#0F172A] text-right whitespace-nowrap">
                                {entry.periodText}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 3: PROVINCIAL COURT FEES & PECUNIARY JURISDICTION
              ================================================================= */}
          {activeTab === "court-fees" && (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {/* Province Selector Bar */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-[#105B38] uppercase tracking-wider">
                    Select Provincial Jurisdiction (5 High Court Regimes)
                  </p>
                  <span className="text-[11px] text-[#64748B]">
                    Governing Act: <strong>{activeProvinceRule.governingAct}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(
                    [
                      { id: "punjab" as const, name: "Punjab", court: "LHC Jurisdiction" },
                      { id: "sindh" as const, name: "Sindh", court: "SHC Original Side" },
                      { id: "islamabad" as const, name: "Islamabad (ICT)", court: "IHC Jurisdiction" },
                      { id: "kpk" as const, name: "KPK", court: "PHC Jurisdiction" },
                      { id: "balochistan" as const, name: "Balochistan", court: "BHC Jurisdiction" },
                    ] as const
                  ).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProvince(p.id)}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all shadow-2xs",
                        selectedProvince === p.id
                          ? "bg-[#105B38] text-white border-[#105B38] shadow-xs"
                          : "bg-white text-[#0F172A] border-[#CBD5E1] hover:border-[#94A3B8] hover:bg-[#F8FAFC]"
                      )}
                    >
                      <p className="text-xs font-bold">{p.name}</p>
                      <p
                        className={cn(
                          "text-[10px]",
                          selectedProvince === p.id ? "text-emerald-100" : "text-[#64748B]"
                        )}
                      >
                        {p.court}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4 Summary Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Ad Valorem Rate</p>
                  <p className="text-lg font-bold text-[#105B38] mt-0.5 font-mono">
                    {activeProvinceRule.adValoremRate}%
                  </p>
                  <p className="text-[10px] text-[#64748B]">Applied on Suit Valuation</p>
                </div>
                <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">Statutory Exemption</p>
                  <p className="text-lg font-bold text-[#0F172A] mt-0.5 font-mono">
                    &le; PKR {activeProvinceRule.exemptThreshold.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-emerald-700 font-semibold">Court Fee = PKR 0/-</p>
                </div>
                <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">General Maximum Cap</p>
                  <p className="text-lg font-bold text-[#0F172A] mt-0.5 font-mono">
                    PKR {activeProvinceRule.maxCapGeneral.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-[#64748B]">Statutory Fee Ceiling</p>
                </div>
                <div className="p-3.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
                  <p className="text-[10px] font-bold text-[#64748B] uppercase">
                    {selectedProvince === "sindh" ? "SHC Original Side Cap" : "Constitutional Writ Fee"}
                  </p>
                  <p className="text-lg font-bold text-[#0F172A] mt-0.5 font-mono">
                    PKR{" "}
                    {selectedProvince === "sindh"
                      ? `${activeProvinceRule.highCourtOriginalSideCap?.toLocaleString()}/- (>65M)`
                      : `${activeProvinceRule.fixedFees.writPetition.toLocaleString()}/- (Fixed)`}
                  </p>
                  <p className="text-[10px] text-[#64748B]">
                    {selectedProvince === "sindh" ? "Sindh High Court Suit" : "Art. 199 High Court"}
                  </p>
                </div>
              </div>

              {/* Fee Calculator & Plaint Valuation Engine */}
              <div className="p-5 rounded-2xl border border-[#CBD5E1] bg-[#F8FAFC] space-y-5 shadow-xs">
                <div className="border-b border-[#E2E8F0] pb-3">
                  <p className="text-[11px] font-bold text-[#105B38] uppercase tracking-wider">
                    Interactive Valuation Engine
                  </p>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Compute Payable Fee & Determine Pecuniary Trial Court
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Suit Type Dropdown */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#475569]">
                      Nature of Suit / Proceeding
                    </label>
                    <select
                      value={selectedSuitTypeId}
                      onChange={(e) => setSelectedSuitTypeId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-xs font-medium text-[#0F172A] focus:outline-none focus:border-[#105B38] shadow-xs"
                    >
                      {COURT_FEE_SUIT_TYPES.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.feeType === "fixed" ? "Fixed Fee" : st.feeType === "exempt" ? "Exempt" : "Ad Valorem 7.5%"})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-[#64748B]">{activeSuitType.description}</p>
                  </div>

                  {/* Valuation Amount Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#475569]">
                      Claim / Subject Matter Valuation (PKR)
                    </label>
                    <input
                      type="number"
                      value={claimValuation}
                      onChange={(e) => setClaimValuation(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#CBD5E1] text-xs font-mono font-bold text-[#0F172A] focus:outline-none focus:border-[#105B38] shadow-xs"
                    />

                    {/* Quick Valuation Presets */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      {[
                        { label: "20k (Exempt)", val: 20000 },
                        { label: "100k", val: 100000 },
                        { label: "500k", val: 500000 },
                        { label: "2M", val: 2000000 },
                        { label: "10M", val: 10000000 },
                        { label: "70M (SHC Original)", val: 70000000 },
                      ].map((item) => (
                        <button
                          key={item.label}
                          onClick={() => setClaimValuation(item.val)}
                          className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-[#E2E8F0] rounded hover:bg-[#F1F5F9] text-[#475569]"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Calculation Result Card */}
                <div className="p-4 rounded-xl bg-white border border-[#CBD5E1] space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F1F5F9] pb-3">
                    <div>
                      <span className="text-[10px] font-bold text-[#64748B] uppercase">
                        Payable Court Fee
                      </span>
                      <p className="text-2xl font-extrabold text-[#105B38] font-mono">
                        PKR {courtFeeResult.fee.toLocaleString()}/-
                      </p>
                      <p className="text-xs text-[#64748B] mt-0.5 font-mono">
                        {courtFeeResult.breakdownFormula}
                      </p>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1">
                      <span
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-bold border w-fit",
                          courtFeeResult.isExempt
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : courtFeeResult.isCapped
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-[#F8FAFC] text-[#0F172A] border-[#E2E8F0]"
                        )}
                      >
                        {courtFeeResult.isExempt
                          ? "Statutory Exemption (Fee = Rs. 0)"
                          : courtFeeResult.isCapped
                          ? `Capped at Max Statutory Ceiling (PKR ${courtFeeResult.capAmount.toLocaleString()})`
                          : "Standard Ad Valorem Rate"}
                      </span>
                      <span className="text-[11px] text-[#64748B]">
                        Governed by: {courtFeeResult.statutoryReference}
                      </span>
                    </div>
                  </div>

                  {/* Pecuniary Forum Recommendation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase flex items-center gap-1">
                        <Landmark className="w-3 h-3 text-[#105B38]" />
                        Recommended Trial Court (Pecuniary Tier)
                      </p>
                      <p className="font-bold text-[#0F172A]">{courtFeeResult.pecuniaryCourt}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase flex items-center gap-1">
                        <Info className="w-3 h-3 text-[#105B38]" />
                        Statutory Explanation
                      </p>
                      <p className="text-[#334155] leading-relaxed">{courtFeeResult.explanation}</p>
                    </div>
                  </div>

                  {/* Action Hub Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-[#F1F5F9] justify-end flex-wrap">
                    <button
                      onClick={handleCopyPlaintValuationClause}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white border border-[#CBD5E1] text-[#0F172A] hover:bg-[#F8FAFC]"
                    >
                      {copiedFeeClause ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Clause Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[#64748B]" />
                          <span>Copy Plaint Valuation Clause</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleInsertValuationIntoDrafting}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#105B38] text-white hover:bg-[#0D4A2E] transition-colors shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>Insert into Drafting Studio</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Pecuniary Jurisdiction Tiers Table for Province */}
              <div className="space-y-3">
                <p className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                  {activeProvinceRule.provinceName} Pecuniary Jurisdiction Tiers
                </p>

                <div className="rounded-xl border border-[#CBD5E1] overflow-hidden bg-white shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                      <tr>
                        <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                          Court / Judicial Forum
                        </th>
                        <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                          Valuation Range (PKR)
                        </th>
                        <th className="px-4 py-2.5 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">
                          Jurisdiction Rules & Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {activeProvinceRule.pecuniaryTiers.map((tier, idx) => (
                        <tr key={idx} className="hover:bg-[#F8FAFC]">
                          <td className="px-4 py-2.5 font-bold text-[#0F172A]">{tier.courtName}</td>
                          <td className="px-4 py-2.5 font-mono text-[#105B38]">
                            PKR {tier.minValuation.toLocaleString()} —{" "}
                            {tier.maxValuation === null
                              ? "Unlimited"
                              : `PKR ${tier.maxValuation.toLocaleString()}`}
                          </td>
                          <td className="px-4 py-2.5 text-[#64748B]">{tier.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 4: PAKISTANI COURT DIRECTORY
              ================================================================= */}
          {activeTab === "courts" && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-6 space-y-4">
              {/* Directory Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                  <input
                    type="text"
                    value={courtQuery}
                    onChange={(e) => setCourtQuery(e.target.value)}
                    placeholder="Search courts, benches, cities, territorial districts..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#105B38] focus:bg-white shadow-xs"
                  />
                  {courtQuery && (
                    <button
                      onClick={() => setCourtQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Tier Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
                  {[
                    { id: "all" as const, label: "All Tiers" },
                    { id: "apex" as const, label: "Apex Courts" },
                    { id: "high_courts" as const, label: "High Courts & Benches" },
                    { id: "tribunals" as const, label: "Special Tribunals" },
                    { id: "district" as const, label: "District Judiciary" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setCourtTier(t.id)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border",
                        courtTier === t.id
                          ? "bg-[#105B38] text-white border-[#105B38] shadow-xs"
                          : "bg-white text-[#64748B] border-[#CBD5E1] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Court List Container */}
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                {filteredCourts.length === 0 ? (
                  <div className="p-12 text-center space-y-2">
                    <Landmark className="w-8 h-8 text-[#CBD5E1] mx-auto" />
                    <p className="text-xs font-semibold text-[#64748B]">No courts match your search</p>
                    <button
                      onClick={() => {
                        setCourtQuery("");
                        setCourtTier("all");
                      }}
                      className="px-3 py-1.5 text-xs font-semibold text-[#105B38] bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                    >
                      Clear Search Filters
                    </button>
                  </div>
                ) : (
                  filteredCourts.map((court) => {
                    const style = TIER_STYLES[court.tier];
                    return (
                      <div
                        key={court.id}
                        className="p-4 rounded-xl border border-[#CBD5E1] bg-white hover:border-[#105B38]/50 hover:shadow-xs transition-all space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-[#0F172A]">{court.name}</h4>
                              <span
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                                  style.bg,
                                  style.text,
                                  style.border
                                )}
                              >
                                {style.label}
                              </span>
                              {court.establishedYear && (
                                <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded font-mono">
                                  Est. {court.establishedYear}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[#64748B] mt-1">
                              <span className="flex items-center gap-1 font-medium">
                                <MapPin className="w-3.5 h-3.5 text-[#105B38]" />
                                {court.city}, {court.province}
                              </span>
                              {court.address && (
                                <>
                                  <span className="text-[#CBD5E1]">•</span>
                                  <span className="text-[11px] truncate max-w-md">{court.address}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {court.contact && (
                            <div className="flex items-center gap-1 text-xs text-[#64748B] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
                              <Phone className="w-3 h-3 text-[#94A3B8]" />
                              <span className="font-mono text-[11px]">{court.contact}</span>
                            </div>
                          )}
                        </div>

                        {/* Jurisdiction Notes */}
                        <p className="text-xs text-[#334155] leading-relaxed bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                          {court.jurisdictionNotes}
                        </p>

                        {/* Benches / Territorial Coverage */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {court.benches && court.benches.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-[#64748B] uppercase">
                                Divisional / Circuit Benches:
                              </span>
                              <div className="flex items-center gap-1 flex-wrap">
                                {court.benches.map((b, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-medium border border-blue-200"
                                  >
                                    {b}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {court.territorialJurisdiction && court.territorialJurisdiction.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-[#64748B] uppercase">
                                Territorial Coverage:
                              </span>
                              <div className="flex items-center gap-1 flex-wrap">
                                {court.territorialJurisdiction.map((d, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#475569] text-[10px] border border-[#E2E8F0]"
                                  >
                                    {d}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Appellate Authority */}
                        {court.appellateAuthority && (
                          <div className="text-[11px] text-[#64748B] flex items-center gap-1.5 pt-1">
                            <span className="font-semibold">Appellate Forum:</span>
                            <span className="font-mono text-[#105B38] font-bold">
                              {court.appellateAuthority}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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

export default LegalReferenceModal;