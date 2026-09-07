const fs = require('fs');

// Get the beautiful navbar from PreviewLanding
const landingCode = fs.readFileSync('client/src/experimental/pages/PreviewLanding.tsx', 'utf-8');
const navMatch = landingCode.match(/<nav className="fixed top-0 left-0 right-0 z-50 bg-background\/90 backdrop-blur-xl border-b border-border\/50">([\s\S]*?)<\/nav>/);
if (!navMatch) {
  console.log("Could not find nav in PreviewLanding.tsx");
  process.exit(1);
}
let beautifulNav = `<nav className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50">\n${navMatch[1]}\n</nav>`;

// However, in PreviewNavbar.tsx, we need to handle Theme Toggle logic differently if it doesn't have the same hooks.
// Let's check what hooks PreviewNavbar uses.
