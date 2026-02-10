
import { Statute, CaseLaw } from './types';

// This acts as your Local Database. 
// You can expand this file with thousands of entries.

export const LOCAL_STATUTES: Statute[] = [
  // --- PPC (Pakistan Penal Code) ---
  {
    shortTitle: "PPC",
    section: "302",
    description: "Punishment of Qatl-i-amd (Intentional Murder).",
    punishment: "Death, Imprisonment for Life, or imprisonment up to 25 years (Tazir)."
  },
  {
    shortTitle: "PPC",
    section: "420",
    description: "Cheating and dishonestly inducing delivery of property.",
    punishment: "Imprisonment up to 7 years and fine."
  },
  {
    shortTitle: "PPC",
    section: "489-F",
    description: "Dishonestly issuing a cheque which is dishonoured on presentation.",
    punishment: "Imprisonment up to 3 years, or with fine, or both."
  },
  {
    shortTitle: "PPC",
    section: "406",
    description: "Punishment for criminal breach of trust.",
    punishment: "Imprisonment up to 7 years and fine."
  },
  {
    shortTitle: "PPC",
    section: "506",
    description: "Punishment for criminal intimidation.",
    punishment: "Imprisonment up to 2 years (Simple) or 7 years (if threat to cause death/grievous hurt)."
  },

  // --- CrPC (Criminal Procedure Code) ---
  {
    shortTitle: "CrPC",
    section: "497",
    description: "When bail may be taken in cases of non-bailable offence (Post-arrest Bail).",
    punishment: "Procedural: Grant of Bail in non-bailable offences."
  },
  {
    shortTitle: "CrPC",
    section: "498",
    description: "Power to direct admission to bail or reduction of bail (Pre-arrest Bail/Anticipatory Bail).",
    punishment: "Procedural: Protection from arrest."
  },
  {
    shortTitle: "CrPC",
    section: "22-A",
    description: "Powers of Justice of Peace (Sessions Judge) to order registration of FIR.",
    punishment: "Procedural: Remedy when Police refuses to register FIR."
  },
  
  // --- Constitution of Pakistan 1973 ---
  {
    shortTitle: "Constitution",
    section: "199",
    description: "Jurisdiction of High Court (Writ Petition).",
    punishment: "Remedy: Issue writs (Mandamus, Certiorari, Habeas Corpus) against state functionaries."
  },
  {
    shortTitle: "Constitution",
    section: "10-A",
    description: "Right to Fair Trial.",
    punishment: "Fundamental Right: Due process for determination of civil rights or criminal charges."
  },

  // --- Family Law ---
  {
    shortTitle: "Family",
    section: "Khula",
    description: "Dissolution of marriage on the ground of Khula (Right of wife to separate).",
    punishment: "Civil Remedy: Dissolution of marriage, usually requires return of partial Haq Mehr."
  },
  {
    shortTitle: "Family",
    section: "Section 9",
    description: "Maintenance (Family Courts Act 1964).",
    punishment: "Civil Remedy: Husband is bound to maintain wife and children."
  },

  // --- Contract Act 1872 ---
  {
    shortTitle: "Contract Act",
    section: "73",
    description: "Compensation for loss or damage caused by breach of contract.",
    punishment: "Civil Remedy: Damages which naturally arose from the breach."
  },
  {
    shortTitle: "Contract Act",
    section: "12",
    description: "What is a sound mind for the purposes of contracting.",
    punishment: "Validity Condition: Contract is void if party is of unsound mind."
  }
];

export const LOCAL_CASE_LAW: CaseLaw[] = [
  {
    citation: "2023 SCMR 1450 & 2023 PLJ 55",
    court: "Supreme Court of Pakistan",
    title: "Bail in Cheque Dishonour Cases",
    summary: "The Supreme Court held that mere dishonor of a cheque is not sufficient to deny bail unless there is evidence of financial fraud on a massive scale. Liberty of a citizen cannot be curtailed on mere allegations.",
    keywords: ["bail", "489-f", "cheque", "dishonour", "financial"]
  },
  {
    citation: "2021 YLR 405 & 2021 PLJ 112",
    court: "Lahore High Court",
    title: "Custody of Minors (Welfare of Minor)",
    summary: "The welfare of the minor is the paramount consideration. Even if the mother has remarried, she does not automatically lose the right of Hizanat (custody) if it is proven that the child is better off with her.",
    keywords: ["custody", "minor", "guardian", "mother", "hizanat", "welfare"]
  },
  {
    citation: "PLD 2019 SC 1",
    court: "Supreme Court of Pakistan",
    title: "Sughran Bibi Case (Inheritance)",
    summary: "Supreme Court clarified that limitation periods do not apply to inheritance claims. A legal heir can claim their share in property at any time, and fraud vitiates all solemn proceedings.",
    keywords: ["inheritance", "property", "fraud", "limitation", "heir"]
  },
  {
    citation: "PLD 2014 SC 696",
    court: "Supreme Court of Pakistan",
    title: "Registration of FIR (Justices of Peace)",
    summary: "Justices of Peace (Ex-officio) under S. 22-A CrPC cannot mechanically order registration of FIR. They must apply their mind to see if a cognizable offence is made out.",
    keywords: ["fir", "22-a", "justice of peace", "police", "investigation"]
  },
  {
    citation: "2020 SCMR 2003",
    court: "Supreme Court of Pakistan",
    title: "Benefit of Doubt in Murder Cases",
    summary: "It is a golden principle of law that if there is a single circumstance which creates reasonable doubt in the prosecution case, the same is sufficient to acquit the accused.",
    keywords: ["murder", "302", "benefit of doubt", "acquittal", "criminal"]
  }
];
