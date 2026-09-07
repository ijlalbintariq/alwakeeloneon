import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { plainTextToTiptapHTML, parseInlineFormatting, isHTMLContent } from "../../client/src/experimental/lib/plain-to-tiptap";
import {
  ALL_DRAFTING_TEMPLATES,
  COURT_PETITIONS,
  COMMERCIAL_CONTRACTS,
  STATUTORY_CLAUSES,
} from "../../client/src/experimental/components/drafting/drafting-data";
import * as allTemplates from "../../client/src/lib/templates-data";

// Helper to check for raw markdown marks
function findRawMarkdownArtifacts(html: string): string[] {
  const leaks: string[] = [];
  
  // Check for raw bold asterisks (e.g. **something**)
  const boldMatch = html.match(/\*\*[^*<>\n]+\*\*/g);
  if (boldMatch) {
    leaks.push(`Raw ** bold found: ${boldMatch.join(", ")}`);
  }

  // Check for standalone unparsed asterisks that look like markdown bold/italic
  // (ignoring multiplication or list bullets if any, but in HTML there shouldn't be markdown bold)
  const strayBold = html.match(/\*\*/g);
  if (strayBold) {
    leaks.push(`Stray ** found: count ${strayBold.length}`);
  }

  // Check for unparsed strikethrough ~~something~~
  const strikeMatch = html.match(/~~[^~<>\n]+~~/g);
  if (strikeMatch) {
    leaks.push(`Raw ~~ strikethrough found: ${strikeMatch.join(", ")}`);
  }

  // Check for unparsed inline code `something`
  const codeMatch = html.match(/`[^`<>\n]+`/g);
  if (codeMatch) {
    leaks.push(`Raw \` code found: ${codeMatch.join(", ")}`);
  }

  // Check for unrendered markdown heading prefixes inside paragraphs (e.g. <p>### Heading</p>)
  const headingLeak = html.match(/<p>\s*#{1,6}\s+[^<]+<\/p>/g);
  if (headingLeak) {
    leaks.push(`Unrendered markdown heading in paragraph: ${headingLeak.join(", ")}`);
  }

  // Check for double escaped entities that shouldn't be double escaped
  if (html.includes("&amp;lt;") || html.includes("&amp;gt;")) {
    leaks.push("Double escaped HTML entities found");
  }

  return leaks;
}

test("Empirical Test Suite 1: Ingestion of ALL templates in drafting-data.ts", () => {
  console.log(`Testing ${ALL_DRAFTING_TEMPLATES.length} templates from drafting-data.ts...`);
  
  for (const tpl of ALL_DRAFTING_TEMPLATES) {
    const html = plainTextToTiptapHTML(tpl.body);
    
    assert.ok(html, `Output HTML should be non-empty for template ${tpl.id} (${tpl.title})`);
    assert.ok(html.startsWith("<"), `Output HTML should start with a tag for template ${tpl.id}`);
    
    const leaks = findRawMarkdownArtifacts(html);
    assert.equal(
      leaks.length,
      0,
      `Template ${tpl.id} (${tpl.title}) has raw markdown leaks:\n${leaks.join("\n")}\n\nGenerated HTML snippet:\n${html.slice(0, 500)}`
    );
  }
});

test("Empirical Test Suite 2: Ingestion of all raw exported templates in templates-data.ts", () => {
  const exportedTemplateKeys = Object.keys(allTemplates).filter(k => typeof (allTemplates as any)[k] === "string");
  console.log(`Testing ${exportedTemplateKeys.length} raw template strings from templates-data.ts...`);

  for (const key of exportedTemplateKeys) {
    const rawTemplate = (allTemplates as any)[key];
    const html = plainTextToTiptapHTML(rawTemplate);

    assert.ok(html, `Output HTML should be non-empty for ${key}`);
    const leaks = findRawMarkdownArtifacts(html);
    assert.equal(
      leaks.length,
      0,
      `Template ${key} has raw markdown leaks:\n${leaks.join("\n")}`
    );
  }
});

test("Empirical Test Suite 3: Ingestion of all Statutory Clauses in drafting-data.ts", () => {
  console.log(`Testing ${STATUTORY_CLAUSES.length} statutory clauses...`);
  for (const clause of STATUTORY_CLAUSES) {
    const html = plainTextToTiptapHTML(clause.clauseText);
    assert.ok(html, `Output HTML should be non-empty for clause ${clause.id}`);
    const leaks = findRawMarkdownArtifacts(html);
    assert.equal(
      leaks.length,
      0,
      `Clause ${clause.id} (${clause.title}) has raw markdown leaks:\n${leaks.join("\n")}`
    );
  }
});

test("Empirical Test Suite 4: Multi-level court grounds formatting", () => {
  const groundsInput = [
    "GROUNDS:",
    "A. That the petitioner is aggrieved of the impugned order.",
    "B. That the learned court failed to appreciate material evidence on record.",
    "I. That the provision of Section 12(2) CPC was improperly invoked.",
    "II. That fundamental rights under Article 10-A, 18, and 25 were violated.",
    "III. That no show cause notice was ever served.",
    "(a) That the alleged agreement was unregistered.",
    "(b) That the attesting witnesses were interested parties.",
    "(i) Sub-ground under roman parenthesis.",
    "(ii) Another sub-ground under roman parenthesis.",
    "1. First numbered ground.",
    "2. Second numbered ground.",
    "1.1. Sub-numbered ground item.",
    "1.2. Another sub-numbered ground item.",
  ].join("\n");

  const html = plainTextToTiptapHTML(groundsInput);

  assert.match(html, /<h2><strong>GROUNDS:<\/strong><\/h2>/);
  assert.match(html, /<p style="text-indent:1.5em">A\. That the petitioner/);
  assert.match(html, /<p style="text-indent:1.5em">B\. That the learned/);
  assert.match(html, /<p style="text-indent:1.5em">I\. That the provision/);
  assert.match(html, /<p style="text-indent:1.5em">II\. That fundamental/);
  assert.match(html, /<p style="text-indent:1.5em">III\. That no show/);
  assert.match(html, /<p style="text-indent:1.5em">\(a\) That the alleged/);
  assert.match(html, /<p style="text-indent:1.5em">\(b\) That the attesting/);
  assert.match(html, /<p style="text-indent:1.5em">\(i\) Sub-ground/);
  assert.match(html, /<p style="text-indent:1.5em">\(ii\) Another sub-ground/);
  assert.match(html, /<p style="text-indent:1.5em">1\. First numbered/);
  assert.match(html, /<p style="text-indent:1.5em">2\. Second numbered/);
  assert.match(html, /<p style="text-indent:1.5em">1\.1\. Sub-numbered/);
  assert.match(html, /<p style="text-indent:1.5em">1\.2\. Another sub-numbered/);
});

test("Empirical Test Suite 5: Centered titles & Court Department headers", () => {
  const courtHeaderSamples = [
    {
      input: "IN THE HIGH COURT OF SINDH, BENCH AT SUKKUR\n(JUDICIAL DEPARTMENT)\nWRIT PETITION NO. 1234/2026",
      expectedMatches: [
        /<h1 style="text-align:center"><strong>IN THE HIGH COURT OF SINDH, BENCH AT SUKKUR<\/strong><\/h1>/,
        /<p style="text-align:center;font-weight:bold;margin-top:0.2em;margin-bottom:0.6em"><em>\(JUDICIAL DEPARTMENT\)<\/em><\/p>/,
        /<p style="text-align:center"><strong>WRIT PETITION NO\. 1234\/2026<\/strong><\/p>/,
      ]
    },
    {
      input: "IN THE SUPREME COURT OF PAKISTAN\n(APPELLATE JURISDICTION)\nCivil Petition for Leave to Appeal No. 99 of 2026",
      expectedMatches: [
        /<h1 style="text-align:center"><strong>IN THE SUPREME COURT OF PAKISTAN<\/strong><\/h1>/,
        /<p style="text-align:center;font-weight:bold;margin-top:0.2em;margin-bottom:0.6em"><em>\(APPELLATE JURISDICTION\)<\/em><\/p>/,
        /<p style="text-align:center"><strong>Civil Petition for Leave to Appeal No\. 99 of 2026<\/strong><\/p>/,
      ]
    },
    {
      input: "BEFORE THE HON'BLE LAHORE HIGH COURT, LAHORE\n(RAWALPINDI BENCH, RAWALPINDI)\nC.M.A. No. 456-M / 2026",
      expectedMatches: [
        /<h1 style="text-align:center"><strong>BEFORE THE HON'BLE LAHORE HIGH COURT, LAHORE<\/strong><\/h1>/,
        /<p style="text-align:center;font-weight:bold;margin-top:0.2em;margin-bottom:0.6em"><em>\(RAWALPINDI BENCH, RAWALPINDI\)<\/em><\/p>/,
        /<p style="text-align:center"><strong>C\.M\.A\. No\. 456-M \/ 2026<\/strong><\/p>/,
      ]
    },
    {
      input: "WRIT PETITION UNDER ARTICLE 199 OF THE CONSTITUTION OF THE ISLAMIC REPUBLIC OF PAKISTAN, 1973",
      expectedMatches: [
        /<h2 style="text-align:center"><strong>WRIT PETITION UNDER ARTICLE 199 OF THE CONSTITUTION OF THE ISLAMIC REPUBLIC OF PAKISTAN, 1973<\/strong><\/h2>/
      ]
    },
    {
      input: "SUIT FOR DECLARATION, CANCELLATION OF REGISTERED SALE DEED NO. 4589 DATED 04.11.2024, AND PERMANENT INJUNCTION",
      expectedMatches: [
        /<h2 style="text-align:center"><strong>SUIT FOR DECLARATION, CANCELLATION OF REGISTERED SALE DEED NO\. 4589 DATED 04\.11\.2024, AND PERMANENT INJUNCTION<\/strong><\/h2>/
      ]
    }
  ];

  for (const sample of courtHeaderSamples) {
    const html = plainTextToTiptapHTML(sample.input);
    for (const matchRe of sample.expectedMatches) {
      assert.match(
        html,
        matchRe,
        `Expected ${matchRe} in generated HTML for input:\n${sample.input}\n\nActual HTML:\n${html}`
      );
    }
  }
});

test("Empirical Test Suite 6: Markdown edge cases and stress testing", () => {
  const testCases = [
    {
      desc: "Nested bold and italic inside list",
      input: "- This is ***bold italic*** and **just bold** and *just italic*",
      expected: "<ul><li>This is <strong><em>bold italic</em></strong> and <strong>just bold</strong> and <em>just italic</em></li></ul>"
    },
    {
      desc: "Fill-in-the-blank lines with 3+ underscores must remain intact",
      input: "Name: _____________\nCNIC: 35201-_______-_",
      expected: "<p>Name: _____________&lt;br&gt;CNIC: 35201-_______-_</p>" // or normalized br
    },
    {
      desc: "Party roles alignment",
      input: "Malik Khalid Mahmood\n... PLAINTIFF\nVERSUS\nTariq Jameel\n... DEFENDANT",
      asserts: (html: string) => {
        assert.match(html, /<p style="text-align:right"><strong>\.\.\. PLAINTIFF<\/strong><\/p>/);
        assert.match(html, /<p style="text-align:center;margin:0.8em 0"><strong>VERSUS<\/strong><\/p>/);
        assert.match(html, /<p style="text-align:right"><strong>\.\.\. DEFENDANT<\/strong><\/p>/);
      }
    },
    {
      desc: "Special legal page breaks on AFFIDAVIT and VAKALATNAMA",
      input: "AFFIDAVIT:\nI, Muhammad Usman, do hereby affirm...",
      asserts: (html: string) => {
        assert.match(html, /<div data-type="legal-page-break" data-page-break="true"><\/div>/);
        assert.match(html, /<h2>AFFIDAVIT:<\/h2>/);
      }
    },
    {
      desc: "Table markdown parsing",
      input: "| Item | Description | Amount (PKR) |\n|---|---|---|\n| 1 | Advance Consideration | 500,000 |\n| 2 | Final Balance | 1,500,000 |",
      asserts: (html: string) => {
        assert.match(html, /<table style="width:100%;border-collapse:collapse;border:1px solid #333;margin:1em 0">/);
        assert.match(html, /<th style="border:1px solid #333;padding:6px 10px;background:#f0f0f0;font-weight:bold;">Item<\/th>/);
        assert.match(html, /<td style="border:1px solid #333;padding:6px 10px;">500,000<\/td>/);
      }
    }
  ];

  for (const tc of testCases) {
    const html = plainTextToTiptapHTML(tc.input);
    if (tc.asserts) {
      tc.asserts(html);
    }
  }
});
