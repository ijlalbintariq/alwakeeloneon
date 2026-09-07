import { normalizeCourtReadyDraftingText } from './server/routes.ts';

const text = `GROUNDS
A. That the FIR in the instant case has been registered with an inordinate and unexplained delay.
B. Medical urgency.

PRAYER:
Admit to bail.

INDEX OF DOCUMENTS
Table here...`;

console.log(JSON.stringify(normalizeCourtReadyDraftingText(text)));
