import { getDocumentProxy } from "unpdf";

export function assertCompletePdfPages(totalPages: number, extractedPages: number): void {
  if (!Number.isInteger(totalPages) || totalPages < 1 || extractedPages !== totalPages) {
    throw new Error(`Incomplete PDF extraction: processed ${extractedPages} of ${totalPages} pages. Upload requires complete text.`);
  }
}

export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const document = await getDocumentProxy(new Uint8Array(buffer));
  try { return document.numPages; }
  finally { await document.destroy(); }
}
