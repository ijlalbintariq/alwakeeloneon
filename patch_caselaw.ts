import fs from 'fs';

const filePath = './server/storage.ts';
let code = fs.readFileSync(filePath, 'utf-8');

const target = `      if (structuredClauses.length === 0) {
        // If there's no query and no filters, return the latest case law
        const builder = courtFilter ? db.select().from(caseLaw).where(courtFilter) : db.select().from(caseLaw);
        rows = await builder.orderBy(desc(caseLaw.citationYear), desc(caseLaw.id)).limit(effectiveFetchLimit).offset(options.offset || 0);`;

const newLogic = `      if (structuredClauses.length === 0) {
        // If there's no query and no filters, return the latest valid case law (filtering out bad OCR future years)
        const currentYear = new Date().getFullYear();
        const yearFilter = lte(caseLaw.citationYear, currentYear);
        const builder = courtFilter 
          ? db.select().from(caseLaw).where(and(yearFilter, courtFilter)) 
          : db.select().from(caseLaw).where(yearFilter);
        rows = await builder.orderBy(desc(caseLaw.citationYear), desc(caseLaw.id)).limit(effectiveFetchLimit).offset(options.offset || 0);`;

code = code.replace(target, newLogic);
fs.writeFileSync(filePath, code);
