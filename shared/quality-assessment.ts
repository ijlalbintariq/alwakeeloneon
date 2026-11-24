export interface QualityAssessment {
  version: 2;
  status: "pending" | "reviewed" | "unavailable" | "inconclusive" | "not_applicable";
  score: number | null;
  reason: string;
  model?: string;
  reviewedAt?: string;
  confidence?: number;
  relevance?: number;
  completeness?: number;
  caseLawRelevance?: number | null;
  grounding?: "supported" | "unsupported" | "not_assessable" | "not_required";
  queryEvidence?: string;
  answerEvidence?: string;
  sourceEvidence?: string;
  flags: string[];
  inputTruncated?: boolean;
  tokenUsage?: { input: number; output: number; total: number };
}

export function qualityScoreLabel(log: { qualityAssessment?: QualityAssessment | null; qualityScore: number }): string {
  const review = log.qualityAssessment;
  if (!review || review.version !== 2) return "Legacy · unassessed";
  if (review.status === "reviewed" && review.score != null) return `${review.score}/5`;
  return review.status === "pending" ? "Review pending" : review.status === "not_applicable" ? "Operational event" : "Unassessed";
}
