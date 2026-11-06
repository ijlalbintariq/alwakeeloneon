import test from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { extractCaseLawInBrowser } from "../../client/src/lib/case-law-client-extractor";
import { sourceFileFormat } from "../../shared/source-file-format";
import { assertCompletePdfPages, getPdfPageCount } from "../../server/pdf-completeness";
import { extractPdfTextGuarded } from "../../server/extraction-guard";
import fs from "node:fs";
import ts from "typescript";
import { sourceFormatRepair } from "../../script/repair_source_file_formats";

function route(path: string, dependencies: Record<string, unknown>) {
  const source = ts.createSourceFile("routes.ts", fs.readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let callback: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === "app.post" && node.arguments[0]?.getText(source) === JSON.stringify(path)) callback = node.arguments.at(-1);
    ts.forEachChild(node, visit);
  };
  visit(source); assert.ok(callback);
  const js = ts.transpileModule(`(${callback.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(dependencies), `return ${js}`)(...Object.values(dependencies));
}

function response() {
  return { statusCode: 200, payload: null as any, status(code: number) { this.statusCode = code; return this; }, json(value: unknown) { this.payload = value; return this; } };
}

function uploadSource(dependencies: Record<string, unknown>) {
  const source = ts.createSourceFile("routes.ts", fs.readFileSync("server/routes.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let found: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === "uploadAdminKnowledgeFileToR2") found = node;
    ts.forEachChild(node, visit);
  };
  visit(source); assert.ok(found);
  const js = ts.transpileModule(`(${found.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function("sourceFileFormat", ...Object.keys(dependencies), `return ${js}`)(sourceFileFormat, ...Object.values(dependencies));
}

test("PDF uploads retain original bytes by falling through to server extraction", async () => {
  const file = new File(["%PDF-1.7"], "judgment.pdf", { type: "application/pdf" });
  assert.equal((await extractCaseLawInBrowser(file)).supported, false);
  const text = new File(["2024 SCMR 1085. Complete text supplied by the user."], "judgment.txt");
  assert.equal((await extractCaseLawInBrowser(text)).supported, true);
});

test("native extraction retains page 21 and short page text", async () => {
  const pdf = new jsPDF();
  for (let page = 1; page <= 21; page++) {
    if (page > 1) pdf.addPage();
    pdf.text(`Page ${page}.`, 20, 20);
  }
  const bytes = Buffer.from(pdf.output("arraybuffer"));
  assert.equal(await getPdfPageCount(bytes), 21);
  const extracted = await extractPdfTextGuarded(bytes);
  assert.match(extracted, /Page 1\./);
  assert.match(extracted, /Page 21\./);
});

test("mixed and watermarked scanned pages require OCR instead of silently losing their text", async () => {
  const pdf = new jsPDF();
  pdf.text("Searchable first page", 20, 20);
  pdf.addPage();
  pdf.text("Scanned with CamScanner", 20, 280);
  pdf.addImage({ data: new Uint8ClampedArray([0, 0, 0, 255]), width: 1, height: 1 }, "RGBA", 20, 20, 100, 100);
  await assert.rejects(extractPdfTextGuarded(Buffer.from(pdf.output("arraybuffer"))), /requires OCR/);
});

test("partial OCR must never be accepted as a complete judgment", () => {
  for (const pages of [0, 3, 8]) assert.throws(() => assertCompletePdfPages(9, pages), /Incomplete PDF extraction/);
  assert.doesNotThrow(() => assertCompletePdfPages(9, 9));
});

test("explicit text MIME overrides a misleading PDF filename", () => {
  assert.deepEqual(sourceFileFormat("case.PDF", "text/plain; charset=utf-8"), { isPdf: false, filename: "case.extracted.txt" });
  assert.deepEqual(sourceFileFormat("case.pdf", "application/pdf"), { isPdf: true, filename: "case.pdf" });
  assert.equal(sourceFileFormat("case.pdf", "application/octet-stream").isPdf, true);
});

test("format repairs preserve source bytes and leave genuine/unchecked PDFs alone", () => {
  const row = { id: 1, parent_id: 2, table: "admin_knowledge_files", object_key: "archive/case.pdf", original_filename: "case.pdf", mime_type: "text/plain" };
  const repaired = sourceFormatRepair(row, { kind: "text_like", pdf: false });
  assert.equal(repaired?.filename, "case.extracted.txt");
  assert.equal(repaired?.object_key, row.object_key);
  assert.equal(sourceFormatRepair(row, { pdf: true }), null);
  assert.equal(sourceFormatRepair(row, { error: "Could not inspect" }), null);
  assert.equal(sourceFormatRepair(row, undefined), null);
  const damaged = sourceFormatRepair({ ...row, mime_type: "application/pdf" }, { kind: "other_binary", pdf: false });
  assert.equal(damaged?.filename, "case.unreadable.bin");
  assert.equal(damaged?.mime, "application/octet-stream");
});

test("old clients cannot save PDF text as an original PDF upload", async () => {
  const res = response();
  await route("/api/admin/case-law/extract-client", {
    isAdmin: async () => true, getUserId: () => "test-user", sanitizeInputText: (v: string) => v,
  })({ body: { filename: "judgment.pdf", content: "Extracted text without the original file" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.message, /original PDF/);
});

test("original PDF storage failures are reported instead of silently claiming success", async () => {
  const args = { fileName: "case.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 original bytes") };
  await assert.rejects(uploadSource({ uploadBufferToR2: async () => null })(args), /Original PDF could not be stored/);
  await assert.rejects(uploadSource({})({ ...args, buffer: Buffer.from("Only extracted text") }), /Original PDF bytes are missing/);
  let metadata: any;
  await uploadSource({ uploadBufferToR2: async (value: any) => { assert.equal(value.contentType, "application/pdf"); return { objectKey: "original.pdf" }; }, storage: { upsertAdminKnowledgeFile: async (value: any) => { metadata = value; } } })({ ...args, mimeType: "text/plain" });
  assert.equal(metadata.mimeType, "application/pdf");
  assert.equal(metadata.originalFilename, "case.pdf");
});

test("PDF extraction waits for original storage and reports failure before indexing", async () => {
  let entered!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const res = response();
  const handler = route("/api/admin/case-law/extract", {
    isAdmin: async () => true, ADMIN_UPLOAD_MAX_FILE_SIZE_BYTES: 100000,
    cloneUploadFile: (file: any) => file, hasSafeDocumentSignature: () => true,
    passesMalwareScan: async () => ({ ok: true }),
    extractPdfTextSafe: async () => "Complete searchable judgment text.", getUserId: () => "test",
    storage: { addAdminKnowledge: async () => ({ id: 1 }) },
    uploadAdminKnowledgeFileToR2: async () => { entered(); await gate; throw new Error("Synthetic storage failure"); },
  });
  const running = handler({ file: { originalname: "case.pdf", mimetype: "application/pdf", size: 100, buffer: Buffer.from("%PDF-1.7") } }, res);
  await started;
  assert.equal(res.payload, null);
  release(); await running;
  assert.equal(res.statusCode, 503);
  assert.match(res.payload.message, /Original PDF could not be stored/);
});

test("signed session uploads reject non-PDF bytes before creating a document", async () => {
  const res = response();
  await route("/api/upload/session/:sessionId/upload", {
    signedUploadSessions: new Map([["session", { expiresAt: Date.now() + 60000 }]]),
    getUploadBufferOrThrow: (file: any) => file.buffer,
    hasSafeDocumentSignature: (file: any) => file.buffer.subarray(0, 5).toString() === "%PDF-",
  })({ params: { sessionId: "session" }, file: { originalname: "broken.pdf", mimetype: "application/pdf", buffer: Buffer.alloc(32) } }, res);
  assert.equal(res.statusCode, 400);
});

test("cloud OCR rejects capped/partial output and counts blank pages without discarding them", async () => {
  process.env.OCRSPACE_API_KEY = "synthetic-test-key";
  const { ocrPdfWithCloud } = await import("../../server/cloud-ocr");
  const pdf = new jsPDF(); pdf.text("First page", 20, 20); pdf.addPage();
  const bytes = Buffer.from(pdf.output("arraybuffer"));
  const original = globalThis.fetch;
  let body: any;
  globalThis.fetch = async () => new Response(JSON.stringify(body), { status: 200 });
  try {
    body = { OCRExitCode: 1, ParsedResults: [{ FileParseExitCode: 1, ParsedText: "First page" }] };
    await assert.rejects(ocrPdfWithCloud(bytes), /Incomplete PDF extraction/);
    body = { OCRExitCode: 2, ParsedResults: [{ ParsedText: "Partial page" }, { ParsedText: "Other page" }] };
    await assert.rejects(ocrPdfWithCloud(bytes), /incomplete OCR/);
    body = { OCRExitCode: 1, ParsedResults: [{ FileParseExitCode: 1, ParsedText: "First page" }, { FileParseExitCode: 1, ParsedText: "" }] };
    const result = await ocrPdfWithCloud(bytes);
    assert.equal(result.pageCount, 2);
    assert.equal(result.text, "First page");
  } finally { globalThis.fetch = original; delete process.env.OCRSPACE_API_KEY; }
});
