const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', 'utf-8');

// First, remove the bad insertion
code = code.replace(
  '  const activeChecklist = documentType === "pleading" ? STATUTORY_CHECKLIST_RULES :\n' +
  '                          documentType === "contract" ? CONTRACT_CHECKLIST_RULES :\n' +
  '                          documentType === "fir" ? FIR_CHECKLIST_RULES :\n' +
  '                          documentType === "application" ? APP_CHECKLIST_RULES :\n' +
  '                          NOTICE_CHECKLIST_RULES;\n' +
  '  return (\n' +
  '    <div className="flex-1 w-full bg-[#F1F5F9] overflow-hidden flex flex-col relative preview-theme-scope">',
  
  '  return (\n' +
  '    <div className="flex-1 w-full bg-[#F1F5F9] overflow-hidden flex flex-col relative preview-theme-scope">'
);

// Now insert it right after the state declarations
const hookPoint = 'const [scanPhaseText, setScanPhaseText] = useState<string>("");';
const insertion = 'const [scanPhaseText, setScanPhaseText] = useState<string>("");\n\n' +
'  const activeChecklist = documentType === "pleading" ? STATUTORY_CHECKLIST_RULES :\n' +
'                          documentType === "contract" ? CONTRACT_CHECKLIST_RULES :\n' +
'                          documentType === "fir" ? FIR_CHECKLIST_RULES :\n' +
'                          documentType === "application" ? APP_CHECKLIST_RULES :\n' +
'                          NOTICE_CHECKLIST_RULES;';

code = code.replace(hookPoint, insertion);

fs.writeFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', code);
console.log("Fixed activeChecklist placement");
