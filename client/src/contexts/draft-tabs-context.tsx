/**
 * DraftTabsContext — React context for managing multiple open drafts
 * in a tabbed editor workflow.
 *
 * Features:
 *  - Up to 5 simultaneous open draft tabs
 *  - Each tab stores its own editor content, chat history, and memory
 *  - Active tab switching with state preservation
 *  - localStorage persistence for tabs across page refreshes
 *  - New tab creation and tab closing
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  LegalDraftChatMessage,
  LegalDraftMemoryItem,
  LegalDraftRecommendation,
  LegalDraftReferences,
} from "@shared/legal-drafting";

const STORAGE_KEY = "legal-drafting-tabs-v1";
const MAX_TABS = 5;

// ── Types ────────────────────────────────────────────────────────────────

export type DraftTab = {
  /** Unique tab identifier */
  id: string;
  /** Server-side document ID (null = new unsaved) */
  draftId: number | null;
  /** Draft title */
  title: string;
  /** Editor HTML content */
  editorHtml: string;
  /** Plain text content */
  docText: string;
  /** AI drafting conversation for this document */
  chatMessages: LegalDraftChatMessage[];
  /** User instructions and risks remembered for this document */
  memoryItems: LegalDraftMemoryItem[];
  /** Verified references resolved for this document */
  draftReferences: LegalDraftReferences | null;
  /** AI review recommendations for this document */
  recommendations: LegalDraftRecommendation[];
  /** Whether this tab currently contains a draft */
  hasDraftInSession: boolean;
  /** Whether this tab has unsaved changes */
  isDirty: boolean;
  /** Timestamp of last activity */
  lastActiveAt: number;
};

type DraftTabsContextValue = {
  /** All open tabs */
  tabs: DraftTab[];
  /** Currently active tab ID */
  activeTabId: string;
  /** Get the active tab object */
  activeTab: DraftTab | undefined;
  /** Add a new tab (creates a blank draft or with initial content) */
  addTab: (partial?: Partial<DraftTab>) => string;
  /** Close a tab */
  closeTab: (id: string) => void;
  /** Switch to a different tab */
  switchTab: (id: string) => void;
  /** Update a tab's data (e.g., after editor content changes) */
  updateTab: (id: string, updates: Partial<DraftTab>) => void;
  /** Check if a draft (by server ID) is already open in a tab */
  findTabByDraftId: (draftId: number) => DraftTab | undefined;
  /** Whether multi-tab mode is enabled (has more than 1 tab) */
  isMultiTab: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultTab(): DraftTab {
  return {
    id: generateTabId(),
    draftId: null,
    title: "Untitled Draft",
    editorHtml: "",
    docText: "",
    chatMessages: [],
    memoryItems: [],
    draftReferences: null,
    recommendations: [],
    hasDraftInSession: false,
    isDirty: false,
    lastActiveAt: Date.now(),
  };
}

export function normalizeStoredDraftTabs(value: unknown): { tabs: DraftTab[]; activeTabId: string } | null {
    if (!value || typeof value !== "object") return null;
    const parsed = value as Record<string, unknown>;
    if (!Array.isArray(parsed.tabs) || typeof parsed.activeTabId !== "string") return null;
    const tabs: DraftTab[] = parsed.tabs
      .filter((tab: unknown): tab is Record<string, unknown> => !!tab && typeof tab === "object")
      .slice(0, MAX_TABS)
      .map((tab: Record<string, unknown>): DraftTab => ({
        ...createDefaultTab(),
        ...tab,
        id: typeof tab.id === "string" && tab.id ? tab.id : generateTabId(),
        draftId: typeof tab.draftId === "number" ? tab.draftId : null,
        title: typeof tab.title === "string" && tab.title ? tab.title.slice(0, 240) : "Untitled Draft",
        editorHtml: typeof tab.editorHtml === "string" ? tab.editorHtml.slice(0, 250_000) : "",
        docText: typeof tab.docText === "string" ? tab.docText.slice(0, 250_000) : "",
        chatMessages: Array.isArray(tab.chatMessages) ? tab.chatMessages.slice(-150) as LegalDraftChatMessage[] : [],
        memoryItems: Array.isArray(tab.memoryItems) ? tab.memoryItems.slice(0, 60) as LegalDraftMemoryItem[] : [],
        draftReferences: tab.draftReferences && typeof tab.draftReferences === "object"
          ? tab.draftReferences as LegalDraftReferences
          : null,
        recommendations: Array.isArray(tab.recommendations) ? tab.recommendations.slice(0, 10) as LegalDraftRecommendation[] : [],
        hasDraftInSession: typeof tab.hasDraftInSession === "boolean"
          ? tab.hasDraftInSession
          : Boolean(String(tab.editorHtml || tab.docText || "").trim()),
        isDirty: Boolean(tab.isDirty),
        lastActiveAt: typeof tab.lastActiveAt === "number" ? tab.lastActiveAt : Date.now(),
      }));
    if (tabs.length === 0) return null;
    const activeTabId = tabs.some((tab) => tab.id === parsed.activeTabId)
      ? parsed.activeTabId
      : tabs[0].id;
    return { tabs, activeTabId };
}

function loadTabsFromStorage(): { tabs: DraftTab[]; activeTabId: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeStoredDraftTabs(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveTabsToStorage(tabs: DraftTab[], activeTabId: string) {
  try {
    const lite = tabs.map((t) => ({
      ...t,
      editorHtml: t.editorHtml.slice(0, 250_000),
      docText: t.docText.slice(0, 250_000),
      chatMessages: t.chatMessages.slice(-50).map((message) => ({
        ...message,
        content: message.content.slice(0, 10_000),
      })),
      memoryItems: t.memoryItems.slice(0, 30),
      recommendations: t.recommendations.slice(0, 10),
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs: lite, activeTabId }));
  } catch {
    // localStorage full — silently fail
  }
}

// ── Context ──────────────────────────────────────────────────────────────

const DraftTabsContext = createContext<DraftTabsContextValue | null>(null);

export function DraftTabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<DraftTab[]>(() => {
    const stored = loadTabsFromStorage();
    return stored?.tabs?.length ? stored.tabs : [createDefaultTab()];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const stored = loadTabsFromStorage();
    return stored?.activeTabId || tabs[0]?.id || "";
  });

  // Persist to localStorage on changes
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveTabsToStorage(tabs, activeTabId);
    }, 500);
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [tabs, activeTabId]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId),
    [tabs, activeTabId],
  );

  const addTab = useCallback(
    (partial?: Partial<DraftTab>): string => {
      if (tabs.length >= MAX_TABS) {
        // Close the least recently used tab that isn't dirty
        const nonDirtyTabs = tabs.filter((t) => !t.isDirty && t.id !== activeTabId);
        if (nonDirtyTabs.length > 0) {
          const lru = nonDirtyTabs.sort((a, b) => a.lastActiveAt - b.lastActiveAt)[0];
          setTabs((prev) => prev.filter((t) => t.id !== lru.id));
        } else {
          // All tabs are dirty or only one exists — can't open more
          return activeTabId;
        }
      }

      const newTab: DraftTab = {
        ...createDefaultTab(),
        ...partial,
        id: partial?.id || generateTabId(),
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      return newTab.id;
    },
    [tabs, activeTabId],
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== id);
        if (remaining.length === 0) {
          // Always keep at least one tab
          const fresh = createDefaultTab();
          setActiveTabId(fresh.id);
          return [fresh];
        }

        // If closing the active tab, switch to the nearest one
        if (id === activeTabId) {
          const closedIndex = prev.findIndex((t) => t.id === id);
          const nextIndex = Math.min(closedIndex, remaining.length - 1);
          setActiveTabId(remaining[nextIndex].id);
        }

        return remaining;
      });
    },
    [activeTabId],
  );

  const switchTab = useCallback(
    (id: string) => {
      // Mark the new tab as recently active
      setTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, lastActiveAt: Date.now() } : t)),
      );
      setActiveTabId(id);
    },
    [],
  );

  const updateTab = useCallback(
    (id: string, updates: Partial<DraftTab>) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      );
    },
    [],
  );

  const findTabByDraftId = useCallback(
    (draftId: number) => tabs.find((t) => t.draftId === draftId),
    [tabs],
  );

  const isMultiTab = tabs.length > 1;

  const contextValue = useMemo<DraftTabsContextValue>(
    () => ({
      tabs,
      activeTabId,
      activeTab,
      addTab,
      closeTab,
      switchTab,
      updateTab,
      findTabByDraftId,
      isMultiTab,
    }),
    [tabs, activeTabId, activeTab, addTab, closeTab, switchTab, updateTab, findTabByDraftId, isMultiTab],
  );

  return (
    <DraftTabsContext.Provider value={contextValue}>
      {children}
    </DraftTabsContext.Provider>
  );
}

export function useDraftTabs(): DraftTabsContextValue {
  const ctx = useContext(DraftTabsContext);
  if (!ctx) {
    throw new Error("useDraftTabs must be used within a DraftTabsProvider");
  }
  return ctx;
}
