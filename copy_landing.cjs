const fs = require('fs');
const prodPath = 'client/src/pages/landing.tsx';
const expPath = 'client/src/experimental/pages/PreviewLanding.tsx';

let code = fs.readFileSync(prodPath, 'utf-8');

// Component name
code = code.replace(/export default function LandingPage\(\)/g, 'export default function PreviewLanding()');

// Routes
const routeMap = {
  '"/"': '"/preview"',
  '"/?consult=1#consult"': '"/preview?consult=1#consult"',
  '"/about"': '"/preview/about"',
  '"/auth"': '"/preview/auth"',
  '"/blog"': '"/preview/blog"',
  '"/cancellation-return-refund-policy"': '"/preview/cancellation-return-refund-policy"',
  '"/contact"': '"/preview/contact"',
  '"/dashboard"': '"/preview/dashboard"',
  '"/faq"': '"/preview/faq"',
  '"/mcp"': '"/preview/mcp"',
  '"/ownership-statement"': '"/preview/ownership-statement"',
  '"/privacy"': '"/preview/privacy"',
  '"/terms"': '"/preview/terms"',
  '"/word-addin-guide"': '"/preview/word-addin-guide"'
};

for (const [prodRoute, expRoute] of Object.entries(routeMap)) {
  // Replace in href="..."
  code = code.split(`href=${prodRoute}`).join(`href=${expRoute}`);
  
  // Replace in navigate("...")
  code = code.split(`navigate(${prodRoute})`).join(`navigate(${expRoute})`);
}

// Special case for ctaTarget which doesn't use href or navigate directly
code = code.replace(/user \? "\/dashboard" : "\/auth"/g, 'user ? "/preview/dashboard" : "/preview/auth"');

fs.writeFileSync(expPath, code);
console.log("Successfully copied and patched PreviewLanding.tsx");
