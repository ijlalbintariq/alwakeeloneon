import test from "node:test";
import assert from "node:assert/strict";
import { plainTextToTiptapHTML, parseInlineFormatting } from "../../client/src/experimental/lib/plain-to-tiptap";
import { PARTNERSHIP_TEMPLATE, SAAS_TEMPLATE } from "../../client/src/lib/templates-data";

test("parseInlineFormatting correctly parses all markdown marks", () => {
  // Bold
  assert.equal(parseInlineFormatting("**[PARTNER 1 NAME]**"), "<strong>[PARTNER 1 NAME]</strong>");
  assert.equal(parseInlineFormatting("**PARTNER 1 NAME**"), "<strong>PARTNER 1 NAME</strong>");
  assert.equal(parseInlineFormatting("__Firm Name__"), "<strong>Firm Name</strong>");

  // Italic
  assert.equal(parseInlineFormatting("*italicized term*"), "<em>italicized term</em>");
  assert.equal(parseInlineFormatting("_single word_"), "<em>single word</em>");

  // Bold Italic
  assert.equal(parseInlineFormatting("***Important Rule***"), "<strong><em>Important Rule</em></strong>");

  // Strikethrough
  assert.equal(parseInlineFormatting("~~obsolete clause~~"), "<s>obsolete clause</s>");

  // Code
  assert.equal(parseInlineFormatting("`const x = 10`"), "<code>const x = 10</code>");

  // Fill-in blanks (3+ underscores) must remain underscores
  assert.equal(parseInlineFormatting("CNIC No. _________________________"), "CNIC No. _________________________");
  assert.equal(parseInlineFormatting("No. ______ of 2026"), "No. ______ of 2026");

  // Safe HTML normalization
  assert.equal(parseInlineFormatting("<b>bold</b> and <i>italic</i>"), "<strong>bold</strong> and <em>italic</em>");

  // Unknown tags escaped
  assert.equal(parseInlineFormatting("<custom-element>text</custom-element>"), "&lt;custom-element&gt;text&lt;/custom-element&gt;");
});

test("plainTextToTiptapHTML centers major court pleading titles", () => {
  const input = "WRIT PETITION UNDER ARTICLE 199 OF THE CONSTITUTION OF ISLAMIC REPUBLIC OF PAKISTAN, 1973";
  const html = plainTextToTiptapHTML(input);
  assert.match(html, /<h2 style="text-align:center"><strong>WRIT PETITION UNDER ARTICLE 199/);
});

test("plainTextToTiptapHTML formats court subtitles like (JUDICIAL DEPARTMENT) as centered subtitles", () => {
  const input = [
    "IN THE HIGH COURT OF SINDH, BENCH AT SUKKUR",
    "(JUDICIAL DEPARTMENT)",
    "WRIT PETITION NO. _________ OF 2025",
  ].join("\n");
  const html = plainTextToTiptapHTML(input);

  assert.match(html, /<h1 style="text-align:center"><strong>IN THE HIGH COURT OF SINDH/);
  assert.match(html, /<p style="text-align:center;font-weight:bold;margin-top:0.2em;margin-bottom:0.6em"><em>\(JUDICIAL DEPARTMENT\)<\/em><\/p>/);
  assert.match(html, /<p style="text-align:center"><strong>WRIT PETITION NO/);
});

test("plainTextToTiptapHTML renders bullet lists into <ul><li> elements", () => {
  const input = [
    "The following conditions apply:",
    "- Partner 1: PKR 500,000",
    "- Partner 2: PKR 500,000",
    "- Partner 3: PKR 250,000",
  ].join("\n");
  const html = plainTextToTiptapHTML(input);

  assert.match(html, /<ul><li>Partner 1: PKR 500,000<\/li><li>Partner 2: PKR 500,000<\/li><li>Partner 3: PKR 250,000<\/li><\/ul>/);
});

test("plainTextToTiptapHTML parses horizontal rules into <hr>", () => {
  const input = [
    "Section 1",
    "---",
    "Section 2",
  ].join("\n");
  const html = plainTextToTiptapHTML(input);

  assert.match(html, /<hr>/);
});

test("plainTextToTiptapHTML parses court grounds as individual formatted paragraphs", () => {
  const input = [
    "GROUNDS:",
    "A. That the impugned order passed by the Respondent is illegal and void ab initio.",
    "B. That no opportunity of hearing or show-cause notice was issued to the Petitioner.",
    "I. That the action violates fundamental rights guaranteed under Article 10-A.",
    "II. That the authority acted ultra vires.",
    "(a) That Section 24-A of the General Clauses Act was not adhered to.",
    "(b) That irreparable loss will be caused to the Petitioner.",
  ].join("\n");
  const html = plainTextToTiptapHTML(input);

  assert.match(html, /<h2><strong>GROUNDS:<\/strong><\/h2>/);
  assert.match(html, /<p style="text-indent:1.5em">A\. That the impugned order/);
  assert.match(html, /<p style="text-indent:1.5em">B\. That no opportunity/);
  assert.match(html, /<p style="text-indent:1.5em">I\. That the action violates/);
  assert.match(html, /<p style="text-indent:1.5em">II\. That the authority/);
  assert.match(html, /<p style="text-indent:1.5em">\(a\) That Section 24-A/);
  assert.match(html, /<p style="text-indent:1.5em">\(b\) That irreparable loss/);
});

test("plainTextToTiptapHTML parses commercial contract templates without raw markdown leakage", () => {
  const html = plainTextToTiptapHTML(PARTNERSHIP_TEMPLATE);

  // Must not have raw ** asterisks
  assert.equal(html.includes("**PARTNER 1 NAME**"), false);
  assert.equal(html.includes("**PARTNER 2 NAME**"), false);
  assert.equal(html.includes("**NOW, THEREFORE"), false);

  // Must contain properly converted strong elements
  assert.match(html, /<strong>\[PARTNER 1 NAME\]<\/strong>/);
  assert.match(html, /<strong>\[PARTNER 2 NAME\]<\/strong>/);
  assert.match(html, /<strong>NOW, THEREFORE, IT IS MUTUALLY AGREED AS FOLLOWS:<\/strong>/);
  assert.match(html, /<ul><li><strong>Partner 1<\/strong>: PKR/);
  assert.match(html, /<hr>/);
});

test("plainTextToTiptapHTML parses SaaS contract template with clean inline formatting", () => {
  const html = plainTextToTiptapHTML(SAAS_TEMPLATE);

  assert.equal(html.includes("**SAAS PROVIDER NAME**"), false);
  assert.equal(html.includes("**CUSTOMER NAME**"), false);
  assert.match(html, /<strong>\[SAAS PROVIDER NAME\]<\/strong>/);
  assert.match(html, /<strong>\[CUSTOMER NAME\]<\/strong>/);
});
