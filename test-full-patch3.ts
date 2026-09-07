import { classifyLegalDraftFollowUp, findLegalDraftEditTarget, applyLegalDraftEdit } from './server/legal-drafting-followup.ts';

const prompt = "Add a new ground stating medical urgency";
const rawDraftText = "GROUNDS:\nA) Delay in FIR.\n\nPRAYER:\nAdmit to bail.";

const editTarget = findLegalDraftEditTarget(prompt, rawDraftText);
console.log("Edit Target:", editTarget);

const replacementText = `GROUNDS
A. That the FIR in the instant case has been registered with an inordinate and unexplained delay.
B. Medical urgency.

PRAYER:
Admit to bail.

INDEX OF DOCUMENTS
Table here...`;

const patched = applyLegalDraftEdit({ draftText: rawDraftText, target: editTarget!, replacementText });
console.log("Patched:", JSON.stringify(patched.text));
