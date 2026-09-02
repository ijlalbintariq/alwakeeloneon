import React, { useState, useEffect } from "react";
import { PreviewHeader } from "./PreviewHeader";
import { PreviewSidebar } from "./PreviewSidebar";
import { PreviewCommandPalette } from "./PreviewCommandPalette";
import { LegalReferenceModal } from "./LegalReferenceModal";
import "@/experimental/styles/preview-theme.css";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface PreviewShellProps {
  children: React.ReactNode;
  className?: string;
  standalone?: boolean;
  hideSidebar?: boolean;
  hideHeader?: boolean;
  noPadding?: boolean;
}

// Pages that don't require authentication
const PUBLIC_PATHS = [
  "/preview/auth", "/preview/login", "/preview/register",
  "/preview/forgot-password", "/preview/reset-password",
  "/preview/pricing", "/preview/faq", "/preview/privacy",
  "/preview/terms", "/preview/refund-policy",
  "/preview/cancellation-return-refund-policy",
  "/preview/contact", "/preview/install-app", "/preview/install",
  "/preview/word-addin-guide",
];

export const PreviewShell: React.FC<PreviewShellProps> = ({
  children,
  className,
  standalone = false,
  hideSidebar = false,
  hideHeader = false,
  noPadding = false,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);
  const [referenceOpen, setReferenceOpen] = useState<boolean>(false);
  const [authChecked, setAuthChecked] = useState<boolean>(false);
  const [, setLocation] = useLocation();

  // Auth guard — redirect to /preview/auth if not authenticated
  useEffect(() => {
    const currentPath = window.location.pathname;
    const isPublic = PUBLIC_PATHS.some(p => currentPath === p || currentPath.startsWith(p + "/"));
    if (isPublic || standalone) {
      setAuthChecked(true);
      return;
    }

    fetch("/api/auth/user", { credentials: "include" })
      .then(res => {
        if (res.ok) {
          setAuthChecked(true);
        } else {
          setLocation("/preview/auth");
        }
      })
      .catch(() => {
        setLocation("/preview/auth");
      });
  }, [setLocation, standalone]);

  const shouldHideSidebar = standalone || hideSidebar;
  const shouldHideHeader = standalone || hideHeader;
  const shouldRemovePadding = standalone || noPadding;

  // Show loading state while checking auth on protected pages
  if (!authChecked) {
    return (
      <div className="preview-theme-scope h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#105B38] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[#64748B] font-medium">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-theme-scope h-screen max-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] antialiased selection:bg-[#105B38]/20 selection:text-[#0F172A] overflow-hidden">
      {/* 1. Global Sandbox Status Banner */}
      
      {/* 2. Main Workstation Shell Area */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Desktop Sidebar */}
        {!shouldHideSidebar && (
          <div className="hidden md:flex">
            <PreviewSidebar
              collapsed={sidebarCollapsed}
              onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
              onOpenReference={() => setReferenceOpen(true)}
            />
          </div>
        )}

        {/* Mobile Sidebar Overlay */}
        {!shouldHideSidebar && mobileSidebarOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-black/30 transition-opacity"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <div className="relative z-10 w-64 max-w-[80vw]">
              <PreviewSidebar
                collapsed={false}
                onToggleCollapse={() => setMobileSidebarOpen(false)}
                onOpenReference={() => setReferenceOpen(true)}
              />
            </div>
          </div>
        )}

        {/* Workstation Right Viewport */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[#F8FAFC]">
          {/* Workstation Header */}
          {!shouldHideHeader && (
            <PreviewHeader
              onToggleSidebar={() => setMobileSidebarOpen((prev) => !prev)}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              onOpenReference={() => setReferenceOpen(true)}
            />
          )}

          {/* Main Page Content */}
          <main
            role="main"
            className={cn(
              "flex-1 min-h-0 flex flex-col",
              shouldRemovePadding ? "p-0 overflow-hidden" : "overflow-y-auto overflow-x-hidden px-4 sm:px-6 md:px-8 py-5",
              className
            )}
          >
            {children}
          </main>
        </div>
      </div>

      {/* 3. Global Command Palette Modal */}
      <PreviewCommandPalette
        isOpen={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
      />

      {/* 4. Legal Reference Shelf (Limitation Act + Courts Directory) */}
      <LegalReferenceModal isOpen={referenceOpen} onClose={() => setReferenceOpen(false)} />
    </div>
  );
};
