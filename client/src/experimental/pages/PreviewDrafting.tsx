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
import { resolveLegalPageProfile, type LegalPageProfileId } from "@/lib/legal-page-layout";
import { isHTMLContent } from "@/lib/plain-to-tiptap";
import { DraftSaveQueue, draftFingerprint, hasDraftContent, normalizeDraftingTabs, type DocumentTab } from "@/experimental/lib/drafting-persistence";
import { plainTextToTiptapHTML } from "@/experimental/lib/plain-to-tiptap";
import {
  COURT_PETITIONS,
  COMMERCIAL_CONTRACTS,
  ALL_DRAFTING_TEMPLATES,
  type DraftingTemplate,
} from "@/experimental/components/drafting/drafting-data";
import { RightDraftingSidebar, type ChatMessage } from "@/experimental/components/drafting/RightDraftingSidebar";
import { DraftingLaunchpad } from "@/experimental/components/drafting/DraftingLaunchpad";
import { CourtFeeCalculatorModal } from "@/experimental/components/drafting/CourtFeeCalculatorModal";
import { DraftingExportModal } from "@/experimental/components/drafting/DraftingExportModal";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

const generateDocId = () => `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const TABS_STORAGE_KEY = "alwakeelo_drafting_tabs_v1";

function loadStoredTabs(storageKey: string): { tabs: DocumentTab[]; activeTabId: string } | null {
  try {
    const raw = localStorage.getItem(storageKey)
      ?? (storageKey.endsWith(":guest") ? null : localStorage.getItem(TABS_STORAGE_KEY));
    if (!raw) return null;
    return normalizeDraftingTabs(JSON.parse(raw));
  } catch {
    return null;
  }
}

function createBlankTab(index: number): DocumentTab {
  return {
    id: generateDocId(),
    title: `Untitled Pleading ${index}`,
    category: "General",
    pageProfileId: "court-legal",
    htmlContent: "<p></p>",
    textContent: "",
    lastModified: Date.now(),
  };
}

const DraftingWorkspace: React.FC<{ storageKey: string }> = ({ storageKey }) => {
  const { toast } = useToast();
  const editorRef = useRef<LegalEditorHandle>(null);
  const chatByTabRef = useRef(new Map<string, ChatMessage[]>());

  // ─── Workstation State ───────────────────────────────────────────────────
  // Default to showing the Template Selection Launchpad whenever entering Drafting
  const [showLaunchpad, setShowLaunchpad] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  const [isLightPaperMode, setIsLightPaperMode] = useState(true);
  const [editorWidthMode, setEditorWidthMode] = useState<"wide" | "full" | "court">("wide");

  // Modals
  const [isFeeModalOpen, setIsFeeModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // ─── Document Tabs Management ─────────────────────────────────────────────
  const [storedWorkspace] = useState(() => loadStoredTabs(storageKey));
  const [tabs, setTabs] = useState<DocumentTab[]>(
    () =>
      storedWorkspace?.tabs ?? [
        {
          id: "doc-1",
          title: "Untitled Document",
          category: "General",
          pageProfileId: "court-legal",
          htmlContent: "",
          textContent: "",
          lastModified: Date.now(),
        },
      ],
  );

  const [activeTabId, setActiveTabId] = useState<string>(() => storedWorkspace?.activeTabId ?? "doc-1");
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const [activeProfileId, setActiveProfileId] = useState<LegalPageProfileId>(
    activeTab?.pageProfileId || "court-legal"
  );
  const [currentHtml, setCurrentHtml] = useState<string>(activeTab?.htmlContent || "");
  const [currentText, setCurrentText] = useState<string>(activeTab?.textContent || "");
  const [savedFingerprints, setSavedFingerprints] = useState<Record<string, string>>({});
  const [savingTabIds, setSavingTabIds] = useState<Set<string>>(new Set());
  const saveStatus = savingTabIds.has(activeTab.id) ? "saving"
    : savedFingerprints[activeTab.id] === draftFingerprint(activeTab) ? "saved" : "unsaved";
  const [docVersions, setDocVersions] = useState<Record<string, number>>({});
  const docVersion = docVersions[activeTabId] ?? 1;
  const setDocVersion = useCallback((update: (version: number) => number) => {
    setDocVersions((prev) => ({ ...prev, [activeTabId]: update(prev[activeTabId] ?? 1) }));
  }, [activeTabId]);
  const [lockedSelection, setLockedSelection] = useState<{
    text: string;
    from: number;
    to: number;
    docVersion: number;
  } | null>(null);
  const [liveSelection, setLiveSelection] = useState<{
    text: string;
    from: number;
    to: number;
  } | null>(null);
  const [triggerPrompt, setTriggerPrompt] = useState<{ prompt: string; timestamp: number } | null>(null);

  const queryClient = useQueryClient();
  const [isSavedDraftsModalOpen, setIsSavedDraftsModalOpen] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const saveTimersRef = useRef(new Map<string, { fingerprint: string; timer: ReturnType<typeof setTimeout> }>());
  const deletingTabsRef = useRef(new Set<string>());
  const dbDraftIdsRef = useRef<Record<string, number>>({});
  const workspaceRef = useRef({ tabs, activeTabId });
  workspaceRef.current = { tabs, activeTabId };

  // Keep a local recovery copy immediately, including before a cloud save completes.
  useEffect(() => {
    const persistLocal = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(workspaceRef.current));
        if (!storageKey.endsWith(":guest")) localStorage.removeItem(TABS_STORAGE_KEY);
      } catch {
        // Quota exceeded — drafts still autosave to the database.
      }
    };
    persistLocal();
    window.addEventListener("pagehide", persistLocal);
    return () => window.removeEventListener("pagehide", persistLocal);
  }, [tabs, activeTabId, storageKey]);

  // Live Saved Drafts Query from PostgreSQL
  const { data: savedDrafts = [], isLoading: isLoadingDrafts } = useQuery<any[]>({
    queryKey: ["/api/drafts", storageKey],
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
  const loadedDocIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (docIdLoadedRef.current || !savedDrafts || savedDrafts.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const docId = params.get("docId");
    if (docId && Number(docId) > 0) {
      const draft = savedDrafts.find((d: any) => d.id === Number(docId));
      if (draft) {
        docIdLoadedRef.current = true;
        loadedDocIdRef.current = draft.id;
        handleLoadSavedDraft(draft);
        const url = new URL(window.location.href);
        url.searchParams.delete("docId");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    }
  }, [savedDrafts]);

  // URL citations must reach the tab state even while the launchpad hides the editor.
  const citeInsertedRef = useRef(false);
  useEffect(() => {
    if (citeInsertedRef.current) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("docId")) return;
    if (loadedDocIdRef.current && activeTab.dbDraftId !== loadedDocIdRef.current) return;
    const cite = url.searchParams.get("cite")?.trim();
    if (!cite) return;
    citeInsertedRef.current = true;
    url.searchParams.delete("cite");
    window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    const clauseHtml = plainTextToTiptapHTML(cite);
    const tab = workspaceRef.current.tabs.find((t) => t.id === activeTabId);
    if (!tab) return;
    const html = tab.htmlContent + clauseHtml;
    const text = [tab.textContent, cite].filter(Boolean).join("\n\n");
    setTabs((prev) => prev.map((t) => t.id === tab.id
      ? { ...t, htmlContent: html, textContent: text, lastModified: Date.now() } : t));
    setCurrentHtml(html);
    setCurrentText(text);
    setShowLaunchpad(false);
    toast({ title: "Citation Inserted", description: `"${cite}" has been inserted into the active document.` });
  }, [activeTabId, savedDrafts, toast]);

  const [saveQueue] = useState(() => new DraftSaveQueue<DocumentTab>(async (tab) => {
    const dbDraftId = dbDraftIdsRef.current[tab.id] ?? tab.dbDraftId;
    const payload = {
      title: tab.title.trim() || "Untitled Document",
      templateType: tab.category || "General",
      content: tab.htmlContent || plainTextToTiptapHTML(tab.textContent) || "<p></p>",
      status: "draft",
      metadata: {
        textContent: tab.textContent,
        pageProfileId: tab.pageProfileId,
        category: tab.category,
        documentType: tab.documentType,
      },
    };
    const res = await fetch(dbDraftId ? `/api/drafts/${dbDraftId}` : "/api/drafts", {
      method: dbDraftId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.message || "Draft could not be saved. Your local copy is retained.");
    }
    const data = await res.json();
    if (!Number.isSafeInteger(data.id) || data.id <= 0) throw new Error("Save returned an invalid draft ID.");
    dbDraftIdsRef.current[tab.id] = data.id;
    setTabs((prev) => prev.map((t) => t.id === tab.id ? { ...t, dbDraftId: data.id } : t));
    setSavedFingerprints((prev) => ({ ...prev, [tab.id]: draftFingerprint(tab) }));
    void queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
  }));

  const saveDraftToDb = useCallback(async (tab: DocumentTab, isManual = false) => {
    if (deletingTabsRef.current.has(tab.id)) return false;
    if (!isManual && !hasDraftContent(tab) && !tab.dbDraftId && !dbDraftIdsRef.current[tab.id]) return true;
    const scheduled = saveTimersRef.current.get(tab.id);
    if (scheduled) clearTimeout(scheduled.timer);
    saveTimersRef.current.delete(tab.id);
    if (isManual) setIsSavingManual(true);
    setSavingTabIds((prev) => new Set(prev).add(tab.id));
    try {
      await saveQueue.save(tab);
      if (isManual) toast({ title: "Draft Saved", description: `Saved "${tab.title}".` });
      return true;
    } catch (err) {
      if (isManual) toast({
        title: "Save Failed",
        description: err instanceof Error ? err.message : "Could not save the draft.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSavingTabIds((prev) => { const next = new Set(prev); next.delete(tab.id); return next; });
      if (isManual) setIsSavingManual(false);
    }
  }, [saveQueue, toast]);

  // All document changes participate, including templates, AI replacements and paper settings.
  useEffect(() => {
    for (const [id, entry] of saveTimersRef.current) {
      if (!tabs.some((tab) => tab.id === id) || deletingTabsRef.current.has(id)) {
        clearTimeout(entry.timer);
        saveTimersRef.current.delete(id);
      }
    }
    for (const tab of tabs) {
      if (deletingTabsRef.current.has(tab.id)) continue;
      if (!hasDraftContent(tab) && !tab.dbDraftId) continue;
      const fingerprint = draftFingerprint(tab);
      if (fingerprint === savedFingerprints[tab.id]) continue;
      const scheduled = saveTimersRef.current.get(tab.id);
      if (scheduled?.fingerprint === fingerprint) continue;
      if (scheduled) clearTimeout(scheduled.timer);
      const timer = setTimeout(() => { void saveDraftToDb(tab); }, 1500);
      saveTimersRef.current.set(tab.id, { fingerprint, timer });
    }
  }, [tabs, savedFingerprints, saveDraftToDb]);

  useEffect(() => () => {
    for (const entry of saveTimersRef.current.values()) clearTimeout(entry.timer);
    saveTimersRef.current.clear();
  }, []);

  // Load draft from PostgreSQL
  const handleLoadSavedDraft = (draft: any) => {
    // Already open? Focus that tab instead of opening a second one that would
    // autosave over the first.
    const existing = tabs.find((t) => t.dbDraftId === draft.id);
    if (existing) {
      handleSwitchTab(existing.id);
      setShowLaunchpad(false);
      setIsSavedDraftsModalOpen(false);
      return;
    }
    const newDocId = generateDocId();
    const htmlContent = isHTMLContent(draft.content || "")
      ? draft.content
      : plainTextToTiptapHTML(draft.content || "");
    const textContent = draft.metadata?.textContent || draft.content?.replace(/<[^>]+>/g, " ") || "";

    const newTab: DocumentTab = {
      id: newDocId,
      dbDraftId: draft.id,
      title: draft.title || "Loaded Pleading",
      category: draft.templateType || draft.metadata?.category || "General",
      pageProfileId: resolveLegalPageProfile(draft.metadata?.pageProfileId).id,
      documentType: draft.metadata?.documentType,
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
    setSavedFingerprints((prev) => ({ ...prev, [newDocId]: draftFingerprint(newTab) }));

    toast({
      title: "Pleading Draft Loaded",
      description: `Loaded "${draft.title}" from PostgreSQL database.`,
    });
  };

  // Delete draft from PostgreSQL
  const handleDeleteSavedDraft = async (draftId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const affectedTabs = workspaceRef.current.tabs.filter((tab) => (dbDraftIdsRef.current[tab.id] ?? tab.dbDraftId) === draftId);
    for (const tab of affectedTabs) {
      deletingTabsRef.current.add(tab.id);
      const scheduled = saveTimersRef.current.get(tab.id);
      if (scheduled) clearTimeout(scheduled.timer);
      saveTimersRef.current.delete(tab.id);
    }
    try {
      await Promise.all(affectedTabs.map((tab) => saveQueue.idle(tab.id).catch(() => {})));
      const res = await fetch(`/api/drafts/${draftId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed");
      // Close any tab bound to the deleted row. Clearing dbDraftId instead would
      // make the next autosave POST the draft straight back.
      const remaining = workspaceRef.current.tabs.filter((t) => !affectedTabs.some((tab) => tab.id === t.id));
      const nextTabs = remaining.length ? remaining : [createBlankTab(1)];
      setTabs(nextTabs);
      if (!nextTabs.some((t) => t.id === workspaceRef.current.activeTabId)) {
        const next = nextTabs[0];
        setActiveTabId(next.id);
        setActiveProfileId(next.pageProfileId);
        setCurrentHtml(next.htmlContent);
        setCurrentText(next.textContent);
      }
      for (const tab of affectedTabs) delete dbDraftIdsRef.current[tab.id];
      queryClient.invalidateQueries({ queryKey: ["/api/drafts"] });
      toast({
        title: "Draft Deleted",
        description: "Draft removed from PostgreSQL database.",
      });
    } catch (err: any) {
      for (const tab of affectedTabs) deletingTabsRef.current.delete(tab.id);
      toast({
        title: "Delete Failed",
        description: err.message || "Failed to delete draft.",
        variant: "destructive",
      });
    }
  };

  // ─── Incoming Statutory Clause Ingestion ─────────────────────────────────
  const processIncomingDraftingInsert = useCallback(() => {
    try {
      const raw = localStorage.getItem("alwakeelo_drafting_insert");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (!data || typeof data.clause !== "string" || !data.clause.trim()) return;
      localStorage.removeItem("alwakeelo_drafting_insert");
      const clauseHtml = plainTextToTiptapHTML(data.clause);
      if (editorRef.current) {
        editorRef.current.insertContent(clauseHtml);
        editorRef.current.focus();
      } else {
        const tab = workspaceRef.current.tabs.find((t) => t.id === activeTabId);
        if (!tab) return;
        const html = tab.htmlContent + clauseHtml;
        const text = [tab.textContent, data.clause].filter(Boolean).join("\n\n");
        setTabs((prev) => prev.map((t) => t.id === tab.id
          ? { ...t, htmlContent: html, textContent: text, lastModified: Date.now() } : t));
        setCurrentHtml(html);
        setCurrentText(text);
      }
      setShowLaunchpad(false);
      toast({ title: "Clause Inserted", description: "Added the clause to the active document." });
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

    const outgoing = tabs.find((t) => t.id === activeTabId);
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, htmlContent: latestHtml, textContent: latestText, lastModified: Date.now() }
          : t
      )
    );
    // The debounce timer only ever targets the active tab, so flush the outgoing
    // one now or its last edits never reach the database.
    if (outgoing) {
      saveDraftToDb({ ...outgoing, htmlContent: latestHtml, textContent: latestText }, false);
    }

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
      const outgoing = tabs.find((t) => t.id === activeTabId);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, htmlContent: html, textContent: text, lastModified: Date.now() }
            : t
        )
      );
      if (outgoing) {
        saveDraftToDb({ ...outgoing, htmlContent: html, textContent: text }, false);
      }
    }
    setShowLaunchpad(true);
  };

  const handleCloseTab = async (tabId: string, e: React.MouseEvent) => {
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

    await saveQueue.idle(tabId).catch(() => {});
    let closing = workspaceRef.current.tabs.find((tab) => tab.id === tabId);
    if (!closing) return;
    while (hasDraftContent(closing) || closing.dbDraftId || dbDraftIdsRef.current[tabId]) {
      if (!await saveDraftToDb(closing)) {
        toast({ title: "Draft Kept Open", description: "The draft could not be saved. Retry saving before closing it.", variant: "destructive" });
        return;
      }
      const latest = workspaceRef.current.tabs.find((tab) => tab.id === tabId);
      if (!latest || draftFingerprint(latest) === draftFingerprint(closing)) break;
      closing = latest;
    }
    const remainingTabs = workspaceRef.current.tabs.filter((t) => t.id !== tabId);
    if (remainingTabs.length === 0) return;
    setTabs(remainingTabs);

    if (workspaceRef.current.activeTabId === tabId) {
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

  const handleEditorUpdate = useCallback((html: string, text: string) => {
    setCurrentHtml(html);
    setCurrentText(text);
    setDocVersion((v) => v + 1);
    setTabs((prev) => prev.map((tab) => tab.id === activeTabId
      ? { ...tab, htmlContent: html, textContent: text, lastModified: Date.now() }
      : tab));
  }, [activeTabId, setDocVersion]);

  // ─── Template ID → Backend documentType mapping ────────────────────────────
  // Every value here MUST exist in LEGAL_DRAFTING_DOC_TYPES (server/routes.ts).
  // Templates with no server equivalent are deliberately absent: the server then
  // infers the type from the prompt instead of silently discarding an unknown key.
  const TEMPLATE_TO_DOC_TYPE: Record<string, string> = {
    writ_199: "high-court-writ-petition",
    bail_497: "sessions-bail-application",
    bail_498_bba: "sessions-pre-arrest-bail",
    civil_plaint_injunction: "civil-suit-plaint",
    stay_order39: "temporary-injunction-application",
    civil_misc_151: "civil-misc-application",
    execution_order21: "execution-application",
    criminal_misc_22a: "criminal-misc-application",
    sessions_crim_appeal: "sessions-criminal-appeal",
    sessions_crim_revision: "sessions-criminal-revision",
    high_court_appeal_rfa: "high-court-civil-appeal",
    high_court_crim_appeal: "high-court-criminal-appeal",
    high_court_crim_revision: "high-court-criminal-revision",
    high_court_bba: "high-court-bail-before-arrest",
    supreme_court_cpla: "supreme-court-cpla",
    supreme_crim_petition: "supreme-court-criminal-petition",
    family_suit_khula: "family-suit-petition",
    guardians_custody_s25: "family-suit-petition",
    suit_order37_summary: "recovery-suit",
    vakalatnama_high_court: "power-of-attorney",
    affidavit_oath_comm: "affidavit",
    notice_489f_cheque: "legal-notice",
    legal_notice_generic: "legal-notice",
    comm_gpa: "power-of-attorney",
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
    draftType: "pleading" | "contract";
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to generate draft");
      if (typeof data.textContent !== "string" || !data.textContent.trim()) throw new Error("No draft text was returned. Please try again.");
      generatedDraftText = data.textContent;
    } catch (err) {
      console.error(err);
      toast({
        title: "Generation Failed",
        description: err instanceof Error ? err.message : "There was an error generating the pleading.",
        variant: "destructive"
      });
      return;
    }

    const formattedHtml = plainTextToTiptapHTML(generatedDraftText);
    const newDocId = generateDocId();
    const newTab: DocumentTab = {
      id: newDocId,
      title: brief.matterTitle || brief.reliefType,
      category: brief.draftType === "contract" ? "Commercial Contracts" : brief.forum.includes("High Court") ? "High Court" : "Court Filings",
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
    const newTab = createBlankTab(tabs.length + 1);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setActiveProfileId("court-legal");
    setCurrentHtml("<p></p>");
    setCurrentText("");
    setShowLaunchpad(false);
  };

  // ─── Actions from Right Sidebar ──────────────────────────────────────────

  const handleLoadTemplate = (template: DraftingTemplate) => {
    setDocVersion((v) => v + 1);
    setLockedSelection(null);
    setLiveSelection(null);
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
              documentType: TEMPLATE_TO_DOC_TYPE[template.id] || undefined,
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

  const handleReplaceDocument = (content: string, documentType?: string) => {
    setDocVersion((v) => v + 1);
    setLockedSelection(null);
    setLiveSelection(null);
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
              // A conversion changes the filing type. Keeping the old one made the
              // next edit run against the previous type's checklist and word floor.
              documentType: documentType || t.documentType,
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

  // ── Claude-Style Safe Surgical Targeted Edit Handler ───────────────────────
  const handleApplyTargetedEdit = useCallback(
    (
      revisedSnippet: string,
      selection: { text: string; from: number; to: number; docVersion?: number }
    ): boolean => {
      if (!editorRef.current) return false;

      // Integrity verification: ensure target range content has not changed unexpectedly
      // If the revised snippet or target selection contains no newlines (single inline fragment),
      // format as inline HTML so ProseMirror doesn't split the surrounding paragraph.
      const isInline = !selection.text.includes("\n") && !revisedSnippet.includes("\n");
      const formattedHtml = plainTextToTiptapHTML(revisedSnippet, { inlineOnly: isInline });
      const success = editorRef.current.replaceRange(
        selection.from,
        selection.to,
        formattedHtml,
        selection.text
      );

      if (!success) {
        toast({
          title: "Stale Edit Warning",
          description: "The text was modified since this edit was generated. To prevent overwriting newer changes, please re-select and regenerate.",
          variant: "destructive",
        });
        return false;
      }

      setDocVersion((v) => v + 1);
      setLockedSelection(null);
      setLiveSelection(null);
      toast({
        title: "Targeted Edit Applied",
        description: "Surgically updated the selected passage without modifying other sections.",
      });
      return true;
    },
    [toast, setDocVersion]
  );

  useEffect(() => {
    setLockedSelection(null);
    setLiveSelection(null);
    setTriggerPrompt(null);
  }, [activeTabId]);

  // Dismiss floating action bar on Escape key
  useEffect(() => {
    if (!liveSelection) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLiveSelection(null);
        setLockedSelection(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [liveSelection]);

  const handleSelectionChange = useCallback(
    (sel: { text: string; from: number; to: number } | null) => {
      if (sel && sel.text.trim().length > 0) {
        setLiveSelection(sel);
        setLockedSelection({ ...sel, docVersion });
      } else {
        setLiveSelection(null);
      }
    },
    [docVersion]
  );

  const handleTriggerAiEdit = useCallback(
    (sel: { text: string; from: number; to: number }, preset?: string) => {
      setLockedSelection({ ...sel, docVersion });
      setIsRightSidebarOpen(true);
      if (preset) {
        setTriggerPrompt({ prompt: preset, timestamp: Date.now() });
      }
    },
    [docVersion]
  );

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
          <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white dark:bg-[#131E2E] relative">
            {/* Document Tabs Bar (Clean & Focused) */}
            <div className="flex items-center justify-between px-4 py-1.5 bg-white dark:bg-[#131E2E] border-b border-[#E2E8F0] dark:border-[#1E2D44] shrink-0 h-11">
              {/* Tabs List */}
              <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto custom-scrollbar pr-2 py-0.5">
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
                        aria-label={`Close ${tab.title}`}
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

            {/* Keep selection actions outside the editor scroller so its sticky tools cannot cover them. */}
            {liveSelection && (
              <div role="toolbar" aria-label="AI actions for selected text" className="shrink-0 mx-4 my-2 px-3.5 py-2 rounded-2xl bg-white/95 dark:bg-[#071322]/95 backdrop-blur-xl border border-emerald-500/30 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-2 duration-150 select-none">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-[#105B38]/10 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-[#105B38] dark:text-emerald-400" />
                  </div>
                  <span className="font-semibold text-emerald-950 dark:text-emerald-100 truncate max-w-[240px] sm:max-w-md">
                    Selected: &quot;{liveSelection.text.slice(0, 45)}{liveSelection.text.length > 45 ? "..." : ""}&quot;
                  </span>
                  <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 shrink-0 font-medium">
                    ({liveSelection.text.split(/\s+/).filter(Boolean).length} words)
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleTriggerAiEdit(liveSelection, "Improve legal clarity and flow")}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
                  >
                    ✍️ Polish
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleTriggerAiEdit(liveSelection, "Shorten and make concise")}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
                  >
                    ✂️ Shorten
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleTriggerAiEdit(liveSelection, "Expand with comprehensive legal grounds")}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
                  >
                    📜 Expand
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleTriggerAiEdit(liveSelection, "Rewrite in formal court-assertive language")}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 text-xs font-medium transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs"
                  >
                    ⚖️ Court Tone
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleTriggerAiEdit(liveSelection)}
                    className="px-3 py-1 rounded-lg bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ask AI</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setLiveSelection(null);
                      setLockedSelection(null);
                    }}
                    className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors ml-0.5 cursor-pointer"
                    title="Dismiss selection bar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

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
                  onSelectionChange={handleSelectionChange}
                  onTriggerAiEdit={handleTriggerAiEdit}
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
                  Times New Roman 13pt · {resolveLegalPageProfile(activeProfileId).label}
                </span>
              </div>
            </div>
          </main>

          {/* ── Right-Side Panel: AI Drafter Chat, Templates, Clauses & Tools ── */}
          <RightDraftingSidebar
            key={activeTabId}
            initialMessages={chatByTabRef.current.get(activeTabId)}
            onMessagesChange={(messages) => { chatByTabRef.current.set(activeTabId, messages); }}
            documentVersion={docVersion}
            isOpen={isRightSidebarOpen}
            onToggle={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            currentDocumentText={currentText}
            onInsertClause={handleInsertClause}
            onReplaceDocument={handleReplaceDocument}
            onApplyTargetedEdit={handleApplyTargetedEdit}
            lockedSelection={lockedSelection}
            onClearLockedSelection={() => setLockedSelection(null)}
            triggerPrompt={triggerPrompt}
            onLoadTemplate={handleLoadTemplate}
            onInsertTemplateAtCursor={handleInsertTemplateAtCursor}
            onOpenFeeModal={() => setIsFeeModalOpen(true)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            activeProfileId={activeProfileId}
            activeDocumentType={activeTab?.documentType}
            getSelectedText={() => editorRef.current?.getSelectedText() || ""}
            getSelectionRange={() => editorRef.current?.getSelectionRange() || null}
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

export const PreviewDrafting: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="p-6">Loading drafting studio…</div>;
  const storageKey = `${TABS_STORAGE_KEY}:${user?.id ?? "guest"}`;
  return <DraftingWorkspace key={storageKey} storageKey={storageKey} />;
};

export default PreviewDrafting;
