/** Public, identity-checked fields shared by initial HTML and the judgment reader. */
export interface PublicJudgmentData {
  id: string;
  citation: string;
  title: string;
  petitioner: string | null;
  respondent: string | null;
  bench?: string | null;
  court: string | null;
  decisionDate: string | null;
  headnotes: string | null;
  previewText: string;
  previewWordCount: number;
  totalWordCount: number;
  isPreview: boolean;
  isTruncated: boolean;
  citations: { made: any[]; received: any[] };
  textIntegrity?: string;
  textWarning?: string | null;
  pdfUrl?: string | null;
  contentFormat?: string;
  textBelongsTo?: { citation: string | null; id: string | null } | null;
}
