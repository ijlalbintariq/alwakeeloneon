import React, { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import {
  Sparkles,
  Plus,
  X,
  FileText,
  Save,
  CheckCircle2,
  PanelRightClose,
  PanelRightOpen,
  LayoutGrid,
  ChevronLeft,
  FolderOpen,
  Database,
  History,
  RefreshCw,
  Clock,
  Trash2,
} from "lucide-react";
import { LegalEditor, type LegalEditorHandle } from "@/components/legal-editor";
import { type LegalPageProfileId } from "@/lib/legal-page-layout";
import { plainTextToTiptapHTML } from "@/experimental/lib/plain-to-tiptap";
import {
  COURT_PETITIONS,
  COMMERCIAL_CONTRACTS,
  ALL_DRAFTING_TEMPLATES,
  type DraftingTemplate,
} from "@/experimental/components/drafting/drafting-data";
import { RightDraftingSidebar } from "@/experimental/components/drafting/RightDraftingSidebar";
import { DraftingLaunchpad } from "@/experimental/components/drafting/DraftingLaunchpad";
import { CourtFeeCalculatorModal } from "@/experimental/components/drafting/CourtFeeCalculatorModal";
import { DraftingExportModal } from "@/experimental/components/drafting/DraftingExportModal";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DocumentTab {
  id: string;
  dbDraftId?: number;
  title: string;
  category: string;
  documentType?: string;
  pageProfileId: LegalPageProfileId;
  htmlContent: string;
  textContent: string;
  lastModified: number;
}

export const PreviewDrafting: React.FC = () => {
  const { toast } = useToast();
  const editorRef = useRef<LegalEditorHandle>(null);

  // ─── Workstation State ───────────────────────────────────────────────────
  // Default to showing the Template Selection Launchpad whenever entering Drafting
  const [showLaunchpad, setShowLaunchpad] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isLightPaperMode, setIsLightPaperMode] = useState(true);
  const [editorWidthMode, setEditorWidthMode] = useState<"wide" | "full" | "court">("wide");

  // Modals
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // ─── Document Tabs Management ─────────────────────────────────────────────
  const [tabs, setTabs] = useState<DocumentTab[]>([
    {
      id: "doc-1",
      title: "Untitled Document",
      category: "General",
      pageProfileId: "court-legal",
      htmlContent: "",
      textContent: "",
      lastModified: Date.now(),
    },
  ]);

  const [activeTabId, setActiveTabId] = useState<string>("doc-1");
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const [activeProfileId, setActiveProfileId] = useState<LegalPageProfileId>(
    activeTab?.pageProfileId || "court-legal"
  );
  const [currentHtml, setCurrentHtml] = useState<string>(activeTab?.htmlContent || "");
  const [currentText, setCurrentText] = useState<string>(activeTab?.textContent || "");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");

  const queryClient = useQueryClient();
  const [isSavedDraftsModalOpen, setIsSavedDraftsModalOpen] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const saveDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Live Saved Drafts Query from PostgreSQL
  const { data: savedDrafts = [], isLoading: isLoadingDrafts } = useQuery<any[]>({
    queryKey: ["/api/drafts"],
    queryFn: async () => {
      const res = await fetch("/api/drafts", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return [];
        throw new Error("Failed to fetch saved drafts");
      }
      return res.json();
    },
  });

  // Auto-load a draft if ?docId= is in the URL (e.g. from Dashboard Activity Stream)
  const docIdLoadedRef = useRef(false);
  useEffect(() => {
    if (docIdLoadedRef.current || !savedDrafts || savedDrafts.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const docId = params.get("docId");
    if (docId && Number(docId) > 0) {
      const draft = savedDrafts.find((d: any) => d.id === Number(docId));
      if (draft) {
        docIdLoadedRef.current = true;
        handleLoadSavedDraft(draft);
        window.history.replaceState({}, "", "/preview/drafting");
      }
    }
  }, [savedDrafts]);

  // Save/Autosave draft to PostgreSQL
  const saveDraftToDb = useCallback(async (tabToSave?: DocumentTab, isManual = false) => {
    const tab = tabToSave || activeTab;
    if (!tab) return;
    const title = tab.title || "Untitled Document";
    const html = tab.htmlContent;
    const text = tab.textContent;

    if (!html.trim() && !text.trim() && title === "Untitled Document") return;

    if (isManual) setIsSavingManual(true);
    setSaveStatus("saving");

    try {
      const payload = {
        title,
        templateType: tab.category || "General",
        content: html || text || "<p></p>",
        status: "draft",
        metadata: {
          textContent: text,
          pageProfileId: tab.pageProfileId,
          category: tab.category,
        },
      };

      let res;
      if (tab.dbDraftId) {
        res = await fetch(`/api/drafts/${tab.dbDraftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error("Draft persistence failed");
      const data = await res.json();
      if (data && data.id && !tab.dbDraftId) {
        setTabs((prev) =>
          prev.map((t) => (t.id === tab.id ? { ...t, dbDraftId: data.id } : t))
        );
      }
      setSaveStatus("saved");
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });

      if (isManual) {
        toast({
          title: "Pleading Draft Saved",
          description: `Persisted "${title}" to PostgreSQL database.`,
        });
      }
    } catch (err: any) {
      console.error("[PreviewDrafting] Save error:", err);
      setSaveStatus("unsaved");
      if (isManual) {
        toast({
          title: "Save Failed",
          description: err.message || "Failed to persist draft to database.",
          variant: "destructive",
        });
      }
    } finally {
      if (isManual) setIsSavingManual(false);
    }
  }, [activeTab, queryClient, toast]);

  // Load draft from PostgreSQL
  const handleLoadSavedDraft = (draft: any) => {
    const newDocId = generateDocId();
    const htmlContent = draft.content?.startsWith("<")
      ? draft.content
      : plainTextToTiptapHTML(draft.content || "");
    const textContent = draft.metadata?.textContent || draft.content?.replace(/<[^>]+>/g, " ") || "";

    const newTab: DocumentTab = {
      id: newDocId,
      dbDraftId: draft.id,
      title: draft.title || "Loaded Pleading",
      category: draft.templateType || draft.metadata?.category || "General",
      pageProfileId: draft.metadata?.pageProfileId || "court-legal",
      htmlContent,
      textContent,
      lastModified: Date.now(),
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newDocId);
    setActiveProfileId(newTab.pageProfileId);
    setCurrentHtml(htmlContent);
    setCurrentText(textContent);
    setShowLaunchpad(false);
    setIsSavedDraftsModalOpen(false);
    setSaveStatus("saved");

    toast({
      title: "Pleading Draft Loaded",
      description: `Loaded "${draft.title}" from PostgreSQL database.`,
    });
  };

  // Delete draft from PostgreSQL
  const handleDeleteSavedDraft = async (draftId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      setTabs((prev) =>
        prev.map((t) => (t.dbDraftId === draftId ? { ...t, dbDraftId: undefined } : t))
      );
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      toast({
        title: "Draft Deleted",
        description: "Draft removed from PostgreSQL database.",
      });
    } catch (err: any) {
      toast({
        title: "Delete Failed",
        description: err.message || "Failed to delete draft.",
        variant: "destructive",
      });
    }
  };

  const generateDocId = () => `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // ─── Incoming Statutory Clause Ingestion ─────────────────────────────────
  const processIncomingDraftingInsert = useCallback(() => {
    try {
      const raw = localStorage.getItem("alwakeelo_drafting_insert");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || !data.clause) return;

      localStorage.removeItem("alwakeelo_drafting_insert");
      setShowLaunchpad(false);

      const clauseHtml = plainTextToTiptapHTML(data.clause);

      setTimeout(() => {
        if (editorRef.current) {
          editorRef.current.insertContent(clauseHtml);
          editorRef.current.focus();
        } else {
          setTabs((prev) =>
            prev.map((t) =>
              t.id === activeTabId
                ? {
                    ...t,
                    htmlContent: (t.htmlContent ? t.htmlContent + "<p></p>" : "") + clauseHtml,
                    textContent: (t.textContent ? t.textContent + "\n\n" : "") + data.clause,
                    lastModified: Date.now(),
                  }
                : t
            )
          );
          setCurrentHtml((prev) => (prev ? prev + "<p></p>" : "") + clauseHtml);
          setCurrentText((prev) => (prev ? prev + "\n\n" : "") + data.clause);
        }

        toast({
          title: "Statutory Clause Inserted",
          description: data.title
            ? `Affixed ${data.statute || ""} ${data.section || ""}: "${data.title}" into drafting canvas.`
            : "Statutory clause inserted into drafting canvas.",
        });
      }, 80);
    } catch (err) {
      console.error("Failed to process incoming drafting insert", err);
    }
  }, [activeTabId, toast]);

  useEffect(() => {
    processIncomingDraftingInsert();

    const handleCustomInsert = () => {
      processIncomingDraftingInsert();
    };

    window.addEventListener("alwakeelo-drafting-insert", handleCustomInsert);
    window.addEventListener("storage", handleCustomInsert);
    return () => {
      window.removeEventListener("alwakeelo-drafting-insert", handleCustomInsert);
      window.removeEventListener("storage", handleCustomInsert);
    };
  }, [processIncomingDraftingInsert]);

  // Keep state synced when switching tabs
  const handleSwitchTab = (tabId: string) => {
    if (tabId === activeTabId) return;

    let latestHtml = currentHtml;
    let latestText = currentText;
    if (editorRef.current) {
      latestHtml = editorRef.current.getHTML();
      latestText = editorRef.current.getText();
    }

    const target = tabs.find((t) => t.id === tabId);
    if (!target) return;

    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, htmlContent: latestHtml, textContent: latestText, lastModified: Date.now() }
          : t
      )
    );

    setActiveTabId(tabId);
    setActiveProfileId(target.pageProfileId);
    setCurrentHtml(target.htmlContent);
    setCurrentText(target.textContent);
    setShowLaunchpad(false);
  };

  const handleAddNewTab = () => {
    if (editorRef.current) {
      const html = editorRef.current.getHTML();
      const text = editorRef.current.getText();
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, htmlContent: html, textContent: text, lastModified: Date.now() }
            : t
        )
      );
    }
    setShowLaunchpad(true);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length <= 1) {
      toast({
        title: "Cannot Close Only Tab",
        description: "Keep at least one drafting canvas open.",
        variant: "destructive",
      });
      return;
    }

    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    const remainingTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(remainingTabs);

    if (activeTabId === tabId) {
      const nextActiveIndex = Math.min(tabIndex, remainingTabs.length - 1);
      const nextActiveTab = remainingTabs[nextActiveIndex];
      setActiveTabId(nextActiveTab.id);
      setActiveProfileId(nextActiveTab.pageProfileId);
      setCurrentHtml(nextActiveTab.htmlContent);
      setCurrentText(nextActiveTab.textContent);
    }
  };

  const handleProfileChange = (profileId: LegalPageProfileId) => {
    setActiveProfileId(profileId);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, pageProfileId: profileId, lastModified: Date.now() }
          : t
      )
    );
  };

  // Editor update callback with debounced PostgreSQL persistence
  const handleEditorUpdate = useCallback(
    (html: string, text: string) => {
      setCurrentHtml(html);
      setCurrentText(text);
      setSaveStatus("unsaved");

      setTabs((prev) => {
        const updated = prev.map((t) =>
          t.id === activeTabId
            ? { ...t, htmlContent: html, textContent: text, lastModified: Date.now() }
            : t
        );
        return updated;
      });

      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
      }
      saveDebounceTimerRef.current = setTimeout(() => {
        const currentTab = tabs.find((t) => t.id === activeTabId);
        if (currentTab) {
          saveDraftToDb({
            ...currentTab,
            htmlContent: html,
            textContent: text,
          }, false);
        }
      }, 1500);
    },
    [activeTabId, tabs, saveDraftToDb]
  );

  // ─── Template ID → Backend documentType mapping ────────────────────────────
  const TEMPLATE_TO_DOC_TYPE: Record<string, string> = {
    writ_199: "high-court-writ-petition",
    bail_497: "sessions-bail-application",
    bail_498_bba: "sessions-pre-arrest-bail",
    civil_plaint_injunction: "civil-suit-plaint",
    stay_order39: "temporary-injunction-application",
    execution_order21: "execution-application",
    criminal_misc_22a: "criminal-misc-application",
    sessions_crim_appeal: "sessions-criminal-appeal",
    high_court_appeal_rfa: "high-court-civil-appeal",
    supreme_court_cpla: "supreme-court-cpla",
    family_suit_khula: "family-suit-petition",
    guardians_custody_s25: "family-suit-petition",
    vakalatnama_high_court: "power-of-attorney",
    affidavit_oath_comm: "affidavit",
    notice_489f_cheque: "legal-notice",
    suit_order37_summary: "recovery-suit",
  };

  const handleSelectTemplateFromLaunchpad = (template: DraftingTemplate) => {
    const formattedHtml = plainTextToTiptapHTML(template.body);
    const newDocId = generateDocId();
    const newTab: DocumentTab = {
      id: newDocId,
      title: template.title,
      category: template.category,
      pageProfileId: "court-legal",
      htmlContent: formattedHtml,
      textContent: template.body,
      lastModified: Date.now(),
      documentType: TEMPLATE_TO_DOC_TYPE[template.id] || undefined,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newDocId);
    setActiveProfileId("court-legal");
    setCurrentHtml(formattedHtml);
    setCurrentText(template.body);
    setShowLaunchpad(false);
    toast({
      title: "Template Initialized",
      description: `Loaded "${template.title}" into drafting studio.`,
    });
  };

  const handleStartWithAiBrief = async (brief: {
    forum: string;
    matterTitle: string;
    reliefType: string;
    facts: string;
  }) => {
    let generatedDraftText = "";
    try {
      const res = await fetch("/api/ai/drafting/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief })
      });
      if (!res.ok) throw new Error("Failed to generate draft");
      const data = await res.json();
      generatedDraftText = data.textContent;
    } catch (err) {
      console.error(err);
      toast({
        title: "Generation Failed",
        description: "There was an error generating the pleading.",
        variant: "destructive"
      });
      return;
    }

    const formattedHtml = plainTextToTiptapHTML(generatedDraftText);
    const newDocId = generateDocId();
    const newTab: DocumentTab = {
      id: newDocId,
      title: brief.matterTitle || brief.reliefType,
      category: brief.forum.includes("High Court") ? "High Court" : "Court Filings",
      pageProfileId: "court-legal",
      htmlContent: formattedHtml,
      textContent: generatedDraftText,
      lastModified: Date.now(),
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newDocId);
    setActiveProfileId("court-legal");
    setCurrentHtml(formattedHtml);
    setCurrentText(generatedDraftText);
    setShowLaunchpad(false);
    toast({
      title: "AI Pleading Formulated",
      description: `Initialized draft for "${brief.matterTitle || brief.reliefType}".`,
    });
  };

  const handleStartBlank = () => {
    const newDocId = generateDocId();
    const newTab: DocumentTab = {
      id: newDocId,
      title: `Untitled Pleading ${tabs.length + 1}`,
      category: "General",
      pageProfileId: "court-legal",
      htmlContent: "<p></p>",
      textContent: "",
      lastModified: Date.now(),
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newDocId);
    setActiveProfileId("court-legal");
    setCurrentHtml("<p></p>");
    setCurrentText("");
    setShowLaunchpad(false);
  };

  // ─── Actions from Right Sidebar ──────────────────────────────────────────

  const handleLoadTemplate = (template: DraftingTemplate) => {
    const formattedHtml = plainTextToTiptapHTML(template.body);
    if (editorRef.current) {
      editorRef.current.setContent(formattedHtml);
      editorRef.current.focus();
    }
    setCurrentHtml(formattedHtml);
    setCurrentText(template.body);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              title: template.title,
              category: template.category,
              documentType: template.id,
              htmlContent: formattedHtml,
              textContent: template.body,
              lastModified: Date.now(),
            }
          : t
      )
    );
    toast({
      title: "Template Loaded",
      description: `"${template.title}" loaded into canvas.`,
    });
  };

  const handleInsertTemplateAtCursor = (template: DraftingTemplate) => {
    const formattedHtml = plainTextToTiptapHTML(template.body);
    if (editorRef.current) {
      editorRef.current.insertContent(formattedHtml);
      editorRef.current.focus();
    }
    toast({
      title: "Template Inserted",
      description: `Inserted "${template.title}" at cursor.`,
    });
  };

  const handleInsertClause = (clauseText: string, title?: string) => {
    const formattedHtml = plainTextToTiptapHTML(clauseText);
    if (editorRef.current) {
      editorRef.current.insertContent(formattedHtml);
      editorRef.current.focus();
    }
    toast({
      title: "Clause Inserted",
      description: title ? `Added ${title}.` : "Clause inserted at cursor position.",
    });
  };

  const handleInsertValuationClause = (clauseText: string) => {
    const formattedHtml = plainTextToTiptapHTML(clauseText);
    if (editorRef.current) {
      editorRef.current.insertContent(formattedHtml);
      editorRef.current.focus();
    }
    toast({
      title: "Court Fee Clause Inserted",
      description: "Affixed statutory suit valuation and court fees clause.",
    });
  };

  const handleReplaceDocument = (content: string) => {
    const formattedHtml = plainTextToTiptapHTML(content);
    if (editorRef.current) {
      editorRef.current.setContent(formattedHtml);
      editorRef.current.focus();
    }
    setCurrentHtml(formattedHtml);
    setCurrentText(content);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? {
              ...t,
              htmlContent: formattedHtml,
              textContent: content,
              lastModified: Date.now(),
            }
          : t
      )
    );
    toast({
      title: "Canvas Replaced",
      description: "Updated drafting canvas with generated court pleading.",
    });
  };

  // Metrics computation
  const wordCount = currentText.trim() ? currentText.trim().split(/\s+/).length : 0;
  const characterCount = currentText.length;
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 320));
  const estimatedReadingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <PreviewShell standalone={false} noPadding>
      {showLaunchpad ? (
        <DraftingLaunchpad
          onSelectTemplate={handleSelectTemplateFromLaunchpad}
          onStartWithAiBrief={handleStartWithAiBrief}
          onStartBlank={handleStartBlank}
          onBackToEditor={tabs.length > 0 ? () => setShowLaunchpad(false) : undefined}
          activeTabTitle={activeTab?.title}
        />
      ) : (
        <div className="flex h-full w-full overflow-hidden relative bg-white dark:bg-[#131E2E]">
          {/* ── Main Full-Width Writing Canvas ─────────────── */}
          <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white dark:bg-[#131E2E]">
            {/* Document Tabs Bar (Clean & Focused) */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-white dark:bg-[#131E2E] border-b border-[#E2E8F0] dark:border-[#1E2D44] shrink-0 h-11">
              {/* Tabs List */}
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pr-2 py-0.5">
                {tabs.map((tab) => {
                  const isActive = tab.id === activeTabId;
                  return (
                    <div
                      key={tab.id}
                      onClick={() => handleSwitchTab(tab.id)}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all select-none",
                        isActive
                          ? "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#0F172A] dark:text-[#F8FAFC] border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs"
                          : "bg-transparent text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border-transparent hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
                      )}
                    >
                      <FileText
                        className={cn("w-3.5 h-3.5", isActive ? "text-[#105B38]" : "text-[#94A3B8] dark:text-[#475569]")}
                      />
                      <span className="max-w-[150px] truncate">{tab.title}</span>
                      <button
                        type="button"
                        onClick={(e) => handleCloseTab(tab.id, e)}
                        className="opacity-40 group-hover:opacity-100 hover:text-rose-600 dark:text-rose-400 rounded transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}

                {/* Add New Tab / Open Template Launchpad Button */}
                <button
                  type="button"
                  onClick={handleAddNewTab}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#105B38] border-dashed border-[#CBD5E1]"
                  title="Select a Template or Start New Pleading"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Pleading</span>
                </button>

                {/* Saved Drafts (PostgreSQL) Button */}
                <button
                  type="button"
                  onClick={() => setIsSavedDraftsModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#105B38] border-[#CBD5E1]"
                  title="View and load saved pleadings from PostgreSQL database"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Saved Drafts ({Array.isArray(savedDrafts) ? savedDrafts.length : 0})</span>
                </button>

                {/* Save Draft Button */}
                <button
                  type="button"
                  onClick={() => saveDraftToDb(activeTab, true)}
                  disabled={isSavingManual}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] border-[#CBD5E1]"
                  title="Persist current active pleading to PostgreSQL database"
                >
                  <Save className="w-3.5 h-3.5 text-[#105B38]" />
                  <span>{isSavingManual ? "Saving..." : "Save"}</span>
                </button>
              </div>

              {/* Right Controls: Auto-save status & Toggle Right Sidebar */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                  {saveStatus === "saved" ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">Saved to DB</span>
                    </>
                  ) : saveStatus === "saving" ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-[#105B38] animate-spin" />
                      <span className="text-[11px] text-[#105B38] font-medium">Autosaving...</span>
                    </>
                  ) : (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Unsaved</span>
                  )}
                </div>

                {/* Right Sidebar Trigger */}
                <button
                  type="button"
                  onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-xs",
                    isRightSidebarOpen
                      ? "bg-[#105B38] text-white border-[#105B38]"
                      : "bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100"
                  )}
                  title="Toggle AI Drafter & Legal Tools (Right Sidebar)"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI & Tools</span>
                  {isRightSidebarOpen ? (
                    <PanelRightClose className="w-3.5 h-3.5 ml-0.5" />
                  ) : (
                    <PanelRightOpen className="w-3.5 h-3.5 ml-0.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Virtual Court Sheet Canvas Area (100% Unobstructed Writing Space) */}
            <div
              data-editor-width={editorWidthMode}
              className={cn(
                "flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 flex justify-center custom-scrollbar",
                isLightPaperMode ? "bg-[#F8FAFC] dark:bg-[#0B131E]" : "bg-[#0F172A]"
              )}
            >
              <div className="w-full flex flex-col items-center">
                <LegalEditor
                  key={activeTabId}
                  ref={editorRef}
                  initialContent={activeTab.htmlContent}
                  pageProfileId={activeProfileId}
                  onPageProfileChange={handleProfileChange}
                  onUpdate={handleEditorUpdate}
                  className="w-full shadow-lg rounded-sm"
                />
              </div>
            </div>

            {/* Bottom Minimal Status Bar */}
            <div className="px-4 py-1.5 bg-white dark:bg-[#131E2E] border-t border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] shrink-0 select-none">
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-[#0F172A] dark:text-[#F8FAFC]">{wordCount} words</span>
                <span className="text-[#CBD5E1]">•</span>
                <span className="font-mono text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">{characterCount} chars</span>
                <span className="text-[#CBD5E1]">•</span>
                <span className="font-mono text-[#105B38] font-bold">~{estimatedPages} Court Page(s)</span>
                <span className="text-[#CBD5E1] hidden sm:inline">•</span>
                <span className="hidden sm:inline text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                  {estimatedReadingTime} min read
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] font-serif">
                  Times New Roman 13pt · Court Legal 8.5×14&quot;
                </span>
              </div>
            </div>
          </main>

          {/* ── Right-Side Panel: AI Drafter Chat, Templates, Clauses & Tools ── */}
          <RightDraftingSidebar
            isOpen={isRightSidebarOpen}
            onToggle={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            currentDocumentText={currentText}
            onInsertClause={handleInsertClause}
            onReplaceDocument={handleReplaceDocument}
            onLoadTemplate={handleLoadTemplate}
            onInsertTemplateAtCursor={handleInsertTemplateAtCursor}
            onOpenFeeModal={() => setIsFeeModalOpen(true)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            activeProfileId={activeProfileId}
            activeDocumentType={activeTab?.documentType}
            onChangeProfileId={handleProfileChange}
            editorWidthMode={editorWidthMode}
            onChangeWidthMode={setEditorWidthMode}
            isLightPaperMode={isLightPaperMode}
            onToggleLightPaperMode={() => setIsLightPaperMode(!isLightPaperMode)}
          />
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      <CourtFeeCalculatorModal
        isOpen={isFeeModalOpen}
        onClose={() => setIsFeeModalOpen(false)}
        onInsertValuationClause={handleInsertValuationClause}
      />

      <DraftingExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        documentTitle={activeTab?.title || "Legal_Pleading"}
        documentHtml={editorRef.current ? editorRef.current.getPaginatedHTML() || currentHtml : currentHtml}
        documentText={editorRef.current ? editorRef.current.getText() || currentText : currentText}
        pageProfileId={activeProfileId}
      />

      {/* ── Saved Drafts Modal (PostgreSQL) ─────────────────────────────── */}
      {isSavedDraftsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xl max-w-2xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E2D44] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EBF5F0] dark:bg-[#105B38]/20 border border-[#A3D4BC] dark:border-[#10B981]/30 flex items-center justify-center text-[#105B38]">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Saved Pleading Drafts</h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">PostgreSQL live cloud persistence across workstation tabs</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSavedDraftsModalOpen(false)}
                className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {isLoadingDrafts ? (
                <div className="py-12 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#105B38]" />
                  <span>Loading saved pleading drafts...</span>
                </div>
              ) : !Array.isArray(savedDrafts) || savedDrafts.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] space-y-2">
                  <History className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-semibold text-slate-700 dark:text-slate-400">No saved drafts found in database</p>
                  <p className="text-slate-500">Draft or paste any court pleading to automatically persist to database.</p>
                </div>
              ) : (
                savedDrafts.map((draft: any) => (
                  <div
                    key={draft.id}
                    className={cn(
                      "p-4 rounded-xl border transition-all flex items-center justify-between gap-3",
                      activeTab.dbDraftId === draft.id
                        ? "bg-emerald-50/6 dark:bg-emerald-500/100 dark:bg-emerald-500/10 border-[#105B38] ring-1 ring-[#105B38]"
                        : "bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-slate-100/80 border-[#E2E8F0] dark:border-[#1E2D44]"
                    )}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                          {draft.title || "Untitled Pleading"}
                        </h4>
                        {activeTab.dbDraftId === draft.id && (
                          <span className="px-2 py-0.5 rounded-md bg-[#105B38] text-white text-[10px] font-bold">
                            Active in Editor
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[10px] font-medium text-slate-600 dark:text-slate-400">
                          {draft.templateType || "Pleading"}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] line-clamp-1">
                        {typeof draft.content === "string"
                          ? draft.content.replace(/<[^>]+>/g, " ").slice(0, 120)
                          : "Pleading content"}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {draft.updatedAt ? new Date(draft.updatedAt).toLocaleString("en-PK") : "Recent"}
                        </span>
                        <span>•</span>
                        <span>Draft ID #{draft.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadSavedDraft(draft)}
                        className="px-3 py-1.5 rounded-lg bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-colors"
                      >
                        Load in Tab
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSavedDraft(draft.id, e)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:bg-rose-500/10 transition-colors"
                        title="Delete from PostgreSQL"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E2E8F0] dark:border-[#1E2D44] shrink-0 text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              <span>Total Saved: {Array.isArray(savedDrafts) ? savedDrafts.length : 0}</span>
              <button
                type="button"
                onClick={() => setIsSavedDraftsModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </PreviewShell>
  );
};

export default PreviewDrafting;
