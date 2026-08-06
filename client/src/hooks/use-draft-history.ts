/**
 * useDraftHistory — React hook for client-side draft version snapshots.
 *
 * Stores snapshots in localStorage keyed by draft ID.
 * Each snapshot captures: timestamp, title, HTML content, plain text, word count.
 * Max 20 snapshots per draft (FIFO eviction).
 */

import { useCallback, useState, useEffect } from "react";

const STORAGE_KEY_PREFIX = "legal-draft-history-v1:";
const MAX_SNAPSHOTS = 20;

export type DraftSnapshot = {
  id: string;
  timestamp: number;
  title: string;
  html: string;
  text: string;
  wordCount: number;
};

export type UseDraftHistoryReturn = {
  /** All snapshots for the current draft, newest first */
  snapshots: DraftSnapshot[];
  /** Add a new snapshot */
  addSnapshot: (title: string, html: string, text: string) => void;
  /** Get a specific snapshot by ID */
  getSnapshot: (id: string) => DraftSnapshot | undefined;
  /** Delete a snapshot */
  deleteSnapshot: (id: string) => void;
  /** Clear all history for this draft */
  clearHistory: () => void;
  /** Change the active draft key */
  setDraftKey: (key: string) => void;
};

function getStorageKey(draftKey: string): string {
  return `${STORAGE_KEY_PREFIX}${draftKey}`;
}

function loadSnapshots(draftKey: string): DraftSnapshot[] {
  if (!draftKey) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(draftKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as DraftSnapshot[];
  } catch {
    return [];
  }
}

function saveSnapshots(draftKey: string, snapshots: DraftSnapshot[]) {
  if (!draftKey) return;
  try {
    localStorage.setItem(getStorageKey(draftKey), JSON.stringify(snapshots));
  } catch {
    // localStorage full — evict oldest entries
    try {
      const trimmed = snapshots.slice(0, Math.floor(MAX_SNAPSHOTS / 2));
      localStorage.setItem(getStorageKey(draftKey), JSON.stringify(trimmed));
    } catch {
      // Can't save at all — silently fail
    }
  }
}

export function useDraftHistory(initialDraftKey = "workspace"): UseDraftHistoryReturn {
  const [draftKey, setDraftKey] = useState(initialDraftKey);
  const [snapshots, setSnapshots] = useState<DraftSnapshot[]>(() => loadSnapshots(initialDraftKey));

  useEffect(() => {
    setDraftKey(initialDraftKey);
  }, [initialDraftKey]);

  // Reload when draft key changes
  useEffect(() => {
    setSnapshots(loadSnapshots(draftKey));
  }, [draftKey]);

  const addSnapshot = useCallback(
    (title: string, html: string, text: string) => {
      const snapshot: DraftSnapshot = {
        id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        title,
        html,
        text,
        wordCount: text.trim().split(/\s+/).filter(Boolean).length,
      };

      setSnapshots((prev) => {
        const updated = [snapshot, ...prev].slice(0, MAX_SNAPSHOTS);
        saveSnapshots(draftKey, updated);
        return updated;
      });
    },
    [draftKey],
  );

  const getSnapshot = useCallback(
    (id: string) => {
      return snapshots.find((s) => s.id === id);
    },
    [snapshots],
  );

  const deleteSnapshot = useCallback(
    (id: string) => {
      setSnapshots((prev) => {
        const updated = prev.filter((s) => s.id !== id);
        saveSnapshots(draftKey, updated);
        return updated;
      });
    },
    [draftKey],
  );

  const clearHistory = useCallback(() => {
    setSnapshots([]);
    try {
      localStorage.removeItem(getStorageKey(draftKey));
    } catch {}
  }, [draftKey]);

  return {
    snapshots,
    addSnapshot,
    getSnapshot,
    deleteSnapshot,
    clearHistory,
    setDraftKey,
  };
}

// ── Simple word-level diff ──────────────────────────────────────────────

export type DiffSegment = {
  type: "same" | "added" | "removed";
  text: string;
};

/**
 * Compute a simple word-level diff between two texts.
 * Uses a basic LCS-based algorithm for reasonable performance.
 */
export function computeWordDiff(oldText: string, newText: string): DiffSegment[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);

  // Build LCS table
  const m = oldWords.length;
  const n = newWords.length;

  // For very long texts, use a simpler approach
  if (m * n > 500000) {
    // Fallback: just show entire old as removed, entire new as added
    return [
      { type: "removed", text: oldText },
      { type: "added", text: newText },
    ];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  const segments: DiffSegment[] = [];
  let i = m;
  let j = n;
  const result: DiffSegment[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.push({ type: "same", text: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "added", text: newWords[j - 1] });
      j--;
    } else {
      result.push({ type: "removed", text: oldWords[i - 1] });
      i--;
    }
  }

  result.reverse();

  // Merge adjacent segments of the same type
  for (const seg of result) {
    if (segments.length > 0 && segments[segments.length - 1].type === seg.type) {
      segments[segments.length - 1].text += seg.text;
    } else {
      segments.push({ ...seg });
    }
  }

  return segments;
}
