import fs from 'fs';

const filePath = './shared/schema.ts';
let code = fs.readFileSync(filePath, 'utf-8');

const target = `  description: text("description"),`;
const newFields = `  description: text("description"),
  leadCounselId: varchar("lead_counsel_id").references(() => users.id),
  assistingCounselId: varchar("assisting_counsel_id").references(() => users.id),`;

code = code.replace(target, newFields);
fs.writeFileSync(filePath, code);
