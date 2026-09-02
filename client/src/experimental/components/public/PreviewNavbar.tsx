import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { Menu, X, ArrowRight, Sun, Moon, LayoutDashboard, Mail, PhoneCall } from "lucide-react";

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
    <nav className={`fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/50 ${className || ""}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate("/preview")}
          >
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#105B38]/30 shadow-lg shadow-[#105B38]/10 bg-card flex items-center justify-center">
              <img
                src="/logo.svg"
                alt="AL WAKEELO logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span
              className="text-xl font-bold italic tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              AL WAKEELO
            </span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a
              href="/preview"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview");
              }}
              className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
            >
              Home
            </a>
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                if (window.location.pathname === '/preview' || window.location.pathname === '/' || window.location.pathname === '/preview/') {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/preview#features');
                }
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                if (window.location.pathname === '/preview' || window.location.pathname === '/' || window.location.pathname === '/preview/') {
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/preview#pricing');
                }
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </a>
            <a
              href="/preview/about"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/about");
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </a>
            <a
              href="/preview/contact"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/contact");
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Contact
            </a>
            <a
              href="/preview/faq"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/faq");
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              FAQ
            </a>
            <a
              href="/preview/blog"
              onClick={(e) => {
                e.preventDefault();
                navigate("/preview/blog");
              }}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Blog
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="h-10 w-10 rounded-xl border border-border bg-transparent text-foreground hover:bg-card p-0 inline-flex items-center justify-center transition-colors"
              aria-label={
                resolvedTheme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              data-testid="landing-theme-toggle"
            >
              {resolvedTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              className="md:hidden h-10 w-10 rounded-xl border border-border bg-transparent text-foreground hover:bg-card p-0 inline-flex items-center justify-center"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <a
              href={ctaTarget}
              onClick={(e) => {
                e.preventDefault();
                navigate(ctaTarget);
              }}
              className="px-6 py-2.5 bg-[#105B38] text-white rounded-xl text-sm font-bold hover:bg-[#0D4A2E] transition-all shadow-lg shadow-[#105B38]/20 flex items-center gap-2"
            >
              {user ? (
                <>
                  <LayoutDashboard size={16} /> Dashboard
                </>
              ) : (
                "Start Now"
              )}
            </a>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="md:hidden border-t border-border/70 bg-background/95 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col gap-3">
              <a
                href="/preview"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  navigate("/preview");
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >
                Home
              </a>
              <a
                href="#features"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  if (window.location.pathname === '/preview' || window.location.pathname === '/' || window.location.pathname === '/preview/') {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/preview#features');
                }
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >
                Features
              </a>
              <a
                href="#pricing"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  if (window.location.pathname === '/preview' || window.location.pathname === '/' || window.location.pathname === '/preview/') {
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                } else {
                  navigate('/preview#pricing');
                }
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >
                Pricing
              </a>
              <a
                href="/preview/about"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  navigate("/preview/about");
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >
                About
              </a>
              <a
                href="/preview/contact"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  navigate("/preview/contact");
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >
                Contact
              </a>
              <a
                href="/preview/faq"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  navigate("/preview/faq");
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >
                FAQ
              </a>
              <a
                href="/preview/blog"
                onClick={(e) => {
                  e.preventDefault();
                  setMobileNavOpen(false);
                  navigate("/preview/blog");
                }}
                className="text-sm font-medium text-foreground hover:text-[#105B38] transition-colors"
              >
                Blog
              </a>
              <div className="pt-2 border-t border-border/80 flex flex-col gap-2">
                <a
                  href="mailto:support@alwakeelo.com"
                  className="inline-flex items-center gap-2 text-sm text-[#105B38] hover:text-foreground transition-colors"
                >
                  <Mail size={14} /> support@alwakeelo.com
                </a>
                <a
                  href="tel:00923358341897"
                  className="inline-flex items-center gap-2 text-sm text-[#105B38] hover:text-foreground transition-colors"
                >
                  <PhoneCall size={14} /> 00923358341897
                </a>
              </div>
            </div>
          </div>
        )}
      </nav>
  );
};

export default PreviewNavbar;
