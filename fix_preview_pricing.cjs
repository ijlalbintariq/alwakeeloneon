const fs = require('fs');
const prodPricingCode = fs.readFileSync('client/src/pages/pricing.tsx', 'utf-8');

const returnMatch = prodPricingCode.match(/return \(\s*([\s\S]*)\s*\);\s*\}/);
let newPricingContent = returnMatch[1];
newPricingContent = newPricingContent.replace(/href="\/contact"/g, 'href="/preview/contact"');
newPricingContent = newPricingContent.replace(/href="\/auth/g, 'href="/preview/auth');

const newPreviewPricingCode = `import React from "react";
import { useDocumentHead } from "@/hooks/use-document-head";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";
import { PricingCards } from "@/components/pricing-cards";

export default function PreviewPricing() {
  useDocumentHead({
    title: "Pricing & Plans | Al Wakeelo",
    description: "View our subscription plans and pricing for advocates, chambers, and corporate counsel.",
    path: "/preview/pricing",
  });

  return (
    <PublicPreviewShell>
      <div className="max-w-6xl mx-auto px-6 py-12">
        ${newPricingContent}
      </div>
    </PublicPreviewShell>
  );
}
`;
fs.writeFileSync('client/src/experimental/pages/PreviewPricing.tsx', newPreviewPricingCode);
console.log("Fixed PreviewPricing");
