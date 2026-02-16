import { useEffect, useRef } from "react";
import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

import LandingPage from "@/pages/landing";
import AuthPage from "@/pages/auth";
import DashboardPage from "@/pages/dashboard";
import JudgmentSearchPage from "@/pages/judgment-search";
import StatuteSearchPage from "@/pages/statute-search";
import ChatPage from "@/pages/chat";
import LegalDraftingPage from "@/pages/legal-drafting";
import ContractDraftingPage from "@/pages/contract-drafting";
import CaseDocumentsPage from "@/pages/case-documents";
import BookmarksPage from "@/pages/bookmarks";
import HistoryPage from "@/pages/history";
import KnowledgeVaultPage from "@/pages/knowledge-vault";
import AdminPanelPage from "@/pages/admin-panel";
import AdminSetupPage from "@/pages/admin-setup";
import UserPanelPage from "@/pages/user-panel";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import SharedConversationPage from "@/pages/shared-conversation";
import NotFound from "@/pages/not-found";
import { AppShell } from "@/components/app-shell";

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

  if (location === "/" && !user) {
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

  if (!user) {
    return <Redirect to="/auth" />;
  }

  if (location === "/admin-setup") {
    return <AdminSetupPage />;
  }

  return (
    <AppShell>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/judgment-search" component={JudgmentSearchPage} />
        <Route path="/statute-search" component={StatuteSearchPage} />
        <Route path="/al-wakeelo" component={ChatPage} />
        <Route path="/legal-drafting" component={LegalDraftingPage} />
        <Route path="/contract-drafting" component={ContractDraftingPage} />
        <Route path="/case-documents" component={CaseDocumentsPage} />
        <Route path="/bookmarks" component={BookmarksPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/knowledge-vault" component={KnowledgeVaultPage} />
        <Route path="/admin" component={AdminPanelPage} />
        <Route path="/settings" component={UserPanelPage} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App({ onReady }: { onReady?: () => void }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router onReady={onReady} />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
