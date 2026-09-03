import { useAuth } from "@/hooks/use-auth";

import React, { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";

// 1. Public Marketing & Informational Pages
import PreviewLanding from "./pages/PreviewLanding";
const PreviewPricing = lazy(() => import("./pages/PreviewPricing"));
const PreviewCheckout = lazy(() => import("./pages/PreviewCheckout"));
const PreviewCheckoutSuccess = lazy(() => import("./pages/PreviewCheckoutSuccess"));
const PreviewAbout = lazy(() => import("./pages/PreviewAbout"));
const PreviewContact = lazy(() => import("./pages/PreviewContact"));
const PreviewFaq = lazy(() => import("./pages/PreviewFaq"));
const PreviewPrivacy = lazy(() => import("./pages/PreviewPrivacy"));
const PreviewTerms = lazy(() => import("./pages/PreviewTerms"));
const PreviewRefundPolicy = lazy(() => import("./pages/PreviewRefundPolicy"));
const PreviewBlog = lazy(() => import("./pages/PreviewBlog"));
const McpPublicLandingPage = lazy(() => import("@/pages/mcp-public-landing"));
const PreviewBlogDetail = lazy(() => import("./pages/PreviewBlogDetail"));
const PreviewInstallApp = lazy(() => import("./pages/PreviewInstallApp"));
const PreviewWordAddinGuide = lazy(() => import("./pages/PreviewWordAddinGuide"));

// 2. Authentication & Onboarding Suite
const PreviewAuth = lazy(() => import("./pages/PreviewAuth"));
const PreviewForgotPassword = lazy(() => import("./pages/PreviewForgotPassword"));
const PreviewResetPassword = lazy(() => import("./pages/PreviewResetPassword"));
const PreviewOnboarding = lazy(() => import("./pages/PreviewOnboarding"));
const McpTutorialPage = lazy(() => import("@/pages/mcp-tutorial"));
const OauthConsentPage = lazy(() => import("@/pages/oauth-consent"));

// 3. Specialized Workstations & Admin Panel
const PreviewContractDrafting = lazy(() => import("./pages/PreviewContractDrafting"));
const PreviewAdminPanel = lazy(() => import("./pages/PreviewAdminPanel"));

// 4. Established 14 Internal Workstations
const PreviewDashboard = lazy(() => import("./pages/PreviewDashboard"));
const PreviewChat = lazy(() => import("./pages/PreviewChat"));
const PreviewDrafting = lazy(() => import("./pages/PreviewDrafting"));
const PreviewJudgments = lazy(() => import("./pages/PreviewJudgments"));
const PreviewCaseFiles = lazy(() => import("./pages/PreviewCaseFiles"));
const PreviewDailyDiary = lazy(() => import("./pages/PreviewDailyDiary"));
const PreviewSettings = lazy(() => import("./pages/PreviewSettings"));
const PreviewKnowledgeVault = lazy(() => import("./pages/PreviewKnowledgeVault"));
const PreviewBookmarks = lazy(() => import("./pages/PreviewBookmarks"));
const PreviewHistory = lazy(() => import("./pages/PreviewHistory"));
const PreviewOrganization = lazy(() => import("./pages/PreviewOrganization"));
const PreviewDocumentAnalyzer = lazy(() => import("./pages/PreviewDocumentAnalyzer"));
const PreviewPublicJudgment = lazy(() => import("./pages/PreviewPublicJudgment"));
const PreviewStatutes = lazy(() => import("./pages/PreviewStatutes"));
const PreviewJudges = lazy(() => import("./pages/PreviewJudges"));
const PreviewMostCited = lazy(() => import("./pages/PreviewMostCited"));

const FallbackLoader = () => (
  <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center text-[#0F172A] font-mono text-xs gap-3">
    <div className="h-7 w-7 border-2 border-[#105B38]/20 border-t-[#105B38] rounded-full animate-spin" />
    <span className="text-[#105B38] font-semibold tracking-wider">LOADING AL WAKEELO CHAMBERS PREVIEW...</span>
  </div>
);


function ProtectedRoute({ path, component: Component }: { path: string, component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#105B38]/10 flex items-center justify-center animate-pulse">
            <div className="w-6 h-6 border-2 border-[#105B38] border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground font-medium animate-pulse">Authenticating...</p>
        </div>
      </div>
    );
  }
  
  if (!user) return <Redirect to="/preview/auth" />;
  
  return <Route path={path} component={Component} />;
}

export const AppPreviewRouter: React.FC = () => {
  return (
    <Suspense fallback={<FallbackLoader />}>
      <Switch>
        {/* ================================================================= */}
        {/* 1. Public Marketing & Landing Pages                               */}
        {/* ================================================================= */}
        <Route path="/" component={PreviewLanding} />
        <Route path="/landing" component={PreviewLanding} />
        <Route path="/preview" component={PreviewLanding} />
        <Route path="/preview/landing" component={PreviewLanding} />
        <Route path="/pricing" component={PreviewPricing} />
        <Route path="/preview/pricing" component={PreviewPricing} />
        <Route path="/about" component={PreviewAbout} />
        <Route path="/preview/about" component={PreviewAbout} />
        <Route path="/contact" component={PreviewContact} />
        <Route path="/preview/contact" component={PreviewContact} />
        <Route path="/faq" component={PreviewFaq} />
        <Route path="/preview/faq" component={PreviewFaq} />
        <Route path="/preview/mcp" component={McpPublicLandingPage} />
        <Route path="/blog" component={PreviewBlog} />
        <Route path="/preview/blog" component={PreviewBlog} />
        <Route path="/preview/blog/:slug" component={PreviewBlogDetail} />
        <Route path="/privacy" component={PreviewPrivacy} />
        <Route path="/preview/privacy" component={PreviewPrivacy} />
        <Route path="/terms" component={PreviewTerms} />
        <Route path="/preview/terms" component={PreviewTerms} />
        <Route path="/refund-policy" component={PreviewRefundPolicy} />
        <Route path="/preview/refund-policy" component={PreviewRefundPolicy} />
        <Route path="/cancellation-return-refund-policy" component={PreviewRefundPolicy} />
        <Route path="/preview/cancellation-return-refund-policy" component={PreviewRefundPolicy} />
        <Route path="/install-app" component={PreviewInstallApp} />
        <Route path="/install" component={PreviewInstallApp} />
        <Route path="/preview/install-app" component={PreviewInstallApp} />
        <Route path="/preview/install" component={PreviewInstallApp} />
        <Route path="/word-addin-guide" component={PreviewWordAddinGuide} />
        <Route path="/preview/word-addin-guide" component={PreviewWordAddinGuide} />

        {/* ================================================================= */}
        {/* 2. Authentication & Onboarding Suite                              */}
        {/* ================================================================= */}
        <Route path="/auth" component={PreviewAuth} />
        <Route path="/login" component={PreviewAuth} />
        <Route path="/sign-in" component={PreviewAuth} />
        <Route path="/register" component={PreviewAuth} />
        <Route path="/sign-up" component={PreviewAuth} />
        <Route path="/preview/auth" component={PreviewAuth} />
        <Route path="/preview/login" component={PreviewAuth} />
        <Route path="/preview/register" component={PreviewAuth} />
        <Route path="/forgot-password" component={PreviewForgotPassword} />
        <Route path="/preview/forgot-password" component={PreviewForgotPassword} />
        <Route path="/reset-password" component={PreviewResetPassword} />
        <Route path="/preview/reset-password" component={PreviewResetPassword} />
        <Route path="/onboarding" component={PreviewOnboarding} />
        <Route path="/preview/onboarding" component={PreviewOnboarding} />
        <ProtectedRoute path="/oauth/consent" component={OauthConsentPage} />
        <ProtectedRoute path="/oauth/authorize" component={OauthConsentPage} />
        <ProtectedRoute path="/preview/oauth/consent" component={OauthConsentPage} />
        <ProtectedRoute path="/preview/oauth/authorize" component={OauthConsentPage} />

        {/* ================================================================= */}
        {/* 3. Billing & Checkout Suite                                       */}
        {/* ================================================================= */}
        <Route path="/checkout" component={PreviewCheckout} />
        <Route path="/preview/checkout" component={PreviewCheckout} />
        <Route path="/checkout/success" component={PreviewCheckoutSuccess} />
        <Route path="/checkout-success" component={PreviewCheckoutSuccess} />
        <Route path="/preview/checkout/success" component={PreviewCheckoutSuccess} />
        <Route path="/preview/checkout-success" component={PreviewCheckoutSuccess} />

        {/* ================================================================= */}
        {/* 4. Specialized Workstations & Administration                      */}
        {/* ================================================================= */}
        <Route path="/contracts" component={PreviewContractDrafting} />
        <ProtectedRoute path="/preview/contracts" component={PreviewContractDrafting} />
        <Route path="/contract-drafting" component={PreviewContractDrafting} />
        <Route path="/preview/contract-drafting" component={PreviewContractDrafting} />
        <Route path="/admin" component={PreviewAdminPanel} />
        <Route path="/admin-panel" component={PreviewAdminPanel} />
        <Route path="/admin-setup" component={PreviewAdminPanel} />
        <ProtectedRoute path="/preview/admin" component={PreviewAdminPanel} />
        <Route path="/preview/admin-panel" component={PreviewAdminPanel} />
        <Route path="/preview/admin-setup" component={PreviewAdminPanel} />

        {/* ================================================================= */}
        {/* 5. 14 Core Internal Litigation Workstations                       */}
        {/* ================================================================= */}
        <Route path="/dashboard" component={PreviewDashboard} />
        <ProtectedRoute path="/preview/dashboard" component={PreviewDashboard} />
        <Route path="/chat" component={PreviewChat} />
        <Route path="/al-wakeelo" component={PreviewChat} />
        <ProtectedRoute path="/preview/chat" component={PreviewChat} />
        <Route path="/drafting" component={PreviewDrafting} />
        <Route path="/legal-drafting" component={PreviewDrafting} />
        <ProtectedRoute path="/preview/drafting" component={PreviewDrafting} />
        <Route path="/judgments" component={PreviewJudgments} />
        <Route path="/judgment-search" component={PreviewJudgments} />
        <Route path="/judgments/:id" component={PreviewJudgments} />
        <Route path="/preview/judgments" component={PreviewJudgments} />
        <Route path="/preview/judgments/:id" component={PreviewJudgments} />
        <Route path="/preview/p/:id" component={PreviewPublicJudgment} />
        <Route path="/preview/public/judgments/:id" component={PreviewPublicJudgment} />
        <Route path="/cases">
          {() => <PreviewCaseFiles />}
        </Route>
        <Route path="/case-files">
          {() => <PreviewCaseFiles />}
        </Route>
        <Route path="/preview/cases">
          {() => <PreviewCaseFiles />}
        </Route>
        <Route path="/preview/case-files">
          {() => <PreviewCaseFiles />}
        </Route>
        <Route path="/case-documents">
          {() => <PreviewCaseFiles initialTab="documents" />}
        </Route>
        <Route path="/preview/case-documents">
          {() => <PreviewCaseFiles initialTab="documents" />}
        </Route>
        <Route path="/cases/:id/documents">
          {() => <PreviewCaseFiles initialTab="documents" />}
        </Route>
        <Route path="/preview/cases/:id/documents">
          {() => <PreviewCaseFiles initialTab="documents" />}
        </Route>
        <Route path="/statutes" component={PreviewStatutes} />
        <Route path="/statute-search" component={PreviewStatutes} />
        <Route path="/preview/statutes" component={PreviewStatutes} />
        <Route path="/preview/reference" component={PreviewStatutes} />
        <Route path="/judges" component={PreviewJudges} />
        <Route path="/preview/judges" component={PreviewJudges} />
        <Route path="/most-cited" component={PreviewMostCited} />
        <Route path="/preview/most-cited" component={PreviewMostCited} />
        <Route path="/diary" component={PreviewDailyDiary} />
        <Route path="/daily-diary" component={PreviewDailyDiary} />
        <ProtectedRoute path="/preview/diary" component={PreviewDailyDiary} />
        <Route path="/vault" component={PreviewKnowledgeVault} />
        <Route path="/knowledge-vault" component={PreviewKnowledgeVault} />
        <Route path="/preview/vault" component={PreviewKnowledgeVault} />
        <Route path="/preview/knowledge-vault" component={PreviewKnowledgeVault} />
        <Route path="/bookmarks" component={PreviewBookmarks} />
        <ProtectedRoute path="/preview/bookmarks" component={PreviewBookmarks} />
        <Route path="/history" component={PreviewHistory} />
        <ProtectedRoute path="/preview/history" component={PreviewHistory} />
        <Route path="/organization" component={PreviewOrganization} />
        <ProtectedRoute path="/preview/organization" component={PreviewOrganization} />
        <Route path="/analyzer" component={PreviewDocumentAnalyzer} />
        <Route path="/preview/analyzer" component={PreviewDocumentAnalyzer} />
        <Route path="/document-analyzer" component={PreviewDocumentAnalyzer} />
        <Route path="/preview/document-analyzer" component={PreviewDocumentAnalyzer} />
        <Route path="/settings" component={PreviewSettings} />
        <Route path="/profile" component={PreviewSettings} />
        <Route path="/user-panel" component={PreviewSettings} />
        <ProtectedRoute path="/preview/settings" component={PreviewSettings} />
        <Route path="/preview/profile" component={PreviewSettings} />
        <Route path="/settings/mcp-tutorial" component={McpTutorialPage} />
        <Route path="/preview/settings/mcp-tutorial" component={McpTutorialPage} />
        <Route path="/mcp-tutorial" component={McpTutorialPage} />
        <Route path="/preview/mcp-tutorial" component={McpTutorialPage} />

        {/* ================================================================= */}
        {/* 6. Wildcard Catch-all Fallback                                    */}
        {/* ================================================================= */}
        <Route path="/preview/*">
          <Redirect to="/preview/dashboard" />
        </Route>
        <Route path="*">
          <Redirect to="/dashboard" />
        </Route>
      </Switch>
    </Suspense>
  );
};

export default AppPreviewRouter;
