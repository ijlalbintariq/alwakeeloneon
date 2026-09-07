const ANY_MAJOR_HEADING = /^\s*(?:PRELIMINARY\s+OBJECTIONS?|CAUSE\s+OF\s+ACTION|JURISDICTION(?:\s+AND\s+VALUATION)?|BRIEF\s+FACTS|MATERIAL\s+FACTS|FACTS(?:\s+OF\s+THE\s+CASE)?|GROUNDS?(?:\s+OF\s+(?:APPEAL|PETITION|APPLICATION|REVISION))?|PRAYER|RELIEF\s+SOUGHT|VERIFICATION|AFFIDAVIT|ANNEXURES?|INDEX\s+OF\s+DOCUMENTS|INTERIM\s+RELIEF)\s*:?[ \t]*$/gim;
const text = `PRAYER

In view of the above, it is most respectfully prayed that this Honourable Court may graciously be pleased to:

a. Admit the Applicant/Accused to post-arrest bail in case FIR No. [______] dated [______] registered at Police Station [______] under Section(s) [______] till the final decision of the main case.

b. Grant interim bail to the Applicant/Accused pending the final disposal of the present bail application to enable the Applicant to avoid further incarceration and to prepare his defense.

c. Any other relief which this Honourable Court may deem fit and proper in the circumstances of the case may also be granted.

 APPLICANT

Through:

INDEX OF DOCUMENTS

<!-- INDEX_TABLE_START -->
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;margin:16px 0;"><thead><tr style="background:#1a2332;color:#fff;"><th style="padding:8px 12px;text-align:left;font-weight:bold;">S.No.</th><th style="padding:8px 12px;text-align:left;font-weight:bold;">Description of Documents</th><th style="padding:8px 12px;text-align:center;font-weight:bold;">Annexures</th><th style="padding:8px 12px;text-align:center;font-weight:bold;">Page No.</th></tr></thead><tbody><tr><td>1.</td><td>Petition/Application</td><td>---</td><td></td></tr><tr><td>2.</td><td>Affidavit</td><td>---</td><td></td></tr><tr><td>3.</td><td>Copy of FIR</td><td>A</td><td></td></tr></tbody></table>
<!-- INDEX_TABLE_END -->

[Advocate Name]
Advocate High Court / Supreme Court of Pakistan

                                                                    APPLICANT

Through:
[Advocate Name]
Advocate High Court
`;
let match;
while ((match = ANY_MAJOR_HEADING.exec(text)) !== null) {
  console.log(`Matched at ${match.index}: ${JSON.stringify(match[0])}`);
}
