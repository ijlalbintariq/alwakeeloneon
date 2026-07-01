import "../server/load-env";
import { retrieveForQuery } from "../server/rag/rag-service";
import { pool } from "../server/db";

async function testQuery(queryText: string, num: number) {
  console.log(`\n======================================================================`);
  console.log(`⚖️  [QUERY ${num}] LEGAL QUERY: "${queryText}"`);
  console.log(`======================================================================`);

  const t0 = Date.now();
  try {
    const result = await retrieveForQuery({
      userId: "global-admin-judgments",
      query: queryText,
      topK: 5,
    });

    console.log(`⏱️  Query + Rerank Latency: ${Date.now() - t0}ms`);
    console.log(`📊 Confidence Level: ${result.confidence.toUpperCase()}`);
    console.log(`📄 Retrieved matches: ${result.matches.length}\n`);

    if (result.matches.length === 0) {
      console.log("❌ No relevant case law found.");
      return;
    }

    result.matches.forEach((match, idx) => {
      const srcType = match.metadata?.sourceType || "unknown";
      console.log(`[${idx + 1}] Score: ${match.score.toFixed(4)} | Type: ${srcType.toUpperCase()}`);
      console.log(`📜 Title: ${match.title}`);
      if (match.metadata?.citationString) {
        console.log(`🔗 Citation: ${match.metadata.citationString}`);
      }
      if (match.metadata?.court) {
        console.log(`🏛️  Court: ${match.metadata.court}`);
      }
      console.log(`✍️  Snippet Excerpt:\n"${match.chunkText.slice(0, 320).trim()}..."`);
      console.log(`----------------------------------------------------------------------`);
    });
  } catch (err: any) {
    console.error("❌ Retrieval error:", err.message);
  }
}

async function runTests() {
  const queries = [
    // 1. PECA Act - Constitutional challenge to criminalizing defamation
    "Whether Section 20 of the Prevention of Electronic Crimes Act (PECA), 2016, violates Article 19 of the Constitution of Pakistan regarding freedom of speech and expression, and the High Court's rulings on criminalizing defamation.",

    // 2. Workplace Harassment Act 2010 - Definition and sexual intent
    "What constitutes 'harassment' under the Protection Against Harassment of Women at the Workplace Act, 2010, and whether it requires sexual intent or can cover professional hostility and discrimination.",

    // 3. Rape cases - Corroborative value of DNA
    "Whether DNA test results alone are sufficient to convict an accused of rape under Section 376 of the Pakistan Penal Code (PPC) without corroborating ocular or circumstantial evidence, and the legal value of DNA in rape cases.",

    // 4. Ban on virginity tests (Two-finger test)
    "Whether the 'two-finger test' (virginity test) on rape and sexual assault victims has been declared unconstitutional and violating Article 9 and 14 of the Constitution of Pakistan, and the relevant judgments of superior courts.",

    // 5. Time Barred - Section 5 Limitation Act (Sufficient Cause & Lawyer Negligence)
    "What constitutes 'sufficient cause' under Section 5 of the Limitation Act, 1908, for condonation of delay in filing an appeal, and whether negligence of a legal counsel or advocate is a ground for condonation.",

    // 6. PECA - High Court quashing jurisdiction under Section 561-A CrPC
    "Whether the High Court has the jurisdiction under Section 561-A CrPC to quash an FIR registered under the Prevention of Electronic Crimes Act (PECA), 2016, if no prima facie case is made out under Sections 20, 21, or 24.",

    // 7. Workplace Harassment - Jurisdiction for civil servants vs Article 212 Services Tribunal
    "Whether a civil servant can file a complaint before the Ombudsman under the Protection Against Harassment of Women at the Workplace Act, 2010, or if their remedy is barred by Article 212 of the Constitution (Service Tribunal).",

    // 8. Honor killing - Application of Section 311 PPC (Fasad-fil-Ardh) and compromise waiver
    "Whether the compromise or waiver of Qisas by the legal heirs of the deceased under Section 302 PPC is applicable in cases of honor killing (Karo-Kari) under Section 311 of the Pakistan Penal Code.",

    // 9. Family Law - Khula, Mehr recovery, and return of dowry articles
    "Whether a wife seeking divorce through Khula is bound to return the entire dower (Mehr) and dowry articles (Saman-e-Harb) received from the husband, and the criteria for determining the consideration for Khula.",

    // 10. Property Law - Suit for declaration and limitation under Section 42 Specific Relief Act
    "What is the limitation period for filing a suit for declaration under Section 42 of the Specific Relief Act, 1877, when the plaintiff's title is threatened, and whether adverse possession can defeat such a declaration."
  ];

  for (let i = 0; i < queries.length; i++) {
    await testQuery(queries[i], i + 1);
  }

  // Close connection pool
  await pool.end();
}

runTests().catch(console.error);
