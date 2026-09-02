/**
 * ============================================================================
 * HYBRID PRECEDENT RESOLUTION REACT HOOK (useSectionPrecedents)
 * Strictly isolated in client/src/experimental/
 * ============================================================================
 * Implements 3-Tier Precedent Engine:
 * - Tier 1 (0ms Instant): Pre-indexed Supreme Court landmark ratios & seed judgments
 * - Tier 2 (Cached): In-memory LRU cache hit (0ms instant)
 * - Tier 3 (Dynamic DB & Resilient Fallback): Zero-401 resilient resolution
 * ============================================================================
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  precedentCache,
  type LandmarkPrecedent,
  type PrecedentResolutionState,
} from "../lib/precedentCache";
import { type LandmarkCitation } from "../data/statutesCompendiumData";

export interface UseSectionPrecedentsOptions {
  enabled?: boolean;
  tier1Citations?: (LandmarkPrecedent | LandmarkCitation)[];
  autoFetch?: boolean;
  title?: string;
  category?: string;
}

export interface UseSectionPrecedentsResult extends PrecedentResolutionState {
  refetch: () => Promise<void>;
  statuteName: string;
  sectionNumber: string;
}


export function useSectionPrecedents(
  statuteName: string,
  sectionNumber: string,
  options: UseSectionPrecedentsOptions = {}
): UseSectionPrecedentsResult {
  const { enabled = true, tier1Citations, autoFetch = true, title, category } = options;

  const [state, setState] = useState<PrecedentResolutionState>(() => {
    // 1. Check explicitly supplied Tier 1 citations
    if (tier1Citations && tier1Citations.length > 0) {
      return {
        precedents: tier1Citations.map((c) => ({
          ...c,
          source: (c as LandmarkPrecedent).source || "tier1_curated",
        })),
        isLoading: false,
        isCached: false,
        latencyMs: 0,
        error: null,
        source: "tier1",
      };
    }

    // 4. Check in-memory LRU cache
    if (statuteName && sectionNumber) {
      const cacheKey = precedentCache.getCacheKey(statuteName, sectionNumber);
      const cached = precedentCache.get(cacheKey);
      if (cached && (cached.status === "resolved" || cached.status === "empty")) {
        return {
          precedents: cached.precedents,
          isLoading: false,
          isCached: true,
          latencyMs: 0,
          error: cached.error || null,
          source: cached.precedents.length > 0 ? "cache" : "empty",
        };
      }
    }

    // Initial default loading state
    return {
      precedents: [],
      isLoading: Boolean(enabled && autoFetch && statuteName && sectionNumber),
      isCached: false,
      latencyMs: 0,
      error: null,
      source: "empty",
    };
  });

  const resolve = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!enabled || !statuteName || !sectionNumber) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      // Check Tier 1 direct citations
      if (tier1Citations && tier1Citations.length > 0) {
        setState({
          precedents: tier1Citations.map((c) => ({
            ...c,
            source: (c as LandmarkPrecedent).source || "tier1_curated",
          })),
          isLoading: false,
          isCached: false,
          latencyMs: 0,
          error: null,
          source: "tier1",
        });
        return;
      }

      const cacheKey = precedentCache.getCacheKey(statuteName, sectionNumber);

      // Check memory cache unless force refreshed
      if (!forceRefresh) {
        const cached = precedentCache.get(cacheKey);
        if (cached && cached.status === "resolved" && cached.precedents.length > 0) {
          setState({
            precedents: cached.precedents,
            isLoading: false,
            isCached: true,
            latencyMs: 0,
            error: cached.error || null,
            source: "cache",
          });
          return;
        }
      } else {
        precedentCache.delete(cacheKey);
      }

      // Perform live fetch with silent fallback
      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
      }));

      const startTime = performance.now();

      try {
        const results = await precedentCache.resolvePrecedents(
          statuteName,
          sectionNumber,
          undefined,
          title,
          category
        );
        const elapsed = Math.round(performance.now() - startTime);

        setState({
          precedents: results,
          isLoading: false,
          isCached: false,
          latencyMs: elapsed,
          error: null,
          source: results.some((r) => r.source === "tier2_live_db") ? "live_db" : "tier1",
        });
      } catch (err: any) {
        const elapsed = Math.round(performance.now() - startTime);
        setState({
          precedents: [],
          isLoading: false,
          isCached: false,
          latencyMs: elapsed,
          error: err?.message || "Failed to fetch precedents",
          source: "empty",
        });
      }
    },
    [enabled, statuteName, sectionNumber, tier1Citations, title, category]
  );

  useEffect(() => {
    if (autoFetch) {
      resolve(false);
    }
  }, [resolve, autoFetch]);

  const refetch = useCallback(async () => {
    await resolve(true);
  }, [resolve]);

  return {
    ...state,
    refetch,
    statuteName,
    sectionNumber,
  };
}
