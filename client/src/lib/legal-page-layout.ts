export type LegalPageProfileId = "court-legal" | "a4";

export type LegalPageProfile = {
  id: LegalPageProfileId;
  label: string;
  shortLabel: string;
  widthMm: number;
  heightMm: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  cssPageSize: "Legal" | "A4";
};

export const DEFAULT_LEGAL_PAGE_PROFILE_ID: LegalPageProfileId = "court-legal";
export const LEGAL_PAGE_GAP_PX = 28;

export const LEGAL_PAGE_PROFILES: Record<LegalPageProfileId, LegalPageProfile> = {
  "court-legal": {
    id: "court-legal",
    label: "Court Legal · 8.5 × 14 in",
    shortLabel: "Legal",
    widthMm: 215.9,
    heightMm: 355.6,
    marginTopMm: 25.4,
    marginRightMm: 25.4,
    marginBottomMm: 25.4,
    marginLeftMm: 31.75,
    cssPageSize: "Legal",
  },
  a4: {
    id: "a4",
    label: "A4 · 210 × 297 mm",
    shortLabel: "A4",
    widthMm: 210,
    heightMm: 297,
    marginTopMm: 25,
    marginRightMm: 25,
    marginBottomMm: 25,
    marginLeftMm: 31.75,
    cssPageSize: "A4",
  },
};

export function resolveLegalPageProfile(value?: string | null): LegalPageProfile {
  if (value && value in LEGAL_PAGE_PROFILES) {
    return LEGAL_PAGE_PROFILES[value as LegalPageProfileId];
  }
  return LEGAL_PAGE_PROFILES[DEFAULT_LEGAL_PAGE_PROFILE_ID];
}

export function mmToCssPx(value: number): number {
  return value * (96 / 25.4);
}

export function buildLegalPageCssVariables(profileId: LegalPageProfileId): Record<string, string> {
  const profile = resolveLegalPageProfile(profileId);
  const pageWidth = mmToCssPx(profile.widthMm);
  const pageHeight = mmToCssPx(profile.heightMm);
  const marginTop = mmToCssPx(profile.marginTopMm);
  const marginRight = mmToCssPx(profile.marginRightMm);
  const marginBottom = mmToCssPx(profile.marginBottomMm);
  const marginLeft = mmToCssPx(profile.marginLeftMm);
  return {
    "--legal-page-width": `${pageWidth}px`,
    "--legal-page-height": `${pageHeight}px`,
    "--legal-page-gap": `${LEGAL_PAGE_GAP_PX}px`,
    "--legal-page-gap-half": `${LEGAL_PAGE_GAP_PX / 2}px`,
    "--legal-margin-top": `${marginTop}px`,
    "--legal-margin-right": `${marginRight}px`,
    "--legal-margin-bottom": `${marginBottom}px`,
    "--legal-margin-left": `${marginLeft}px`,
    "--legal-content-height": `${pageHeight - marginTop - marginBottom}px`,
  };
}
