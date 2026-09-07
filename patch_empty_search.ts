import fs from 'fs';

const filePath = './server/storage.ts';
let code = fs.readFileSync(filePath, 'utf-8');

const target = `    if (!safeQuery) {
      const builder = court ? db.select().from(judgments).where(ilike(judgments.court, \`%\${court}%\`)) : db.select().from(judgments);
      const rows = await builder.orderBy(desc(judgments.year), desc(judgments.id)).limit(safeLimit);
      return rows.map((row) => ({`;

const newLogic = `    if (!safeQuery) {
      const currentYear = new Date().getFullYear();
      const builder = court 
        ? db.select().from(judgments).where(and(lte(judgments.year, currentYear), ilike(judgments.courtNameSnapshot, \`%\${court}%\`))) 
        : db.select().from(judgments).where(lte(judgments.year, currentYear));
      
      const rows = await builder.orderBy(desc(judgments.year), desc(judgments.id)).limit(safeLimit);
      return rows.map((row) => ({`;

code = code.replace(target, newLogic);
fs.writeFileSync(filePath, code);
