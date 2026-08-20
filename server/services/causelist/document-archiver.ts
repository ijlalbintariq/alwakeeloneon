import crypto from "node:crypto";
import { uploadBufferToR2 } from "../../r2-storage";
import { ScrapedDocument } from "./types";

export interface ArchiveResult {
  sourceHash: string;
  storageKey: string | null;
  publicUrl: string | null;
}

export function computeSha256(buffer: Buffer | string): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function archiveCauseListDocument(
  buffer: Buffer,
  doc: ScrapedDocument,
  mimeType = "application/pdf"
): Promise<ArchiveResult> {
  const sourceHash = computeSha256(buffer);
  const benchSlug = doc.bench.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const ext = doc.sourceFormat === "pdf" ? "pdf" : "html";
  const fileName = `${doc.court}_${benchSlug}_${doc.listType}_${sourceHash.slice(0, 12)}.${ext}`;
  const prefix = `causelists/${doc.court}/${benchSlug}/${doc.targetDate}`;

  try {
    const uploaded = await uploadBufferToR2({
      buffer,
      fileName,
      contentType: mimeType,
      prefix,
      metadata: {
        court: doc.court,
        bench: doc.bench,
        targetDate: doc.targetDate,
        listType: doc.listType,
        sourceHash,
      },
    });

    return {
      sourceHash,
      storageKey: uploaded ? uploaded.objectKey : null,
      publicUrl: uploaded ? uploaded.publicUrl : null,
    };
  } catch (err) {
    console.warn(`[DocumentArchiver] Cloudflare R2 upload skipped or failed for ${doc.court} ${doc.bench}:`, err);
    return {
      sourceHash,
      storageKey: null,
      publicUrl: null,
    };
  }
}
