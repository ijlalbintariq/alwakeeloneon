const ANY_MAJOR_HEADING = /^\s*(?:PRELIMINARY\s+OBJECTIONS?|CAUSE\s+OF\s+ACTION|JURISDICTION(?:\s+AND\s+VALUATION)?|BRIEF\s+FACTS|MATERIAL\s+FACTS|FACTS(?:\s+OF\s+THE\s+CASE)?|GROUNDS?(?:\s+OF\s+(?:APPEAL|PETITION|APPLICATION|REVISION))?|PRAYER|RELIEF\s+SOUGHT|VERIFICATION|AFFIDAVIT|ANNEXURES?|INDEX\s+OF\s+DOCUMENTS|INTERIM\s+RELIEF|APPLICANT|RESPONDENT|DEFENDANT|PLAINTIFF|PETITIONER|DEPONENT|ACCUSED)\s*:?[ \t]*$/gim;

let replacement = `GROUNDS
A. That the FIR in the instant case has been registered with an inordinate and unexplained delay.
B. That the Applicant/Accused is suffering from severe medical ailments.

PRAYER:
Admit to bail.

INDEX OF DOCUMENTS
<table...>...</table>
APPLICANT
`;

ANY_MAJOR_HEADING.lastIndex = 0;
const repMatch = ANY_MAJOR_HEADING.exec(replacement);
console.log("repMatch:", repMatch ? JSON.stringify(repMatch[0]) : "null");

const overgenMatch = ANY_MAJOR_HEADING.exec(replacement);
console.log("overgenMatch:", overgenMatch ? JSON.stringify(overgenMatch[0]) : "null");
