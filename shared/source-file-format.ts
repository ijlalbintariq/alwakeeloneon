export function sourceFileFormat(filename: string, mimeType?: string | null) {
  const mime = String(mimeType || "").split(";")[0].trim().toLowerCase();
  const generic = !mime || mime === "application/octet-stream";
  const isPdf = mime === "application/pdf" || (generic && /\.pdf$/i.test(filename));
  const isText = mime.startsWith("text/");
  return {
    isPdf,
    filename: isText && /\.pdf$/i.test(filename) ? filename.replace(/\.pdf$/i, ".extracted.txt") : filename,
  };
}
