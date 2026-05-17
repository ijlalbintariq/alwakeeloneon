/**
 * CitationSuggestion — Tiptap Suggestion extension for `/cite` command.
 *
 * When the user types `/cite` followed by a space and query text,
 * a popup appears with matching judgments from the case-law search API.
 * Selecting a result inserts a CitationNode inline chip.
 */

import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

export interface CitationSuggestionItem {
  id: string;
  citation: string;
  title: string;
  court: string;
  decisionDate?: string | null;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export const CitationSuggestion = Extension.create({
  name: "citationSuggestion",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        allowSpaces: true,
        command: ({ editor, range, props }: any) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent({
              type: "citation",
              attrs: {
                citation: props.citation,
                title: props.title,
                court: props.court,
                judgmentId: props.id || null,
              },
            })
            .insertContent(" ")
            .run();
        },
        items: async ({ query }: { query: string }) => {
          // Only activate when the user typed "cite " prefix
          if (!query.toLowerCase().startsWith("cite ")) {
            return [];
          }
          const searchQuery = query.slice(5).trim(); // Remove "cite " prefix
          if (searchQuery.length < 3) return [];

          // Debounce to avoid hammering the API
          if (debounceTimer) clearTimeout(debounceTimer);
          
          return new Promise<CitationSuggestionItem[]>((resolve) => {
            debounceTimer = setTimeout(async () => {
              try {
                const params = new URLSearchParams({ q: searchQuery, limit: "8" });
                const res = await fetch(`/api/case-law/search?${params.toString()}`, {
                  credentials: "include",
                });
                if (!res.ok) {
                  resolve([]);
                  return;
                }
                const data = await res.json();
                const results = (Array.isArray(data) ? data : [])
                  .slice(0, 8)
                  .map((item: any, idx: number) => ({
                    id: String(item.judgmentId || item.id || `citation-${idx}`),
                    citation: item.citation || "Unknown Citation",
                    title: item.title || "Untitled",
                    court: item.court || "Court",
                    decisionDate: item.decisionDate || null,
                  }));
                resolve(results);
              } catch {
                resolve([]);
              }
            }, 300);
          });
        },
        // render is provided by the component that registers this extension
      } as Partial<SuggestionOptions<CitationSuggestionItem>>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
