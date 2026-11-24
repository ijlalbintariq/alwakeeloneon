import type { QualityAssessment } from "@shared/quality-assessment";

export function QualityAssessmentDetails({ assessment }: { assessment?: QualityAssessment | null }) {
  if (!assessment || assessment.version !== 2) return <p className="text-xs text-muted-foreground">Legacy format-only score. Relevance and legal accuracy were not assessed; excluded from reviewed-quality statistics.</p>;
  return <div className="space-y-2 rounded-lg border border-border p-3 text-xs">
    <p className="font-semibold">{assessment.status === "reviewed" ? "AI quality assessment" : `Assessment: ${assessment.status.replace(/_/g, " ")}`}</p>
    <p>{assessment.reason}</p>
    {assessment.relevance != null && <p>{assessment.status !== "reviewed" ? "Provisional findings (not included in score averages): " : ""}Question relevance: {assessment.relevance}/5 · Task completion: {assessment.completeness}/5{assessment.caseLawRelevance != null ? ` · Case relevance: ${assessment.caseLawRelevance}/5` : ""}</p>}
    {assessment.grounding && <p>Source support: {assessment.grounding.replace(/_/g, " ")}{assessment.inputTruncated ? " · Partial review: input exceeded the review limit" : ""}</p>}
    {assessment.queryEvidence && <blockquote className="border-l-2 pl-2"><strong>Request evidence:</strong> {assessment.queryEvidence}</blockquote>}
    {assessment.answerEvidence && <blockquote className="border-l-2 pl-2"><strong>Answer evidence:</strong> {assessment.answerEvidence}</blockquote>}
    {assessment.sourceEvidence && <blockquote className="border-l-2 pl-2"><strong>Supporting source excerpt:</strong> {assessment.sourceEvidence}</blockquote>}
    {assessment.model && <p className="text-muted-foreground">Reviewer: {assessment.model}{assessment.confidence != null ? ` · Confidence: ${Math.round(assessment.confidence * 100)}%` : ""}{assessment.reviewedAt ? ` · ${new Date(assessment.reviewedAt).toLocaleString()}` : ""}</p>}
    {assessment.tokenUsage && <p className="text-muted-foreground">Reviewer usage: {assessment.tokenUsage.total.toLocaleString()} tokens ({assessment.tokenUsage.input.toLocaleString()} input, {assessment.tokenUsage.output.toLocaleString()} output). Separate from customer action quotas.</p>}
    <p className="text-muted-foreground">AI assessment can be wrong. Source support concerns supplied excerpts; it does not authenticate judgments.</p>
  </div>;
}
