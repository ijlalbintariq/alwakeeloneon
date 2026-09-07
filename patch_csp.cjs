const fs = require('fs');
const path = 'server/index.ts';
let content = fs.readFileSync(path, 'utf8');

const oldCspBlock = `  if (isProduction) {
    directives.push("script-src 'self' https://accounts.google.com https://pagead2.googlesyndication.com");
    directives.push("connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com https://pagead2.googlesyndication.com");
    directives.push("upgrade-insecure-requests");
  } else {`;

const newCspBlock = `  if (isProduction) {
    directives.push("script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://pagead2.googlesyndication.com https://news.google.com");
    directives.push("connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://accounts.google.com https://oauth2.googleapis.com https://pagead2.googlesyndication.com");
    directives.push("frame-src 'self' https://accounts.google.com https://googleads.g.doubleclick.net");
    directives.push("upgrade-insecure-requests");
  } else {`;

// Replace the old block, wait frame-src is already defined above?
// "frame-src 'self' https://accounts.google.com", let's check
if (content.includes(oldCspBlock)) {
  content = content.replace(oldCspBlock, newCspBlock);
  fs.writeFileSync(path, content, 'utf8');
  console.log("Patched production CSP");
} else {
  console.log("Could not find CSP block");
}
