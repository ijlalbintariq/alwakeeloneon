const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', 'utf-8');

// 1. Add checklists
const newChecklists = `
const FIR_CHECKLIST_RULES: StatutoryCheckItem[] = [
  { id: "fir-1", statute: "Criminal Procedure Code 1898", section: "Section 154", requirement: "Information discloses a cognizable offense.", status: "fatal_risk", detail: "Police cannot register FIR under Sec 154 for non-cognizable offenses without court order." },
  { id: "fir-2", statute: "Criminal Procedure Code 1898", section: "Section 154", requirement: "Explanation for delay in reporting (if any).", status: "warning", detail: "Unexplained delay can be fatal to the prosecution case during trial." },
  { id: "fir-3", statute: "Pakistan Penal Code 1860", section: "General", requirement: "Specific roles assigned to each accused person.", status: "warning", detail: "Omnibus allegations generally lead to bail for the accused." },
  { id: "fir-4", statute: "Criminal Procedure Code 1898", section: "Section 161", requirement: "List of eye-witnesses to the occurrence.", status: "warning", detail: "Immediate naming of witnesses prevents claims of afterthought." },
];

const APP_CHECKLIST_RULES: StatutoryCheckItem[] = [
  { id: "app-1", statute: "Code of Civil Procedure 1908", section: "Order / Rule", requirement: "Explicit statutory backing (e.g., O39 R1, O7 R11, S151).", status: "fatal_risk", detail: "Applications without clear statutory backing may be dismissed in limine." },
  { id: "app-2", statute: "Code of Civil Procedure 1908", section: "Affidavit", requirement: "Duly sworn affidavit in support of the application.", status: "fatal_risk", detail: "Applications based on factual assertions require an affidavit." },
  { id: "app-3", statute: "Code of Civil Procedure 1908", section: "Prayer", requirement: "Prayer directly flows from the main suit.", status: "warning", detail: "Interim relief cannot exceed the main prayer of the suit." },
  { id: "app-4", statute: "General Rules", section: "Notice", requirement: "Advance notice to opposite party (where caveats exist).", status: "compliant", detail: "Prevents ex-parte suspension." },
];

const NOTICE_CHECKLIST_RULES: StatutoryCheckItem[] = [
  { id: "not-1", statute: "Code of Civil Procedure 1908", section: "Section 80", requirement: "Statutory 2-month notice before suing Govt (if applicable).", status: "fatal_risk", detail: "Suits against government entities face outright rejection without Sec 80 notice." },
  { id: "not-2", statute: "Defamation Ordinance 2002", section: "Section 8", requirement: "14-day statutory notice for apology/retraction.", status: "fatal_risk", detail: "Mandatory pre-condition for filing a defamation suit." },
  { id: "not-3", statute: "General Law", section: "Cause of Action", requirement: "Clear narration of facts establishing liability.", status: "warning", detail: "Must lock in the factual matrix before litigation commences." },
  { id: "not-4", statute: "General Law", section: "Relief Demanded", requirement: "Specific demand (e.g., specific performance, damages).", status: "warning", detail: "Ambiguous demands weaken subsequent litigation." },
];

function parseAiFindings`;

code = code.replace('function parseAiFindings', newChecklists);

// 2. Update autoDetectDocumentType
const oldAutoDetect = `function autoDetectDocumentType(text: string): "pleading" | "contract" {
  const t = text.toLowerCase();
  const pleadingKeywords = ["plaint", "petition", "appeal", "suit", "versus", "vs.", "v.", "respondent", "appellant", "defendant", "plaintiff", "in the court of", "civil judge", "high court", "supreme court", "writ", "jurisdiction", "prayer", "prays that"];
  const pleadingScore = pleadingKeywords.filter(k => t.includes(k)).length;
  
  const contractKeywords = ["agreement", "deed", "memorandum", "mou", "contract", "between", "party of the first part", "hereinafter referred to as", "whereby", "witnesseth", "agreed terms", "lease", "partnership", "indemnity", "terms and conditions", "now this deed", "this agreement"];
  const contractScore = contractKeywords.filter(k => t.includes(k)).length;
  
  return contractScore > pleadingScore ? "contract" : "pleading";
}`;

const newAutoDetect = `function autoDetectDocumentType(text: string): "pleading" | "contract" | "fir" | "application" | "legal_notice" {
  const t = text.toLowerCase();
  const pleadingScore = ["plaint", "petition", "appeal", "suit", "versus", "vs.", "v.", "respondent", "appellant", "defendant", "plaintiff", "in the court of", "civil judge", "high court", "supreme court", "writ", "jurisdiction", "prayer", "prays that"].filter(k => t.includes(k)).length;
  const contractScore = ["agreement", "deed", "memorandum", "mou", "contract", "between", "party of the first part", "hereinafter referred to as", "whereby", "witnesseth", "agreed terms", "lease", "partnership", "indemnity", "terms and conditions", "now this deed", "this agreement"].filter(k => t.includes(k)).length;
  const firScore = ["fir", "first information report", "police station", "ps", "offence", "accused", "complainant", "crpc", "ppc", "f.i.r"].filter(k => t.includes(k)).length;
  const appScore = ["application for", "stay application", "bail", "under section", "read with section 151", "applicant", "affidavit", "respectfully sheweth", "humbly submitted"].filter(k => t.includes(k)).length;
  const noticeScore = ["legal notice", "under instructions from my client", "defamation", "demand", "damages", "hereby give you notice", "advocate high court", "serve you with this legal notice"].filter(k => t.includes(k)).length;
  
  const scores = [
    { type: "pleading", score: pleadingScore },
    { type: "contract", score: contractScore },
    { type: "fir", score: firScore },
    { type: "application", score: appScore },
    { type: "legal_notice", score: noticeScore }
  ];
  
  scores.sort((a, b) => b.score - a.score);
  return (scores[0].score > 0 ? scores[0].type : "pleading") as any;
}`;

code = code.replace(oldAutoDetect, newAutoDetect);

// 3. Update useState type
code = code.replace('useState<"pleading" | "contract">("pleading");', 'useState<"pleading" | "contract" | "fir" | "application" | "legal_notice">("pleading");');

// 4. Update Prompts inside handleRunScan
const promptHook = 'const activePrompt = documentType === "pleading" ? pleadingPrompt : contractPrompt;';
const newPrompts = `      const firPrompt = \`You are the Al Wakeelo AI Criminal Law Analyzer for Pakistani law.
Analyze the following Pakistani FIR or criminal complaint for CrPC procedural defects, evidentiary gaps, Section 154 CrPC compliance, delay in registration issues, and missing elements for establishing cognizable offenses under PPC:

"""
\${documentText}
"""

Return your findings ONLY as a JSON array inside a \\\`\\\`\\\`json block with objects matching this exact schema:
[
  {
    "category": "Statute name (e.g. Criminal Procedure Code 1898, Pakistan Penal Code 1860)",\`;

      const appPrompt = \`You are the Al Wakeelo AI Court Application Analyzer for Pakistani law.
Analyze the following Pakistani court application for statutory backing, affidavit requirements, and procedural maintainability under the Code of Civil Procedure 1908 or CrPC 1898:

"""
\${documentText}
"""

Return your findings ONLY as a JSON array inside a \\\`\\\`\\\`json block with objects matching this exact schema:
[
  {
    "category": "Statute name (e.g. Code of Civil Procedure 1908, Criminal Procedure Code 1898)",\`;

      const noticePrompt = \`You are the Al Wakeelo AI Legal Notice Analyzer for Pakistani law.
Analyze the following Pakistani Legal Notice for compliance with statutory notice periods (e.g., Section 80 CPC, Defamation Ordinance), cause of action clarity, and litigation threat enforceability:

"""
\${documentText}
"""

Return your findings ONLY as a JSON array inside a \\\`\\\`\\\`json block with objects matching this exact schema:
[
  {
    "category": "Statute name (e.g. Code of Civil Procedure 1908, Defamation Ordinance 2002)",\`;

      const activePrompt = documentType === "pleading" ? pleadingPrompt :
                           documentType === "contract" ? contractPrompt :
                           documentType === "fir" ? firPrompt :
                           documentType === "application" ? appPrompt :
                           noticePrompt;`;

code = code.replace(promptHook, newPrompts);

// 5. Update activeChecklist definition inside PreviewDocumentAnalyzer render
const checklistDef = `  const activeChecklist = documentType === "pleading" ? STATUTORY_CHECKLIST_RULES :
                          documentType === "contract" ? CONTRACT_CHECKLIST_RULES :
                          documentType === "fir" ? FIR_CHECKLIST_RULES :
                          documentType === "application" ? APP_CHECKLIST_RULES :
                          NOTICE_CHECKLIST_RULES;`;

// Let's insert it right after \`const renderCleanAnnotatedDocument = ...\` ends or just near the top of the component render.
// Look for \`return (\` that starts the main JSX.
code = code.replace('return (\n    <div className="flex-1 w-full bg-[#F1F5F9] overflow-hidden flex flex-col relative preview-theme-scope">', checklistDef + '\n  return (\n    <div className="flex-1 w-full bg-[#F1F5F9] overflow-hidden flex flex-col relative preview-theme-scope">');

// 6. Replace (documentType === "pleading" ? STATUTORY_CHECKLIST_RULES : CONTRACT_CHECKLIST_RULES) with activeChecklist everywhere
code = code.replace(/\(documentType === "pleading" \? STATUTORY_CHECKLIST_RULES : CONTRACT_CHECKLIST_RULES\)/g, 'activeChecklist');

// 7. Replace "5 Core Statutory Audits" with {activeChecklist.length} Core Statutory Audits
code = code.replace(/5 Core Statutory Audits/g, '{activeChecklist.length} Core Statutory Audits');

// 8. Update <select> options
const oldSelect = `<option value="pleading">Court Pleading (Plaint/Petition/Appeal)</option>
              <option value="contract">Commercial Contract (Agreement/Deed)</option>`;
const newSelect = `<option value="pleading">Court Pleading (Plaint/Petition/Appeal)</option>
              <option value="contract">Commercial Contract (Agreement/Deed)</option>
              <option value="fir">First Information Report (FIR)</option>
              <option value="application">Misc. Court Application (Bail/Stay)</option>
              <option value="legal_notice">Legal Notice / Statutory Notice</option>`;
code = code.replace(oldSelect, newSelect);
code = code.replace('onChange={(e) => setDocumentType(e.target.value as "pleading" | "contract")}', 'onChange={(e) => setDocumentType(e.target.value as any)}');


fs.writeFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', code);
console.log("Successfully expanded document types");
