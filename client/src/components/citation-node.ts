/**
 * CitationNode — Custom Tiptap Node for inline legal citations.
 *
 * Renders as a styled inline chip: e.g.  「PLD 2023 SC 145」
 * Stores citation, title, court, and optional judgment ID as attributes.
 * On click in the browser, opens the judgment page in a new tab.
 */

import { Node, mergeAttributes } from "@tiptap/core";

export interface CitationAttributes {
  citation: string;
  title: string;
  court: string;
  judgmentId?: string | null;
}

export const CitationNode = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true, // non-editable block — treated as a single unit

  addAttributes() {
    return {
      citation: { default: "" },
      title: { default: "" },
      court: { default: "" },
      judgmentId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="citation"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "citation",
        class: "citation-chip",
        title: HTMLAttributes.title || "",
        "data-judgment-id": HTMLAttributes.judgmentId || "",
        contenteditable: "false",
      }),
      HTMLAttributes.citation || "Citation",
    ];
  },
});
