/**
 * Pakistani Court Fee Calculator
 *
 * Based on the Court Fees Act 1870 as amended by Punjab/Sindh and applied
 * federally. Provinces vary slightly; these defaults match Punjab Civil
 * Court schedules which are the most commonly used.
 *
 * IMPORTANT: This is a tool to *suggest* a court fee. The user/lawyer
 * remains responsible for verifying the exact applicable schedule with
 * the registrar.
 */

export type SuitType =
  | "money"
  | "property-declaration"
  | "property-possession"
  | "specific-performance"
  | "injunction"
  | "family-maintenance"
  | "family-khula"
  | "family-custody"
  | "writ-constitutional"
  | "civil-appeal"
  | "civil-revision"
  | "criminal-appeal"
  | "bail-application"
  | "vakalatnama"
  | "general-misc";

export interface CourtFeeResult {
  /** Calculated court fee in PKR */
  feeRs: number;
  /** Human-readable formula used */
  formula: string;
  /** Statute / Article reference for inclusion in draft */
  legalCitation: string;
  /** Ready-to-insert plaint paragraph text */
  draftText: string;
}

interface SuitTypeMeta {
  label: string;
  /** Whether the calculation requires a suit-value input */
  needsValue: boolean;
  /** Brief description shown in the picker */
  description: string;
}

export const SUIT_TYPES: Record<SuitType, SuitTypeMeta> = {
  "money": {
    label: "Money / Recovery suit",
    needsValue: true,
    description: "Suit for recovery of liquidated money (Schedule I, Article 1).",
  },
  "property-declaration": {
    label: "Declaration with consequential relief (Property)",
    needsValue: true,
    description: "Declaration of title / cancellation with possession (ad valorem).",
  },
  "property-possession": {
    label: "Possession of immovable property",
    needsValue: true,
    description: "Suit for possession (Schedule I, Article 1, on market value).",
  },
  "specific-performance": {
    label: "Specific Performance of contract",
    needsValue: true,
    description: "On consideration value of the contract (Schedule I, Article 1).",
  },
  "injunction": {
    label: "Suit for Injunction (no consequential relief)",
    needsValue: false,
    description: "Permanent injunction without monetary relief (Schedule II, Article 17(iii)).",
  },
  "family-maintenance": {
    label: "Family Court — Maintenance",
    needsValue: false,
    description: "Maintenance suit (Family Courts Rules — fixed fee).",
  },
  "family-khula": {
    label: "Family Court — Khula / Dissolution",
    needsValue: false,
    description: "Dissolution of marriage / khula (Family Courts Rules).",
  },
  "family-custody": {
    label: "Family Court — Custody / Guardianship",
    needsValue: false,
    description: "Custody petition under Guardians and Wards Act 1890.",
  },
  "writ-constitutional": {
    label: "High Court Constitutional Writ Petition",
    needsValue: false,
    description: "Article 199 writ (Schedule II, Article 11).",
  },
  "civil-appeal": {
    label: "Civil Appeal",
    needsValue: true,
    description: "Same fee as plaint on the suit value.",
  },
  "civil-revision": {
    label: "Civil Revision",
    needsValue: true,
    description: "50% of appeal fee on suit value (Schedule I, Article 1).",
  },
  "criminal-appeal": {
    label: "Criminal Appeal",
    needsValue: false,
    description: "Fixed fee under Schedule II, Article 11.",
  },
  "bail-application": {
    label: "Bail Application",
    needsValue: false,
    description: "Fixed fee for bail application (Schedule II, Article 1A).",
  },
  "vakalatnama": {
    label: "Vakalatnama",
    needsValue: false,
    description: "Stamp + court fee for advocate's authorisation form.",
  },
  "general-misc": {
    label: "Miscellaneous Application",
    needsValue: false,
    description: "Generic miscellaneous application (Schedule II, Article 1A).",
  },
};

/**
 * Ad valorem calculation per Punjab Court Fees (Schedule I, Article 1).
 * Slabs (cumulative):
 *   Up to Rs 25,000      → 5% of value, minimum Rs 250
 *   Rs 25,001-100,000    → Rs 1,250 + 6% of value over Rs 25,000
 *   Rs 100,001-500,000   → Rs 5,750 + 7% of value over Rs 100,000
 *   Rs 500,001-1,000,000 → Rs 33,750 + 7.5% of value over Rs 500,000
 *   Above Rs 1,000,000   → Rs 71,250 + 7.5% of value over 1M, capped at Rs 200,000
 */
function computeAdValorem(value: number): number {
  const v = Math.max(0, Math.floor(value));
  if (v === 0) return 0;
  let fee = 0;
  if (v <= 25_000) {
    fee = Math.max(250, Math.round(v * 0.05));
  } else if (v <= 100_000) {
    fee = 1_250 + Math.round((v - 25_000) * 0.06);
  } else if (v <= 500_000) {
    fee = 5_750 + Math.round((v - 100_000) * 0.07);
  } else if (v <= 1_000_000) {
    fee = 33_750 + Math.round((v - 500_000) * 0.075);
  } else {
    fee = 71_250 + Math.round((v - 1_000_000) * 0.075);
  }
  return Math.min(fee, 200_000); // statutory cap
}

function formatRs(n: number): string {
  return `Rs. ${n.toLocaleString("en-PK")}`;
}

export function calculateCourtFee(suitType: SuitType, valueRs: number = 0): CourtFeeResult {
  switch (suitType) {
    case "money":
    case "property-declaration":
    case "property-possession":
    case "specific-performance":
    case "civil-appeal": {
      const fee = computeAdValorem(valueRs);
      return {
        feeRs: fee,
        formula: `Ad valorem on Rs ${valueRs.toLocaleString("en-PK")} per Schedule I, Article 1 slab`,
        legalCitation: "Schedule I, Article 1, Court Fees Act 1870",
        draftText: `Court fee of ${formatRs(fee)} has been affixed, calculated under Schedule I, Article 1 of the Court Fees Act, 1870, on the suit value of ${formatRs(valueRs)}.`,
      };
    }
    case "civil-revision": {
      const fee = Math.round(computeAdValorem(valueRs) / 2);
      return {
        feeRs: fee,
        formula: `50% of ad valorem appeal fee on Rs ${valueRs.toLocaleString("en-PK")}`,
        legalCitation: "Schedule I, Article 1 (revision = 50% of appeal fee)",
        draftText: `Court fee of ${formatRs(fee)} has been affixed, being 50% of the ad valorem appeal fee under Schedule I, Article 1 of the Court Fees Act, 1870, on the value of ${formatRs(valueRs)}.`,
      };
    }
    case "injunction": {
      const fee = 500;
      return {
        feeRs: fee,
        formula: "Fixed fee for permanent injunction without consequential relief",
        legalCitation: "Schedule II, Article 17(iii), Court Fees Act 1870",
        draftText: `Fixed court fee of ${formatRs(fee)} has been affixed under Schedule II, Article 17(iii) of the Court Fees Act, 1870.`,
      };
    }
    case "family-maintenance":
    case "family-khula":
    case "family-custody": {
      const fee = 500;
      const matter = suitType === "family-khula" ? "khula / dissolution of marriage"
        : suitType === "family-maintenance" ? "maintenance"
        : "custody / guardianship";
      return {
        feeRs: fee,
        formula: `Fixed fee for Family Court ${matter} suit`,
        legalCitation: "Family Courts Rules read with Schedule II, Court Fees Act 1870",
        draftText: `Fixed court fee of ${formatRs(fee)} has been affixed under the Family Courts Rules read with Schedule II of the Court Fees Act, 1870, on this petition for ${matter}.`,
      };
    }
    case "writ-constitutional": {
      const fee = 100;
      return {
        feeRs: fee,
        formula: "Fixed fee for High Court constitutional writ petition",
        legalCitation: "Schedule II, Article 11, Court Fees Act 1870",
        draftText: `Fixed court fee of ${formatRs(fee)} has been affixed under Schedule II, Article 11 of the Court Fees Act, 1870, on this petition under Article 199 of the Constitution.`,
      };
    }
    case "criminal-appeal": {
      const fee = 100;
      return {
        feeRs: fee,
        formula: "Fixed fee for criminal appeal",
        legalCitation: "Schedule II, Article 11, Court Fees Act 1870",
        draftText: `Fixed court fee of ${formatRs(fee)} has been affixed under Schedule II, Article 11 of the Court Fees Act, 1870.`,
      };
    }
    case "bail-application": {
      const fee = 25;
      return {
        feeRs: fee,
        formula: "Fixed fee for bail application",
        legalCitation: "Schedule II, Article 1A, Court Fees Act 1870",
        draftText: `Fixed court fee of ${formatRs(fee)} has been affixed under Schedule II, Article 1A of the Court Fees Act, 1870.`,
      };
    }
    case "vakalatnama": {
      const fee = 30;
      return {
        feeRs: fee,
        formula: "Vakalatnama: Rs 25 stamp + Rs 5 court fee",
        legalCitation: "Stamp Act 1899 + Court Fees Act 1870",
        draftText: `Stamp duty of Rs. 25 (Stamp Act, 1899) and court fee of Rs. 5 (Court Fees Act, 1870) have been affixed on this Vakalatnama.`,
      };
    }
    case "general-misc": {
      const fee = 100;
      return {
        feeRs: fee,
        formula: "Fixed fee for general miscellaneous application",
        legalCitation: "Schedule II, Article 1A, Court Fees Act 1870",
        draftText: `Fixed court fee of ${formatRs(fee)} has been affixed under Schedule II, Article 1A of the Court Fees Act, 1870.`,
      };
    }
  }
}
