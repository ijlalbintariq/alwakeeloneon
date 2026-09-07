const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', 'utf-8');

const helperCode = `
function autoDetectDocumentType(text: string): "pleading" | "contract" {
  const t = text.toLowerCase();
  const pleadingKeywords = ["plaint", "petition", "appeal", "suit", "versus", "vs.", "v.", "respondent", "appellant", "defendant", "plaintiff", "in the court of", "civil judge", "high court", "supreme court", "writ", "jurisdiction", "prayer", "prays that"];
  const pleadingScore = pleadingKeywords.filter(k => t.includes(k)).length;
  
  const contractKeywords = ["agreement", "deed", "memorandum", "mou", "contract", "between", "party of the first part", "hereinafter referred to as", "whereby", "witnesseth", "agreed terms", "lease", "partnership", "indemnity", "terms and conditions", "now this deed", "this agreement"];
  const contractScore = contractKeywords.filter(k => t.includes(k)).length;
  
  return contractScore > pleadingScore ? "contract" : "pleading";
}

export const PreviewDocumentAnalyzer`;

code = code.replace('export const PreviewDocumentAnalyzer', helperCode);

// Add logic to handleRealFileUpload
const oldUpload = `      const extractedText = data.documents[0].content || "";

      setUploadProgress(100);
      setIsUploadingFile(false);
      setShowUploadModal(false);

      // Clean the canvas and push the extracted text
      persistState(extractedText, []);
      setSelectedPresetId("blank");`;

const newUpload = `      const extractedText = data.documents[0].content || "";

      setUploadProgress(100);
      setIsUploadingFile(false);
      setShowUploadModal(false);

      // Clean the canvas and push the extracted text
      const detected = autoDetectDocumentType(extractedText);
      setDocumentType(detected);
      persistState(extractedText, []);
      setSelectedPresetId("blank");`;

code = code.replace(oldUpload, newUpload);

// Add logic to handlePresetSelection (wait, where is preset selection?)
// Let's replace textarea onChange
const oldOnChange1 = `value={documentText}
                  onChange={(e) => persistState(e.target.value, findings)}
                  placeholder="Paste pleading text`;
                  
const newOnChange1 = `value={documentText}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (documentText.trim().length === 0 && val.trim().length > 100) {
                      setDocumentType(autoDetectDocumentType(val));
                    }
                    persistState(val, findings);
                  }}
                  placeholder="Paste pleading text`;

code = code.replace(oldOnChange1, newOnChange1);

const oldOnChange2 = `value={documentText}
                onChange={(e) => persistState(e.target.value, findings)}
                className="w-full flex-1 min-h-[540px]`;
                
const newOnChange2 = `value={documentText}
                onChange={(e) => {
                  const val = e.target.value;
                  if (documentText.trim().length === 0 && val.trim().length > 100) {
                    setDocumentType(autoDetectDocumentType(val));
                  }
                  persistState(val, findings);
                }}
                className="w-full flex-1 min-h-[540px]`;

code = code.replace(oldOnChange2, newOnChange2);

fs.writeFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', code);
console.log("Added auto detect logic");
