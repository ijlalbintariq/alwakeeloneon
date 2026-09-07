const fs = require('fs');
const prodContactCode = fs.readFileSync('client/src/pages/contact.tsx', 'utf-8');

const returnMatch = prodContactCode.match(/return \(\s*([\s\S]*)\s*\);\s*\}/);
let newContactContent = returnMatch[1];

const newPreviewContactCode = `import React from "react";
import { useDocumentHead } from "@/hooks/use-document-head";
import { Mail, MapPin, Phone, MessageSquare, ArrowRight } from "lucide-react";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";

export default function PreviewContact() {
  useDocumentHead({
    title: "Contact Us | Al Wakeelo — Pakistan's AI Legal Assistant",
    description: "Get in touch with the Al Wakeelo team. Chamber support, demonstrations, and technical assistance.",
    path: "/preview/contact",
  });

  return (
    <PublicPreviewShell>
      <div className="max-w-6xl mx-auto px-6 py-12">
        ${newContactContent}
      </div>
    </PublicPreviewShell>
  );
}
`;
fs.writeFileSync('client/src/experimental/pages/PreviewContact.tsx', newPreviewContactCode);
console.log("Fixed PreviewContact");
