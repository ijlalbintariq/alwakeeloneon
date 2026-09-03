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
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-foreground">
          <div className="w-16 h-16 mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Application Crash Log</h2>
          <div className="bg-red-50 text-red-900 border border-red-200 p-4 rounded-lg w-full max-w-3xl mb-6 overflow-auto max-h-[300px] text-sm font-mono text-left">
            <p className="font-bold mb-2">{this.state.error?.name}: {this.state.error?.message}</p>
            <pre className="whitespace-pre-wrap">{this.state.error?.stack}</pre>
          </div>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            Please copy the error above and send it to the developer.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                localStorage.clear();
                const url = new URL(window.location.href);
                url.searchParams.set('v', Date.now().toString());
                window.location.href = url.toString();
              }} 
              className="px-6 py-2 bg-[#105B38] text-white rounded-md hover:bg-[#105B38]/90 font-medium"
            >
              Clear Cache & Force Reload
            </button>
          </div>
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
