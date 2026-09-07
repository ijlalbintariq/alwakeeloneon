const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', 'utf-8');

// Replace parseAiFindings signature
const oldParseFuncStart = 'function parseAiFindings(aiContent: string): PleadingFinding[] {';
const newParseFuncStart = 'function parseAiFindings(aiContent: string): { success: boolean; data: PleadingFinding[] } {';

code = code.replace(oldParseFuncStart, newParseFuncStart);
code = code.replace('if (!aiContent || typeof aiContent !== "string") return [];', 'if (!aiContent || typeof aiContent !== "string") return { success: false, data: [] };');

// Replace `if (Array.isArray(items) && items.length > 0) {`
code = code.replace('if (Array.isArray(items) && items.length > 0) {', 'if (Array.isArray(items)) {');

// Replace `return items`
code = code.replace('return items\n          .filter', 'const data = items\n          .filter');

// Add return { success: true, data }
code = code.replace('dismissed: false,\n            };\n          });\n      }\n    } catch (e) {', 'dismissed: false,\n            };\n          });\n        return { success: true, data };\n      }\n    } catch (e) {');

// Replace final return
code = code.replace('  return [];\n}', '  return { success: false, data: [] };\n}');

// Replace handleRunScan logic
const oldHandleScanResult = `      const parsedAiFindings = parseAiFindings(aiContent);

      if (parsedAiFindings.length > 0) {
        setScanProgress(100);
        persistState(documentText, parsedAiFindings);
        toast({
          title: "AI Procedural Scan Completed",
          description: \`Identified \${parsedAiFindings.length} statutory findings via AI backend.\`,
        });
        return;
      }`;

const newHandleScanResult = `      const parseResult = parseAiFindings(aiContent);

      if (parseResult.success) {
        setScanProgress(100);
        persistState(documentText, parseResult.data);
        toast({
          title: "AI Scan Completed",
          description: parseResult.data.length === 0 
            ? "No active vulnerabilities found." 
            : \`Identified \${parseResult.data.length} statutory findings via AI backend.\`,
        });
        return;
      }`;

code = code.replace(oldHandleScanResult, newHandleScanResult);

fs.writeFileSync('client/src/experimental/pages/PreviewDocumentAnalyzer.tsx', code);
console.log("Updated parseAiFindings successfully");
