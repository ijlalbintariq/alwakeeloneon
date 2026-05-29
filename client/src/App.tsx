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
const ForgotPasswordPage = lazy(() => import("@/pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const SharedConversationPage = lazy(() => import("@/pages/shared-conversation"));
const PrivacyPolicyPage = lazy(() => import("@/pages/privacy"));
const TermsOfServicePage = lazy(() => import("@/pages/terms"));
const CancellationReturnRefundPolicyPage = lazy(() => import("@/pages/cancellation-return-refund-policy"));
const OwnershipStatementPage = lazy(() => import("@/pages/ownership-statement"));
const OrganizationPage = lazy(() => import("@/pages/organization"));
const CaseFilesPage = lazy(() => import("@/pages/case-files"));
const DailyDiaryPage = lazy(() => import("@/pages/daily-diary"));
const InstallAppPage = lazy(() => import("@/pages/install-app"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const CheckoutSuccessPage = lazy(() => import("@/pages/checkout-success"));
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
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const readyFired = useRef(false);

  useEffect(() => {
    if (!isLoading && !readyFired.current) {
      readyFired.current = true;
      onReady?.();
    }
  }, [isLoading, onReady]);

  if (isLoading) {
    return null;
  }

  if (location === "/") {
    if (user) return <Redirect to="/dashboard" />;
    return <LandingPage />;
  }

  if (location === "/auth") {
    if (user) return <Redirect to="/dashboard" />;
    return <AuthPage />;
  }

  if (location === "/sign-in" || location === "/login") {
    if (user) return <Redirect to="/dashboard" />;
    return <Redirect to="/auth?mode=login" />;
  }

  if (location === "/sign-up" || location === "/register" || location === "/signup") {
    if (user) return <Redirect to="/dashboard" />;
    return <Redirect to="/auth?mode=register" />;
  }

  if (location === "/forgot-password") {
    if (user) return <Redirect to="/dashboard" />;
    return <ForgotPasswordPage />;
  }

  if (location.startsWith("/reset-password")) {
    if (user) return <Redirect to="/dashboard" />;
    return <ResetPasswordPage />;
  }

  if (location.startsWith("/share/")) {
    return <SharedConversationPage />;
  }

  if (location === "/privacy") {
    return <PrivacyPolicyPage />;
  }

  if (location === "/terms") {
    return <TermsOfServicePage />;
  }

  if (location === "/cancellation-return-refund-policy") {
    return <CancellationReturnRefundPolicyPage />;
  }

  if (location === "/ownership-statement") {
    return <OwnershipStatementPage />;
  }

  if (location === "/install") {
    return <InstallAppPage />;
  }

  if (location.startsWith("/checkout/success")) {
    return <CheckoutSuccessPage />;
  }

  if (location.startsWith("/checkout")) {
    return <CheckoutPage />;
  }

  // Public judgment detail — anonymous visitors and search crawlers must reach
  // the page without redirecting to /auth. JudgmentDetailPage detects the
  // unauthenticated case and renders a preview view via /api/public/judgments.
  if (location.startsWith("/judgment/")) {
    if (user) {
      return (
        <AppShell>
          <JudgmentDetailPage />
        </AppShell>
      );
    }
    return (
      <PublicPageShell>
        <JudgmentDetailPage />
      </PublicPageShell>
    );
  }

  if (location === "/judgments/browse") {
    if (user) {
      return (
        <AppShell>
          <JudgmentDirectoryPage />
        </AppShell>
      );
    }
    return (
      <PublicPageShell>
        <JudgmentDirectoryPage />
      </PublicPageShell>
    );
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  const userTier = String(user.subscriptionTier || "").toLowerCase();
  const canAccessOrganization = !!user && (user.isAdmin || userTier === "chamber" || userTier === "enterprise");
  const OrganizationRoute = () => (canAccessOrganization ? <OrganizationPage /> : <Redirect to="/dashboard" />);

  if (location === "/admin-setup") {
    return <AdminSetupPage />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/judgments/browse" component={JudgmentDirectoryPage} />
        <Route path="/judgments" component={JudgmentsPage} />
        <Route path="/judgment-search" component={LegacyJudgmentSearchRedirect} />
        <Route path="/judgment-view" component={JudgmentViewPage} />
        <Route path="/citation-search" component={LegacyCitationSearchRedirect} />
        <Route path="/statutes" component={LegacyStatutesSearchRedirect} />
        <Route path="/chat" component={LegacyChatRedirect} />
        <Route path="/judgment/:id" component={JudgmentDetailPage} />
        <Route path="/statute-search" component={StatuteSearchPage} />
        <Route path="/statute-view/:id" component={StatuteViewPage} />
        <Route path="/al-wakeelo" component={ChatPage} />
        <Route path="/legal-drafting" component={LegalDraftingPage} />
        <Route path="/contract-drafting" component={ContractDraftingPage} />
        <Route path="/case-documents" component={CaseDocumentsPage} />
        <Route path="/bookmarks" component={BookmarksPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/knowledge-vault" component={KnowledgeVaultPage} />
        <Route path="/case-files/:id" component={CaseFilesPage} />
        <Route path="/case-files" component={CaseFilesPage} />
        <Route path="/daily-diary" component={DailyDiaryPage} />
        <Route path="/organization" component={OrganizationRoute} />
        <Route path="/admin" component={AdminPanelPage} />
        <Route path="/settings" component={UserPanelPage} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
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
