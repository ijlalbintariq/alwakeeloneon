const titles = [
  "Const. P. 11/2026 (D.B.) Sindh High Court, Circuit Court, Mirpur Khas; attached cases: C.Ps No.D-12 to 25 of 2026 - Sindh Engro Coal Mining, Thr. Qazafi (Petitioner)",
  "Cr.J.A 38/2024 (D.B.) Sindh High Court, Circuit at Larkana - Nusrat Hussain Kalhoro (Appellant)",
  "Const. P. 225/2026 (S.B.) Mst. Nadia V/S The Deputy I.G. of Police & others Sindh High Court, Karachi"
];

for (const title of titles) {
  const match = title.match(/^(.*?)\s*\(/);
  console.log(`Original: ${title}`);
  console.log(`Extracted: ${match ? match[1] : 'NONE'}\n`);
}
