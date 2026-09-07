import fs from 'fs';

const filePath = './client/src/experimental/lib/judgmentApiClient.ts';
let code = fs.readFileSync(filePath, 'utf-8');

const target = `  return {
    made,
    received: existingReceived || [],
  };`;

const newLogic = `  // Filter out any self-referencing citations created by backend indexing anomalies
  const cleanMade = made.filter((c) => c.linkedCitation?.toUpperCase() !== citation.toUpperCase() && c.citationText?.toUpperCase() !== citation.toUpperCase());
  const cleanReceived = (existingReceived || []).filter((c) => c.linkedCitation?.toUpperCase() !== citation.toUpperCase() && c.citationText?.toUpperCase() !== citation.toUpperCase());

  return {
    made: cleanMade,
    received: cleanReceived,
  };`;

code = code.replace(target, newLogic);
fs.writeFileSync(filePath, code);
