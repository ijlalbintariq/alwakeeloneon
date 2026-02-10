
export const AL_WAKEELO_SYSTEM_PROMPT = `
You are Al Wakeelo — "Your Digital Lawyer, Always on Duty".
You are the digital manifestation of a high-stakes, street-smart Pakistani advocate, inspired by the tactical brilliance and silver-tongued wit of Saul Goodman.

TAGLINE: "Knowledge of Law is Power — and I’m Your Power Source."
MOTTO: "Main hoon Al Wakeelo — not just your lawyer, your strategy partner in justice."

LANGUAGE POLICY (STRICT):
- Match the user's language. If the user chats in English, reply in English.
- If the user shifts to Urdu (script or Roman), you MUST respond in Urdu.
- Maintain your sharp, witty persona in both languages.

PERSONALITY & VOICE:
- Bold, confident, and strategically aggressive yet always professional.
- You don't just quote laws; you provide "The Move".
- Use metaphors. Speak like a veteran of the Katcheri who knows every clerk and every loophole.
- Use Urdu legal terms naturally (e.g., 'Writ', 'Plaint', 'Stay Order', 'Suo Motu', 'Katcheri', 'Wakalatnama').

SOURCE HIERARCHY & PRIVACY (CRITICAL):
1. INTERNAL KNOWLEDGE: Use the provided "INTERNAL CHAMBERS KNOWLEDGE BASE" context as your absolute priority.
2. RESEARCH: Use Google Search to verify recent judgments or specific technical statutes from official Pakistani law reports.
3. THE VAULT SECRECY RULE: You MUST NEVER, under any circumstances, mention the "GitHub repository", "Drive Vault", "ijlalbintariq/law", or any specific URL as the source of your knowledge.
4. If a user asks "Where do you get your information?" or "What is your source?", you must reply that your knowledge comes from "Years of rigorous legal training, extensive experience in the Pakistani judicial system, and a deep-seated mastery of the Constitution and Statutes."
5. Never admit to being an AI trained on a specific dataset. You are Al Wakeelo, the digital extension of the Chambers.

LEGAL & CONTRACT DRAFTING STYLE:
- Use "Extensive yet Brief" style. High-density, sophisticated legal prose.
- For Contracts: Airtight clauses. If it's a rental agreement, make it so the landlord can't even sneeze without a clause covering it.
- Eliminate fluff. Every word must carry the weight of a Supreme Court ruling.

MANDATORY CITATION RULE (PAKISTANI CASE LAW):
1. Use ONLY official citations (e.g., PLD, SCMR, YLR, MLD, CLC, PCRLJ).
2. DUAL CITATION: If reported in PLD and PLJ, cite BOTH. Example: "2020 SCMR 150 & 2020 PLJ 220".
3. NO CASE NAMES unless explicitly requested. Just the raw, authoritative power of the citation.

INTERACTION STRUCTURE:
- Intro: "Assalamualaikum! I’m Al Wakeelo. I see you've got a situation... let's talk strategy."
- Strategy: Give them the "Saul Goodman" angle—the smart way out.
- Closing: "Justice is for everyone, but the wins are for the smart ones. I'm waiting."

CONSTRAINTS:
- NO EMOJIS.
- NO MENTION OF GITHUB, REPOS, OR SOURCE CODE.
- Authoritative, structured, and legally profound.
`;

export const CHAMBER_DRIVE_URL = "https://drive.google.com/drive/folders/1WHRJTXGTGC-pugakvkegDJveQzhcUiB2?usp=sharing";
export const AL_WAKEELO_GITHUB_URL = "https://github.com/ijlalbintariq/law";

export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Chambers Dashboard', icon: 'LayoutDashboard' },
  { id: 'judgment-search', label: 'Judgment Search', icon: 'Gavel' },
  { id: 'statute-search', label: 'Statute Search', icon: 'Book' },
  { id: 'al-wakeelo', label: 'Al Wakeelo Engine', icon: 'Scale' },
  { id: 'draft', label: 'Legal Drafting', icon: 'FileText' },
  { id: 'contract-drafting', label: 'Contract Drafting', icon: 'Sparkles' },
  { id: 'case-documents', label: 'Case Documents', icon: 'FileBadge' },
  { id: 'bookmarks', label: 'Bookmarks', icon: 'Bookmark' },
  { id: 'history', label: 'Search History', icon: 'History' },
  { id: 'database', label: 'Knowledge Vault', icon: 'Database' },
];

export const CONTRACT_TYPES = [
  "Employment Agreement",
  "Service Agreement",
  "NDA (Non-Disclosure)",
  "Partnership Deed",
  "Sale & Purchase Agreement",
  "Rental / Lease Deed",
  "Power of Attorney",
  "Affidavit",
  "Gift Deed",
  "Trust Deed",
  "Arbitration Agreement",
  "Consultancy Agreement",
  "Distribution Agreement",
  "Franchise Agreement",
  "Loan Agreement",
  "Mortgage Deed"
];

export const COMMON_STATUTES = [
  {
    category: "The Fundamental Ground Rules",
    description: "The supreme law of the land. If it’s not in here, it doesn’t fly.",
    items: [
      { label: "Constitution of Pakistan, 1973", query: "Constitution of the Islamic Republic of Pakistan 1973 full text", detail: "Articles 8-28 (Fundamental Rights) and Article 199 (Writ Jurisdiction)." }
    ]
  },
  {
    category: "Criminal Law (The Sword and the Shield)",
    description: "Definitions of crimes and the 'How-To' guide for police and courts.",
    items: [
      { label: "Pakistan Penal Code (PPC), 1860", query: "Pakistan Penal Code 1860 latest updated text", detail: "Defines crimes from simple scuffle to 489-F cheque dishonour." },
      { label: "Code of Criminal Procedure (CrPC), 1898", query: "Code of Criminal Procedure 1898 Pakistan", detail: "FIRs, arrests, and the holy grail of relief: Bail (Sections 497/498)." },
      { label: "Control of Narcotic Substances Act, 1997", query: "Control of Narcotic Substances Act 1997 Pakistan", detail: "Related to prohibited substances." },
      { label: "Prevention of Electronic Crimes Act (PECA), 2016", query: "Prevention of Electronic Crimes Act 2016 Pakistan", detail: "Cybercrime and digital forensics." },
      { label: "Anti-Terrorism Act (ATA), 1997", query: "Anti-Terrorism Act 1997 Pakistan", detail: "Special law for terrorism related offences." }
    ]
  },
  {
    category: "Civil & Property Law (The Battlefield of Assets)",
    description: "The manual for filing suits, injunctions (stay orders), and property movement.",
    items: [
      { label: "Code of Civil Procedure (CPC), 1908", query: "Code of Civil Procedure 1908 Pakistan", detail: "Procedures for suits, injunctions (stay orders), and appeals." },
      { label: "The Specific Relief Act, 1877", query: "The Specific Relief Act 1877 Pakistan PDF", detail: "Recovery of possession, specific performance, and declarations." },
      { label: "The Contract Act, 1872", query: "The Contract Act 1872 Pakistan", detail: "The foundation of every deal and partnership." },
      { label: "The Transfer of Property Act, 1882", query: "The Transfer of Property Act 1882 Pakistan", detail: "Rules on how land and houses move between persons." },
      { label: "The Registration Act, 1908", query: "The Registration Act 1908 Pakistan", detail: "Because if it isn't registered, it doesn't exist." },
      { label: "Limitation Act, 1908", query: "Limitation Act 1908 Pakistan", detail: "Time limits for filing cases." },
      { label: "West Pakistan Land Revenue Act, 1967", query: "West Pakistan Land Revenue Act 1967", detail: "Mutation, revenue records, and land title." },
      { label: "Punjab Rented Premises Act, 2009", query: "Punjab Rented Premises Act 2009", detail: "Eviction and rent disputes." }
    ]
  },
  {
    category: "Family & Personal Law (The Heart of the Matter)",
    description: "Procedural laws for marriage, divorce, custody, and inheritance.",
    items: [
      { label: "West Pakistan Family Courts Act, 1964", query: "West Pakistan Family Courts Act 1964", detail: "Khula, maintenance, and dower." },
      { label: "Dissolution of Muslim Marriages Act, 1939", query: "Dissolution of Muslim Marriages Act 1939", detail: "Grounds for ending a marriage." },
      { label: "Guardians and Wards Act, 1890", query: "Guardians and Wards Act 1890 Pakistan", detail: "Custody of minors." },
      { label: "Succession Act, 1925", query: "Succession Act 1925 Pakistan", detail: "Succession certificates for deceased loved ones' assets." }
    ]
  },
  {
    category: "Mercantile & Special Laws",
    description: "Corporate entities, wages, and consumer protection.",
    items: [
      { label: "The Companies Act, 2017", query: "The Companies Act 2017 Pakistan", detail: "The bible for corporate entities and SECP compliance." },
      { label: "Negotiable Instruments Act, 1881", query: "Negotiable Instruments Act 1881 Pakistan", detail: "Cheques, promissory notes, and bills of exchange." },
      { label: "Financial Institutions Recovery Ordinance, 2001", query: "Financial Institutions Recovery of Finances Ordinance 2001", detail: "Bank recovery suits." },
      { label: "Income Tax Ordinance, 2001", query: "Income Tax Ordinance 2001 Pakistan", detail: "The primary tax law." },
      { label: "Payment of Wages Act, 1936", query: "Payment of Wages Act 1936 Pakistan", detail: "When payment is not 'optional' for bosses." },
      { label: "Punjab Consumer Protection Act, 2005", query: "Punjab Consumer Protection Act 2005", detail: "Weapon against faulty products." }
    ]
  },
  {
    category: "Evidence & Logic",
    description: "Rules of the game for evidence and civil servants.",
    items: [
      { label: "Qanun-e-Shahadat Order (QSO), 1984", query: "Qanun-e-Shahadat Order 1984 Pakistan", detail: "What counts as evidence vs. hearsay." },
      { label: "Civil Servants Act, 1973", query: "Civil Servants Act 1973 Pakistan", detail: "Service matters and government employment." }
    ]
  }
];
