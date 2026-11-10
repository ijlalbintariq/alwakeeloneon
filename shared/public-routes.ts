/** Canonical public marketing paths. Workspace and authentication URLs remain unchanged. */
export function canonicalPublicPath(pathname: string): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (["/", "/landing", "/preview", "/preview/landing"].includes(path)) return "/";

  const publicPath = path.replace(/^\/preview(?=\/)/, "");
  if (/^\/(?:about|contact|faq|privacy|terms|ownership-statement|word-addin-guide|pricing)$/.test(publicPath)) {
    return publicPath;
  }
  if (/^\/blog(?:\/[^/]+)?$/.test(publicPath)) return publicPath;
  if (["/refund-policy", "/cancellation-return-refund-policy"].includes(publicPath)) {
    return "/cancellation-return-refund-policy";
  }
  if (["/install", "/install-app"].includes(publicPath)) return "/install";
  return pathname;
}

/** Keep browse filters and pagination consistent in server and client canonical URLs. */
export function judgmentDirectoryPath(params: URLSearchParams): string {
  const query = new URLSearchParams();
  for (const key of ["courtId", "journalId", "year", "limit", "page"]) {
    const raw = params.get(key);
    if (!raw) continue;
    const value = Number(raw), maximum = key === "year" ? 9999 : key === "limit" ? 100 : 100_000;
    if (!/^\d+$/.test(raw) || value < 1 || value > maximum) throw new RangeError(`Invalid ${key}`);
    if ((key === "page" && value === 1) || (key === "limit" && value === 50)) continue;
    query.set(key, String(value));
  }
  return "/judgments/browse" + (query.size ? "?" + query : "");
}
