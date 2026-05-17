/**
 * CitationList — Popup component for the citation slash-menu.
 *
 * Renders a floating dropdown with search results when the user
 * types `/cite <query>` in the Tiptap editor. Supports keyboard
 * navigation (arrow keys + Enter) and mouse selection.
 *
 * Shows citation, court, title, and a 1-line summary preview.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  type Ref,
} from "react";
import { BookOpen, Gavel, Loader2 } from "lucide-react";
import type { CitationSuggestionItem } from "./citation-suggestion";

export interface CitationListProps {
  items: CitationSuggestionItem[];
  command: (item: CitationSuggestionItem) => void;
}

export interface CitationListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

function CitationListInner(
  { items, command }: CitationListProps,
  ref: Ref<CitationListHandle>,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) command(item);
    },
    [items, command],
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1));
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="citation-suggestion-popup">
        <div className="flex items-center gap-2 px-3 py-4 text-muted-foreground text-xs">
          <Loader2 size={14} className="animate-spin text-primary" />
          <span>
            Type after <code className="bg-card/60 px-1 py-0.5 rounded text-[10px] font-mono">/cite</code> to search, or wait for auto-suggestions...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="citation-suggestion-popup">
      <div className="px-2.5 py-1.5 border-b border-border flex items-center gap-1.5">
        <Gavel size={11} className="text-primary" />
        <span className="text-[9px] uppercase tracking-widest text-primary font-bold">
          Insert Citation + Ratio
        </span>
        <span className="ml-auto text-[9px] text-muted-foreground">{items.length} results</span>
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`w-full text-left px-2.5 py-2.5 flex flex-col gap-1 transition-colors border-b border-border/30 last:border-b-0 ${
              index === selectedIndex
                ? "bg-primary/15 text-foreground"
                : "text-foreground hover:bg-card/60"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm shrink-0">
                {item.citation}
              </span>
              <span className="text-[9px] text-muted-foreground uppercase shrink-0">
                {item.court}
              </span>
            </div>
            <span className="text-[11px] text-foreground/80 line-clamp-1 leading-tight font-medium">
              {item.title}
            </span>
            {item.summary ? (
              <div className="flex items-start gap-1.5 mt-0.5">
                <BookOpen size={10} className="text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-[10px] text-muted-foreground line-clamp-2 leading-snug italic">
                  {item.summary.length > 150 ? item.summary.slice(0, 147) + "..." : item.summary}
                </span>
              </div>
            ) : null}
          </button>
        ))}
      </div>
      <div className="px-2.5 py-1 border-t border-border text-[8px] text-muted-foreground">
        ↑↓ navigate · Enter to insert citation + ratio · Esc dismiss
      </div>
    </div>
  );
}

export const CitationList = forwardRef(CitationListInner);
