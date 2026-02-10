import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";

import LandingPage from "@/pages/landing";
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
import NotFound from "@/pages/not-found";
import { AppShell } from "@/components/app-shell";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/" />;
  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Loading Chambers...</p>
        </div>
      </div>
    );
  }

  if (!user && location !== "/") {
    return <Redirect to="/" />;
  }

  if (!user) {
    return <LandingPage />;
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
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
