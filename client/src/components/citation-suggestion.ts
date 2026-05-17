/**
 * CitationSuggestion — Tiptap Suggestion extension for `/cite` command.
 *
 * When the user types `/cite` followed by a space and query text,
 * a popup appears with matching judgments from the case-law search API.
 * Selecting a result inserts a CitationNode inline chip followed by
 * a 2–3 line ratio / legal principle summary.
 *
 * **Auto-suggest**: If the user types `/cite` with a very short or empty
 * query, we extract the surrounding paragraph text and use it as context
 * to suggest relevant citations automatically.
 */

import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

export interface CitationSuggestionItem {
  id: string;
  citation: string;
  title: string;
  court: string;
  summary: string;
  decisionDate?: string | null;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Extract nearby paragraph text from the editor around the cursor.
 * Used as context for auto-suggesting citations when no explicit query is given.
 */
function extractSurroundingContext(editor: any): string {
  try {
    if (!editor?.state) return "";

    const { from } = editor.state.selection;
    const doc = editor.state.doc;

    // Walk backward and forward to find the paragraph boundaries
    const resolved = doc.resolve(from);
    const parentNode = resolved.parent;
    if (!parentNode) return "";

    // Get text from the current block node
    let text = parentNode.textContent || "";

    // If the current block is short, also grab the previous 1–2 blocks
    if (text.length < 80) {
      const blockStart = resolved.before(resolved.depth);
      const startPos = Math.max(0, blockStart - 600);
      const slice = doc.textBetween(startPos, blockStart, "\n", "\n");
      text = slice + " " + text;
    }

    // Clean up: remove /cite command, trim, cap at ~400 chars
    return text
      .replace(/\/cite\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(-400);
  } catch {
    return "";
  }
}

export const CitationSuggestion = Extension.create({
  name: "citationSuggestion",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        allowSpaces: true,
        command: ({ editor, range, props }: any) => {
          const summary = String(props.summary || "").trim();

          // Build the content to insert: citation chip + ratio summary
          const content: any[] = [
            {
              type: "citation",
              attrs: {
                citation: props.citation,
                title: props.title,
                court: props.court,
                judgmentId: props.id || null,
              },
            },
          ];

          // If we have a summary, insert it as italic text on a new line
          if (summary) {
            const ratioText = summary.length > 300
              ? summary.slice(0, 297) + "..."
              : summary;

            content.push({ type: "text", text: " " });
            content.push({ type: "hardBreak" });
            content.push({
              type: "text",
              marks: [{ type: "italic" }],
              text: `[Ratio: ${ratioText}]`,
            });
            content.push({ type: "hardBreak" });
          } else {
            content.push({ type: "text", text: " " });
          }

          editor.chain().focus().deleteRange(range).insertContent(content).run();
        },
        items: async ({ query, editor }: { query: string; editor: any }) => {
          // Only activate when the user typed "cite" prefix
          if (!query.toLowerCase().startsWith("cite")) {
            return [];
          }

          const explicitQuery = query.slice(4).trim(); // Remove "cite" prefix
          const isAutoSuggest = explicitQuery.length < 3;

          // For auto-suggest, extract surrounding paragraph as search context
          let searchQuery = explicitQuery;
          if (isAutoSuggest) {
            const context = extractSurroundingContext(editor);
            if (!context || context.length < 10) return [];
            searchQuery = context;
          }

          // Debounce to avoid hammering the API
          if (debounceTimer) clearTimeout(debounceTimer);

          return new Promise<CitationSuggestionItem[]>((resolve) => {
            debounceTimer = setTimeout(async () => {
              try {
                const params = new URLSearchParams({
                  q: searchQuery,
                  limit: isAutoSuggest ? "6" : "8",
                });
                const res = await fetch(`/api/case-law/search?${params.toString()}`, {
                  credentials: "include",
                });
                if (!res.ok) {
                  resolve([]);
                  return;
                }
                const data = await res.json();
                const results = (Array.isArray(data) ? data : [])
                  .slice(0, isAutoSuggest ? 6 : 8)
                  .map((item: any, idx: number) => ({
                    id: String(item.judgmentId || item.id || `citation-${idx}`),
                    citation: item.citation || "Unknown Citation",
                    title: item.title || "Untitled",
                    court: item.court || "Court",
                    summary: item.summary || "",
                    decisionDate: item.decisionDate || null,
                  }));
                resolve(results);
              } catch {
                resolve([]);
              }
            }, isAutoSuggest ? 500 : 300); // Slightly longer debounce for auto-suggest
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
