const fs = require('fs');
const prodFaqCode = fs.readFileSync('client/src/pages/faq.tsx', 'utf-8');

const returnMatch = prodFaqCode.match(/return \(\s*([\s\S]*)\s*\);\s*\}/);
let newFaqContent = returnMatch[1];
newFaqContent = newFaqContent.replace(/href="\/contact"/g, 'href="/preview/contact"');
newFaqContent = newFaqContent.replace(/href="\/about"/g, 'href="/preview/about"');
newFaqContent = newFaqContent.replace(/href="\/pricing"/g, 'href="/preview/pricing"');

const newPreviewFaqCode = `import React from "react";
import { useDocumentHead } from "@/hooks/use-document-head";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";

export default function PreviewFaq() {
  useDocumentHead({
    title: "Frequently Asked Questions | Al Wakeelo",
    description: "Get answers to common questions about Al Wakeelo's AI legal assistant.",
    path: "/preview/faq",
  });

  return (
    <PublicPreviewShell>
      <div className="max-w-6xl mx-auto px-6 py-12">
        ${newFaqContent}
      </div>
    </PublicPreviewShell>
  );
}
`;
fs.writeFileSync('client/src/experimental/pages/PreviewFaq.tsx', newPreviewFaqCode);
console.log("Fixed PreviewFaq");
