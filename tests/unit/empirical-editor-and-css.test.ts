import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";

// ── Define ProseMirror schema matching Tiptap legal editor ──
const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "inline*",
      attrs: {
        lineHeight: { default: "1.3" },
        textAlign: { default: "justify" },
        indent: { default: 0 },
      },
      parseDOM: [{ tag: "p" }],
      toDOM: (node) => [
        "p",
        {
          style: `line-height: ${node.attrs.lineHeight}; text-align: ${node.attrs.textAlign};`,
          "data-indent": node.attrs.indent,
        },
        0,
      ],
    },
    heading: {
      group: "block",
      content: "inline*",
      attrs: {
        level: { default: 1 },
        lineHeight: { default: "1.3" },
      },
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } },
      ],
      toDOM: (node) => [`h${node.attrs.level}`, { style: `line-height: ${node.attrs.lineHeight}` }, 0],
    },
    text: {
      group: "inline",
    },
  },
  marks: {
    bold: {
      parseDOM: [{ tag: "strong" }, { tag: "b" }],
      toDOM: () => ["strong", 0],
    },
    italic: {
      parseDOM: [{ tag: "em" }, { tag: "i" }],
      toDOM: () => ["em", 0],
    },
    underline: {
      parseDOM: [{ tag: "u" }],
      toDOM: () => ["u", 0],
    },
    citation: {
      attrs: { citationText: { default: "" } },
      parseDOM: [{ tag: "span[data-citation]" }],
      toDOM: (mark) => ["span", { "data-citation": mark.attrs.citationText }, 0],
    },
  },
});

type CaseMode = "upper" | "lower" | "capitalize" | "sentence" | "toggle";

function applyCase(text: string, mode: CaseMode): string {
  switch (mode) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "capitalize":
      return text.toLowerCase().replace(/\b[a-zA-Z]/g, (c) => c.toUpperCase());
    case "sentence":
      return text.toLowerCase().replace(/(^\s*[a-zA-Z]|[.\!?]\s+[a-zA-Z])/g, (c) => c.toUpperCase());
    case "toggle":
      return text
        .split("")
        .map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))
        .join("");
    default:
      return text;
  }
}

// Function replicating applyTextCase from legal-editor.tsx
function executeApplyTextCase(state: EditorState, mode: CaseMode): { newState: EditorState; modified: boolean } {
  const { doc, schema, tr } = state;
  const { from, to } = state.selection;
  const hasSelection = from !== to;
  const targetFrom = hasSelection ? from : 0;
  const targetTo = hasSelection ? to : doc.content.size;

  const textNodesToTransform: Array<{
    start: number;
    end: number;
    text: string;
    transformed: string;
    marks: readonly any[];
  }> = [];

  doc.nodesBetween(targetFrom, targetTo, (node: any, pos: number) => {
    if (node.isText && node.text) {
      const nodeStart = pos;
      const nodeEnd = pos + node.text.length;
      const sliceStart = Math.max(targetFrom, nodeStart);
      const sliceEnd = Math.min(targetTo, nodeEnd);
      if (sliceStart < sliceEnd) {
        const offsetStart = sliceStart - nodeStart;
        const offsetEnd = sliceEnd - nodeStart;
        const originalSlice = node.text.substring(offsetStart, offsetEnd);
        const transformed = applyCase(originalSlice, mode);
        if (transformed !== originalSlice) {
          textNodesToTransform.push({
            start: sliceStart,
            end: sliceEnd,
            text: originalSlice,
            transformed,
            marks: node.marks,
          });
        }
      }
    }
  });

  if (textNodesToTransform.length > 0) {
    for (let idx = textNodesToTransform.length - 1; idx >= 0; idx--) {
      const item = textNodesToTransform[idx];
      const newTextNode = schema.text(item.transformed, item.marks);
      tr.replaceWith(item.start, item.end, newTextNode);
    }
    return { newState: state.apply(tr), modified: true };
  }
  return { newState: state, modified: false };
}

// Function replicating LineSpacing multi-node mutation from legal-editor.tsx
function executeSetLineSpacing(state: EditorState, value: string): { newState: EditorState; modified: boolean } {
  const { from, to } = state.selection;
  const { tr } = state;
  let modified = false;

  state.doc.nodesBetween(from, to, (node: any, pos: number) => {
    if (node.type.name === "paragraph" || node.type.name === "heading") {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        lineHeight: value,
      });
      modified = true;
    }
  });

  if (modified) {
    return { newState: state.apply(tr), modified: true };
  }
  return { newState: state, modified: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Empirical Tests for applyCase and applyTextCase
// ─────────────────────────────────────────────────────────────────────────────

test("Empirical applyCase pure unit tests", () => {
  // UPPERCASE
  assert.equal(applyCase("writ petition 2026", "upper"), "WRIT PETITION 2026");
  assert.equal(applyCase("Already UPPER", "upper"), "ALREADY UPPER");

  // lowercase
  assert.equal(applyCase("HIGH COURT OF SINDH", "lower"), "high court of sindh");

  // Capitalize Each Word
  assert.equal(applyCase("in the high court of judicature", "capitalize"), "In The High Court Of Judicature");
  assert.equal(applyCase("SECTION 497 CR.P.C.", "capitalize"), "Section 497 Cr.P.C.");

  // Sentence case
  assert.equal(
    applyCase("the petitioner is aggrieved. no notice was issued! why? because of negligence.", "sentence"),
    "The petitioner is aggrieved. No notice was issued! Why? Because of negligence."
  );
  assert.equal(
    applyCase("   leading whitespace sentence. next sentence.", "sentence"),
    "   Leading whitespace sentence. Next sentence."
  );

  // Toggle case
  assert.equal(applyCase("High Court 1973", "toggle"), "hIGH cOURT 1973");
});

test("Empirical applyTextCase with ProseMirror rich text & mark preservation", () => {
  // Construct a doc: <p>Hello <strong>bold world</strong> and <em>italic end</em>.</p>
  const boldMark = schema.marks.bold.create();
  const italicMark = schema.marks.italic.create();
  const citationMark = schema.marks.citation.create({ citationText: "2024 SCMR 123" });

  const doc = schema.nodes.doc.create({}, [
    schema.nodes.paragraph.create({}, [
      schema.text("Hello "),
      schema.text("bold world", [boldMark]),
      schema.text(" and "),
      schema.text("cited term", [citationMark, italicMark]),
      schema.text("."),
    ]),
    schema.nodes.paragraph.create({}, [
      schema.text("Second paragraph for multi-paragraph test."),
    ]),
  ]);

  // Case 1: Apply UPPERCASE to entire document (no selection, cursor at 0)
  const initialState = EditorState.create({ doc, schema });
  const { newState: upperState, modified: modified1 } = executeApplyTextCase(initialState, "upper");

  assert.equal(modified1, true);
  const p1 = upperState.doc.child(0);
  assert.equal(p1.child(0).text, "HELLO ");
  assert.equal(p1.child(1).text, "BOLD WORLD");
  // Check marks preserved!
  assert.equal(p1.child(1).marks.length, 1);
  assert.equal(p1.child(1).marks[0].type.name, "bold");

  assert.equal(p1.child(2).text, " AND ");
  assert.equal(p1.child(3).text, "CITED TERM");
  assert.equal(p1.child(3).marks.length, 2);
  const markNames = p1.child(3).marks.map((m: any) => m.type.name);
  assert.ok(markNames.includes("citation"));
  assert.ok(markNames.includes("italic"));

  // Case 2: Apply lowercase only to a partial selection spanning across bold mark
  // Selection across "lo bold wo"
  const selectionStart = 4; // in "Hello"
  const selectionEnd = 15; // in "bold world"
  const selState = EditorState.create({
    doc,
    schema,
    selection: TextSelection.create(doc, selectionStart, selectionEnd),
  });

  const { newState: lowerState, modified: modified2 } = executeApplyTextCase(selState, "upper");
  assert.equal(modified2, true);
  // Verify that only the selected slice was uppercase, and marks are intact
  const transformedP = lowerState.doc.child(0);
  assert.equal(transformedP.child(0).text, "HelLO "); // 'lo ' uppercased to 'LO '
  assert.equal(transformedP.child(1).text, "BOLD WORld"); // 'bold wor' uppercased to 'BOLD WOR'
  assert.equal(transformedP.child(1).marks[0].type.name, "bold");
});

// ─────────────────────────────────────────────────────────────────────────────
// Empirical Tests for LineSpacing across Multiple Blocks
// ─────────────────────────────────────────────────────────────────────────────

test("Empirical LineSpacingSelect multi-paragraph mutation", () => {
  const doc = schema.nodes.doc.create({}, [
    schema.nodes.heading.create({ level: 1, lineHeight: "1.0" }, [schema.text("Heading 1")]),
    schema.nodes.paragraph.create({ lineHeight: "1.0", textAlign: "justify", indent: 2 }, [schema.text("Paragraph 1")]),
    schema.nodes.paragraph.create({ lineHeight: "1.0", textAlign: "justify", indent: 0 }, [schema.text("Paragraph 2")]),
    schema.nodes.paragraph.create({ lineHeight: "1.0", textAlign: "justify", indent: 0 }, [schema.text("Paragraph 3")]),
  ]);

  // Select from Heading 1 through Paragraph 2 (positions 0 to 25)
  const selState = EditorState.create({
    doc,
    schema,
    selection: TextSelection.create(doc, 1, 25),
  });

  // Apply line spacing "1.5"
  const { newState, modified } = executeSetLineSpacing(selState, "1.5");
  assert.equal(modified, true);

  // Assert Heading 1 has lineHeight 1.5
  assert.equal(newState.doc.child(0).attrs.lineHeight, "1.5");
  assert.equal(newState.doc.child(0).attrs.level, 1); // level preserved

  // Assert Paragraph 1 has lineHeight 1.5 and preserved indent/textAlign
  assert.equal(newState.doc.child(1).attrs.lineHeight, "1.5");
  assert.equal(newState.doc.child(1).attrs.indent, 2);
  assert.equal(newState.doc.child(1).attrs.textAlign, "justify");

  // Assert Paragraph 2 has lineHeight 1.5
  assert.equal(newState.doc.child(2).attrs.lineHeight, "1.5");

  // Assert Paragraph 3 (outside selection) remains untouched with lineHeight 1.0
  assert.equal(newState.doc.child(3).attrs.lineHeight, "1.0");
});

// ─────────────────────────────────────────────────────────────────────────────
// Empirical Verification of preview-theme.css Properties
// ─────────────────────────────────────────────────────────────────────────────

test("Empirical CSS properties verification in preview-theme.css", () => {
  const cssPath = path.resolve(process.cwd(), "client/src/experimental/styles/preview-theme.css");
  assert.ok(fs.existsSync(cssPath), "preview-theme.css must exist");

  const css = fs.readFileSync(cssPath, "utf-8");

  // 1. Legal draft editor base styling
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor\s*\{[^}]*font-family:\s*['"]Times New Roman['"]/s,
    "Must specify Times New Roman font family"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor\s*\{[^}]*font-size:\s*13pt/s,
    "Must specify font-size: 13pt"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor\s*\{[^}]*line-height:\s*1\.35/s,
    "Must specify line-height: 1.35"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor\s*\{[^}]*text-align:\s*justify/s,
    "Must specify text-align: justify"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor\s*\{[^}]*width:\s*min\(100%,\s*1160px\)/s,
    "Must specify width: min(100%, 1160px)"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor\s*\{[^}]*padding:\s*var\(--legal-margin-top,\s*96px\)\s+var\(--legal-margin-right,\s*96px\)\s+var\(--legal-margin-bottom,\s*96px\)\s+var\(--legal-margin-left,\s*120px\)/s,
    "Must specify Pakistani court margins with 120px (1.25in) left margin"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor\s*\{[^}]*background-repeat:\s*repeat-y/s,
    "Must specify repeating page background"
  );

  // 2. Headings hierarchy
  // H1: 15pt bold uppercase centered
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor h1\s*\{[^}]*font-size:\s*15pt/s,
    "H1 must be 15pt"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor h1\s*\{[^}]*text-align:\s*center/s,
    "H1 must be centered"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor h1\s*\{[^}]*text-transform:\s*uppercase/s,
    "H1 must be uppercase"
  );

  // H2: 14pt bold uppercase
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor h2\s*\{[^}]*font-size:\s*14pt/s,
    "H2 must be 14pt"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor h2\s*\{[^}]*text-transform:\s*uppercase/s,
    "H2 must be uppercase"
  );

  // H3: 13pt bold
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor h3\s*\{[^}]*font-size:\s*13pt/s,
    "H3 must be 13pt"
  );

  // 3. Body paragraphs & lists
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor p\s*\{[^}]*font-size:\s*13pt/s,
    "Paragraphs must be 13pt"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor p\s*\{[^}]*line-height:\s*1\.35/s,
    "Paragraphs must have 1.35 line height"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor p\s*\{[^}]*text-align:\s*justify/s,
    "Paragraphs must be justified"
  );
  assert.match(
    css,
    /\.preview-theme-scope \.legal-draft-editor li\s*\{[^}]*font-size:\s*13pt/s,
    "List items must be 13pt"
  );

  // Indentation override for centered and right aligned text
  assert.match(
    css,
    /p\[style\*="text-align:\s*center"\],\s*\.preview-theme-scope \.legal-draft-editor p\[style\*="text-align:center"\]/s,
    "Centered/right aligned text must override text-indent to 0"
  );

  // 4. Dark Paper Mode
  assert.match(
    css,
    /\[data-paper-mode="dark"\] \.legal-draft-editor\s*\{[^}]*#1E293B/s,
    "Dark paper mode must use #1E293B page surface"
  );
  assert.match(
    css,
    /\[data-paper-mode="dark"\] \.legal-draft-editor h1/s,
    "Dark paper mode must have h1 text color override"
  );
  assert.match(
    css,
    /\[data-paper-mode="dark"\] \.legal-draft-editor p/s,
    "Dark paper mode must have body text color override"
  );
  assert.match(
    css,
    /\[data-paper-mode="dark"\] \.legal-editor-toolbar/s,
    "Dark paper mode must have toolbar dark styling"
  );
});
