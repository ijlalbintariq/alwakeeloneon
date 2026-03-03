import test from "node:test";
import assert from "node:assert/strict";

import { classifyDocumentMetadata, detectSourceType } from "../../server/document-classifier";

test("detects source type from extension and mime", () => {
  const detected = detectSourceType("lease-agreement.pdf", "application/pdf");
  assert.equal(detected.sourceType, "pdf");
  assert.equal(detected.fileExtension, "pdf");
});

test("classifies contract documents with rule engine", async () => {
  const result = await classifyDocumentMetadata({
    title: "Service Agreement.docx",
    filename: "Service Agreement.docx",
    content: "This contract defines consideration, indemnity, warranty, and breach remedies between party A and party B.",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  assert.equal(result.detectedDomain, "contracts");
  assert.equal(result.classificationMethod, "rule");
  assert.ok(result.classificationConfidence > 0);
});

test("classifies civil litigation petition with rule engine", async () => {
  const result = await classifyDocumentMetadata({
    title: "Civil Petition.txt",
    filename: "Civil Petition.txt",
    content: "The petitioner files this writ petition and seeks injunction in this civil suit before the court.",
    mimeType: "text/plain",
  });

  assert.equal(result.detectedDomain, "civil-litigation");
  assert.equal(result.classificationMethod, "rule");
});

test("falls back to other when ambiguous and no ML classifier is configured", async () => {
  const prevMlServiceUrl = process.env.ML_SERVICE_URL;
  delete process.env.ML_SERVICE_URL;

  const result = await classifyDocumentMetadata({
    title: "notes.txt",
    filename: "notes.txt",
    content: "alpha beta gamma random words without legal context",
    mimeType: "text/plain",
  });

  assert.equal(result.detectedDomain, "other");
  assert.equal(result.classificationMethod, "fallback");
  assert.equal(result.classificationConfidence, 0);

  if (typeof prevMlServiceUrl === "string") process.env.ML_SERVICE_URL = prevMlServiceUrl;
  else delete process.env.ML_SERVICE_URL;
});
