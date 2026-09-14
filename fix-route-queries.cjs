const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/server/routes/bench-routes.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const queries = await generateAdversarialQueries(userMessage, config);',
  'const queries = await generateAdversarialQueries(userMessage, { ...config, judgeProfile: judgeProfileData });'
);

fs.writeFileSync(file, content);
console.log("bench-routes updated to pass judgeProfile to queries.");
