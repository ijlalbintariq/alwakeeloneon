const fs = require('fs');
let code = fs.readFileSync('client/src/experimental/pages/PreviewLanding.tsx', 'utf-8');

// Fix Desktop Features
code = code.replace(
  /<a\n              href="#features"\n              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"\n            >/g,
  `<a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >`
);

// Fix Desktop Pricing
code = code.replace(
  /<a\n              href="#pricing"\n              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"\n            >/g,
  `<a
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >`
);

// Fix Mobile Features
code = code.replace(
  /<a\n                href="#features"\n                onClick={\(\) => setMobileNavOpen\(false\)}\n                className="text-sm font-medium text-foreground hover:text-\[#105B38\] transition-colors"\n              >/g,
  `<a
                href="#features"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >`
);

// Fix Mobile Pricing
code = code.replace(
  /<a\n                href="#pricing"\n                onClick={\(\) => setMobileNavOpen\(false\)}\n                className="text-sm font-medium text-foreground hover:text-\[#105B38\] transition-colors"\n              >/g,
  `<a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >`
);

// Fix Explore Features
code = code.replace(
  /<a\n              href="#features"\n              className="inline-flex items-center gap-2 text-sm font-bold text-foreground hover:text-\[#105B38\] transition-all"\n            >/g,
  `<a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-2 text-sm font-bold text-foreground hover:text-[#105B38] transition-all"
            >`
);

fs.writeFileSync('client/src/experimental/pages/PreviewLanding.tsx', code);
console.log("Fixed smooth scrolling");
