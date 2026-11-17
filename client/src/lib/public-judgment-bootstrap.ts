import type { PublicJudgmentData } from "@shared/public-judgment-data";

/** Never reuse initial HTML data for a different client-side judgment route. */
export function readPublicJudgmentBootstrap(id: string | undefined): PublicJudgmentData | null {
  if (!id || typeof document === "undefined") return null;
  const element = document.getElementById("public-judgment-data");
  if (!element?.textContent) return null;
  try {
    const data = JSON.parse(element.textContent);
    if (data.id !== id || data.textIntegrity !== "own" || typeof data.title !== "string"
      || typeof data.previewText !== "string" || !Array.isArray(data.citations?.made)
      || !Array.isArray(data.citations?.received)) return null;
    return data as PublicJudgmentData;
  } catch {
    return null;
  }
}
