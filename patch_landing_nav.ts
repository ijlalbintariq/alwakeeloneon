import fs from 'fs';

const filePath = 'client/src/experimental/pages/PreviewLanding.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

// Replace features link
code = code.replace(
  /<a\s+href="#features"\s+className="([^"]+)"\s*>\s*Features\s*<\/a>/g,
  \`<a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="$1"
            >
              Features
            </a>\`
);

// Replace pricing link
code = code.replace(
  /<a\s+href="#pricing"\s+className="([^"]+)"\s*>\s*Pricing\s*<\/a>/g,
  \`<a
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="$1"
            >
              Pricing
            </a>\`
);

// Replace mobile nav features and pricing
code = code.replace(
  /<a\s+href="#features"\s+onClick=\{[^}]+\}\s+className="([^"]+)"\s*>\s*Features\s*<\/a>/g,
  \`<a
                href="#features"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="$1"
              >
                Features
              </a>\`
);

code = code.replace(
  /<a\s+href="#pricing"\s+onClick=\{[^}]+\}\s+className="([^"]+)"\s*>\s*Pricing\s*<\/a>/g,
  \`<a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="$1"
              >
                Pricing
              </a>\`
);

fs.writeFileSync(filePath, code);
