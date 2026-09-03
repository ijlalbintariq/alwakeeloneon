export interface ContractTemplateItem {
  id: string;
  title: string;
  category: string;
  description: string;
  icon?: string;
  estimatedTime?: string;
  complexity?: string;
  body: string;
  defaultVariables: Record<string, string>;
  governingLaw?: string;
  forum?: string;
  stampDutyArticle?: string;
}

export interface ClauseItem {
  id: string;
  title: string;
  category: string;
  clauseText: string;
  favor?: string;
  subtitle?: string;
  statutoryReference?: string;
}




    
    
  export const PAKISTANI_CONTRACT_TEMPLATES: ContractTemplateItem[] = [
  {
    id: "tpl_agreement_to_sell",
    title: "Agreement to Sell (Bayana / Immovable Property)",
    category: "Property & Real Estate",
    governingLaw: "Transfer of Property Act, 1882 & Registration Act, 1908",
    forum: "Civil Court / Registrar of Sub-District",
    stampDutyArticle: "Article 5(c), Stamp Act 1899 (PKR 1,200 non-judicial e-stamp)",
    description: "Standard Pakistani immovable property sale agreement with earnest money (Bayana), balance consideration timeline, encumbrance-free title warranty, and vacant possession delivery.",
    defaultVariables: {
      title: "AGREEMENT TO SELL IMMOVABLE PROPERTY",
      firstParty: "Malik Muhammad Usman",
      firstPartyCNIC: "35201-1829384-1",
      firstPartyAddress: "House No. 42, Sector F-7/2, Islamabad",
      secondParty: "Syed Asad Ali Shah",
      secondPartyCNIC: "35202-9876543-3",
      secondPartyAddress: "House No. 15-B, DHA Phase V, Lahore",
      considerationPkr: "45,000,000",
      jurisdiction: "Lahore",
      effectiveDate: "2026-09-01",
      termMonths: "3",
      noticeDays: "15",
      propertyOrScope: "Residential Plot No. 128, Block-C, Gulberg III, Lahore measuring 1 Kanal (500 sq. yards)",
      arbitrationCity: "Lahore",
    },
    body: `AGREEMENT TO SELL (IMMOVABLE PROPERTY)

This Agreement to Sell (the "Agreement") is executed at [JURISDICTION], Pakistan on this [EFFECTIVE_DATE] by and between:

1. [FIRST_PARTY_NAME], holding CNIC No. [FIRST_PARTY_CNIC], residing at [FIRST_PARTY_ADDRESS] (hereinafter referred to as the "VENDOR", which expression shall include his legal heirs, executors, administrators, and assigns) of the FIRST PART;
AND
2. [SECOND_PARTY_NAME], holding CNIC No. [SECOND_PARTY_CNIC], residing at [SECOND_PARTY_ADDRESS] (hereinafter referred to as the "PURCHASER", which expression shall include his legal heirs, executors, administrators, and assigns) of the SECOND PART.

(The Vendor and the Purchaser shall hereinafter collectively be referred to as the "Parties" and individually as a "Party").

WHEREAS, the Vendor is the absolute and lawful owner in possession of [PROPERTY_OR_SCOPE] (hereinafter referred to as the "Subject Property"), having acquired the same through registered Sale Deed / Allotment Letter free from all encumbrances, liens, mortgages, charges, or litigations of any nature whatsoever.

AND WHEREAS, the Vendor has agreed to sell, and the Purchaser has agreed to purchase the Subject Property for a total sale consideration of PKR [CONSIDERATION_PKR]/- (Pakistani Rupees in Words) on the following terms and conditions:

NOW, THEREFORE, THIS AGREEMENT WITNESSETH AS FOLLOWS:

1. TOTAL CONSIDERATION & PAYMENT SCHEDULE
1.1 Total Price: The agreed sale consideration for the Subject Property is PKR [CONSIDERATION_PKR]/-.
1.2 Earnest Money (Bayana): The Purchaser has paid a sum of PKR [CONSIDERATION_PKR_20PCT]/- as earnest money (Bayana) via Pay Order / Bank Draft, the receipt whereof the Vendor hereby acknowledges.
1.3 Balance Payment: The remaining balance of PKR [CONSIDERATION_PKR_80PCT]/- shall be paid by the Purchaser to the Vendor on or before [COMPLETION_DATE] simultaneously with the execution and registration of the final Sale Deed before the Sub-Registrar.

2. VENDOR'S TITLE WARRANTY & INDEMNITY
2.1 The Vendor explicitly covenants and warrants that the Subject Property is free from all mortgages, charges, prior agreements, family disputes, tax liabilities, municipal dues, or government acquisition notices.
2.2 The Vendor undertakes to clear all outstanding property taxes, excise charges, electricity, gas, and water dues up to the date of final handover.
2.3 If any defect in title or third-party claim emerges, the Vendor shall fully indemnify the Purchaser against all losses, damages, legal costs, and refund the consideration with 18% markup per annum.

3. VACANT PHYSICAL POSSESSION
The Vendor shall deliver peaceful, vacant, and physical possession of the Subject Property along with all original title documents, clearance certificates, and transfer permissions upon receipt of the final balance payment.

4. DEFAULT & SPECIFIC PERFORMANCE
4.1 Purchaser's Default: If the Purchaser fails to pay the balance consideration within the stipulated time without valid legal cause, the Vendor may serve a [NOTICE_DAYS]-day written notice, failing which the earnest money may be forfeited as liquidated damages.
4.2 Vendor's Default: If the Vendor fails or refuses to execute the registered Sale Deed or deliver possession, the Purchaser shall have the absolute right to enforce this Agreement through a Suit for Specific Performance under the Specific Relief Act, 1877 before the Civil Court at [JURISDICTION].

5. STAMP DUTY & TRANSFER EXPENSES
All stamp duty, registration fees, capital value tax (CVT), and municipal transfer fees shall be borne exclusively by the Purchaser, whereas Capital Gains Tax (CGT Section 37A/236C ITO 2001) shall be paid by the Vendor.

6. GOVERNING LAW & JURISDICTION
This Agreement shall be governed by and construed in accordance with the laws of the Islamic Republic of Pakistan, and the Civil Courts at [JURISDICTION] shall have exclusive jurisdiction.

IN WITNESS WHEREOF, the Parties have signed this Agreement on the date and year first above written.

_________________________                _________________________
VENDOR: [FIRST_PARTY_NAME]              PURCHASER: [SECOND_PARTY_NAME]
CNIC: [FIRST_PARTY_CNIC]                 CNIC: [SECOND_PARTY_CNIC]

WITNESS 1:                               WITNESS 2:
Name: ______________________             Name: ______________________
CNIC: ______________________             CNIC: ______________________
Address: ___________________             Address: ___________________`,
  },
  {
    id: "tpl_rent_deed",
    title: "Tenancy Deed / Commercial Rent Agreement",
    category: "Property & Real Estate",
    governingLaw: "Punjab Rented Premises Act, 2009 / Provincial Rent Restriction Laws",
    forum: "Rent Tribunal / Special Rent Judge",
    stampDutyArticle: "Article 35, Stamp Act 1899 (E-Stamp registered with Rent Registrar)",
    description: "Comprehensive tenancy deed for commercial/residential premises with 10% annual rent escalation, security deposit, utility liability, maintenance division, and eviction terms.",
    defaultVariables: {
      title: "COMMERCIAL TENANCY AGREEMENT",
      firstParty: "Chaudhry Pervaiz Iqbal",
      firstPartyCNIC: "35201-4455667-1",
      firstPartyAddress: "House 88, Main Boulevard, Gulberg II, Lahore",
      secondParty: "NexGen Logistics Pakistan (Pvt) Ltd",
      secondPartyCNIC: "0098472-8 (CUIN)",
      secondPartyAddress: "Plaza 14, Commercial Zone, Phase 4, DHA Lahore",
      considerationPkr: "250,000",
      jurisdiction: "Lahore",
      effectiveDate: "2026-09-01",
      termMonths: "11",
      noticeDays: "30",
      propertyOrScope: "Ground Floor Commercial Hall measuring 2,400 sq. ft located at Plaza No. 18, Civic Centre, Johar Town, Lahore",
      arbitrationCity: "Lahore",
    },
    body: `COMMERCIAL TENANCY AGREEMENT

This Tenancy Agreement (the "Agreement") is executed at [JURISDICTION] on this [EFFECTIVE_DATE] by and between:

1. [FIRST_PARTY_NAME], CNIC No. [FIRST_PARTY_CNIC], residing at [FIRST_PARTY_ADDRESS] (hereinafter referred to as the "LANDLORD") of the FIRST PART;
AND
2. [SECOND_PARTY_NAME], Registration/CNIC No. [SECOND_PARTY_CNIC], having office at [SECOND_PARTY_ADDRESS] (hereinafter referred to as the "TENANT") of the SECOND PART.

WHEREAS, the Landlord is the lawful owner of [PROPERTY_OR_SCOPE] (the "Demised Premises") and has agreed to let out the same to the Tenant on a monthly tenancy basis.

NOW, THEREFORE, IT IS MUTUALLY AGREED AS FOLLOWS:

1. TENANCY TERM & RENT
1.1 Term: The tenancy is granted for a fixed period of [TERM_MONTHS] months commencing from [EFFECTIVE_DATE].
1.2 Monthly Rent: The agreed monthly rent is PKR [CONSIDERATION_PKR]/- payable in advance on or before the 5th day of each calendar month via bank transfer to the Landlord's designated account.
1.3 Annual Escalation: Upon completion of each 11-month cycle, the monthly rent shall automatically escalate by ten percent (10%) over the existing rate.

2. SECURITY DEPOSIT
The Tenant has deposited with the Landlord an interest-free refundable security deposit of PKR [DEPOSIT_PKR] (equivalent to 3 months' rent). The Landlord shall refund this deposit within 10 days of the Tenant peacefully vacating the premises after adjusting any unpaid utilities or damages beyond normal wear and tear.

3. USE OF PREMISES & PROHIBITIONS
3.1 The Tenant shall use the premises strictly for lawful commercial office purposes and shall not store inflammable or hazardous goods.
3.2 Absolute Prohibition on Subletting: The Tenant shall not sublet, assign, mortgage, or transfer possession of the Demised Premises or any portion thereof to any third party under any circumstances.

4. UTILITIES & TAXES
4.1 The Tenant shall regularly pay all electricity, water, telephone, and internet bills according to actual meter readings and furnish paid receipts to the Landlord.
4.2 Property taxes and government ground rent shall be paid exclusively by the Landlord.

5. TERMINATION & VACATION NOTICE
Either Party may terminate this tenancy by serving a [NOTICE_DAYS]-day prior written notice. Upon expiry or earlier termination, the Tenant shall peacefully hand over vacant possession in good tenantable repair.

6. RENT REGISTRAR COMPLIANCE
This Agreement shall be duly registered with the Rent Registrar under Section 5 of the Punjab Rented Premises Act, 2009 / relevant Provincial Rent Law.

LANDLORD: [FIRST_PARTY_NAME]                 TENANT: [SECOND_PARTY_NAME]
CNIC: [FIRST_PARTY_CNIC]                     CNIC/Reg: [SECOND_PARTY_CNIC]`,
  },
  {
    id: "tpl_nda",
    title: "Mutual Non-Disclosure Agreement (NDA)",
    category: "Commercial & Corporate",
    governingLaw: "Contract Act, 1872 & Trade Secrets Protection",
    forum: "Civil Court / Commercial Arbitration",
    stampDutyArticle: "Article 5, Stamp Act 1899 (PKR 500 stamp paper)",
    description: "Bilateral confidentiality and proprietary trade secrets protection agreement with strict disclosure carveouts, 3-year post-termination survival, and injunctive relief clauses.",
    defaultVariables: {
      title: "MUTUAL NON-DISCLOSURE AGREEMENT",
      firstParty: "Alwakeelo Legal Technologies (Pvt) Ltd",
      firstPartyCNIC: "0194821-2",
      firstPartyAddress: "Floor 4, Software Technology Park, Constitution Ave, Islamabad",
      secondParty: "Apex Financial Systems Ltd",
      secondPartyCNIC: "0082914-5",
      secondPartyAddress: "Level 12, Executive Tower, Dolmen City, Clifton, Karachi",
      considerationPkr: "0",
      jurisdiction: "Islamabad",
      effectiveDate: "2026-09-01",
      termMonths: "24",
      noticeDays: "15",
      propertyOrScope: "Proprietary AI Legal RAG Algorithms, PostgreSQL Case Law Schemas, API Keys, and Commercial Architecture",
      arbitrationCity: "Islamabad",
    },
    body: `MUTUAL NON-DISCLOSURE AND CONFIDENTIALITY AGREEMENT

This Mutual Non-Disclosure Agreement (the "Agreement") is made and entered into at [JURISDICTION], Pakistan on this [EFFECTIVE_DATE] by and between:

1. [FIRST_PARTY_NAME], having its principal office at [FIRST_PARTY_ADDRESS] (hereinafter referred to as the "First Party");
AND
2. [SECOND_PARTY_NAME], having its principal office at [SECOND_PARTY_ADDRESS] (hereinafter referred to as the "Second Party").

(The First Party and Second Party shall individually be referred to as "Party" and collectively as "Parties").

WHEREAS, the Parties are exploring a prospective commercial collaboration concerning [PROPERTY_OR_SCOPE] (the "Authorized Purpose"); and in connection therewith, each Party may disclose to the other certain proprietary and confidential information.

NOW, THEREFORE, THE PARTIES HEREBY AGREE AS FOLLOWS:

1. DEFINITION OF CONFIDENTIAL INFORMATION
"Confidential Information" means all non-public, proprietary, or confidential data, technical architecture, software code, customer lists, financial figures, RAG vector embeddings, algorithms, trade secrets, and business plans disclosed by one Party (the "Disclosing Party") to the other Party (the "Receiving Party"), whether orally, in writing, or electronically.

2. EXCLUSIONS FROM CONFIDENTIALITY
Confidential Information does not include information that:
(a) is or becomes publicly known through no breach of this Agreement;
(b) was already rightfully in the possession of the Receiving Party prior to disclosure;
(c) is independently developed by the Receiving Party without reference to the Confidential Information; or
(d) is required to be disclosed by order of a competent Pakistani court or regulatory authority, provided the Disclosing Party is given prompt written notice.

3. OBLIGATIONS OF RECEIVING PARTY
3.1 Duty of Care: The Receiving Party shall hold all Confidential Information in strict confidence and apply at least the same degree of care as it uses to protect its own confidential data of like nature, but not less than reasonable care.
3.2 Limited Use: The Receiving Party shall use the Confidential Information solely for the Authorized Purpose and shall not disclose it to any third party without prior written consent.
3.3 Need-to-Know: Disclosure shall be restricted strictly to employees, directors, and legal counsel who have a need to know and are bound by written non-disclosure obligations.

4. TERM & SURVIVAL
This Agreement shall remain effective for [TERM_MONTHS] months from the Effective Date. The confidentiality obligations herein shall survive the termination of this Agreement for a period of three (3) years thereafter.

5. REMEDIES & INJUNCTIVE RELIEF
The Parties acknowledge that any breach of this Agreement may cause irreparable harm for which monetary damages alone would be inadequate. Accordingly, the Disclosing Party shall be entitled to seek temporary and permanent injunctive relief under Order XXXIX Rules 1 & 2 of the Code of Civil Procedure, 1908 without proving actual damages.

6. GOVERNING LAW & ARBITRATION
This Agreement shall be governed by the laws of Pakistan. Any dispute shall be resolved through arbitration under the Arbitration Act, 1940 by a sole arbitrator seated in [ARBITRATION_CITY].

FIRST PARTY: [FIRST_PARTY_NAME]              SECOND PARTY: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_partnership_deed",
    title: "Partnership Deed (Partnership Act 1932)",
    category: "Commercial & Corporate",
    governingLaw: "Partnership Act, 1932",
    forum: "Registrar of Firms / Civil Court",
    stampDutyArticle: "Article 46, Stamp Act 1899 (Special Partnership stamp value)",
    description: "Formal partnership agreement with capital contributions, profit/loss distribution ratio, management authority, banking operations, retirement, and Section 48 dissolution rules.",
    defaultVariables: {
      title: "DEED OF PARTNERSHIP",
      firstParty: "Barrister Hamza Tariq",
      firstPartyCNIC: "35201-1122334-1",
      firstPartyAddress: "Chamber 401, Al-Murtaza Law Chambers, Fane Road, Lahore",
      secondParty: "Advocate Bilal Raza Khan",
      secondPartyCNIC: "35202-5566778-3",
      secondPartyAddress: "Chamber 202, Legal Heights, Mozang Road, Lahore",
      considerationPkr: "10,000,000",
      jurisdiction: "Lahore",
      effectiveDate: "2026-09-01",
      termMonths: "60",
      noticeDays: "90",
      propertyOrScope: "Legal Consultancy, Corporate Advisory, and Commercial Litigation Firm operating under the style of 'Tariq & Raza Law Chambers'",
      arbitrationCity: "Lahore",
    },
    body: `PARTNERSHIP DEED

This Deed of Partnership (the "Deed") is made and executed at [JURISDICTION], Pakistan on this [EFFECTIVE_DATE] by and between:

1. [FIRST_PARTY_NAME], CNIC No. [FIRST_PARTY_CNIC], residing at [FIRST_PARTY_ADDRESS] (hereinafter referred to as "Partner 1");
AND
2. [SECOND_PARTY_NAME], CNIC No. [SECOND_PARTY_CNIC], residing at [SECOND_PARTY_ADDRESS] (hereinafter referred to as "Partner 2").

(Partner 1 and Partner 2 shall individually be referred to as a "Partner" and collectively as the "Partners").

WHEREAS, the Partners have agreed to enter into a partnership to carry on the business of [PROPERTY_OR_SCOPE] under the provisions of the Partnership Act, 1932.

NOW, THEREFORE, THIS DEED WITNESSETH AS FOLLOWS:

1. NAME & PLACE OF BUSINESS
1.1 The business of the partnership shall be carried on under the firm name of "[PROPERTY_OR_SCOPE]" (the "Firm").
1.2 The principal office of the Firm shall be at [FIRST_PARTY_ADDRESS], or at such other place as the Partners may mutually decide.

2. COMMENCEMENT & DURATION
The partnership shall commence on [EFFECTIVE_DATE] and shall continue as a "Partnership at Will" under Section 7 of the Partnership Act, 1932 until dissolved in accordance with the provisions of this Deed.

3. CAPITAL CONTRIBUTION & PROFIT SHARING
3.1 The initial capital of the Firm is PKR [CONSIDERATION_PKR]/- contributed equally (50% : 50%) by the Partners.
3.2 Profit and Loss Sharing: All net profits, losses, and liabilities of the Firm shall be shared between Partner 1 and Partner 2 in equal proportion (50% each).
3.3 Financial Year: The accounting year of the Firm shall close on the 30th day of June each year to align with the Pakistani tax fiscal year.

4. BANK ACCOUNTS & SIGNING POWERS
All bank accounts in the name of the Firm shall be maintained at scheduled Pakistani banks and shall be operated JOINTLY by both Partners for all transactions exceeding PKR 100,000/-.

5. RETIREMENT & ADMISSION
5.1 Retirement: Any Partner may retire from the Firm by giving at least [NOTICE_DAYS] days' prior written notice to the other Partner.
5.2 Admission: No new partner shall be admitted to the Firm without the unanimous written consent of both existing Partners.

6. DISSOLUTION & WINDING UP (SECTION 48)
Upon dissolution of the Firm, the accounts shall be settled and assets distributed strictly in accordance with Section 48 of the Partnership Act, 1932:
(a) First, in payment of all third-party debts and liabilities of the Firm;
(b) Second, in payment to each Partner rateably of advances distinguished from capital;
(c) Third, in payment to each Partner rateably what is due in respect of capital; and
(d) The residue, if any, shall be divided among the Partners in equal shares.

7. ARBITRATION (ARBITRATION ACT 1940)
All disputes or differences arising between the Partners regarding this Deed shall be referred to arbitration under the Arbitration Act, 1940 by a sole arbitrator mutually appointed in [ARBITRATION_CITY].

PARTNER 1: [FIRST_PARTY_NAME]               PARTNER 2: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_employment_contract",
    title: "Executive Employment Agreement",
    category: "Employment & HR",
    governingLaw: "Industrial & Commercial Employment (Standing Orders) Ordinance, 1968",
    forum: "Labour Court / Civil Court",
    stampDutyArticle: "Article 5, Stamp Act 1899 (PKR 100 stamp paper)",
    description: "Standard Pakistani employment agreement with 3-month probation, salary breakdown, working hours, IP assignment, lawful non-solicitation covenants, and severance procedures.",
    defaultVariables: {
      title: "EMPLOYMENT CONTRACT",
      firstParty: "Alwakeelo Technologies (Pvt) Ltd",
      firstPartyCNIC: "0194821-2",
      firstPartyAddress: "Floor 4, STP Building, Constitution Ave, Islamabad",
      secondParty: "Muhammad Daniyal Khan",
      secondPartyCNIC: "37405-1234567-9",
      secondPartyAddress: "House 22, Street 8, G-11/1, Islamabad",
      considerationPkr: "350,000",
      jurisdiction: "Islamabad",
      effectiveDate: "2026-09-01",
      termMonths: "12",
      noticeDays: "30",
      propertyOrScope: "Lead Full-Stack AI Engineer & RAG System Architect",
      arbitrationCity: "Islamabad",
    },
    body: `EMPLOYMENT CONTRACT

This Employment Agreement (the "Agreement") is executed at [JURISDICTION] on this [EFFECTIVE_DATE] by and between:

1. [FIRST_PARTY_NAME], having its registered office at [FIRST_PARTY_ADDRESS] (the "EMPLOYER");
AND
2. [SECOND_PARTY_NAME], CNIC No. [SECOND_PARTY_CNIC], residing at [SECOND_PARTY_ADDRESS] (the "EMPLOYEE").

1. APPOINTMENT & PROBATION
1.1 Position: The Employer hereby appoints the Employee to the position of [PROPERTY_OR_SCOPE].
1.2 Probation Period: The Employee shall serve an initial probation period of three (3) months. Upon satisfactory performance, the Employer shall issue a written letter of confirmation.

2. REMUNERATION & TAX DEDUCTION
2.1 Monthly Gross Salary: The Employer shall pay the Employee a monthly gross remuneration of PKR [CONSIDERATION_PKR]/- subject to statutory income tax deductions under Section 149 of the Income Tax Ordinance, 2001.
2.2 Payment Date: Salary shall be credited directly to the Employee's bank account on or before the 1st working day of each calendar month.

3. WORKING HOURS & STATUTORY LEAVES
3.1 Working Hours: Standard working hours shall be 40 hours per week (Monday to Friday, 9:00 AM to 6:00 PM).
3.2 Leaves: The Employee shall be entitled to statutory leaves (14 Annual Leaves, 10 Casual Leaves, and 8 Sick Leaves per annum) in accordance with the Provincial Standing Orders.

4. WORK PRODUCT & INTELLECTUAL PROPERTY ASSIGNMENT
All inventions, software code, legal databases, RAG algorithms, and trade secrets developed by the Employee during the course of employment shall be the sole and exclusive property of the Employer from inception as "work made for hire" under the Copyright Ordinance, 1962 and Patents Ordinance, 2000.

5. RESTRICTIVE COVENANTS & SECTION 27 COMPLIANCE
5.1 Non-Solicitation: During employment and for a period of twelve (12) months thereafter, the Employee shall not solicit or entice away any customer, client, or employee of the Employer.
5.2 Enforceability Notice: In compliance with Section 27 of the Contract Act, 1872, no unreasonable post-employment restraint of trade is imposed, and this restriction is strictly limited to non-solicitation and trade secret protection.

6. TERMINATION
During probation, either Party may terminate this Agreement with seven (7) days' notice. Post-confirmation, termination by either Party shall require [NOTICE_DAYS] days' written notice or salary in lieu thereof.

EMPLOYER: [FIRST_PARTY_NAME]                 EMPLOYEE: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_power_of_attorney_gpa",
    title: "General Power of Attorney (GPA)",
    category: "Property & Real Estate",
    governingLaw: "Powers of Attorney Act, 1882 & Registration Act, 1908",
    forum: "Sub-Registrar / Revenue Courts / High Court",
    stampDutyArticle: "Article 48, Stamp Act 1899 (PKR 1,200 stamp + biometric verification)",
    description: "Registered General Power of Attorney appointing lawful agent to manage properties, institute and defend court litigations, sign Vakalatnamas, and represent before CDA/LDA/DHA.",
    defaultVariables: {
      title: "GENERAL POWER OF ATTORNEY",
      firstParty: "Sardar Aurangzeb Khan",
      firstPartyCNIC: "35201-9988776-1",
      firstPartyAddress: "Villa 10, Sector G-6/3, Islamabad (Principal)",
      secondParty: "Raja Farhan Aurangzeb",
      secondPartyCNIC: "35201-1122998-3",
      secondPartyAddress: "House 24, Sector F-8/4, Islamabad (Attorney)",
      considerationPkr: "0",
      jurisdiction: "Islamabad",
      effectiveDate: "2026-09-01",
      termMonths: "0",
      noticeDays: "0",
      propertyOrScope: "All immovable and movable assets including Commercial Plaza No. 8, Blue Area, Islamabad and Residential Plot 50, Sector E-11, Islamabad",
      arbitrationCity: "Islamabad",
    },
    body: `GENERAL POWER OF ATTORNEY

KNOW ALL MEN BY THESE PRESENTS that I, [FIRST_PARTY_NAME], holding CNIC No. [FIRST_PARTY_CNIC], residing at [FIRST_PARTY_ADDRESS] (hereinafter referred to as the "PRINCIPAL"), do hereby nominate, constitute, and appoint [SECOND_PARTY_NAME], holding CNIC No. [SECOND_PARTY_CNIC], residing at [SECOND_PARTY_ADDRESS] (hereinafter referred to as the "ATTORNEY"), as my true and lawful Attorney to act in my name, on my behalf, and for my benefit in respect of [PROPERTY_OR_SCOPE].

I hereby grant the Attorney the following powers and authorities:

1. PROPERTY MANAGEMENT & LEASING
1.1 To manage, supervise, and administer all my properties; to let out the same on rent, execute tenancy deeds, collect rents, issue receipts, and deposit funds in my bank account.
1.2 To pay property taxes, utility bills, maintenance charges, and government levies.

2. COURT REPRESENTATION & LEGAL PROCEEDINGS
2.1 To represent me before the Supreme Court of Pakistan, High Courts, Civil Courts, Sessions Courts, Rent Tribunals, Revenue Courts, and all statutory authorities (including CDA, LDA, DHA, FBR, WAPDA).
2.2 To engage advocates, sign Vakalatnamas, plaints, written statements, appeals, revisions, writ petitions, compromise deeds, and record statements on oath.

3. UTILITY & MUNICIPAL CONNECTIONS
To apply for, obtain, transfer, and install electricity, gas, water, and telephone connections in respect of my properties.

4. RESTRICTIONS ON SALE & ENCUMBRANCE
The Attorney shall NOT have any power to sell, gift, mortgage, or transfer the title of the Principal's immovable properties unless accompanied by a specific, registered Special Power of Attorney identifying the exact plot and registered with the Sub-Registrar.

5. RATIFICATION & INDEMNITY
I hereby agree to ratify and confirm all lawful acts, deeds, and things done by the Attorney pursuant to these presents.

IN WITNESS WHEREOF, the Principal has executed this General Power of Attorney on [EFFECTIVE_DATE].

PRINCIPAL: [FIRST_PARTY_NAME]               ATTORNEY: [SECOND_PARTY_NAME]
CNIC: [FIRST_PARTY_CNIC]                     CNIC: [SECOND_PARTY_CNIC]`,
  },
  {
    id: "tpl_franchise_agreement",
    title: "Commercial Franchise Agreement",
    category: "Commercial & Corporate",
    governingLaw: "Contract Act, 1872 & Trade Marks Ordinance, 2001",
    forum: "Commercial Court / Arbitration",
    stampDutyArticle: "Article 5, Stamp Act 1899",
    description: "Franchise brand licensing agreement detailing franchise fees, 5% monthly gross revenue royalty, operating manual compliance, quality audits, territory exclusivity, and trademark guidelines.",
    defaultVariables: {
      title: "COMMERCIAL FRANCHISE AGREEMENT",
      firstParty: "Khyber Roast Master Foods (Pvt) Ltd",
      firstPartyCNIC: "0219482-1",
      firstPartyAddress: "Head Office, 50-C, Commercial Zone, Gulberg III, Lahore (Franchisor)",
      secondParty: "Peshawar Gourmet Hospitality (SMC-Pvt) Ltd",
      secondPartyCNIC: "0349182-4",
      secondPartyAddress: "Mall Road, Peshawar Cantt (Franchisee)",
      considerationPkr: "5,000,000",
      jurisdiction: "Lahore",
      effectiveDate: "2026-09-01",
      termMonths: "60",
      noticeDays: "60",
      propertyOrScope: "Khyber Roast Brand License for Exclusive Territory of Peshawar Cantt & University Road",
      arbitrationCity: "Lahore",
    },
    body: `COMMERCIAL FRANCHISE AGREEMENT

This Franchise Agreement (the "Agreement") is entered into at [JURISDICTION] on [EFFECTIVE_DATE] by and between [FIRST_PARTY_NAME] (the "FRANCHISOR") and [SECOND_PARTY_NAME] (the "FRANCHISEE").

1. GRANT OF FRANCHISE & TERRITORY
The Franchisor hereby grants to the Franchisee the exclusive right and license to establish and operate one franchise outlet under the proprietary brand name and system in the territory of [PROPERTY_OR_SCOPE] for a term of [TERM_MONTHS] months.

2. FRANCHISE FEES & ROYALTY
2.1 Initial Franchise Fee: The Franchisee shall pay an initial, non-refundable franchise fee of PKR [CONSIDERATION_PKR]/- upon execution of this Agreement.
2.2 Monthly Royalty: The Franchisee shall pay a continuing monthly royalty fee equal to five percent (5%) of gross monthly sales, payable on or before the 10th day of each calendar month.

3. QUALITY STANDARDS & OPERATING MANUAL
The Franchisee shall operate strictly in accordance with the Franchisor's confidential Operations Manual, recipe formulas, food hygiene benchmarks, and brand guidelines.

4. TRADEMARK & INTELLECTUAL PROPERTY
The Franchisee acknowledges that all trademarks, service marks, recipes, and goodwill belong exclusively to the Franchisor. The Franchisee acquires no proprietary rights therein.

5. TERMINATION
The Franchisor may terminate this Agreement immediately upon written notice if the Franchisee defaults on royalty payments, breaches quality standards, or violates food safety regulations.

6. GOVERNING LAW & ARBITRATION
Governed by Pakistani laws. Disputes resolved by arbitration under the Arbitration Act, 1940 in [ARBITRATION_CITY].

FRANCHISOR: [FIRST_PARTY_NAME]              FRANCHISEE: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_share_purchase_agreement",
    title: "Share Purchase Agreement (SPA)",
    category: "Commercial & Corporate",
    governingLaw: "Companies Act, 2017 & Contract Act, 1872",
    forum: "SECP / High Court (Company Bench)",
    stampDutyArticle: "Article 62, Stamp Act 1899 (Share transfer stamp rate)",
    description: "Corporate equity sale agreement detailing share transfer, purchase consideration, seller warranties, conditions precedent, closing deliverables (Form-29 / Form-A), and tax indemnities.",
    defaultVariables: {
      title: "SHARE PURCHASE AGREEMENT",
      firstParty: "Kamran Akmal Siddiqui",
      firstPartyCNIC: "35201-7788990-1",
      firstPartyAddress: "House 19, DHA Phase 6, Lahore (Seller)",
      secondParty: "Apex Holdings (Pvt) Ltd",
      secondPartyCNIC: "0091823-7",
      secondPartyAddress: "Building 10, Clifton, Karachi (Purchaser)",
      considerationPkr: "75,000,000",
      jurisdiction: "Karachi",
      effectiveDate: "2026-09-01",
      termMonths: "6",
      noticeDays: "30",
      propertyOrScope: "500,000 Ordinary Shares representing 25% paid-up capital of Indus Agro Chemicals (Pvt) Ltd",
      arbitrationCity: "Karachi",
    },
    body: `SHARE PURCHASE AGREEMENT (SPA)

This Share Purchase Agreement (the "Agreement") is made at [JURISDICTION] on [EFFECTIVE_DATE] by and between [FIRST_PARTY_NAME] (the "SELLER") and [SECOND_PARTY_NAME] (the "PURCHASER").

1. SALE AND PURCHASE OF SHARES
Subject to the terms herein, the Seller agrees to sell and transfer, and the Purchaser agrees to purchase [PROPERTY_OR_SCOPE] (the "Sale Shares") free from all liens, pledges, and encumbrances for a total purchase price of PKR [CONSIDERATION_PKR]/-.

2. CONDITIONS PRECEDENT & CLOSING
Closing shall occur within 30 days of obtaining Board approval and SECP compliance filings under the Companies Act, 2017.

3. REPRESENTATIONS AND WARRANTIES
The Seller warrants that he is the sole beneficial and registered owner of the Sale Shares with full corporate power to execute this transfer.

4. GOVERNING LAW & ARBITRATION
Governed by the Companies Act, 2017 and Contract Act, 1872. Arbitration under Arbitration Act, 1940 in [ARBITRATION_CITY].

SELLER: [FIRST_PARTY_NAME]                  PURCHASER: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_master_services_agreement",
    title: "Master Services Agreement (MSA & SLA)",
    category: "Commercial & Corporate",
    governingLaw: "Contract Act, 1872",
    forum: "Commercial Court / ADR",
    stampDutyArticle: "Article 5, Stamp Act 1899",
    description: "Comprehensive B2B Master Services Agreement with statement of work schedules, milestone deliverables, acceptance testing, 99.5% SLA, and provincial withholding tax compliance.",
    defaultVariables: {
      title: "MASTER SERVICES AGREEMENT",
      firstParty: "PakCloud Infrastructure (Pvt) Ltd",
      firstPartyCNIC: "0182938-4",
      firstPartyAddress: "Floor 2, I-9/3 Industrial Area, Islamabad (Provider)",
      secondParty: "Habib Commercial Enterprises Ltd",
      secondPartyCNIC: "0019284-9",
      secondPartyAddress: "I.I. Chundrigar Road, Karachi (Client)",
      considerationPkr: "12,000,000",
      jurisdiction: "Islamabad",
      effectiveDate: "2026-09-01",
      termMonths: "12",
      noticeDays: "30",
      propertyOrScope: "Enterprise Cloud Hosting, High-Availability Database Replication, and 24/7 Cybersecurity Monitoring",
      arbitrationCity: "Islamabad",
    },
    body: `MASTER SERVICES AGREEMENT (MSA)

This Master Services Agreement is entered into at [JURISDICTION] on [EFFECTIVE_DATE] between [FIRST_PARTY_NAME] ("PROVIDER") and [SECOND_PARTY_NAME] ("CLIENT").

1. SCOPE OF SERVICES
The Provider shall deliver [PROPERTY_OR_SCOPE] in accordance with the Service Level Agreement (SLA) specifications.

2. FEES AND PAYMENT TERMS
Client shall pay PKR [CONSIDERATION_PKR]/- per annum, invoiced quarterly, subject to applicable provincial sales tax (PRA 16% / SRB 13%).

3. LIMITATION OF LIABILITY
Neither Party's aggregate liability under this Agreement shall exceed the total fees paid in the twelve (12) months preceding the claim.

4. DISPUTE RESOLUTION
Arbitration under Arbitration Act 1940 in [ARBITRATION_CITY].

PROVIDER: [FIRST_PARTY_NAME]                CLIENT: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_consultancy_agreement",
    title: "Independent Consultancy Agreement",
    category: "Employment & HR",
    governingLaw: "Contract Act, 1872",
    forum: "Civil Court / Commercial Arbitration",
    stampDutyArticle: "Article 5, Stamp Act 1899",
    description: "Independent contractor consultancy contract with milestone deliverables, retainer billing, intellectual property transfer, and tax withholding compliance under Section 153 ITO 2001.",
    defaultVariables: {
      title: "INDEPENDENT CONSULTANCY AGREEMENT",
      firstParty: "National Telecommunications Consortium",
      firstPartyCNIC: "0088991-2",
      firstPartyAddress: "Telecom Tower, Blue Area, Islamabad (Client)",
      secondParty: "Engr. Mansoor Ahmed Qureshi",
      secondPartyCNIC: "61101-1234567-1",
      secondPartyAddress: "House 45, Sector F-10/2, Islamabad (Consultant)",
      considerationPkr: "1,800,000",
      jurisdiction: "Islamabad",
      effectiveDate: "2026-09-01",
      termMonths: "6",
      noticeDays: "15",
      propertyOrScope: "5G Spectrum Deployment Strategy and Network Optimization Advisory",
      arbitrationCity: "Islamabad",
    },
    body: `INDEPENDENT CONSULTANCY AGREEMENT

Executed at [JURISDICTION] on [EFFECTIVE_DATE] between [FIRST_PARTY_NAME] ("CLIENT") and [SECOND_PARTY_NAME] ("CONSULTANT").

1. NATURE OF RELATIONSHIP
The Consultant is an independent contractor, and nothing herein creates an employer-employee relationship.

2. SCOPE & DELIVERABLES
Consultant shall perform [PROPERTY_OR_SCOPE] with reasonable skill, care, and diligence.

3. FEES
Total consultancy fee is PKR [CONSIDERATION_PKR]/- payable in monthly installments subject to tax deduction at source under Section 153 of the Income Tax Ordinance, 2001.

CLIENT: [FIRST_PARTY_NAME]                  CONSULTANT: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_commercial_lease",
    title: "Commercial Long-Term Lease Agreement",
    category: "Property & Real Estate",
    governingLaw: "Transfer of Property Act, 1882 & Registration Act, 1908",
    forum: "Civil Court / Sub-Registrar",
    stampDutyArticle: "Article 35, Stamp Act 1899 (Mandatory registered lease)",
    description: "Long-term commercial real estate lease for shopping malls, office towers, or industrial warehouses with 5-year term, rent escalation tiers, structural modification rules, and insurance covenants.",
    defaultVariables: {
      title: "COMMERCIAL LONG-TERM LEASE DEED",
      firstParty: "Gulberg Heights Commercial Tower (Pvt) Ltd",
      firstPartyCNIC: "0149281-5",
      firstPartyAddress: "Main Boulevard, Gulberg III, Lahore (Lessor)",
      secondParty: "Bank Al-Habib Islamic Banking Division",
      secondPartyCNIC: "0018294-8",
      secondPartyAddress: "DHA Phase 5 Commercial, Lahore (Lessee)",
      considerationPkr: "1,200,000",
      jurisdiction: "Lahore",
      effectiveDate: "2026-09-01",
      termMonths: "60",
      noticeDays: "90",
      propertyOrScope: "Ground Floor Banking Hall measuring 4,500 sq. ft in Gulberg Heights Tower, Lahore",
      arbitrationCity: "Lahore",
    },
    body: `COMMERCIAL LONG-TERM LEASE DEED

This Commercial Lease Deed is executed at [JURISDICTION] on [EFFECTIVE_DATE] between [FIRST_PARTY_NAME] ("LESSOR") and [SECOND_PARTY_NAME] ("LESSEE").

1. DEMISE AND TERM
The Lessor hereby demises unto the Lessee [PROPERTY_OR_SCOPE] for a fixed term of [TERM_MONTHS] months.

2. RENT AND ESCALATION
Monthly rent of PKR [CONSIDERATION_PKR]/- payable in advance, with 10% annual escalation.

3. STRUCTURAL ALTERATIONS
The Lessee may carry out non-structural interior fit-outs with prior written approval of the Lessor.

LESSOR: [FIRST_PARTY_NAME]                  LESSEE: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_loan_agreement",
    title: "Commercial Loan & Financing Deed",
    category: "Finance & IP",
    governingLaw: "Contract Act, 1872 & Financial Institutions Ordinance",
    forum: "Banking Court / Civil Court",
    stampDutyArticle: "Article 5, Stamp Act 1899",
    description: "B2B commercial loan agreement with principal amount, mark-up schedule, repayment milestones, personal guarantor undertakings, and default acceleration clauses.",
    defaultVariables: {
      title: "COMMERCIAL LOAN AGREEMENT",
      firstParty: "Crescent Capital Investments (Pvt) Ltd",
      firstPartyCNIC: "0091824-3",
      firstPartyAddress: "Tower B, Stock Exchange Road, Karachi (Lender)",
      secondParty: "Sunrise Textile Mills Ltd",
      secondPartyCNIC: "0014829-1",
      secondPartyAddress: "Industrial Estate, Kot Lakhpat, Lahore (Borrower)",
      considerationPkr: "25,000,000",
      jurisdiction: "Lahore",
      effectiveDate: "2026-09-01",
      termMonths: "24",
      noticeDays: "15",
      propertyOrScope: "Working Capital Facility for Machinery Import and Plant Expansion",
      arbitrationCity: "Lahore",
    },
    body: `COMMERCIAL LOAN AGREEMENT

Executed at [JURISDICTION] on [EFFECTIVE_DATE] between [FIRST_PARTY_NAME] ("LENDER") and [SECOND_PARTY_NAME] ("BORROWER").

1. PRINCIPAL LOAN AMOUNT
The Lender agrees to disburse PKR [CONSIDERATION_PKR]/- to the Borrower for [PROPERTY_OR_SCOPE].

2. REPAYMENT & MARKUP
Borrower shall repay the principal along with agreed markup in 24 equal monthly installments.

3. EVENTS OF DEFAULT
Upon default of any installment, the entire outstanding balance shall immediately become due and payable.

LENDER: [FIRST_PARTY_NAME]                  BORROWER: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_saas_agreement",
    title: "Software-as-a-Service (SaaS) Agreement",
    category: "Finance & IP",
    governingLaw: "Contract Act, 1872 & Electronic Transactions Ordinance, 2002",
    forum: "Corporate Commercial / ADR",
    stampDutyArticle: "Article 5, Stamp Act 1899",
    description: "Enterprise SaaS subscription agreement with 99.5% service uptime commitment, cybersecurity safeguards (PECA 2016), cloud backup, data sovereignty, and tiered subscription pricing.",
    defaultVariables: {
      title: "ENTERPRISE SAAS AGREEMENT",
      firstParty: "Alwakeelo Legal AI Technologies (Pvt) Ltd",
      firstPartyCNIC: "0194821-2",
      firstPartyAddress: "Floor 4, STP Building, Constitution Ave, Islamabad (Supplier)",
      secondParty: "Raza & Khan Law Chambers",
      secondPartyCNIC: "35201-9988112-1",
      secondPartyAddress: "Fane Road, Lahore (Customer)",
      considerationPkr: "180,000",
      jurisdiction: "Islamabad",
      effectiveDate: "2026-09-01",
      termMonths: "12",
      noticeDays: "30",
      propertyOrScope: "Chamber Enterprise Tier with 1,200 Monthly Queries, 83k Statutes RAG, and Citation Graph Access",
      arbitrationCity: "Islamabad",
    },
    body: `ENTERPRISE SAAS AGREEMENT

This SaaS Agreement is made at [JURISDICTION] on [EFFECTIVE_DATE] between [FIRST_PARTY_NAME] ("SUPPLIER") and [SECOND_PARTY_NAME] ("CUSTOMER").

1. SUBSCRIPTION ACCESS & LICENSE
Supplier grants Customer a non-exclusive, non-transferable right to access [PROPERTY_OR_SCOPE].

2. UPTIME & SLA COMMITMENT
Supplier shall maintain a 99.5% monthly uptime target, excluding scheduled maintenance.

3. DATA PRIVACY (PECA 2016)
Supplier shall maintain end-to-end encryption for all Customer uploads and legal query dialogues.

SUPPLIER: [FIRST_PARTY_NAME]                CUSTOMER: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_settlement_deed",
    title: "Compromise & Settlement Deed (ADR)",
    category: "Personal & Succession",
    governingLaw: "Code of Civil Procedure, 1908 (Order XXIII Rule 3) & Contract Act",
    forum: "Civil Court / High Court",
    stampDutyArticle: "Article 58, Stamp Act 1899",
    description: "Full and final mutual settlement of pending civil/commercial litigations, mutual releases, waiver of future claims, and joint application for withdrawal of suits before court.",
    defaultVariables: {
      title: "DEED OF COMPROMISE AND SETTLEMENT",
      firstParty: "Haji Abdul Rasheed",
      firstPartyCNIC: "35201-4433221-1",
      firstPartyAddress: "House 10, Samanabad, Lahore (First Party)",
      secondParty: "Sheikh Muhammad Naveed",
      secondPartyCNIC: "35202-6677889-3",
      secondPartyAddress: "House 45, Model Town, Lahore (Second Party)",
      considerationPkr: "8,500,000",
      jurisdiction: "Lahore",
      effectiveDate: "2026-09-01",
      termMonths: "0",
      noticeDays: "0",
      propertyOrScope: "Full Settlement of Civil Suit No. 412/2024 (Specific Performance) Pending before Senior Civil Judge, Lahore",
      arbitrationCity: "Lahore",
    },
    body: `DEED OF COMPROMISE AND SETTLEMENT

This Deed of Settlement is executed at [JURISDICTION] on [EFFECTIVE_DATE] between [FIRST_PARTY_NAME] and [SECOND_PARTY_NAME].

WHEREAS, disputes arose between the Parties regarding [PROPERTY_OR_SCOPE]; and the Parties have agreed to resolve all claims amicably.

1. SETTLEMENT CONSIDERATION & FULL RELEASE
In consideration of PKR [CONSIDERATION_PKR]/- paid by the Second Party to the First Party, both Parties grant each other full and irrevocable release.

2. WITHDRAWAL OF PENDING PROCEEDINGS
The Parties shall jointly file an application under Order XXIII Rule 3 CPC before the competent court to withdraw the suit.

FIRST PARTY: [FIRST_PARTY_NAME]              SECOND PARTY: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_will_testament",
    title: "Last Will & Testament (Wasiyyat Deed)",
    category: "Personal & Succession",
    governingLaw: "Succession Act, 1925 & Muslim Personal Law (Shariat) Application Act",
    forum: "Civil Court / Succession Court",
    stampDutyArticle: "Article 64, Stamp Act 1899",
    description: "Testamentary bequest under Islamic Law adhering to the mandatory one-third (1/3) estate limitation, executor appointment, funeral debt settlement, and Shariah inheritance distribution.",
    defaultVariables: {
      title: "LAST WILL AND TESTAMENT (WASIYYAT)",
      firstParty: "Chaudhry Muhammad Akram",
      firstPartyCNIC: "35201-3322114-1",
      firstPartyAddress: "House 12, Gulberg 2, Lahore (Testator)",
      secondParty: "Barrister Zafar Iqbal",
      secondPartyCNIC: "35202-9900112-3",
      secondPartyAddress: "Al-Murtaza Chambers, Lahore (Executor)",
      considerationPkr: "0",
      jurisdiction: "Lahore",
      effectiveDate: "2026-09-01",
      termMonths: "0",
      noticeDays: "0",
      propertyOrScope: "Bequest of 1/3rd Estate to Shaukat Khanum Memorial Cancer Hospital & Remaining 2/3rd to Shariah Heirs",
      arbitrationCity: "Lahore",
    },
    body: `LAST WILL AND TESTAMENT

I, [FIRST_PARTY_NAME], CNIC No. [FIRST_PARTY_CNIC], residing at [FIRST_PARTY_ADDRESS], declare this as my Last Will and Testament executed on [EFFECTIVE_DATE] at [JURISDICTION].

1. APPOINTMENT OF EXECUTOR
I appoint [SECOND_PARTY_NAME] as the sole Executor of this Will.

2. SETTLEMENT OF DEBTS & FUNERAL EXPENSES
My Executor shall first clear all funeral expenses and lawful debts (including unpaid Mehr).

3. ONE-THIRD SHARIAH BEQUEST
I bequeath 1/3rd permissible portion of my net estate for [PROPERTY_OR_SCOPE]. The remaining 2/3rd shall be distributed among my legal heirs strictly under Islamic Law.

TESTATOR: [FIRST_PARTY_NAME]                 EXECUTOR: [SECOND_PARTY_NAME]`,
  },
  {
    id: "tpl_dissolution_of_marri",
    title: "Dissolution Of Marriage Application",
    category: "Application/Petition",
    description: "Seek divorce with our Dissolution of Marriage Application template, compliant with Pakistan’s Muslim Family Laws Ordinance, 1961. It outlines grounds for divorce and reliefs, ensuring clarity. This customizable document is ideal for family court filings. Download now to craft professional, legally sound petitions for marital dissolution.",
    body: `# DISSOLUTION OF MARRIAGE APPLICATION

This document serves as a high-quality, standardized template for Dissolution Of Marriage Application within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_cover_letter",
    title: "Cover Letter",
    category: "Email/Letter",
    description: "Enhance your job applications with our Cover Letter template, tailored for Pakistan. It showcases your skills and enthusiasm professionally, complementing your resume. This customizable document is ideal for job seekers aiming to make a strong impression. Download now to craft compelling, professional cover letters that elevate your candidacy and open career opportunities.",
    body: `# COVER LETTER

This document serves as a high-quality, standardized template for Cover Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_board_resolution",
    title: "Board Resolution",
    category: "Business/Commercial",
    description: "Formalize corporate decisions with our Board Resolution template, compliant with Pakistan’s Companies Act, 2017. It records approvals for actions like bank accounts or contracts, ensuring legal clarity. This customizable document streamlines governance for directors and secretaries. Ideal for private companies. Download now to create professional, legally sound resolutions for your board’s decisions.",
    body: `# BOARD RESOLUTION

This document serves as a high-quality, standardized template for Board Resolution within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_application_for_leav",
    title: "Application For Leave",
    category: "General",
    description: "Request leave professionally with our Application for Leave template, tailored for Pakistan. It ensures clear, courteous requests for personal, medical, or family leave. This customizable document is ideal for employees seeking approval smoothly. Download now to craft formal, professional leave applications that ensure clarity and compliance with workplace policies.",
    body: `# APPLICATION FOR LEAVE

This document serves as a high-quality, standardized template for Application For Leave within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_follow_up_email",
    title: "Follow Up Email",
    category: "Email/Letter",
    description: "Maintain professional communication with our Follow-up Email template, designed for clarity and courtesy. Ideal for tracking progress on discussions, proposals, or requests, this customizable template ensures polite, concise follow-ups. Perfect for businesses or individuals seeking timely updates. Download now to craft effective, professional emails that keep conversations on track and foster strong relationships.",
    body: `# FOLLOW UP EMAIL

This document serves as a high-quality, standardized template for Follow Up Email within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_guardianship_applica",
    title: "Guardianship Application",
    category: "Application/Petition",
    description: "Secure guardianship with our Guardianship Application template, compliant with Pakistan’s Guardian and Wards Act, 1890. It details applicant and child information, ensuring legal clarity and child welfare. This customizable document is ideal for those seeking guardianship. Download now to craft professional, legally sound applications that prioritize the child’s best interests.",
    body: `# GUARDIANSHIP APPLICATION

This document serves as a high-quality, standardized template for Guardianship Application within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_review_petition",
    title: "Review Petition",
    category: "Application/Petition",
    description: "Seek judicial review with our Review Petition template, compliant with Pakistan’s Civil Procedure Code. It outlines grounds like new evidence or errors, ensuring legal clarity. This customizable document is ideal for challenging court orders. Download now to craft professional, legally sound petitions that strengthen your case for reconsideration.",
    body: `# REVIEW PETITION

This document serves as a high-quality, standardized template for Review Petition within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_articles_of_associat",
    title: "Articles Of Association",
    category: "Business/Commercial",
    description: "Establish your company’s foundation with our Articles of Association template, compliant with Pakistan’s Companies Act, 2017. It governs share capital, meetings, and board operations, ensuring regulatory alignment. This customizable document provides clarity for shareholders and directors. Ideal for private limited companies. Download now to create a professional, legally robust governance structure for your business.",
    body: `# ARTICLES OF ASSOCIATION

This document serves as a high-quality, standardized template for Articles Of Association within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_employment_offer_let",
    title: "Employment Offer Letter",
    category: "Email/Letter",
    description: "Attract top talent with our Employment Offer Letter template, compliant with Pakistan’s labor laws. It outlines position, salary, and terms clearly, ensuring professionalism. This customizable document is ideal for businesses formalizing job offers. Download now to create legally sound, welcoming offer letters that set the stage for successful employment relationships.",
    body: `# EMPLOYMENT OFFER LETTER

This document serves as a high-quality, standardized template for Employment Offer Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_custody_application",
    title: "Custody Application",
    category: "Application/Petition",
    description: "Secure child custody with our Custody Application template, compliant with Pakistan’s Guardian and Wards Act, 1890. It prioritizes child welfare, detailing grounds for custody. This customizable document is ideal for parents seeking custody. Download now to craft professional, legally sound applications that ensure the child’s best interests.",
    body: `# CUSTODY APPLICATION

This document serves as a high-quality, standardized template for Custody Application within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_resignation_letter",
    title: "Resignation Letter",
    category: "Email/Letter",
    description: "Resign professionally with our Resignation Letter template, tailored for Pakistan. It ensures a courteous, clear exit while meeting notice period requirements. This customizable document is ideal for employees transitioning smoothly from roles. Download now to craft formal, respectful resignation letters that maintain positive relationships with employers.",
    body: `# RESIGNATION LETTER

This document serves as a high-quality, standardized template for Resignation Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_notice_letter",
    title: "Notice Letter",
    category: "Email/Letter",
    description: "Issue formal notices with our Notice Letter template, designed for Pakistan. It ensures clear, professional communication for contract breaches, policy updates, or other notifications. This customizable document is ideal for businesses or individuals needing formal notices. Download now to craft concise, professional letters that prompt action and maintain clarity.",
    body: `# NOTICE LETTER

This document serves as a high-quality, standardized template for Notice Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_reference_letter",
    title: "Reference Letter",
    category: "Email/Letter",
    description: "Support professionals with our Reference Letter template, crafted for Pakistan. It verifies employment history and skills, ensuring clarity and professionalism. This customizable document is ideal for employers providing references for former employees. Download now to create concise, professional letters that validate credentials and enhance career prospects.",
    body: `# REFERENCE LETTER

This document serves as a high-quality, standardized template for Reference Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_loan_agreement",
    title: "Loan Agreement",
    category: "Agreement/Contract",
    description: "Facilitate secure lending with our Loan Agreement template, designed for Pakistan’s legal framework. It details loan amounts, interest rates, repayment terms, and collateral, ensuring clarity for lenders and borrowers. Compliant with local laws, this customizable document minimizes risks in financial transactions. Perfect for personal or business loans. Download now to establish transparent, legally binding loan agreements with confidence.",
    body: `# LOAN AGREEMENT

This document serves as a high-quality, standardized template for Loan Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_civil_suit_applicati",
    title: "Civil Suit Application",
    category: "Application/Petition",
    description: "Pursue civil remedies with our Civil Suit Application template, tailored for Pakistan’s legal framework. It details claims for recovery, injunction, or performance, ensuring clarity. This customizable document is ideal for plaintiffs seeking justice. Download now to craft professional, legally sound suits that strengthen your case.",
    body: `# CIVIL SUIT APPLICATION

This document serves as a high-quality, standardized template for Civil Suit Application within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_thank_you_letter",
    title: "Thank You Letter",
    category: "Email/Letter",
    description: "Express gratitude professionally with our Thank You Letter template, designed for Pakistan. It offers a clear, courteous format to acknowledge support, hospitality, or assistance. This customizable document is ideal for businesses or individuals fostering goodwill. Download now to craft heartfelt, professional letters that strengthen relationships and convey appreciation effectively.",
    body: `# THANK YOU LETTER

This document serves as a high-quality, standardized template for Thank You Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_general_letter",
    title: "General Letter",
    category: "Email/Letter",
    description: "Address various needs with our General Letter template, designed for professional communication in Pakistan. It offers a flexible structure for formal correspondence, ensuring clarity and courtesy. This customizable document suits diverse purposes like requests or announcements. Ideal for businesses or individuals seeking polished letters. Download now to craft professional, adaptable letters that meet your communication needs.",
    body: `# GENERAL LETTER

This document serves as a high-quality, standardized template for General Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_probate_application",
    title: "Probate Application",
    category: "Application/Petition",
    description: "Administer estates lawfully with our Probate Application template, compliant with Pakistan’s Probate and Administration Act, 1881. It details the will and estate, ensuring legal clarity. This customizable document is ideal for executors or beneficiaries. Download now to craft professional, legally sound applications that streamline estate administration.",
    body: `# PROBATE APPLICATION

This document serves as a high-quality, standardized template for Probate Application within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_recommendation_lette",
    title: "Recommendation Letter",
    category: "Email/Letter",
    description: "Endorse talent confidently with our Recommendation Letter template, tailored for Pakistan. It highlights skills and achievements professionally, supporting candidates for jobs or opportunities. This customizable document is ideal for employers or educators providing strong endorsements. Download now to create impactful, professional letters that boost credibility and open doors.",
    body: `# RECOMMENDATION LETTER

This document serves as a high-quality, standardized template for Recommendation Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_appeal_application",
    title: "Appeal Application",
    category: "Application/Petition",
    description: "Challenge rulings confidently with our Appeal Application template, compliant with Pakistan’s legal framework. It outlines grounds for appeal clearly, ensuring procedural compliance. This customizable document is ideal for individuals or businesses seeking judicial review. Download now to craft professional, legally sound appeals that strengthen your case.",
    body: `# APPEAL APPLICATION

This document serves as a high-quality, standardized template for Appeal Application within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_settlement_agreement",
    title: "Settlement Agreement",
    category: "Agreement/Contract",
    description: "Resolve disputes amicably with our Settlement Agreement template, designed for Pakistan’s legal framework. It outlines payment terms, mutual releases, and confidentiality, ensuring a fair resolution without litigation. Compliant with local laws, this customizable document fosters peace and clarity for both parties. Ideal for businesses or individuals settling disputes efficiently. Download now to secure a professional, legally binding settlement with confidence.",
    body: `# SETTLEMENT AGREEMENT

This document serves as a high-quality, standardized template for Settlement Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_shareholders_agreeme",
    title: "Shareholders Agreement",
    category: "Business/Commercial",
    description: "Protect shareholder interests with our Shareholders Agreement template, tailored for Pakistan. It governs share transfers, dividends, and board decisions, ensuring clarity under the Companies Act, 2017. This customizable document fosters trust and alignment among shareholders. Ideal for private companies seeking governance clarity. Download now to establish a legally sound framework for shareholder relations.",
    body: `# SHAREHOLDERS AGREEMENT

This document serves as a high-quality, standardized template for Shareholders Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_request_letter",
    title: "Request Letter",
    category: "Email/Letter",
    description: "Make formal requests effectively with our Request Letter template, designed for Pakistan. It provides a clear structure for seeking permissions, documents, or assistance, ensuring professionalism. This customizable document is ideal for individuals or businesses needing formal communication. Download now to craft polite, professional letters that achieve results.",
    body: `# REQUEST LETTER

This document serves as a high-quality, standardized template for Request Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_job_application_lett",
    title: "Job Application Letter",
    category: "Application/Petition",
    description: "Stand out with our Job Application Letter template, crafted for Pakistan’s job market. It highlights your skills and experience professionally, complementing your resume. This customizable document ensures a compelling case for your candidacy. Ideal for job seekers aiming to impress employers. Download now to create polished, effective application letters that boost your career prospects.",
    body: `# JOB APPLICATION LETTER

This document serves as a high-quality, standardized template for Job Application Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_maintenance_applicat",
    title: "Maintenance Application",
    category: "Application/Petition",
    description: "Claim support with our Maintenance Application template, compliant with Pakistan’s Muslim Family Laws Ordinance, 1961. It ensures clear requests for spousal or child support, prioritizing welfare. This customizable document is ideal for family court filings. Download now to craft professional, legally sound applications that secure fair maintenance.",
    body: `# MAINTENANCE APPLICATION

This document serves as a high-quality, standardized template for Maintenance Application within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_partnership_agreemen",
    title: "Partnership Agreement",
    category: "Agreement/Contract",
    description: "Build strong business alliances with our Partnership Agreement template, designed for Pakistan’s legal landscape. It outlines capital contributions, profit-sharing, and decision-making terms, ensuring clarity among partners. Compliant with the Partnership Act, 1932, this customizable document fosters trust and collaboration. Perfect for entrepreneurs launching joint ventures. Download now to create a solid, legally sound foundation for your partnership.",
    body: `# PARTNERSHIP AGREEMENT

This document serves as a high-quality, standardized template for Partnership Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_invitation_letter",
    title: "Invitation Letter",
    category: "Email/Letter",
    description: "Host events seamlessly with our Invitation Letter template, designed for Pakistan. It provides a professional format to invite guests to events, ensuring clarity and warmth. This customizable document is ideal for businesses or individuals organizing formal gatherings. Download now to craft engaging, professional invitations that ensure high attendance and event success.",
    body: `# INVITATION LETTER

This document serves as a high-quality, standardized template for Invitation Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_vendor_agreement",
    title: "Vendor Agreement",
    category: "Agreement/Contract",
    description: "Streamline procurement with our Vendor Agreement template, crafted for Pakistan. It details goods/services, pricing, quality standards, and confidentiality, ensuring smooth supplier relationships. Compliant with the Companies Act, 2017, this customizable document protects both parties while maintaining professionalism. Perfect for businesses sourcing reliable vendors. Download now to establish clear, legally sound vendor agreements with ease.",
    body: `# VENDOR AGREEMENT

This document serves as a high-quality, standardized template for Vendor Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_franchise_agreement",
    title: "Franchise Agreement",
    category: "Business/Commercial",
    description: "Grow your brand with our Franchise Agreement template, tailored for Pakistan. It outlines franchise rights, fees, training, and IP usage, ensuring compliance with the Companies Act, 2017. This customizable document sets clear standards for franchisees while protecting franchisors. Ideal for businesses expanding through franchising. Download now to establish professional, legally robust franchise agreements that drive success.",
    body: `# FRANCHISE AGREEMENT

This document serves as a high-quality, standardized template for Franchise Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_service_agreement",
    title: "Service Agreement",
    category: "Agreement/Contract",
    description: "Deliver services with confidence using our Service Agreement template, tailored for Pakistan. It defines scope, fees, confidentiality, and IP ownership, ensuring clarity for providers and clients. Compliant with local laws, this customizable document promotes trust and professionalism. Perfect for freelancers or businesses offering services. Download now to create legally sound, efficient agreements that protect your interests and enhance client relationships.",
    body: `# SERVICE AGREEMENT

This document serves as a high-quality, standardized template for Service Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_memorandum_of_unders",
    title: "Memorandum Of Understanding (mou)",
    category: "Business/Commercial",
    description: "Forge strategic collaborations with our Memorandum of Understanding (MoU) template, crafted for Pakistan. It outlines cooperative terms, roles, and confidentiality for business or project partnerships. Non-binding yet clear, it sets the stage for formal agreements while ensuring mutual understanding. Ideal for businesses exploring joint ventures. Download now to create professional, legally aligned MoUs that foster successful collaborations.",
    body: `# MEMORANDUM OF UNDERSTANDING (MOU)

This document serves as a high-quality, standardized template for Memorandum Of Understanding (mou) within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_non_disclosure_agree",
    title: "Non Disclosure Agreement",
    category: "Agreement/Contract",
    description: "Protect sensitive information with our Non-Disclosure Agreement template. Tailored for Pakistan, it ensures confidentiality for business plans, financial data, and more. With clear terms on usage, exceptions, and duration, this legally sound document safeguards your proprietary information. Perfect for businesses engaging in strategic discussions or partnerships. Download now to secure trust and protect your intellectual assets with confidence.",
    body: `# NON DISCLOSURE AGREEMENT

This document serves as a high-quality, standardized template for Non Disclosure Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_permission_applicati",
    title: "Permission Application",
    category: "Application/Petition",
    description: "Seek approvals confidently with our Permission Application template, tailored for Pakistan. It provides a professional format to request permissions for events, leave, or activities, ensuring compliance. This customizable document is ideal for individuals or organizations needing formal consent. Download now to craft clear, respectful applications that secure approvals efficiently.",
    body: `# PERMISSION APPLICATION

This document serves as a high-quality, standardized template for Permission Application within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_complaint_letter",
    title: "Complaint Letter",
    category: "Email/Letter",
    description: "Address grievances effectively with our Complaint Letter template, tailored for Pakistan. It provides a clear structure to detail issues, prior communications, and resolutions sought, ensuring professionalism. This customizable document is ideal for individuals or businesses resolving disputes. Download now to create formal, impactful complaint letters that prompt action while maintaining a respectful tone.",
    body: `# COMPLAINT LETTER

This document serves as a high-quality, standardized template for Complaint Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_acknowledgement_lett",
    title: "Acknowledgement Letter",
    category: "Email/Letter",
    description: "Confirm receipt professionally with our Acknowledgement Letter template, tailored for Pakistan. It ensures clear, courteous acknowledgment of documents, payments, or requests. This customizable document is ideal for businesses or individuals maintaining formal communication. Download now to create polished, professional letters that build trust and streamline correspondence.",
    body: `# ACKNOWLEDGEMENT LETTER

This document serves as a high-quality, standardized template for Acknowledgement Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_joint_venture_agreem",
    title: "Joint Venture Agreement",
    category: "Business/Commercial",
    description: "Launch collaborative ventures with our Joint Venture Agreement template, designed for Pakistan. It details contributions, profit-sharing, and management, ensuring clarity and fairness. Compliant with local laws, this customizable document fosters trust and alignment between parties. Perfect for businesses pursuing shared goals. Download now to create a legally sound framework for your joint venture with confidence.",
    body: `# JOINT VENTURE AGREEMENT

This document serves as a high-quality, standardized template for Joint Venture Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_adoption_of_minor_ch",
    title: "Adoption Of Minor Child Petition",
    category: "Application/Petition",
    description: "Secure adoptions with our Adoption of Minor Child Petition template, tailored for Pakistan’s family courts. It ensures compliance with legal and welfare standards, detailing petitioner and child information. This customizable document is ideal for adoptive parents seeking legal approval. Download now to craft professional, legally robust petitions that prioritize child welfare.",
    body: `# ADOPTION OF MINOR CHILD PETITION

This document serves as a high-quality, standardized template for Adoption Of Minor Child Petition within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_licensing_agreement",
    title: "Licensing Agreement",
    category: "Agreement/Contract",
    description: "Monetize your intellectual property with our Licensing Agreement template. Crafted for Pakistan, it grants exclusive or non-exclusive rights to use trademarks, patents, or software, with clear terms on fees, quality control, and termination. Legally robust, it protects licensors while enabling licensees to innovate. Ideal for businesses licensing IP assets. Download to establish secure, professional licensing arrangements with ease.",
    body: `# LICENSING AGREEMENT

This document serves as a high-quality, standardized template for Licensing Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_distribution_agreeme",
    title: "Distribution Agreement",
    category: "Agreement/Contract",
    description: "Expand your market reach with our Distribution Agreement template. Designed for suppliers and distributors, it details product distribution rights, pricing, and obligations in Pakistan. With clear terms on exclusivity, IP usage, and termination, this legally robust document ensures smooth partnerships. Perfect for businesses aiming to scale efficiently while maintaining brand integrity. Download to secure compliant, professional distribution arrangements today.",
    body: `# DISTRIBUTION AGREEMENT

This document serves as a high-quality, standardized template for Distribution Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_business_email",
    title: "Business Email",
    category: "Business/Commercial",
    description: "Communicate effectively with our Business Email template, crafted for professionalism in Pakistan. It supports clear, concise correspondence for proposals, updates, or collaborations. This customizable template ensures a polished tone for business interactions. Ideal for professionals building relationships or advancing deals. Download now to create impactful, professional emails that drive results and maintain credibility.",
    body: `# BUSINESS EMAIL

This document serves as a high-quality, standardized template for Business Email within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_lease_agreement",
    title: "Lease Agreement",
    category: "Agreement/Contract",
    description: "Secure your property transactions with our Lease Agreement template, tailored for Pakistan. It covers rent, security deposits, maintenance, and termination terms for residential or commercial leases. Compliant with local laws, this customizable document ensures clarity and protection for lessors and lessees. Ideal for property owners or tenants seeking reliable agreements. Download now to establish professional, legally sound lease terms effortlessly.",
    body: `# LEASE AGREEMENT

This document serves as a high-quality, standardized template for Lease Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_criminal_petition",
    title: "Criminal Petition",
    category: "Application/Petition",
    description: "Initiate justice with our Criminal Petition template, compliant with Pakistan’s Criminal Procedure Code. It requests FIR registration or criminal proceedings, ensuring legal clarity. This customizable document is ideal for complainants seeking action. Download now to craft professional, legally sound petitions that drive justice forward.",
    body: `# CRIMINAL PETITION

This document serves as a high-quality, standardized template for Criminal Petition within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_habeas_writ_petition",
    title: "Habeas Writ Petition",
    category: "Application/Petition",
    description: "Challenge unlawful detention with our Habeas Writ Petition template, compliant with Pakistan’s Constitution. It demands the production of a detainee, ensuring legal clarity and rights protection. This customizable document is ideal for seeking justice in detention cases. Download now to craft professional, legally robust petitions that uphold fundamental rights.",
    body: `# HABEAS WRIT PETITION

This document serves as a high-quality, standardized template for Habeas Writ Petition within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_bail_application",
    title: "Bail Application",
    category: "Application/Petition",
    description: "Secure bail with our Bail Application template, compliant with Pakistan’s Criminal Procedure Code. It outlines grounds for release, ensuring legal clarity and rights protection. This customizable document is ideal for individuals seeking bail. Download now to craft professional, legally sound applications that strengthen your case for release.",
    body: `# BAIL APPLICATION

This document serves as a high-quality, standardized template for Bail Application within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_termination_letter",
    title: "Termination Letter",
    category: "Email/Letter",
    description: "Handle terminations professionally with our Termination Letter template, compliant with Pakistan’s labor laws. It outlines reasons, settlement, and exit terms clearly, ensuring legal clarity. This customizable document is ideal for businesses managing employee separations. Download now to create respectful, legally sound letters that streamline the termination process.",
    body: `# TERMINATION LETTER

This document serves as a high-quality, standardized template for Termination Letter within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_consultancy_agreemen",
    title: "Consultancy Agreement",
    category: "Agreement/Contract",
    description: "Streamline your consulting engagements with our Consultancy Agreement template. Tailored for clarity, it outlines services, fees, confidentiality, and IP rights, ensuring a professional partnership. Compliant with Pakistani law, this customizable document protects both consultant and client, fostering trust and efficiency. Ideal for businesses seeking expert advice while safeguarding interests. Download now to establish clear, legally sound consultancy terms.",
    body: `# CONSULTANCY AGREEMENT

This document serves as a high-quality, standardized template for Consultancy Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_sale_and_purchase_ag",
    title: "Sale And Purchase Agreement",
    category: "Business/Commercial",
    description: "Secure transactions with our Sale and Purchase Agreement template, crafted for Pakistan. It details goods/property, pricing, and delivery terms, ensuring clarity and legal compliance. This customizable document protects buyers and sellers from risks. Ideal for business or personal asset transactions. Download now to create professional, legally binding agreements that ensure smooth transfers.",
    body: `# SALE AND PURCHASE AGREEMENT

This document serves as a high-quality, standardized template for Sale And Purchase Agreement within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  },
  {
    id: "tpl_employment_contract",
    title: "Employment Contract",
    category: "Agreement/Contract",
    description: "Hire with confidence using our Employment Contract template, crafted for Pakistan’s legal framework. It covers position, salary, benefits, confidentiality, and termination terms, ensuring clarity for employers and employees. Compliant with local labor laws, this customizable document fosters fair, transparent workplace agreements. Ideal for businesses seeking to formalize employment terms professionally. Download now to build a solid foundation for your workforce.",
    body: `# EMPLOYMENT CONTRACT

This document serves as a high-quality, standardized template for Employment Contract within the jurisdiction of Pakistan.

## 1. PARTIES
This agreement is made between [Party 1 Name] and [Party 2 Name].

## 2. TERMS AND CONDITIONS
[Insert detailed legal drafting, statutory references, and terms here]

## 3. GOVERNING LAW
This document shall be governed by the laws of Pakistan.

## SIGNATURES
______________________
[Party 1 Name]

______________________
[Party 2 Name]`,
    defaultVariables: {
      "Party 1 Name": "Enter first party name",
      "Party 2 Name": "Enter second party name"
    },
    icon: "FileText",
  }
];

// ─── 4-Category Clause Library (30+ Real Clauses) ──────────────────────────────


  export const CLAUSE_LIBRARY: ClauseItem[] = [
  // Category 1: General Commercial
  {
    id: "cls_arbitration_1940",
    category: "General Commercial",
    title: "Arbitration & Dispute Resolution (Arbitration Act 1940)",
    subtitle: "Sole arbitrator appointment with seat and language specifications",
    statutoryReference: "Arbitration Act, 1940 (Sections 8 & 9)",
    clauseText: `### DISPUTE RESOLUTION AND ARBITRATION
1. Any dispute, controversy, or claim arising out of or relating to this Agreement, including its validity, breach, or termination, shall be settled amicably through good-faith mutual negotiations within fifteen (15) days of written notice.
2. Failing amicable settlement, the dispute shall be referred to and finally resolved by arbitration in accordance with the **Arbitration Act, 1940**.
3. The arbitral tribunal shall consist of a sole arbitrator appointed by mutual agreement of the Parties. If the Parties fail to agree upon an arbitrator within twenty-one (21) days, the arbitrator shall be appointed by the competent Court under Section 8 of the Arbitration Act, 1940.
4. The seat and legal place of arbitration shall be [City], Pakistan, and proceedings shall be conducted in the English language. The arbitral award shall be final, binding, and enforceable in any court of competent jurisdiction.`,
  },
  {
    id: "cls_force_majeure",
    category: "General Commercial",
    title: "Force Majeure & Exceptional Events",
    subtitle: "Covers floods, civil commotion, pandemics with 14-day notice requirement",
    statutoryReference: "Contract Act, 1872 (Section 56 Doctrine of Frustration)",
    clauseText: `### FORCE MAJEURE
1. Neither Party shall be liable for any failure or delay in performing its obligations under this Agreement if such failure arises from an event of Force Majeure, including acts of God, flood, earthquake, war, armed conflict, civil commotion, governmental embargoes, or epidemic/pandemic restrictions.
2. The affected Party shall notify the other Party in writing within fourteen (14) days of the occurrence of the Force Majeure event, stating the anticipated duration and mitigation measures taken.
3. If the Force Majeure event persists for more than sixty (60) consecutive days, either Party may terminate this Agreement upon written notice without penalty.`,
  },
  {
    id: "cls_termination_cure",
    category: "General Commercial",
    title: "Termination for Cause & 30-Day Cure Period",
    subtitle: "Material breach notice with mandatory 30-day remediation window",
    statutoryReference: "Contract Act, 1872 (Section 39)",
    clauseText: `### TERMINATION AND CURE PERIOD
1. Either Party may terminate this Agreement immediately upon written notice if the other Party:
   (a) commits a material breach of this Agreement and fails to remedy such breach within thirty (30) calendar days of receiving written notice specifying the breach;
   (b) becomes insolvent, files for bankruptcy, or goes into compulsory liquidation; or
   (c) engages in fraudulent conduct or material misrepresentation.
2. Upon termination, all accrued payment obligations up to the effective termination date shall immediately become due and payable.`,
  },
  {
    id: "cls_limitation_liability",
    category: "General Commercial",
    title: "Limitation of Liability & Consequential Damages Exclusion",
    subtitle: "Caps maximum financial exposure to 12 months fees paid",
    statutoryReference: "Contract Act, 1872 (Section 73)",
    clauseText: `### LIMITATION OF LIABILITY
1. To the maximum extent permitted by Pakistani law, in no event shall either Party be liable to the other for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, revenue, or business reputation.
2. The total aggregate liability of either Party arising out of or related to this Agreement, whether in contract, tort, or otherwise, shall be strictly capped at the total amount actually paid by Client under this Agreement in the twelve (12) months preceding the event giving rise to liability.`,
  },
  {
    id: "cls_tax_withholding",
    category: "General Commercial",
    title: "Tax Deductions & Provincial Sales Tax on Services",
    subtitle: "Income Tax Ordinance 2001 S.153 & PRA/SRB tax allocation",
    statutoryReference: "Income Tax Ordinance, 2001 (S.153) & Provincial Sales Tax Acts",
    clauseText: `### TAXATION AND WITHHOLDING TAX
1. All prices and consideration stated in this Agreement are exclusive of applicable Provincial Sales Tax on Services (Punjab PRA 16% / Sindh SRB 13% / Islamabad ICT 15%), which shall be invoiced additionally to the Client.
2. The Client shall deduct withholding tax at source in accordance with Section 153 of the Income Tax Ordinance, 2001 (or applicable withholding rules) and shall furnish official withholding tax deduction CPR certificates to the Provider within fifteen (15) days of payment.`,
  },
  {
    id: "cls_entire_agreement",
    category: "General Commercial",
    title: "Entire Agreement & Merger Clause",
    subtitle: "Supersedes all prior oral and written discussions",
    statutoryReference: "Qanun-e-Shahadat Order, 1984 (Article 102 & 103)",
    clauseText: `### ENTIRE AGREEMENT AND AMENDMENT
1. This Agreement constitutes the complete and exclusive understanding between the Parties regarding its subject matter and supersedes all prior negotiations, representations, warranties, or understandings, whether oral or written.
2. No amendment, variation, or modification of this Agreement shall be valid unless made in writing and signed by the duly authorized representatives of both Parties.`,
  },
  {
    id: "cls_peca_privacy",
    category: "General Commercial",
    title: "Data Protection & PECA 2016 Cybersecurity Compliance",
    subtitle: "Mandatory compliance with Prevention of Electronic Crimes Act 2016",
    statutoryReference: "Prevention of Electronic Crimes Act, 2016 (PECA)",
    clauseText: `### DATA SECURITY AND PECA COMPLIANCE
1. Each Party shall implement robust administrative, physical, and technical safeguards to preserve the security, integrity, and confidentiality of all proprietary data in compliance with the **Prevention of Electronic Crimes Act, 2016 (PECA)**.
2. Neither Party shall intercept, exfiltrate, or alter electronic data without authorization, and any data breach shall be reported to the other Party within twenty-four (24) hours.`,
  },

  // Category 2: Property & Tenancy
  {
    id: "cls_title_warranty",
    category: "Property & Tenancy",
    title: "Absolute Title & Encumbrance-Free Warranty",
    subtitle: "Vendor warrants clear title free of mortgage, stay orders, or revenue dues",
    statutoryReference: "Transfer of Property Act, 1882 (Section 55)",
    clauseText: `### TITLE WARRANTY AND FREEHOLD CLEARANCE
1. The Vendor expressly warrants that he is the sole, absolute, and undisputed owner of the Subject Property with full legal right to convey the same.
2. The Subject Property is free from all mortgages, charges, liens, court attachments, stay orders, tax arrears, municipal dues, or adverse third-party claims.
3. The Vendor covenants to defend the Purchaser's title and indemnify the Purchaser against any challenge, litigation, or eviction at the Vendor's sole cost and expense.`,
  },
  {
    id: "cls_rent_escalation",
    category: "Property & Tenancy",
    title: "10% Annual Rent Escalation Schedule",
    subtitle: "Automatic yearly percentage escalation pursuant to tenancy agreements",
    statutoryReference: "Punjab Rented Premises Act, 2009",
    clauseText: `### ANNUAL RENT ESCALATION
1. The agreed monthly rent shall remain fixed for the initial tenancy period of eleven (11) months.
2. Upon renewal or expiry of the initial term, the monthly rent shall automatically increase by **ten percent (10%)** over the last prevailing monthly rent, and such escalated rent shall continue for the subsequent eleven-month cycle.`,
  },
  {
    id: "cls_subletting_ban",
    category: "Property & Tenancy",
    title: "Absolute Prohibition on Subletting",
    subtitle: "Strict ban on assigning or parting with possession without landlord consent",
    statutoryReference: "Urban Rent Restriction Ordinance, 1959 / PRPA 2009",
    clauseText: `### SUBLETTING AND ASSIGNMENT PROHIBITION
1. The Tenant shall not sublet, assign, transfer, license, or part with the physical or constructive possession of the Demised Premises or any part thereof to any third party under any pretext.
2. Any unauthorized subletting or parting with possession shall constitute a non-curable default entitling the Landlord to immediately terminate the tenancy and initiate summary eviction proceedings before the Rent Tribunal.`,
  },
  {
    id: "cls_maintenance_division",
    category: "Property & Tenancy",
    title: "Maintenance Allocation (Structural vs Routine)",
    subtitle: "Landlord covers structural repairs; Tenant covers routine wear & tear",
    statutoryReference: "Punjab Rented Premises Act, 2009 (Section 13)",
    clauseText: `### MAINTENANCE AND REPAIR DUTIES
1. Structural Repairs: The Landlord shall be exclusively responsible for all major structural repairs, foundation repairs, exterior wall maintenance, roof waterproofing, and main plumbing lines.
2. Routine Maintenance: The Tenant shall be responsible for routine day-to-day maintenance, minor electrical fixtures, internal paint, glass panes, and keeping the premises in clean sanitary condition.`,
  },

  // Category 3: Employment & HR
  {
    id: "cls_probation_period",
    category: "Employment & HR",
    title: "3-Month Probation Period & Evaluation",
    subtitle: "Standard probation terms with 7-day termination notice during probation",
    statutoryReference: "Standing Orders Ordinance, 1968",
    clauseText: `### PROBATION AND CONFIRMATION
1. The Employee shall serve an initial probationary period of three (3) calendar months from the Effective Date.
2. During the probationary period, either Party may terminate employment by giving seven (7) days' written notice without assigning cause.
3. Upon satisfactory completion of probation, the Employer shall issue a formal written Letter of Confirmation, whereupon standard termination notice rules shall apply.`,
  },
  {
    id: "cls_non_solicitation",
    category: "Employment & HR",
    title: "Post-Employment Non-Solicitation (Section 27 Compliant)",
    subtitle: "Enforceable 12-month client and employee non-solicitation covenant",
    statutoryReference: "Contract Act, 1872 (Section 27 lawful narrow scope)",
    clauseText: `### NON-SOLICITATION OF CLIENTS AND EMPLOYEES
1. In consideration of specialized training and access to confidential customer databases, the Employee covenants that during employment and for a period of **twelve (12) months** following separation, the Employee shall not directly or indirectly:
   (a) solicit, divert, or do business with any client or customer of the Employer with whom the Employee had business dealings in the preceding twelve months; or
   (b) recruit, hire, or entice away any employee or contractor of the Employer.
2. This restriction is reasonably bounded in duration and scope solely to protect proprietary goodwill and customer connections.`,
  },
  {
    id: "cls_ip_work_for_hire",
    category: "Employment & HR",
    title: "Employee IP & Work-For-Hire Assignment",
    subtitle: "Full assignment of copyright, code, algorithms, and inventions to employer",
    statutoryReference: "Copyright Ordinance, 1962 (Section 13) & Patents Ordinance, 2000",
    clauseText: `### INTELLECTUAL PROPERTY WORK-FOR-HIRE ASSIGNMENT
1. All literary works, software programs, code repositories, UI designs, inventions, databases, algorithms, and documentation authored or created by the Employee during the course of employment shall be deemed "work made for hire" owned exclusively by the Employer.
2. To the extent any moral rights or intellectual property rights do not automatically vest in the Employer, the Employee hereby irrevocably assigns all worldwide rights, title, and interest therein to the Employer in perpetuity.`,
  },
  {
    id: "cls_anti_harassment",
    category: "Employment & HR",
    title: "Code of Conduct & Anti-Harassment Compliance",
    subtitle: "Mandatory compliance with Protection Against Harassment of Women Act 2010",
    statutoryReference: "Protection Against Harassment of Women at the Workplace Act, 2010",
    clauseText: `### CODE OF CONDUCT AND WORKPLACE HARASSMENT
1. The Employee strictly agrees to adhere to the Employer's Workplace Code of Conduct and zero-tolerance policy regarding discrimination, harassment, or misconduct.
2. The Employee undertakes to comply with all provisions of the **Protection Against Harassment of Women at the Workplace Act, 2010**. Any verified instance of harassment or hostile behavior shall constitute gross misconduct resulting in immediate summary dismissal without severance pay.`,
  },

  // Category 4: Corporate & M&A
  {
    id: "cls_rofr_shareholders",
    category: "Corporate & M&A",
    title: "Right of First Refusal (ROFR) on Share Transfers",
    subtitle: "Existing shareholders have first right to purchase exiting shares",
    statutoryReference: "Companies Act, 2017 (Section 76)",
    clauseText: `### RIGHT OF FIRST REFUSAL (ROFR)
1. If any Shareholder (the "Selling Shareholder") desires to sell, transfer, or dispose of any shares in the Company to a third party, the Selling Shareholder shall first offer such shares to the other existing Shareholders pro-rata to their existing shareholding.
2. The notice of transfer shall state the number of shares, proposed purchase price, and terms. Existing Shareholders shall have thirty (30) days from receipt of notice to exercise their Right of First Refusal.`,
  },
  {
    id: "cls_tag_along",
    category: "Corporate & M&A",
    title: "Tag-Along (Co-Sale) Minority Shareholder Protection",
    subtitle: "Minority shareholders can participate in majority shareholder exit sales",
    statutoryReference: "Companies Act, 2017 & Standard Shareholder Agreements",
    clauseText: `### TAG-ALONG RIGHTS (CO-SALE)
1. If the majority shareholders propose to sell more than fifty percent (50%) of the total equity in the Company to a third-party purchaser, the minority shareholders shall have the right (but not the obligation) to require the third-party purchaser to purchase a proportional number of their shares on the same price, terms, and conditions.
2. The majority shareholders shall not consummate any such transfer unless the third-party purchaser simultaneously acquires the shares offered by the tagging minority shareholders.`,
  },
  {
    id: "cls_board_quorum",
    category: "Corporate & M&A",
    title: "Board Composition, Quorum & Supermajority Matters",
    subtitle: "Reserved matters requiring 75% affirmative board vote",
    statutoryReference: "Companies Act, 2017 (Section 166 & 176)",
    clauseText: `### BOARD QUORUM AND RESERVED MATTERS
1. The quorum for any meeting of the Board of Directors shall require the presence of at least two (2) directors, including at least one nominee director of each Founding Shareholder.
2. The following Reserved Matters shall require the affirmative vote of at least seventy-five percent (75%) of the Board:
   (a) Any incurrence of debt or capital expenditure exceeding PKR 5,000,000/-;
   (b) Issuance of new equity, options, or debt instruments;
   (c) Any merger, acquisition, joint venture, or sale of substantial company assets; and
   (d) Change in senior executive compensation or appointment of statutory auditors.`,
  }
];

// ─── Automated Contract Risk Scanner Engine ────────────────────────────────────

  