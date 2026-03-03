export type MlDomainClassification = {
  key: string;
  confidence: number; // 0-1
};

function serviceBaseUrl(): string | null {
  const raw = (process.env.ML_SERVICE_URL || "").trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export async function classifyDocumentDomainWithML(params: {
  title: string;
  content: string;
  taxonomy: string[];
}): Promise<MlDomainClassification | null> {
  const base = serviceBaseUrl();
  if (!base) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);

  try {
    const response = await fetch(`${base}/classify/document-domain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        title: params.title,
        content: params.content.slice(0, 16000),
        taxonomy: params.taxonomy,
      }),
    });

    if (!response.ok) return null;

    const payload = await response.json().catch(() => null);
    const key = typeof payload?.key === "string" ? payload.key.trim().toLowerCase() : "";
    const confidenceRaw = typeof payload?.confidence === "number" ? payload.confidence : 0;
    if (!key) return null;

    return {
      key,
      confidence: Math.max(0, Math.min(1, confidenceRaw)),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
