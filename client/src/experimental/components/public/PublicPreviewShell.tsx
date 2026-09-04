import React from "react";
import { PreviewNavbar } from "./PreviewNavbar";
import { PreviewFooter } from "./PreviewFooter";
import "@/experimental/styles/preview-theme.css";
import { cn } from "@/lib/utils";

interface PublicPreviewShellProps {
  children: React.ReactNode;
  className?: string;
  hideBanner?: boolean;
  hideNavbar?: boolean;
  hideFooter?: boolean;
  bannerNotice?: string;
  fullWidth?: boolean;
}

export const PublicPreviewShell: React.FC<PublicPreviewShellProps> = ({
  children,
  className,
  hideBanner = false,
  hideNavbar = false,
  hideFooter = false,
  bannerNotice,
  fullWidth = false,
}) => {
  return (
    <div className="preview-theme-scope min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0B131E] text-[#0F172A] dark:text-[#F8FAFC] antialiased selection:bg-[#105B38]/20 selection:text-[#0F172A] dark:text-[#F8FAFC]">
      {/* 1. Global Preview Sandbox Banner */}
      
      {/* Optional Top Notification Bar */}
      {bannerNotice && (
        <div className="bg-[#EBF5F0] dark:bg-[#105B38]/20 border-b border-[#A3D4BC] dark:border-[#10B981]/30 text-[#105B38] px-4 py-2 text-xs text-center font-medium">
          {bannerNotice}
        </div>
      )}

      {/* 2. Chambers Public Navigation Header */}
      {!hideNavbar && <PreviewNavbar />}

      {/* 3. Main Body Content */}
      <main
        role="main"
        className={cn(
          "flex-1 min-h-0 flex flex-col",
          !fullWidth && "w-full",
          className
        )}
      >
        {children}
      </main>

      {/* 4. Comprehensive Public Footer */}
      {!hideFooter && <PreviewFooter />}
    </div>
  );
};

export default PublicPreviewShell;
