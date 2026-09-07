import fs from 'fs';

const filePath = './server/routes.ts';
let code = fs.readFileSync(filePath, 'utf-8');

const target = `      if (isNumeric) {
        // Numeric ID → look up in case_law table and return compatible response
        const caseLawEntry = await storage.getCaseLawById(Number(id));
        if (!caseLawEntry) return res.status(404).json({ message: "Case law entry not found" });

        return res.json({
          id: caseLawEntry.id,
          citation: caseLawEntry.citation || "",
          title: caseLawEntry.title || "",
          court: caseLawEntry.court || "",
          decisionDate: null,
          headnotes: caseLawEntry.summary || "",
          fullText: caseLawEntry.summary || "",
          petitioner: null,
          respondent: null,
        });
      }`;

const newLogic = `      if (isNumeric) {
        // Numeric ID → look up in case_law table
        const caseLawEntry = await storage.getCaseLawById(Number(id));
        if (!caseLawEntry) return res.status(404).json({ message: "Case law entry not found" });

        // Try to find the real judgment UUID to fetch full citations
        let detail;
        if (caseLawEntry.citation) {
           const [realJudgment] = await db.select({ id: judgments.id }).from(judgments).where(eq(judgments.citationString, caseLawEntry.citation)).limit(1);
           if (realJudgment) {
             detail = await storage.getJudgmentDetail(realJudgment.id);
           }
        }

        if (detail) {
           return res.json(detail);
        }

        return res.json({
          id: caseLawEntry.id,
          citation: caseLawEntry.citation || "",
          title: caseLawEntry.title || "",
          court: caseLawEntry.court || "",
          decisionDate: null,
          headnotes: caseLawEntry.summary || "",
          fullText: caseLawEntry.summary || "",
          petitioner: null,
          respondent: null,
          citations: { made: [], received: [] }
        });
      }`;

code = code.replace(target, newLogic);
fs.writeFileSync(filePath, code);
