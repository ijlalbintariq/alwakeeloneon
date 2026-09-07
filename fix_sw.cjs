const fs = require('fs');
const path = 'client/public/sw.js';
let content = fs.readFileSync(path, 'utf8');

const oldCatch = `.catch(() => caches.match(request))`;
const newCatch = `.catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response("Offline or blocked by CSP", { status: 503, statusText: "Service Unavailable" });
      })`;

if (content.includes(oldCatch)) {
  content = content.replace(oldCatch, newCatch);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Patched sw.js");
} else {
  console.log("Could not find catch block in sw.js");
}
