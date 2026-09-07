const fs = require('fs');

let code = fs.readFileSync('server/routes.ts', 'utf-8');

code = code.replace(
  'await db.delete(searchHistory).where(and(eq(searchHistory.id, id), eq(searchHistory.userId, userId)));',
  '// searchHistory removed\n      // await db.delete(searchHistory).where(and(eq(searchHistory.id, id), eq(searchHistory.userId, userId)));'
);

code = code.replace(
  'await db.delete(searchHistory).where(eq(searchHistory.userId, userId));',
  '// searchHistory removed\n      // await db.delete(searchHistory).where(eq(searchHistory.userId, userId));'
);

fs.writeFileSync('server/routes.ts', code);
