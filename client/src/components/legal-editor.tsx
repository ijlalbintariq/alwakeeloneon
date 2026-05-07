/**
 * LegalEditor — Tiptap-based rich-text editor for the Legal Drafting Studio.
 *
 * Features:
 *  - Court-ready formatting toolbar (Bold, Italic, Underline, Headings, Lists, Alignment)
 *  - Times New Roman font at 13pt for court typography
 *  - Exposes imperative handle for parent to get/set content
 *  - Fires onUpdate callback on every content change
 *  - Supports selection-based snippet extraction for AI editing
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  type Ref,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  RemoveFormatting,
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
        inline-flex items-center justify-center size-8 rounded-md text-[13px]
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
  return <div className="h-5 w-px bg-border/60 mx-0.5 shrink-0" />;
}

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
    ],
    content: initialContent || "",
    editorProps: {
      attributes: {
        class: "legal-draft-editor outline-none",
        spellcheck: "true",
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
      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap px-3 md:px-4 py-2 border-b border-[hsl(var(--preview-border))] bg-background/50 backdrop-blur-xl">
        {/* Text formatting */}
        <ToolbarBtn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold (Ctrl+B)"
        >
          <Bold size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic (Ctrl+I)"
        >
          <Italic size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={14} />
        </ToolbarBtn>

        <ToolbarSep />

        {/* Headings */}
        <ToolbarBtn
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          title="Heading 1 — Court/Case Title"
        >
          <Heading1 size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Heading 2 — Section (Prayer, Grounds)"
        >
          <Heading2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Heading 3 — Sub-section"
        >
          <Heading3 size={14} />
        </ToolbarBtn>

        <ToolbarSep />

        {/* Lists */}
        <ToolbarBtn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <List size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          <ListOrdered size={14} />
        </ToolbarBtn>

        <ToolbarSep />

        {/* Text alignment */}
        <ToolbarBtn
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title="Align Left"
        >
          <AlignLeft size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title="Align Center"
        >
          <AlignCenter size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title="Align Right"
        >
          <AlignRight size={14} />
        </ToolbarBtn>

        <ToolbarSep />

        {/* Undo / Redo / Clear */}
        <ToolbarBtn
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 size={14} />
        </ToolbarBtn>
        <ToolbarBtn
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Clear Formatting"
        >
          <RemoveFormatting size={14} />
        </ToolbarBtn>

        {/* Word count */}
        <div className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {editor.storage.characterCount?.words?.() ??
            editor.getText().split(/\s+/).filter(Boolean).length}{" "}
          words
        </div>
      </div>

      {/* Editor content */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export const LegalEditor = forwardRef(LegalEditorInner);
