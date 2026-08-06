import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    legalPageBreak: {
      insertLegalPageBreak: () => ReturnType;
    };
  }
}

export const LegalPageBreak = Node.create({
  name: "legalPageBreak",
  group: "block",
  atom: true,
  selectable: true,
  defining: true,

  parseHTML() {
    return [
      { tag: 'div[data-type="legal-page-break"]' },
      { tag: "div[data-page-break]" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "legal-page-break",
        "data-page-break": "true",
        class: "legal-page-break",
        contenteditable: "false",
      }),
      ["span", { class: "legal-page-break-label" }, "PAGE BREAK"],
    ];
  },

  addCommands() {
    return {
      insertLegalPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },

  addKeyboardShortcuts() {
    return {
      "Mod-Enter": () => this.editor.commands.insertLegalPageBreak(),
    };
  },
});
