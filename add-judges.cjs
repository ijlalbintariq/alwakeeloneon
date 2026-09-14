const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/server/routes.ts';
let content = fs.readFileSync(file, 'utf8');

const routeStr = `
  app.get("/api/judges/directory", async (req, res) => {
    try {
      const q = req.query.q ? String(req.query.q).toLowerCase() : "";
      let results;
      if (q) {
        results = await db.execute(sql\`SELECT DISTINCT judge_name FROM judge_case_links WHERE LOWER(judge_name) LIKE \${'%' + q + '%'} LIMIT 20\`);
      } else {
        results = await db.execute(sql\`SELECT DISTINCT judge_name FROM judge_case_links LIMIT 20\`);
      }
      res.json(results.rows.map(r => r.judge_name));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
`;

content = content.replace(
  'app.use("/api/bench", benchRouter);',
  'app.use("/api/bench", benchRouter);\n' + routeStr
);

fs.writeFileSync(file, content);
console.log("Judges directory route added.");
