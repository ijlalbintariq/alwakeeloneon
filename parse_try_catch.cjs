const raw = `
SADAQAT ALI KHAN, J. Mukhtiar Khan
(appellant) alongwith Hamad Kh an and Ubaidullah Khan ( coaccused since acquitted ) has been tried by the trial Court in case
FIR No. 147 dated 21.04.2023 offences under Section s
302/324/148/149 PPC, Police Station Kamar Mushani,
District Mianwali and was convicted and sentenced vide
judgment dated 22.12.2025 as under:Mukhtiar Khan (appellant)
U/S 302(b) PPC
Sentenced to DEATH on two counts for committing murder
of Muhammad Ishtiaq and Ghulam Mustafa (deceased)
with compensation of Rs. 500,000/- (recoverable as arrears of land
revenue) each payable to legal heirs of each deceased u/s
544-A Cr.P.C , and in default whereof to further undergo
simple imprisonment for six months each.
2. Appellant ha s filed this criminal appeal against
his conviction and the trial Court has sent Murder Reference
for confirmation of his death sentence or otherwise which
are being decided through this single judgment.
`;

    let t = raw.replace(/\r\n/g, '\n');
    t = t.replace(/\n\n+/g, '___PARAGRAPH_BREAK___');
    t = t.replace(/\n(\d+\.|[A-Z]\.) /g, '___PARAGRAPH_BREAK___$1 ');
    t = t.replace(/\n(JUDGMENT|ORDER|BACKGROUND|FACTS|HELD|DECISION)(:|\s)/g, '___PARAGRAPH_BREAK___$1$2');
    t = t.replace(/\n/g, ' ');
    console.log(t.split('___PARAGRAPH_BREAK___').map(p => p.trim()).filter(Boolean).join("\n\n"));
