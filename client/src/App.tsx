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


function App({ onReady }: { onReady?: () => void }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AppContent onReady={onReady} />
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
