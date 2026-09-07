const { classifyLegalDraftFollowUp, findLegalDraftEditTarget } = require('./server/legal-drafting-followup.ts');
const prompt = "Add a new ground stating medical urgency";
const draft = "GROUNDS:\nA) Delay in FIR.\n\nPRAYER:\nAdmit to bail.";
console.log("Intent:", classifyLegalDraftFollowUp({ prompt, hasDraft: true, hasSelection: false }));
console.log("Target:", findLegalDraftEditTarget(prompt, draft));
