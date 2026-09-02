import React from "react";
import { Link, useLocation } from "wouter";

export const PreviewFooter: React.FC = () => {
  const [, navigate] = useLocation();
  return (
    <footer className="py-10 px-6 bg-background border-t border-border/50">
      
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={(e) => { e.preventDefault(); navigate("/preview"); }}
            >
              <div className="w-8 h-8 rounded-lg overflow-hidden border border-[#105B38]/30 bg-card flex items-center justify-center">
                <img
                  src="/logo.svg"
                  alt="AL WAKEELO logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <span
                className="text-sm font-bold italic"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                AL WAKEELO
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <a
                href="/preview/about"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/about");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                About Us
              </a>
              <a
                href="/preview/contact"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/contact");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Contact Us
              </a>
              <a
                href="/preview/faq"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/faq");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                FAQ
              </a>
              <a
                href="/preview/blog"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/blog");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Legal Blog
              </a>
              <a
                href="/preview/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/privacy");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Privacy Policy
              </a>
              <a
                href="/preview/terms"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/terms");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Terms and Conditions
              </a>
              <a
                href="/preview/cancellation-return-refund-policy"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/cancellation-return-refund-policy");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Cancellation/Return/Refund Policy
              </a>
              <a
                href="/preview/ownership-statement"
                onClick={(e) => {
                  e.preventDefault();
                  navigate("/preview/ownership-statement");
                }}
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Ownership Statement
              </a>
              <a
                href="https://www.reddit.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                Reddit Community
              </a>
              <a
                href="https://www.linkedin.com/company/al-wakeelo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-[#105B38] transition-colors"
              >
                LinkedIn
              </a>
            </div>

            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} AL WAKEELO. All rights reserved.
            </p>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              AL WAKEELO by{" "}
              <span className="text-muted-foreground font-semibold">
                Majnun Studio
              </span>
            </p>
          </div>
        </div>
      
    </footer>
  );
};

export default PreviewFooter;
