const fs = require('fs');

// 1. Rewrite PreviewFooter to match PreviewLanding's footer
const landingCode = fs.readFileSync('client/src/experimental/pages/PreviewLanding.tsx', 'utf-8');
const footerMatch = landingCode.match(/<footer className="py-10 px-6 bg-background border-t border-border\/50">([\s\S]*?)<\/footer>/);
if (!footerMatch) {
  console.log("Could not find footer in PreviewLanding.tsx");
  process.exit(1);
}

const newFooterCode = `import React from "react";
import { Link, useLocation } from "wouter";

export const PreviewFooter: React.FC = () => {
  const [, navigate] = useLocation();
  return (
    <footer className="py-10 px-6 bg-background border-t border-border/50">
      ${footerMatch[1].replace(/onClick=\{\(\) => navigate\("\/preview"\)\}/, `onClick={(e) => { e.preventDefault(); navigate("/preview"); }}`)}
    </footer>
  );
};

export default PreviewFooter;
`;
fs.writeFileSync('client/src/experimental/components/public/PreviewFooter.tsx', newFooterCode);

// 2. Rewrite PreviewAbout to match production about.tsx, but wrapped in PublicPreviewShell
const prodAboutCode = fs.readFileSync('client/src/pages/about.tsx', 'utf-8');

// Extract the content inside the return statement of prod about
const returnMatch = prodAboutCode.match(/return \(\s*([\s\S]*)\s*\);\s*\}/);
if (!returnMatch) {
  console.log("Could not parse about.tsx");
  process.exit(1);
}

let newAboutContent = returnMatch[1];
// The production about page uses relative links like /auth?mode=register, let's make them /preview/auth
newAboutContent = newAboutContent.replace(/href="\/auth\?mode=register"/g, 'href="/preview/auth?mode=register"');
newAboutContent = newAboutContent.replace(/href="\/contact"/g, 'href="/preview/contact"');

const newPreviewAboutCode = `import React from "react";
import { useDocumentHead } from "@/hooks/use-document-head";
import { Shield, Users, Gavel, Cpu } from "lucide-react";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";

export default function PreviewAbout() {
  useDocumentHead({
    title: "About Us | Al Wakeelo — Pakistan's AI Legal Assistant",
    description: "Learn about Al Wakeelo, Pakistan's premier AI legal assistant operated by Majnoon Studio.",
    path: "/preview/about",
  });

  return (
    <PublicPreviewShell>
      <div className="max-w-6xl mx-auto px-6 py-12">
        ${newAboutContent}
      </div>
    </PublicPreviewShell>
  );
}
`;
fs.writeFileSync('client/src/experimental/pages/PreviewAbout.tsx', newPreviewAboutCode);

console.log("Fixed PreviewFooter and PreviewAbout!");
