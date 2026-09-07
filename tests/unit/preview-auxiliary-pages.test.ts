import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

test("Auxiliary Pages Suite: 8 Required Legal & Informational Pages", async (t) => {
  const pagesDir = path.resolve(process.cwd(), "client/src/experimental/pages");
  const requiredPages = [
    "PreviewAbout.tsx",
    "PreviewContact.tsx",
    "PreviewFaq.tsx",
    "PreviewPrivacy.tsx",
    "PreviewTerms.tsx",
    "PreviewRefundPolicy.tsx",
    "PreviewInstallApp.tsx",
    "PreviewWordAddinGuide.tsx",
  ];

  await t.test("All 8 auxiliary page files exist and are populated", () => {
    for (const pageName of requiredPages) {
      const filePath = path.join(pagesDir, pageName);
      assert.ok(fs.existsSync(filePath), `Missing page: ${pageName}`);
      const content = fs.readFileSync(filePath, "utf-8");
      assert.ok(content.length > 500, `Page ${pageName} is too short / empty`);
      assert.ok(content.includes("PublicPreviewShell"), `Page ${pageName} must use PublicPreviewShell`);
      assert.ok(content.includes("export default function"), `Page ${pageName} must export default component`);
    }
  });

  await t.test("PreviewAbout.tsx content specifications", () => {
    const content = fs.readFileSync(path.join(pagesDir, "PreviewAbout.tsx"), "utf-8");
    assert.ok(content.includes("600,000+"), "Must reference 600,000+ judgments");
    assert.ok(content.includes("83,117"), "Must reference 83,117 statutory sections");
    assert.ok(content.includes("5,887"), "Must reference 5,887 Acts");
    assert.ok(content.includes("Majnoon Studio"), "Must reference Majnoon Studio ownership");
    assert.ok(content.includes("Zero-Training"), "Must reference Zero-Training on briefs");
  });

  await t.test("PreviewContact.tsx interactive form & chamber channels", () => {
    const content = fs.readFileSync(path.join(pagesDir, "PreviewContact.tsx"), "utf-8");
    assert.ok(content.includes("+92 335 834 1897"), "Must contain chamber helpline");
    assert.ok(content.includes("support@alwakeelo.com"), "Must contain chamber support email");
    assert.ok(content.includes("handleSubmit"), "Must contain interactive form handler");
    assert.ok(content.includes("Islamabad"), "Must list Islamabad office");
    assert.ok(content.includes("Lahore"), "Must list Lahore office");
    assert.ok(content.includes("Karachi"), "Must list Karachi office");
  });

  await t.test("PreviewFaq.tsx search and categorized questions", () => {
    const content = fs.readFileSync(path.join(pagesDir, "PreviewFaq.tsx"), "utf-8");
    assert.ok(content.includes("searchQuery"), "Must include search state filter");
    assert.ok(content.includes("Limitation Act"), "Must cover Limitation Act in FAQ");
    assert.ok(content.includes("Order VII Rule 11"), "Must cover O.7 R.11 in FAQ");
    assert.ok(content.includes("Zero-Training"), "Must cover privacy in FAQ");
  });

  await t.test("PreviewPrivacy.tsx Pakistani legal protections and PECA alignment", () => {
    const content = fs.readFileSync(path.join(pagesDir, "PreviewPrivacy.tsx"), "utf-8");
    assert.ok(content.includes("Qanun-e-Shahadat"), "Must cite Qanun-e-Shahadat Order 1984");
    assert.ok(content.includes("PECA 2016"), "Must cite PECA 2016");
    assert.ok(content.includes("Zero-Training"), "Must include Zero-Training Guarantee");
    assert.ok(content.includes("TLS 1.3"), "Must include TLS 1.3 encryption standard");
    assert.ok(content.includes("AES-256"), "Must include AES-256 encryption standard");
  });

  await t.test("PreviewTerms.tsx terms of service & SLA", () => {
    const content = fs.readFileSync(path.join(pagesDir, "PreviewTerms.tsx"), "utf-8");
    assert.ok(content.includes("Mandatory Legal Disclaimer"), "Must include legal disclaimer");
    assert.ok(content.includes("Islamic Republic of Pakistan"), "Must specify Pakistan governing law");
    assert.ok(content.includes("99.5%"), "Must specify 99.5% uptime SLA target");
    assert.ok(content.includes("Limitation of Liability"), "Must include limitation of liability");
  });

  await t.test("PreviewRefundPolicy.tsx 7-day guarantee & refund mechanics", () => {
    const content = fs.readFileSync(path.join(pagesDir, "PreviewRefundPolicy.tsx"), "utf-8");
    assert.ok(content.includes("7-Day"), "Must include 7-day guarantee");
    assert.ok(content.includes("Refund Request"), "Must include refund request flow");
    assert.ok(content.includes("7 to 14 business days"), "Must include processing timeline");
  });

  await t.test("PreviewInstallApp.tsx multi-platform PWA steps", () => {
    const content = fs.readFileSync(path.join(pagesDir, "PreviewInstallApp.tsx"), "utf-8");
    assert.ok(content.includes("ios"), "Must include iOS Safari instructions");
    assert.ok(content.includes("android"), "Must include Android Chrome instructions");
    assert.ok(content.includes("windows"), "Must include Windows PC instructions");
    assert.ok(content.includes("mac"), "Must include macOS instructions");
  });

  await t.test("PreviewWordAddinGuide.tsx manifest sideloading & platform guides", () => {
    const content = fs.readFileSync(path.join(pagesDir, "PreviewWordAddinGuide.tsx"), "utf-8");
    assert.ok(content.includes("alwakeelo-manifest.xml"), "Must reference manifest XML");
    assert.ok(content.includes("C:\\AlWakeeloAddin\\"), "Must reference Windows catalog path");
    assert.ok(content.includes("wef"), "Must reference Mac wef directory");
    assert.ok(content.includes("word.office.com"), "Must reference Word Web");
  });
});
