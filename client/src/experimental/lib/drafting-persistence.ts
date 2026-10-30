import { resolveLegalPageProfile, type LegalPageProfileId } from "../../lib/legal-page-layout";

export interface DocumentTab {
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

export function draftFingerprint(tab: DocumentTab): string {
  return JSON.stringify([tab.title, tab.category, tab.documentType, tab.pageProfileId, tab.htmlContent, tab.textContent]);
}

export function hasDraftContent(tab: DocumentTab): boolean {
  return Boolean(tab.textContent.trim() || /<(?:table|hr)\b|data-type=["'](?:citation|legal-page-break)["']/i.test(tab.htmlContent));
}

export function normalizeDraftingTabs(value: unknown): { tabs: DocumentTab[]; activeTabId: string } | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as { tabs?: unknown; activeTabId?: unknown };
  if (!Array.isArray(stored.tabs)) return null;
  const seen = new Set<string>();
  const tabs: DocumentTab[] = [];
  for (const tab of stored.tabs) {
    if (!tab || typeof tab.id !== "string" || !tab.id || seen.has(tab.id)) continue;
    seen.add(tab.id);
    tabs.push({
      id: tab.id,
      dbDraftId: Number.isSafeInteger(tab.dbDraftId) && tab.dbDraftId > 0 ? tab.dbDraftId : undefined,
      title: typeof tab.title === "string" ? tab.title : "Untitled Document",
      category: typeof tab.category === "string" ? tab.category : "General",
      documentType: typeof tab.documentType === "string" ? tab.documentType : undefined,
      pageProfileId: resolveLegalPageProfile(tab.pageProfileId).id,
      htmlContent: typeof tab.htmlContent === "string" ? tab.htmlContent : "",
      textContent: typeof tab.textContent === "string" ? tab.textContent : "",
      lastModified: Number.isFinite(tab.lastModified) ? tab.lastModified : Date.now(),
    });
  }
  return tabs.length ? { tabs, activeTabId: tabs.some((t) => t.id === stored.activeTabId) ? stored.activeTabId as string : tabs[0].id } : null;
}

/** One request per document at a time; edits arriving during a save are drained afterwards. */
export class DraftSaveQueue<T extends { id: string }> {
  private entries = new Map<string, { pending?: T; running: Promise<void> }>();

  constructor(private persist: (snapshot: T) => Promise<void>) {}

  save(snapshot: T): Promise<void> {
    const existing = this.entries.get(snapshot.id);
    if (existing) {
      existing.pending = snapshot;
      return existing.running;
    }
    const entry = { pending: snapshot as T | undefined, running: Promise.resolve() };
    this.entries.set(snapshot.id, entry);
    entry.running = Promise.resolve().then(async () => {
      try {
        while (entry.pending) {
          const next = entry.pending;
          entry.pending = undefined;
          await this.persist(next);
        }
      } finally {
        this.entries.delete(snapshot.id);
      }
    });
    return entry.running;
  }

  idle(id: string): Promise<void> {
    return this.entries.get(id)?.running ?? Promise.resolve();
  }
}
