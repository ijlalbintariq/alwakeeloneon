import { Extension, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

type LegalPaginationBreak = {
  from: number;
  gap: number;
  kind: "auto" | "manual";
};

type LegalPaginationState = {
  breaks: LegalPaginationBreak[];
  decorations: DecorationSet;
};

export const legalPaginationPluginKey = new PluginKey<LegalPaginationState>("legalPagination");

function buildDecorations(doc: ProseMirrorNode, breaks: LegalPaginationBreak[]): DecorationSet {
  const decorations = breaks.flatMap((pageBreak) => {
    const node = doc.nodeAt(pageBreak.from);
    if (!node) return [];
    const attrs = pageBreak.kind === "manual"
      ? {
          class: "legal-manual-page-break",
          style: `--legal-page-break-gap:${pageBreak.gap}px`,
        }
      : {
          class: "legal-auto-page-break",
          style: `--legal-page-break-gap:${pageBreak.gap}px`,
        };
    return [Decoration.node(pageBreak.from, pageBreak.from + node.nodeSize, attrs)];
  });
  return DecorationSet.create(doc, decorations);
}

function breaksEqual(left: LegalPaginationBreak[], right: LegalPaginationBreak[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    if (!other) return false;
    return item.from === other.from && item.kind === other.kind && Math.abs(item.gap - other.gap) <= 4;
  });
}

function cssNumber(style: CSSStyleDeclaration, property: string, fallback: number): number {
  const value = Number.parseFloat(style.getPropertyValue(property));
  return Number.isFinite(value) ? value : fallback;
}

function computePaginationBreaks(view: EditorView, previous: LegalPaginationBreak[]): LegalPaginationBreak[] {
  const editorElement = view.dom as HTMLElement;
  const style = window.getComputedStyle(editorElement);
  const marginTop = cssNumber(style, "--legal-margin-top", 96);
  const marginBottom = cssNumber(style, "--legal-margin-bottom", 96);
  const pageHeight = cssNumber(style, "--legal-page-height", 1344);
  const contentHeight = cssNumber(style, "--legal-content-height", 1152);
  const pageGap = cssNumber(style, "--legal-page-gap", 28);
  const blocks: Array<{ from: number; nodeType: string; element: HTMLElement; height: number; offsetTop: number }> = [];

  view.state.doc.forEach((node, from) => {
    const dom = view.nodeDOM(from);
    if (!(dom instanceof HTMLElement)) return;
    blocks.push({
      from,
      nodeType: node.type.name,
      element: dom,
      height: dom.offsetHeight || dom.getBoundingClientRect().height,
      offsetTop: dom.offsetTop,
    });
  });

  if (blocks.length === 0) return [];

  const previousGapBefore = (from: number) => previous.reduce((total, item) => {
    const applies = item.kind === "manual" ? item.from < from : item.from <= from;
    return applies ? total + item.gap : total;
  }, 0);

  const nextBreaks: LegalPaginationBreak[] = [];
  let pageContentStart = marginTop;

  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    // Use offsetTop instead of getBoundingClientRect so scrolling container doesn't cause subpixel layout thrashing
    const naturalTop = block.offsetTop > 0
      ? block.offsetTop - previousGapBefore(block.from)
      : marginTop;

    if (block.nodeType === "legalPageBreak") {
      const remaining = Math.max(0, pageContentStart + contentHeight - naturalTop);
      const gap = Math.round(remaining + marginBottom + pageGap + marginTop);
      nextBreaks.push({ from: block.from, gap, kind: "manual" });
      pageContentStart = naturalTop;
      continue;
    }

    const nextBlock = blocks[index + 1];
    const keepWithNext = /^heading$/i.test(block.nodeType) && nextBlock
      ? Math.min(nextBlock.height, 120)
      : 0;
    const neededHeight = block.height <= contentHeight ? block.height + keepWithNext : Math.min(block.height, contentHeight);
    const pageBottom = pageContentStart + contentHeight;

    if (naturalTop > pageContentStart + 4 && naturalTop + neededHeight > pageBottom) {
      const gap = Math.round(Math.max(0, pageBottom - naturalTop) + marginBottom + pageGap + marginTop);
      nextBreaks.push({ from: block.from, gap, kind: "auto" });
      pageContentStart = naturalTop;
    }
  }

  const pageCount = nextBreaks.length + 1;
  if (editorElement.dataset.pageCount !== String(pageCount)) {
    editorElement.dataset.pageCount = String(pageCount);
  }
  const nextDocHeight = `${pageCount * pageHeight + Math.max(0, pageCount - 1) * pageGap}px`;
  if (editorElement.style.getPropertyValue("--legal-document-height") !== nextDocHeight) {
    editorElement.style.setProperty("--legal-document-height", nextDocHeight);
  }
  return nextBreaks;
}

export function createLegalPaginationPlugin(): Plugin<LegalPaginationState> {
  return new Plugin<LegalPaginationState>({
    key: legalPaginationPluginKey,
    state: {
      init: (_, state) => ({ breaks: [], decorations: DecorationSet.empty }),
      apply(transaction, value, _oldState, newState) {
        const nextBreaks = transaction.getMeta(legalPaginationPluginKey) as LegalPaginationBreak[] | undefined;
        if (nextBreaks) {
          return {
            breaks: nextBreaks,
            decorations: buildDecorations(newState.doc, nextBreaks),
          };
        }
        return {
          breaks: value.breaks,
          decorations: value.decorations.map(transaction.mapping, newState.doc),
        };
      },
    },
    props: {
      decorations(state) {
        return legalPaginationPluginKey.getState(state)?.decorations || DecorationSet.empty;
      },
    },
    view(initialView) {
      let frame = 0;
      let activeView = initialView;
      let isComputing = false;
      let lastWidth = initialView.dom.clientWidth;

      const schedule = () => {
        if (isComputing) return;
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(() => {
          if (!activeView || activeView.isDestroyed) return;
          isComputing = true;
          try {
            const current = legalPaginationPluginKey.getState(activeView.state)?.breaks || [];
            const next = computePaginationBreaks(activeView, current);
            if (!breaksEqual(current, next)) {
              activeView.dispatch(activeView.state.tr.setMeta(legalPaginationPluginKey, next));
            }
          } finally {
            isComputing = false;
          }
        });
      };

      const resizeObserver = typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver((entries) => {
            // Only recompute if width changed, not when height changes from decoration margin application
            const entry = entries[0];
            if (entry) {
              const currentWidth = entry.contentRect.width;
              if (Math.abs(currentWidth - lastWidth) > 2) {
                lastWidth = currentWidth;
                schedule();
              }
            }
          });

      resizeObserver?.observe(initialView.dom);
      void document.fonts?.ready.then(schedule);
      schedule();

      return {
        update(view, prevState) {
          activeView = view;
          // Only re-run pagination if document content actually changed
          if (!view.state.doc.eq(prevState.doc)) {
            schedule();
          }
        },
        destroy() {
          window.cancelAnimationFrame(frame);
          resizeObserver?.disconnect();
        },
      };
    },
  });
}

export const LegalPaginationExtension = Extension.create({
  name: "legalPagination",
  addProseMirrorPlugins() {
    return [createLegalPaginationPlugin()];
  },
});

export function getPaginatedEditorHTML(editor: Editor): string {
  const container = document.createElement("div");
  container.innerHTML = editor.getHTML();
  const topLevelElements = Array.from(container.children);
  const pagination = legalPaginationPluginKey.getState(editor.state);
  const autoBreaks = new Set((pagination?.breaks || []).filter((item) => item.kind === "auto").map((item) => item.from));

  editor.state.doc.forEach((_node, from, index) => {
    if (!autoBreaks.has(from)) return;
    const target = topLevelElements[index];
    if (!target) return;
    const marker = document.createElement("div");
    marker.setAttribute("data-type", "legal-page-break");
    marker.setAttribute("data-page-break", "true");
    target.before(marker);
  });

  return container.innerHTML;
}
