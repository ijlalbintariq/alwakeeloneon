import { classifyLegalDraftFollowUp } from './server/legal-drafting-followup.ts';
const prompt = "Rewrite the entire document as a Civil Suit for Damages";
console.log("Intent:", classifyLegalDraftFollowUp({ prompt, hasDraft: true, hasSelection: false }));
