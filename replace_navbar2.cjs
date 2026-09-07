const fs = require('fs');

const landingCode = fs.readFileSync('client/src/experimental/pages/PreviewLanding.tsx', 'utf-8');
const navMatch = landingCode.match(/<nav className="fixed top-0 left-0 right-0 z-50 bg-background\/90 backdrop-blur-xl border-b border-border\/50">([\s\S]*?)<\/nav>/);
if (!navMatch) {
  console.log("Could not find nav in PreviewLanding.tsx");
  process.exit(1);
}
let navHtml = navMatch[0];

// The navHtml contains `{user ? ... : ...}` logic, so we need useAuth.
// It also has `mobileNavOpen` state, `toggleTheme` etc.

const newPreviewNavbar = `import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Menu, X, ArrowRight, Sun, Moon } from "lucide-react";

export interface PreviewNavbarProps {
  className?: string;
  onOpenCommandPalette?: () => void;
}

export const PreviewNavbar: React.FC<PreviewNavbarProps> = ({ className }) => {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { resolvedTheme, toggle: toggleTheme } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const ctaTarget = user ? "/preview/dashboard" : "/preview/auth";

  return (
    ${navHtml.replace(/<nav className="fixed top-0 left-0 right-0 z-50 bg-background\/90 backdrop-blur-xl border-b border-border\/50">/, '<nav className={`fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50 ${className || ""}`}>')}
  );
};

export default PreviewNavbar;
`;

fs.writeFileSync('client/src/experimental/components/public/PreviewNavbar.tsx', newPreviewNavbar);
console.log("Replaced PreviewNavbar.tsx!");
