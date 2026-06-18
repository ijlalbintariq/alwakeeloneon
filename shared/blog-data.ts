export interface BlogArticle {
  slug: string;
  title: string;
  category: string;
  summary: string;
  content: string; // Markdown content
  publishedAt: string;
  author: string;
  readTime: string;
}

export const BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: "muslim-family-laws-pakistan-nikah-talaq-khula",
    title: "Guide to Muslim Family Laws in Pakistan: Nikah, Talaq, and Khula",
    category: "Family Law",
    summary: "An in-depth guide to Nikah registration, divorce procedures (Talaq), and court-dissolved marriage (Khula) under the Muslim Family Laws Ordinance 1961.",
    author: "Zainab Chaudhry, Senior Advocate",
    publishedAt: "2026-06-10",
    readTime: "8 min read",
    content: `# Guide to Muslim Family Laws in Pakistan: Nikah, Talaq, and Khula

Family law in Pakistan is primarily governed by Islamic jurisprudence and codified statutes, most notably the **Muslim Family Laws Ordinance (MFLO), 1961**, and the **Family Courts Act, 1964**. Understanding the legal frameworks for marriage, divorce, dower, maintenance, and child custody is crucial for anyone navigating personal relations in Pakistan.

## 1. The Nikahnama (Marriage Contract)
In Islam, marriage (Nikah) is a civil contract rather than a sacrament. The terms of this contract are detailed in the **Nikahnama**, a formal legal document.
- **Registration:** Under Section 5 of the MFLO 1961, every marriage must be registered with the local Union Council. Failure to register can lead to fines and imprisonment, though it does not invalidate the marriage itself.
- **Key Columns:** 
  - **Column 18 (Delegated Divorce):** The husband can delegate the right of divorce (Talaq-e-Tafweez) to the wife. If this column is filled with "Yes" or specific conditions, the wife can divorce herself without going to court.
  - **Column 20 (Dower/Mehr):** The Mehr is a mandatory gift from the husband to the wife. It can be *Prompt* (payable on demand) or *Deferred* (payable upon dissolution of marriage or death).

## 2. Talaq (Divorce by the Husband)
Under Section 7 of the MFLO 1961, a husband who wishes to divorce his wife must follow a statutory procedure:
1. **Notice to Union Council:** The husband must send a written notice of divorce to the Chairman of the local Union Council and a copy to his wife.
2. **Arbitration Council:** Within 30 days of receiving the notice, the Chairman must constitute an Arbitration Council to attempt reconciliation between the parties.
3. **90-Day Period:** The divorce does not become effective until **90 days** from the date the notice was delivered to the Chairman. If the wife is pregnant at the time, the divorce is not effective until the pregnancy ends.
4. **Certificate of Effectiveness:** If reconciliation fails, the Union Council issues a certificate of effectiveness, finalizing the divorce.

## 3. Khula (Divorce initiated by the Wife)
If the wife does not have the delegated right of divorce in Column 18 of the Nikahnama, she must file a suit for the **Dissolution of Marriage on the grounds of Khula** in the Family Court under the **West Pakistan Family Courts Act, 1964**.
- **Grounds:** The wife can seek Khula if she establishes that she can no longer live with her husband within the limits ordained by Allah due to hatred or incompatibility. She does not need to prove specific misconduct (like cruelty), though doing so strengthens her case.
- **Relinquishment of Dower:** In exchange for Khula, the wife is usually required to return or waive her dower (Mehr). The court typically orders the return of 25% to 50% of prompt dower or relinquishment of deferred dower.
- **Reconciliation Attempt:** The Family Court is legally mandated to attempt pre-trial and post-trial reconciliation between the spouses. If reconciliation fails, the court decrees the Khula.

## 4. Maintenance (Nafaqa)
A husband is legally obligated to maintain his wife during the subsistence of the marriage and during the *Iddat* period (waiting period) after divorce.
- **Child Maintenance:** Under Section 9 of the MFLO 1961, a father is solely responsible for the maintenance of his minor children (sons until 18, daughters until marriage) according to his financial status.
- **Legal Recourse:** If a husband/father fails to provide maintenance, the wife can file an application to the Union Council or institute a suit in the Family Court.

## 5. Child Custody (Hizanat) and Guardianship
Child custody disputes are decided by the Guardian Court under the **Guardians and Wards Act, 1890**.
- **Welfare of the Minor:** The paramount consideration in all custody cases is the welfare of the minor child, not the absolute rights of the parents.
- **Right of Hizanat:** Generally, the mother has the right of custody (Hizanat) of young children (sons up to age 7, daughters up to puberty). However, this right can be lost if she remarries a stranger or is proven to lead an immoral lifestyle.
- **Guardianship:** Under Pakistani law, the father remains the natural guardian of the child's person and property, even if physical custody is with the mother.
`
  },
  {
    slug: "understanding-bail-criminal-procedure-pakistan",
    title: "Understanding Bail and Criminal Procedure under Pakistani CrPC",
    category: "Criminal Law",
    summary: "A comprehensive analysis of FIR registration, bailable versus non-bailable offenses, pre-arrest bail, post-arrest bail, and protective bail under the Code of Criminal Procedure 1898.",
    author: "Barrister Ijlal Tariq",
    publishedAt: "2026-06-12",
    readTime: "10 min read",
    content: `# Understanding Bail and Criminal Procedure under Pakistani CrPC

The criminal justice system in Pakistan is anchored by the **Code of Criminal Procedure (CrPC), 1898**, and the **Pakistan Penal Code (PPC), 1860**. For an accused individual, securing bail is one of the most critical stages of the legal process.

## 1. The Starting Point: The FIR
A criminal case typically begins with the registration of a **First Information Report (FIR)** under Section 154 of the CrPC at a local police station. 
- **Cognizable Offence:** An FIR can only be registered for cognizable offences (serious crimes where the police can arrest without a warrant, such as murder, robbery, or theft).
- **Non-Cognizable Offence:** For minor offences, the police record the entry in the daily diary (Roznamcha) and require a magistrate's order to arrest or investigate.

## 2. Bailable vs. Non-Bailable Offences
The CrPC categorizes criminal offences into two types regarding bail:
- **Bailable Offences:** These are minor offences listed in the Second Schedule of the CrPC. In these cases, bail is a **matter of right** for the accused. The police officer or magistrate must release the accused upon execution of a bail bond.
- **Non-Bailable Offences:** These are more serious offences where bail is **not a matter of right**, but a **matter of court discretion**. The court decides whether to grant bail based on the facts of the case.

## 3. Types of Bail in Pakistan

### A. Pre-Arrest Bail (Bail Before Arrest)
Pre-arrest bail is granted under **Section 498 of the CrPC** to prevent the arrest of an innocent person who fears arrest due to political victimization, ulterior motives, or malice (*malafide*) by the police or complainant.
- **Jurisdiction:** Can be filed in the Court of Sessions or the High Court.
- **Requirements:** The accused must show that their arrest would cause irreparable loss to their dignity and that the accusation is motivated by malice. The accused must surrender themselves to the court when filing the petition.

### B. Post-Arrest Bail (Bail After Arrest)
Once an individual has been arrested by the police, they can apply for post-arrest bail under **Section 497 of the CrPC**.
- **The Prohibitory Clause:** Section 497(1) states that bail shall *not* be granted if there are reasonable grounds to believe the accused is guilty of an offence punishable by death, life imprisonment, or 10 years (offences falling under the prohibitory clause).
- **Exceptions to Prohibitory Clause:** Even in serious offences, the court may grant bail if the accused is a woman, a minor (under 16), sick, or infirm.
- **Further Inquiry:** Under Section 497(2), if the court finds there are no reasonable grounds for believing the accused committed the offence, but there are sufficient grounds for *further inquiry* into their guilt, the accused is entitled to bail.

### C. Protective Bail / Transit Bail
- **Protective Bail:** Granted by a High Court to allow an accused person to reach the concerned trial court in another city or province to apply for bail without being arrested on the way.
- **Transit Bail:** A short-term bail granted to allow the accused to travel to the jurisdiction where the FIR was registered.

## 4. Statutory Delay as Ground for Bail
If a trial is delayed excessively through no fault of the accused, the third proviso of Section 497(1) provides a statutory right to bail:
- **In non-capital cases:** If the accused has been detained for more than **one year** without trial completion.
- **In capital cases:** If the accused has been detained for more than **two years** without trial completion.
*(Exceptions apply to hardened, dangerous, or desperate criminals).*
`
  },
  {
    slug: "contract-act-1872-pakistan-business-agreements",
    title: "The Contract Act 1872: Essentials of Business Agreements in Pakistan",
    category: "Commercial Law",
    summary: "Learn the core components of a legally binding business contract under the Contract Act 1872, including void agreements, breach of contract, and dispute resolution.",
    author: "M. Haris, Corporate Counsel",
    publishedAt: "2026-06-15",
    readTime: "7 min read",
    content: `# The Contract Act 1872: Essentials of Business Agreements in Pakistan

Commercial agreements and business relationships in Pakistan are governed by the **Contract Act, 1872**. Whether you are drafting a lease, employment contract, or partnership agreement, adherence to this statute is essential to ensure enforceability.

## 1. What Makes a Contract Enforceable?
Under Section 10 of the Contract Act, all agreements are contracts if they are made by the **free consent** of parties **competent to contract**, for a **lawful consideration**, and with a **lawful object**, and are not explicitly declared void by the Act.

### A. Competency of Parties (Section 11)
A person is competent to contract if they:
1. Have attained the age of majority (18 years under the Majority Act, 1875).
2. Are of sound mind.
3. Are not disqualified from contracting by any law to which they are subject.
*Contracts entered into by minors are void ab initio (void from the beginning) in Pakistan.*

### B. Free Consent (Section 14)
Consent is free when it is not caused by:
- **Coercion (Section 15):** Committing or threatening to commit any act forbidden by the Pakistan Penal Code.
- **Undue Influence (Section 16):** When one party is in a position to dominate the will of the other.
- **Fraud (Section 17):** Active concealment of a fact or false representations.
- **Misrepresentation (Section 18):** Unwarranted statements that lead to an error.
- **Mistake (Sections 20-22):** Mutual mistake of fact.

### C. Lawful Consideration and Object (Section 23)
The consideration or object of an agreement is unlawful if it is forbidden by law, defeats the provisions of any law, is fraudulent, involves injury to person or property, or is regarded by the court as immoral or opposed to public policy.

## 2. Void Agreements
The Contract Act declares certain types of agreements to be void:
- **Agreements in Restraint of Marriage (Section 26):** Void, except for minors.
- **Agreements in Restraint of Trade (Section 27):** Any agreement that restricts someone from exercising a lawful profession, trade, or business is void (with exceptions for the sale of goodwill).
- **Agreements in Restraint of Legal Proceedings (Section 28):** Agreements that restrict a party from enforcing their rights in court are void, *except* for agreements to refer future or existing disputes to **Arbitration**.

## 3. Breach of Contract and Remedies
When a party fails to perform their contractual obligations, the innocent party is entitled to remedies:
- **Compensation/Damages (Section 73):** The non-breaching party can claim compensation for any loss or damage that naturally arose in the usual course of things from the breach. Punitive or indirect damages are generally not allowed.
- **Liquidated Damages (Section 74):** If the contract specifies a penalty amount for breach, the court will award a reasonable sum not exceeding the specified amount.
- **Specific Performance:** Under the **Specific Relief Act, 1877**, the court can order the breaching party to perform their specific contract terms if monetary compensation is not an adequate remedy (e.g., in sale of unique real estate).

## 4. Best Practices for Business Contracts in Pakistan
1. **Put it in Writing:** While oral contracts are technically valid, they are extremely difficult to prove. Always put agreements in writing.
2. **Execute on Stamp Paper:** Contracts must be executed on non-judicial stamp paper of appropriate value under the **Stamp Act, 1899**. An unstamped contract cannot be admitted as evidence in court without paying heavy penalties.
3. **Witnesses:** Ensure the contract is signed by at least two competent witnesses.
4. **Registration:** Certain contracts (like property leases over 12 months) must be registered under the **Registration Act, 1908**.
`
  },
  {
    slug: "cybercrime-laws-peca-pakistan-digital-rights",
    title: "Cybercrime and Digital Media Laws in Pakistan: A Practical Guide to PECA 2016",
    category: "Cyber Law",
    summary: "Explore the offences, penalties, and enforcement mechanisms under the Prevention of Electronic Crimes Act 2016 (PECA), with focus on online defamation and identity theft.",
    author: "Raza Ali, Cyber Law Consultant",
    publishedAt: "2026-06-16",
    readTime: "7 min read",
    content: `# Cybercrime and Digital Media Laws in Pakistan: A Practical Guide to PECA 2016

The expansion of internet access and digital communication in Pakistan brought a parallel increase in digital fraud, harassment, and data breaches. The primary legislation dealing with these issues is the **Prevention of Electronic Crimes Act (PECA), 2016**.

## 1. Key Offences and Penalties under PECA 2016

### A. Unauthorized Access to Information System (Section 3)
Commonly known as **hacking**, accessing any information system or data without authorization is punishable by up to 3 months in prison, a fine of up to 50,000 PKR, or both. If the unauthorized access involves critical infrastructure (critical information systems), the penalty is up to 3 years.

### B. Electronic Fraud (Section 10)
Using a computer system or internet to defraud individuals, obtain financial gain, or cause damage is electronic fraud. It is punishable by up to 7 years in prison, a fine of up to 10 million PKR, or both.

### C. Identity Theft / Spoofing (Section 16)
Obtaining, selling, or using another person's identity information (such as CNIC, photos, biometrics, or passwords) without authorization is identity theft. The penalty is up to 3 years in prison, a fine of up to 5 million PKR, or both.

### D. Cyber Harassment and Defamation (Section 20 & 24)
- **Section 20 (Dignity of Natural Person):** Intentionally transmitting false information that intimidates, harms, or insults a natural person's dignity or reputation is a criminal offence. It carries a penalty of up to 3 years in prison, a fine of up to 1 million PKR, or both.
- **Section 24 (Cyber Stalking):** Following, contacting, or monitoring someone online despite their clear disapproval, or sharing their photos/videos online to cause harm or distress is cyberstalking. It carries up to 3 years in prison and up to a 1 million PKR fine.

## 2. Enforcement Agency: The FIA
The federal government has designated the **Federal Investigation Agency (FIA)** as the sole investigative agency under PECA. The FIA has established a specialized **Cyber Crime Wing (CCW)**.
- **Complaints:** Complaints can be submitted online via the FIA CCW web portal, by email, or in person at regional Cyber Crime centers.
- **Powers:** The FIA can search and seize digital devices (laptops, mobile phones) under a warrant.

## 3. Admissibility of Electronic Evidence
Under the **Qanun-e-Shahadat Order, 1984 (QSO)**, electronic records (emails, WhatsApp screenshots, SMS, CCTV footage) are admissible in court as secondary evidence. However, to be accepted:
1. The integrity of the data must be verified (no tampering).
2. The source device must be identified.
3. In practice, courts often require forensic reports from the FIA or independent experts to verify digital evidence.

## 4. Key Takeaways for Businesses and Individuals
- **Data Protection:** Businesses must protect customer data. Unauthorized sharing or data leaks can lead to liability under PECA.
- **Social Media Caution:** Sharing defamatory content, even if it is a repost or forward, can make you liable under Section 20 of PECA.
`
  },
  {
    slug: "demystifying-pakistani-land-revenue-records-fard-mutation",
    title: "Demystifying Pakistani Land Revenue Records: Fard, Khasra, and Mutation (Intaqal)",
    category: "Property Law",
    summary: "Understand the structure of Pakistani land revenue systems, how to read a Fard, the role of a Patwari, and the legal mutation process (Intaqal) for property transfer.",
    author: "Kamran Khan, Property Law Expert",
    publishedAt: "2026-06-18",
    readTime: "9 min read",
    content: `# Demystifying Pakistani Land Revenue Records: Fard, Khasra, and Mutation (Intaqal)

Real estate transactions and ownership disputes constitute a major portion of litigation in Pakistan. To protect your property investments, it is critical to understand the historical land revenue record-keeping system governed by the **Land Revenue Act, 1967**.

## 1. Key Terminology of Land Records
The land record system in Pakistan uses traditional terminology that can be confusing. Here are the core terms:
- **Jamabandi / Register Haqdaran-e-Zamin:** The core Record of Rights. It contains details of land ownership, shares, and tenancy in a particular revenue estate (Mauza).
- **Fard:** A copy of the land record page indicating ownership details, area of land, share ratio, and any encumbrances (mortgages, court stays).
- **Khasra:** A survey number assigned to a specific parcel of land. Every piece of land is mapped and given a unique Khasra number.
- **Khewat:** A ledger number representing a group of co-owners who hold joint land shares.
- **Khatooni:** A sub-division of a Khewat indicating the specific person occupying or cultivating the land.
- **Mauza:** The revenue village or estate boundaries.

## 2. The Mutation (Intaqal) Process
A **Mutation (Intaqal)** is the formal registration of a change in land ownership in the revenue records. It occurs after a sale, gift (Hiba), inheritance, or mortgage.
- **How it works (Traditional):** 
  1. The buyer and seller execute a sale deed (Registry) on stamp paper.
  2. The Sub-Registrar registers the deed.
  3. The deed is sent to the local **Patwari** (Land Record Keeper), who records the change in his register.
  4. The Revenue Officer (Tehsildar) verifies and approves the mutation in a public gathering.
- **Digital Land Records:** Major provinces like Punjab (Punjab Land Records Authority - PLRA) and Sindh (LARMIS) have computerized land records. Buyers can now visit Land Record Centers (Arazi Record Centers / ARC) to obtain digital Fards and register mutations directly via biometric verification.

## 3. The Role of a Patwari
The Patwari is the lowest-tier official in the Board of Revenue but holds massive influence. They maintain the field map (Shajra), crop registers (Khasra Girdawari), and record mutations. 
- *Crucial Warning:* A Fard or mutation recorded by a Patwari is *not* a title deed itself. It is only evidence of possession and tax collection. The ultimate legal title is established through a registered Sale Deed or a court decree.

## 4. Due Diligence Steps for Property Buyers
Before buying land in Pakistan, perform these essential checks:
1. **Obtain fresh Fard-e-Malkiat:** Ensure it shows the seller's name and has no active "stay orders" or mortgages.
2. **Verify physical possession:** Check who is physically occupying the land. Under Pakistani law, possession is strong evidence of title.
3. **Verify the Mutation History:** Trace the chain of mutations back at least 15 years to ensure there are no fraudulent transactions.
4. **Obtain Non-Encumbrance Certificate (NEC):** Verify with the registrar that the property is free from mortgages or legal disputes.
`
  }
];
