import { applyLegalDraftEdit } from './server/legal-drafting-followup.ts';
import { normalizeCourtReadyDraftingText } from './server/routes.ts';

const draftText = "GROUNDS:\nA) Delay in FIR.\n\nPRAYER:\nAdmit to bail.";
const rawReplacementText = `GROUNDS
A. That the FIR in the instant case has been registered with an inordinate and unexplained delay.
B. Medical urgency.

PRAYER:
Admit to bail.

INDEX OF DOCUMENTS
Table here...`;

const replacementText = normalizeCourtReadyDraftingText(rawReplacementText);

const target = {
  label: 'GROUNDS',
  start: 0,
  end: 25,
  text: 'GROUNDS:\nA) Delay in FIR.',
  action: 'replace' as const
};

const patched = applyLegalDraftEdit({ draftText, target, replacementText });
console.log("Patched:", JSON.stringify(patched.text));
