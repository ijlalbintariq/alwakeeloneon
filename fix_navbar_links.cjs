const fs = require('fs');

const files = [
  'client/src/experimental/components/public/PreviewNavbar.tsx',
  'client/src/experimental/pages/PreviewLanding.tsx'
];

files.forEach(file => {
  let code = fs.readFileSync(file, 'utf-8');

  // Desktop Features
  code = code.replace(
    /document\.getElementById\('features'\)\?\.scrollIntoView\(\{ behavior: 'smooth' \}\);/g,
    `if (window.location.pathname === '/preview' || window.location.pathname === '/' || window.location.pathname === '/preview/') {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/preview#features');
                }`
  );

  // Desktop Pricing
  code = code.replace(
    /document\.getElementById\('pricing'\)\?\.scrollIntoView\(\{ behavior: 'smooth' \}\);/g,
    `if (window.location.pathname === '/preview' || window.location.pathname === '/' || window.location.pathname === '/preview/') {
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/preview#pricing');
                }`
  );

  fs.writeFileSync(file, code);
});

console.log("Fixed cross-page anchor routing");
