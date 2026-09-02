/**
 * ============================================================================
 * UNIVERSAL STATUTE SEARCH REACT HOOK (useStatuteSearch)
 * Strictly isolated in client/src/experimental/
 * ============================================================================
 * Features:
 * 1. Fast in-memory token scoring across major enactments and 83k index (<15ms).
 * 2. Automatic Pakistani legal acronym expansion (PPC, CrPC, CPC, QSO, SRA, PECA, etc.).
 * 3. 250ms input debouncing with instantaneous clearing.
 * 4. Dynamic PostgreSQL search fallback (/api/statute/lookup & /api/statute-documents/search).
 * 5. Domain & Enactment filtering.
 * ============================================================================
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  statuteSearchEngine,
  type SearchResultItem,
  type SearchOptions,
  normalizeSectionNumber,
  parseLegalQuery,
} from "../lib/statuteSearchEngine";
import type { StatutorySection } from "../data/majorEnactmentsData";
import { STATUTE_SECTIONS } from "../data/statutesCompendiumData";

export interface UseStatuteSearchOptions {
  initialQuery?: string;
  category?: string;
  statute?: string;
  debounceMs?: number;
  enableLiveDbFallback?: boolean;
  limit?: number;
}

export interface UseStatuteSearchResult {
  query: string;
  setQuery: (q: string) => void;
  debouncedQuery: string;
  results: SearchResultItem[];
  isSearching: boolean;
  latencyMs: number;
  totalCount: number;
  category: string;
  setCategory: (category: string) => void;
  statuteFilter: string;
  setStatuteFilter: (statute: string) => void;
  clearSearch: () => void;
}

export function useStatuteSearch(options: UseStatuteSearchOptions = {}): UseStatuteSearchResult {
  const {
    initialQuery = "",
    category: initialCategory = "all",
    statute: initialStatute = "",
    debounceMs = 250,
    enableLiveDbFallback = true,
    limit = 60,
  } = options;

  const [query, setQuery] = useState(initialQuery);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQuery);
  const [category, setCategory] = useState(initialCategory);
  const [statuteFilter, setStatuteFilter] = useState(initialStatute);
  const [isSearching, setIsSearching] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);
  const [liveDbResults, setLiveDbResults] = useState<SearchResultItem[]>([]);

  // Debounce input change
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  // Execute in-memory token-scored search
  const localResults = useMemo(() => {
    const t0 = performance.now();
    const searchOpts: SearchOptions = {
      limit,
      category: category !== "all" ? category : undefined,
      statute: statuteFilter || undefined,
    };

    const res = statuteSearchEngine.search(debouncedQuery, searchOpts);
    const elapsed = Math.round(performance.now() - t0);
    setLatencyMs(elapsed);
    return res;
  }, [debouncedQuery, category, statuteFilter, limit]);

  // Optional live PostgreSQL database fallback
  useEffect(() => {
    if (!enableLiveDbFallback || !debouncedQuery || debouncedQuery.length < 2) {
      setLiveDbResults([]);
      setIsSearching(false);
      return;
    }

    let isMounted = true;
    setIsSearching(true);

    async function fetchLiveDbStatutes() {
      try {
        const liveItems: SearchResultItem[] = [];
        const seenIds = new Set<string>();

        // 1. Query /api/statute/lookup?q=...
        try {
          const res = await fetch(`/api/statute/lookup?q=${encodeURIComponent(debouncedQuery)}`, {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            if (data && (data.id || (Array.isArray(data.sections) && data.sections.length > 0))) {
              const matchedSections = Array.isArray(data.sections) ? data.sections : [data];
              for (const sec of matchedSections) {
                const secId = `postgres-statute-${sec.id || sec.sectionNumber || Math.random()}`;
                if (!seenIds.has(secId)) {
                  seenIds.add(secId);
                  liveItems.push({
                    section: {
                      id: secId,
                      statute: sec.statuteName || data.title || "PostgreSQL Statutory Document",
                      section: String(sec.sectionNumber || sec.section || "Sec"),
                      title: sec.title || sec.sectionTitle || "Statutory Provision",
                      description: sec.text || sec.content || sec.description || "",
                      punishment: sec.punishment || null,
                      category: sec.domain || "general",
                      liveDbMatch: true,
                    },
                    score: 2500,
                    matchType: "keyword",
                  });
                }
              }
            }
          } else {
            console.warn(`[useStatuteSearch] /api/statute/lookup returned HTTP ${res.status}`);
          }
        } catch (err) {
          console.warn("[useStatuteSearch] Live statute lookup query failed:", err);
        }

        // 2. Query /api/statute-documents/search?q=...
        try {
          const docRes = await fetch(`/api/statute-documents/search?q=${encodeURIComponent(debouncedQuery)}`, {
            credentials: "include",
          });
          if (docRes.ok) {
            const docData = await docRes.json();
            if (Array.isArray(docData)) {
              for (const doc of docData.slice(0, 5)) {
                const docId = `statute-doc-${doc.id}`;
                if (!seenIds.has(docId)) {
                  seenIds.add(docId);
                  liveItems.push({
                    section: {
                      id: docId,
                      statute: doc.title || "Statutory Enactment Document",
                      section: doc.shortCode || "Statute",
                      title: doc.title || "Official Gazette Enactment",
                      description: doc.description || doc.fullTextSnippet || "Statutory Document Record from Database.",
                      category: doc.category || "special",
                      liveDbMatch: true,
                    },
                    score: 1500,
                    matchType: "title",
                  });
                }
              }
            }
          } else {
            console.warn(`[useStatuteSearch] /api/statute-documents/search returned HTTP ${docRes.status}`);
          }
        } catch (err) {
          console.warn("[useStatuteSearch] Live statute-documents search failed:", err);
        }

        if (isMounted) {
          setLiveDbResults(liveItems);
          setIsSearching(false);
        }
      } catch (err) {
        console.warn("[useStatuteSearch] Live DB statute query encountered an error, using in-memory compendium:", err);
        if (isMounted) {
          setIsSearching(false);
        }
      }
    }

    fetchLiveDbStatutes();

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery, enableLiveDbFallback]);

  // Merge in-memory results with dynamic live DB results (prioritizing live DB matches)
  const mergedResults = useMemo(() => {
    if (liveDbResults.length === 0) return localResults;

    const combined = [...liveDbResults, ...localResults];
    // Deduplicate by section ID
    const unique = new Map<string, SearchResultItem>();
    for (const item of combined) {
      if (!unique.has(item.section.id)) {
        unique.set(item.section.id, item);
      }
    }

    const sorted = Array.from(unique.values()).sort((a, b) => b.score - a.score);
    return sorted.slice(0, limit);
  }, [localResults, liveDbResults, limit]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    setLiveDbResults([]);
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    results: mergedResults,
    isSearching,
    latencyMs,
    totalCount: mergedResults.length,
    category,
    setCategory,
    statuteFilter,
    setStatuteFilter,
    clearSearch,
  };
}
