import { lazy, Suspense, useEffect, useRef } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

import { AppShell } from "@/components/app-shell";
import { ThemeProvider, useTheme } from "@/hooks/use-theme";

const LandingPage = lazy(() => import("@/pages/landing"));
const AuthPage = lazy(() => import("@/pages/auth"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const JudgmentSearchPage = lazy(() => import("@/pages/judgment-search"));
const JudgmentViewPage = lazy(() => import("@/pages/judgment-view"));
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
const OrganizationPage = lazy(() => import("@/pages/organization"));
const InstallAppPage = lazy(() => import("@/pages/install-app"));
const NotFound = lazy(() => import("@/pages/not-found"));

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/auth" />;
  return <Component />;
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
    return <LandingPage />;
  }

  if (location === "/auth") {
    if (user) return <Redirect to="/dashboard" />;
    return <AuthPage />;
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

  if (location === "/install") {
    return <InstallAppPage />;
  }

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (location === "/admin-setup") {
    return <AdminSetupPage />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/judgment-search" component={JudgmentSearchPage} />
        <Route path="/judgment-view" component={JudgmentViewPage} />
        <Route path="/statute-search" component={StatuteSearchPage} />
        <Route path="/statute-view/:id" component={StatuteViewPage} />
        <Route path="/al-wakeelo" component={ChatPage} />
        <Route path="/legal-drafting" component={LegalDraftingPage} />
        <Route path="/contract-drafting" component={ContractDraftingPage} />
        <Route path="/case-documents" component={CaseDocumentsPage} />
        <Route path="/bookmarks" component={BookmarksPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/knowledge-vault" component={KnowledgeVaultPage} />
        <Route path="/organization" component={OrganizationPage} />
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
          <div className="min-h-screen flex items-center justify-center text-slate-400 text-sm">
            Loading workspace...
          </div>
        }
      >
        <Router onReady={onReady} />
      </Suspense>
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
