/**
 * LegalEditor — Tiptap-based rich-text editor for the Legal Drafting Studio.
 *
 * Features:
 *  - MS Word–style formatting toolbar (Bold, Italic, Underline, Strikethrough,
 *    Subscript, Superscript, Highlight, Font Size, Headings, Lists, Alignment,
 *    Indent/Outdent, Horizontal Rule, Table, Clear Formatting)
 *  - Times New Roman font at 13pt for court typography
 *  - Exposes imperative handle for parent to get/set content
 *  - Fires onUpdate callback on every content change
 *  - Supports selection-based snippet extraction for AI editing
 *  - /cite inline citation insertion from case-law search
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
  type Ref,
} from "react";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { CitationNode } from "./citation-node";
import { CitationSuggestion, type CitationSuggestionItem } from "./citation-suggestion";
import { CitationList, type CitationListHandle } from "./citation-list";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  RemoveFormatting,
  Highlighter,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Indent,
  Outdent,
  Minus,
  TableIcon,
  Palette,
  Type,
} from "lucide-react";

// ── Public imperative handle ─────────────────────────────────────────────

export type LegalEditorHandle = {
  /** Get the editor's content as HTML */
  getHTML: () => string;
  /** Get the editor's content as plain text */
  getText: () => string;
  /** Replace the entire editor content */
  setContent: (html: string) => void;
  /** Insert content at the current cursor position (or at the end) */
  insertContent: (html: string) => void;
  /** Get the currently selected text (empty string if no selection) */
  getSelectedText: () => string;
  /** Replace the current selection with new content */
  replaceSelection: (html: string) => void;
  /** Focus the editor */
  focus: () => void;
  /** Check if the editor is empty */
  isEmpty: () => boolean;
};

// ── Props ────────────────────────────────────────────────────────────────

type LegalEditorProps = {
  /** Initial HTML content */
  initialContent?: string;
  /** Callback fired on every content change (debounced in parent if needed) */
  onUpdate?: (html: string, text: string) => void;
  /** Placeholder when editor is empty */
  placeholder?: string;
  /** Extra CSS classes on the wrapper */
  className?: string;
};

// ── Toolbar button ───────────────────────────────────────────────────────

function ToolbarBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        inline-flex items-center justify-center size-9 rounded text-sm
        transition-colors
        ${active
          ? "bg-primary/25 text-primary border border-primary/40"
          : "text-muted-foreground hover:text-foreground hover:bg-card/60 border border-transparent"
        }
        disabled:opacity-30 disabled:cursor-not-allowed
      `}
    >
      {children}
    </button>
  );
}

function ToolbarSep() {
  return <div className="h-5 w-px bg-border/60 mx-1 shrink-0" />;
}

// ── Font size select ─────────────────────────────────────────────────────

function FontSizeSelect({ editor }: { editor: any }) {
  const sizes = ["10pt", "11pt", "12pt", "13pt", "14pt", "16pt", "18pt", "20pt", "24pt"];
  const current = editor?.getAttributes("textStyle")?.fontSize || "13pt";

  return (
    <select
      value={current}
      onChange={(e) => {
        const size = e.target.value;
        if (size === "13pt") {
          editor?.chain().focus().unsetFontSize().run();
        } else {
          editor?.chain().focus().setFontSize(size).run();
        }
      }}
      title="Font Size"
      className="h-7 text-[10px] rounded border border-border/60 bg-transparent text-foreground px-1 cursor-pointer focus:outline-none focus:border-primary/50"
    >
      {sizes.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

// ── Text color picker ────────────────────────────────────────────────────

function TextColorPicker({ editor }: { editor: any }) {
  const colors = ["#000000", "#1a2332", "#991b1b", "#166534", "#1e40af", "#7c2d12"];
  const [open, setOpen] = useState(false);
  const current = editor?.getAttributes("textStyle")?.color || "#000000";

  return (
    <div className="relative">
      <ToolbarBtn
        onClick={() => setOpen(!open)}
        title="Text Color"
        active={current !== "#000000"}
      >
        <div className="flex flex-col items-center gap-0">
          <Palette size={11} />
          <div className="w-3 h-0.5 rounded-full" style={{ background: current }} />
        </div>
      </ToolbarBtn>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 p-1.5 rounded-lg border border-border bg-popover shadow-lg flex gap-1">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => {
                if (c === "#000000") {
                  editor?.chain().focus().unsetColor().run();
                } else {
                  editor?.chain().focus().setColor(c).run();
                }
                setOpen(false);
              }}
              className="size-5 rounded border border-border/50 hover:scale-110 transition-transform"
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── FontSize extension (inline style) ────────────────────────────────────

const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setFontSize:
        (fontSize: string) =>
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize }).run(),
      unsetFontSize:
        () =>
        ({ chain }: any) =>
          chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

// ── Component ────────────────────────────────────────────────────────────

function LegalEditorInner(
  { initialContent, onUpdate, placeholder, className }: LegalEditorProps,
  ref: Ref<LegalEditorHandle>,
) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Placeholder.configure({
        placeholder: placeholder || "Begin drafting or load a template…",
      }),
      Typography,
      Highlight.configure({ multicolor: false }),
      Subscript,
      Superscript,
      FontSize,
      Color,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      CitationNode,
      CitationSuggestion.configure({
        suggestion: {
          render: () => {
            let component: ReactRenderer<CitationListHandle> | null = null;
            let popup: TippyInstance[] | null = null;

            return {
              onStart: (props: any) => {
                component = new ReactRenderer(CitationList, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                  maxWidth: 380,
                });
              },
              onUpdate: (props: any) => {
                component?.updateProps(props);
                if (popup?.[0] && props.clientRect) {
                  popup[0].setProps({
                    getReferenceClientRect: props.clientRect,
                  });
                }
              },
              onKeyDown: (props: any) => {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }
                return component?.ref?.onKeyDown(props) ?? false;
              },
              onExit: () => {
                popup?.[0]?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: {
        class: "legal-draft-editor outline-none",
        spellcheck: "true",
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement;
        const chip = target.closest?.('[data-type="citation"]') as HTMLElement | null;
        if (chip) {
          const jid = chip.getAttribute("data-judgment-id");
          if (jid) {
            window.open(`/judgment/${jid}`, "_blank");
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onUpdate?.(ed.getHTML(), ed.getText());
    },
  });

  // Expose imperative methods to parent
  useImperativeHandle(
    ref,
    () => ({
      getHTML: () => editor?.getHTML() ?? "",
      getText: () => editor?.getText() ?? "",
      setContent: (html: string) => {
        editor?.commands.setContent(html, { emitUpdate: false });
      },
      insertContent: (html: string) => {
        if (!editor) return;
        // If there's a selection, focus at end; otherwise insert at cursor
        editor.chain().focus().insertContent(html).run();
      },
      getSelectedText: () => {
        if (!editor) return "";
        const { from, to } = editor.state.selection;
        if (from === to) return "";
        return editor.state.doc.textBetween(from, to, "\n");
      },
      replaceSelection: (html: string) => {
        if (!editor) return;
        editor
          .chain()
          .focus()
          .deleteSelection()
          .insertContent(html)
          .run();
      },
      focus: () => editor?.commands.focus(),
      isEmpty: () => editor?.isEmpty ?? true,
    }),
    [editor],
  );

  // Update content when initialContent changes from outside (e.g. template load)
  const setContentExternal = useCallback(
    (html: string) => {
      if (!editor) return;
      // Only update if content actually changed to avoid cursor jump
      const current = editor.getHTML();
      if (current !== html) {
        editor.commands.setContent(html, { emitUpdate: false });
      }
    },
    [editor],
  );

  useEffect(() => {
    if (initialContent !== undefined) {
      setContentExternal(initialContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  if (!editor) return null;

  // ── Toolbar ───────────────────────────────────────────────────────

  return (
    <div className={className}>
      {/* Formatting toolbar — MS Word–style (sticky: follows scroll) */}
      <div className="flex items-center gap-1 flex-wrap px-3 py-2 border-b border-[hsl(var(--preview-border))] bg-background/95 backdrop-blur-xl sticky top-0 z-30">
        {/* Undo / Redo */}
        <ToolbarBtn
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={18} />
        </ToolbarBtn>

        <ToolbarSep />

        {/* Font size */}
        <FontSizeSelect editor={editor} />

        <ToolbarSep />

        {/* Text formatting */}
        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        >
          <Bold size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <Italic size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        >
          <Strikethrough size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          title="Highlight"
        >
          <Highlighter size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("subscript")}
          onClick={() => editor.chain().focus().toggleSubscript().run()}
          title="Subscript"
        >
          <SubscriptIcon size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("superscript")}
          onClick={() => editor.chain().focus().toggleSuperscript().run()}
          title="Superscript"
        >
          <SuperscriptIcon size={18} />
        </ToolbarBtn>

        <ToolbarSep />

        {/* Text color */}
        <TextColorPicker editor={editor} />

        <ToolbarSep />

        {/* Headings */}
        <ToolbarBtn
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1 — Court Title"
        >
          <Heading1 size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2 — Section"
        >
          <Heading2 size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3 — Sub-section"
        >
          <Heading3 size={18} />
        </ToolbarBtn>

        <ToolbarSep />

        {/* Lists */}
        <ToolbarBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <List size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          <ListOrdered size={18} />
        </ToolbarBtn>

        {/* Indent / Outdent */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().sinkListItem("listItem").run()}
          disabled={!editor.can().sinkListItem("listItem")}
          title="Increase Indent"
        >
          <Indent size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().liftListItem("listItem").run()}
          disabled={!editor.can().liftListItem("listItem")}
          title="Decrease Indent"
        >
          <Outdent size={18} />
        </ToolbarBtn>

        <ToolbarSep />

        {/* Text alignment */}
        <ToolbarBtn
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Align Left"
        >
          <AlignLeft size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Align Center"
        >
          <AlignCenter size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Align Right"
        >
          <AlignRight size={18} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: "justify" })}
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          title="Justify"
        >
          <AlignJustify size={18} />
        </ToolbarBtn>

        <ToolbarSep />

        {/* Horizontal Rule */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Horizontal Line"
        >
          <Minus size={18} />
        </ToolbarBtn>

        {/* Insert Table */}
        <ToolbarBtn
          onClick={() =>
            editor
              .chain()
              .focus()
              .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
              .run()
          }
          title="Insert Table"
        >
          <TableIcon size={18} />
        </ToolbarBtn>

        {/* Clear Formatting */}
        <ToolbarBtn
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Clear Formatting"
        >
          <RemoveFormatting size={18} />
        </ToolbarBtn>

        {/* Right side: word count + citation hint */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground/60 hidden md:inline">Type <code className="bg-card/60 px-1 py-0.5 rounded text-[8px] font-mono">/cite</code> to insert citation</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {editor.storage.characterCount?.words?.() ??
              editor.getText().split(/\s+/).filter(Boolean).length}{" "}
            words
          </span>
        </div>
      </div>

      {/* Editor content — flex-1 ensures it fills remaining space below sticky toolbar */}
      <div className="flex-1">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export const LegalEditor = forwardRef(LegalEditorInner);
