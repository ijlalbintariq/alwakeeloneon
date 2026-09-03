import { lazy, Suspense, useEffect, useRef } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { PublicLegalChatWidget } from "@/components/public-legal-chat-widget";
import { OnboardingTour } from "@/components/onboarding-tour";

import { AppShell } from "@/components/app-shell";
import { PublicPageShell } from "@/components/public-page-shell";
import { ThemeProvider, useTheme } from "@/hooks/use-theme";

import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const JudgmentsPage = lazy(() => import("@/pages/judgments"));
const JudgmentViewPage = lazy(() => import("@/pages/judgment-view"));
const JudgmentDetailPage = lazy(() => import("@/pages/judgment-detail"));
const JudgmentDirectoryPage = lazy(() => import("@/pages/judgment-directory"));
const StatuteSearchPage = lazy(() => import("@/pages/statute-search"));
const StatuteViewPage = lazy(() => import("@/pages/statute-view"));
const ChatPage = lazy(() => import("@/pages/chat"));
const LegalDraftingPage = lazy(() => import("@/pages/legal-drafting"));
const ContractDraftingPage = lazy(() => import("@/pages/contract-drafting"));
const CaseDocumentsPage = lazy(() => import("@/pages/case-documents"));
const BookmarksPage = lazy(() => import("@/pages/bookmarks"));
const HistoryPage = lazy(() => import("@/pages/history"));
const KnowledgeVaultPage = lazy(() => import("@/pages/knowledge-vault"));
const AdminPanelPage = lazy(() => import("@/pages/admin-panel"));
const AdminSetupPage = lazy(() => import("@/pages/admin-setup"));
const UserPanelPage = lazy(() => import("@/pages/user-panel"));
const McpTutorialPage = lazy(() => import("@/pages/mcp-tutorial"));
const OauthConsentPage = lazy(() => import("@/pages/oauth-consent"));
const UploadSessionPage = lazy(() => import("@/pages/upload-session"));
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const SharedConversationPage = lazy(() => import("@/pages/shared-conversation"));
const PrivacyPolicyPage = lazy(() => import("@/pages/privacy"));
const TermsOfServicePage = lazy(() => import("@/pages/terms"));
const CancellationReturnRefundPolicyPage = lazy(() => import("@/pages/cancellation-return-refund-policy"));
const OwnershipStatementPage = lazy(() => import("@/pages/ownership-statement"));
const AboutPage = lazy(() => import("@/pages/about"));
const ContactPage = lazy(() => import("@/pages/contact"));
const FaqPage = lazy(() => import("@/pages/faq"));
const McpPublicLandingPage = lazy(() => import("@/pages/mcp-public-landing"));
const BlogPage = lazy(() => import("@/pages/blog"));
const BlogDetailPage = lazy(() => import("@/pages/blog-detail"));
const OrganizationPage = lazy(() => import("@/pages/organization"));
const CaseFilesPage = lazy(() => import("@/pages/case-files"));
const DailyDiaryPage = lazy(() => import("@/pages/daily-diary"));
const InstallAppPage = lazy(() => import("@/pages/install-app"));
const WordAddinGuidePage = lazy(() => import("@/pages/word-addin-guide"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const CheckoutSuccessPage = lazy(() => import("@/pages/checkout-success"));
const AppPreviewRouter = lazy(() => import("@/experimental/AppPreviewRouter"));
const NotFound = lazy(() => import("@/pages/not-found"));

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/auth" />;
  return <Component />;
}

function LegacyJudgmentSearchRedirect() {
  const params = new URLSearchParams(window.location.search);
  const next = params.toString();
  return <Redirect to={next ? `/judgments?${next}` : "/judgments"} />;
}

function LegacyCitationSearchRedirect() {
  const params = new URLSearchParams(window.location.search);
  const next = params.toString();
  return <Redirect to={next ? `/judgments?${next}` : "/judgments"} />;
}

function LegacyStatutesSearchRedirect() {
  const params = new URLSearchParams(window.location.search);
  const next = params.toString();
  return <Redirect to={next ? `/statute-search?${next}` : "/statute-search"} />;
}

function LegacyChatRedirect() {
  const params = new URLSearchParams(window.location.search);
  const next = params.toString();
  return <Redirect to={next ? `/al-wakeelo?${next}` : "/al-wakeelo"} />;
}

function Router({ onReady }: { onReady?: () => void }) {
  const { isLoading } = useAuth();
  const readyFired = useRef(false);

  useEffect(() => {
    if (!readyFired.current) {
      readyFired.current = true;
      onReady?.(); // Hide splash screen instantly
    }
  }, [onReady]);

  // AL WAKEELO V2.0 HARD CUTOVER:
  // All routes are intercepted and served by the new Experimental UI router.
  return <AppPreviewRouter />;
}

function AppContent({ onReady }: { onReady?: () => void }) {
  const { resolvedTheme } = useTheme();

  return (
    <div data-ui-preview="macos" data-theme={resolvedTheme} className="min-h-screen">
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
            Loading workspace...
          </div>
        }
      >
        <Router onReady={onReady} />
      </Suspense>
      <OnboardingTour />
      <PublicLegalChatWidget />
      <Toaster />
    </div>
  );
}


import React, { ErrorInfo } from "react";

class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Global Error Caught:", error, errorInfo);
    // If it's a chunk load error (React lazy), force a reload to get new JS chunks
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      window.location.reload();
    }
  }


  state: { hasError: boolean; error?: Error } = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    const msg = error.message || "";
    if (
      error.name === 'ChunkLoadError' || 
      msg.includes('Loading chunk') || 
      msg.includes('Unable to preload CSS') ||
      msg.includes('Failed to fetch dynamically imported module')
    ) {
      // Hard cache-busting reload
      const url = new URL(window.location.href);
      url.searchParams.set('v', Date.now().toString());
      window.location.href = url.toString();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#FBFBFA] text-[#0F172A] font-sans">
          <div className="w-16 h-16 mb-6 rounded-2xl bg-[#105B38]/10 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#105B38" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.94-4.81"></path></svg>
          </div>
          <h2 className="text-2xl font-serif font-bold mb-3 text-[#105B38]">Update Available</h2>
          <p className="text-[#64748B] text-center mb-8 max-w-md text-sm leading-relaxed">
            We've just released a new version of the Al Wakeelo platform. Your browser is holding onto an older version in its cache, which is preventing the page from loading correctly.
          </p>
          
          <div className="bg-white border border-[#E2E8F0] shadow-sm rounded-xl p-6 w-full max-w-md mb-8">
            <h3 className="font-semibold text-[13px] uppercase tracking-wider text-[#64748B] mb-4 text-center">How to continue</h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-gray-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path></svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Windows & Linux Users</p>
                  <p className="text-xs text-[#64748B] mt-1">Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">F5</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">R</kbd></p>
                </div>
              </div>
              
              <div className="h-px w-full bg-[#E2E8F0]"></div>
              
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5 text-gray-500">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"></path><path d="M10 2c1 .5 2 2 2 5"></path></svg>
                </div>
                <div>
                  <p className="text-sm font-medium">Mac Users</p>
                  <p className="text-xs text-[#64748B] mt-1">Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">Cmd</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">Shift</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-gray-700 font-mono text-[10px]">R</kbd></p>
                </div>
              </div>
            </div>
          </div>
          
          <button 
            onClick={() => {
              localStorage.clear();
              const url = new URL(window.location.href);
              url.searchParams.set('v', Date.now().toString());
              window.location.href = url.toString();
            }} 
            className="px-6 py-2.5 bg-[#105B38] text-white rounded-lg hover:bg-[#105B38]/90 font-medium text-sm transition-colors shadow-sm"
          >
            Or click here to Auto-Update
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App({ onReady }: { onReady?: () => void }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <GlobalErrorBoundary>
            <AppContent onReady={onReady} />
          </GlobalErrorBoundary>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
