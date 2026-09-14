const fs = require('fs');
const file = '/Users/macbook/Downloads/Alwakeelo/client/src/pages/bench-simulator.tsx';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  '<SelectItem value="appellate_arguments">Appellate Arguments</SelectItem>\n                  </SelectContent>\n                \n              </div>',
  '<SelectItem value="appellate_arguments">Appellate Arguments</SelectItem>\n                  </SelectContent>\n                </Select>\n              </div>'
);
fs.writeFileSync(file, content);
console.log("Fixed Select.");
