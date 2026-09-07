import { applyLegalDraftEdit } from './server/legal-drafting-followup.ts';

const draftText = `GROUNDS:
a) Delay

PRAYER:
Admit to bail.`;

const target = {
  action: 'replace',
  label: 'PRAYER',
  start: draftText.indexOf('PRAYER:'),
  end: draftText.length,
  text: `PRAYER:
Admit to bail.`
};

const replacementText = `PRAYER:

In view of the above...

INDEX OF DOCUMENTS

<!-- INDEX_TABLE_START -->
`;

const result = applyLegalDraftEdit({ draftText, target: target as any, replacementText });
console.log(result);
