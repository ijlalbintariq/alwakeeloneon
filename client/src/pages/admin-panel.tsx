import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Redirect } from "wouter";
import {
  Shield, Users, BarChart3, Database, Upload, Trash2, Crown,
  UserCheck, UserX, Loader2, FileText, AlertTriangle, Plus,
  Scale, Pencil, X, Check, FileUp, Search, AlertOctagon, Globe, ExternalLink, RotateCcw, Download, StopCircle
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import type { User } from "@shared/models/auth";
import { extractCaseLawInBrowser } from "@/lib/case-law-client-extractor";

type SystemStats = {
  totalUsers: number;
  totalThreads: number;
  totalMessages: number;
  totalDocuments: number;
  totalKnowledge: number;
  totalCacheEntries: number;
  totalUsageThisMonth: number;
};

type AdminKnowledgeDoc = {
  id: number;
  title: string;
  filename: string;
  category: string;
  uploadedBy: string;
  createdAt: string;
};

type PagedResponse<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type CostAnalytics = {
  byFeature: Array<{
    feature: string;
    totalQueries: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCost: string;
  }>;
  totalCost: string;
  totalTokens: number;
};

type SeoStatus = {
  siteBase: string;
  generatedAt: string;
  healthyChecks: number;
  totalChecks: number;
  checks: Array<{
    key: string;
    label: string;
    ok: boolean;
    detail: string;
  }>;
  urls: {
    home: string;
    robots: string;
    sitemap: string;
  };
  recommendations: string[];
};

type AdminUser = User & {
  isBanned?: boolean;
  banReason?: string | null;
  bannedAt?: string | null;
  bannedBy?: string | null;
};

type AdminAuditLog = {
  id: number;
  action: string;
  actorUserId: string | null;
  targetUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type SecurityEventSnapshot = {
  id: number;
  type: string;
  key: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  metadata: Record<string, unknown> | null;
};

type ClientLead = {
  id: string;
  name: string;
  phone: string;
  email: string;
  caseType: string;
  city: string;
  urgency: "low" | "normal" | "high" | "urgent";
  preferredCallbackTime: string | null;
  consentToContact: boolean;
  caseDescription: string;
  ipAddress: string;
  status: "open" | "completed";
  statusUpdatedAt: string;
  createdAt: string;
};

type GlobalRagReindexSourceStatus = {
  key: "case-law" | "statute-docs" | "knowledge-vault";
  label: string;
  nextOffset: number;
  nextCursorId: number | null;
  totalDocuments: number;
  processed: number;
  indexed: number;
  failed: number;
  done: boolean;
  lastError: string | null;
};

type GlobalRagReindexStatus = {
  running: boolean;
  shouldStop: boolean;
  mode: "full" | "incremental";
  batchSize: number;
  activeSource: "case-law" | "statute-docs" | "knowledge-vault" | null;
  activeSourceLabel: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  aggregate: {
    totalDocuments: number;
    processed: number;
    indexed: number;
    failed: number;
  };
  sources: GlobalRagReindexSourceStatus[];
};

export default function AdminPanelPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"stats" | "users" | "knowledge" | "case-law" | "statute-docs" | "audit" | "client-leads">("stats");

  if (!user?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="admin-panel-premium space-y-8 fade-in" data-testid="admin-panel-page">
      <div className="admin-panel-hero">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="admin-panel-shield-wrap">
              <Shield size={18} className="text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Admin Control Panel
            </h1>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground font-black">
            Platform Management Command Center
          </p>
        </div>
      </div>

      <div className="admin-tab-strip flex gap-2 flex-wrap">
        {[
          { id: "stats" as const, label: "Analytics", icon: BarChart3 },
          { id: "users" as const, label: "Users", icon: Users },
          { id: "audit" as const, label: "Audit Logs", icon: Shield },
          { id: "knowledge" as const, label: "Knowledge Vault", icon: Database },
          { id: "client-leads" as const, label: "Client Leads", icon: FileText },
          { id: "case-law" as const, label: "Case Law", icon: Scale },
          { id: "statute-docs" as const, label: "Statute Library", icon: FileText },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            className={`rounded-xl text-[10px] uppercase tracking-widest font-black admin-tab-button ${activeTab === tab.id ? "bg-primary text-slate-950" : "text-foreground"}`}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`tab-${tab.id}`}
          >
            <tab.icon size={14} />
            <span>{tab.label}</span>
          </Button>
        ))}
      </div>

      {activeTab === "stats" && <StatsSection />}
      {activeTab === "users" && <UsersSection />}
      {activeTab === "audit" && <AuditLogsSection />}
      {activeTab === "knowledge" && <KnowledgeSection />}
      {activeTab === "client-leads" && <ClientLeadsSection />}
      {activeTab === "case-law" && <CaseLawSection />}
      {activeTab === "statute-docs" && <StatuteDocumentsSection />}
    </div>
  );
}

const FEATURE_LABELS: Record<string, string> = {
  chat: "Chat",
  "search-judgments": "Judgment Search",
  "search-statutes": "Statute Search",
  summarize: "Summarize",
  brief: "Legal Brief",
  draft: "Draft",
  contract: "Contract",
  "contract-drafting": "Contract Draft",
};

const ADMIN_PAGE_SIZE = 50;

function PaginationStrip({
  page,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
}) {
  if (total <= pageSize) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between gap-3 pt-2">
      <span className="text-[10px] text-muted-foreground font-bold">
        Showing {start}-{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          className="text-[10px] text-foreground rounded-lg"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Prev
        </Button>
        <span className="text-[10px] text-muted-foreground font-bold">
          Page {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="ghost"
          className="text-[10px] text-foreground rounded-lg"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function GlobalRagIndexCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reindexStatusResponse, isLoading } = useQuery<{ ok: boolean; status: GlobalRagReindexStatus }>({
    queryKey: ["/api/admin/rag/reindex-global/status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/rag/reindex-global/status", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch global RAG reindex status");
      }
      return res.json();
    },
    refetchInterval: 2500,
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/rag/reindex-global/start", { batchSize: 50, mode: "full" });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data?.message || "Global RAG indexing started" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rag/reindex-global/status"] });
    },
    onError: (err: any) => {
      toast({
        title: err?.message || "Failed to start global RAG indexing",
        variant: "destructive",
      });
    },
  });

  const startIncrementalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/rag/reindex-global/start", { batchSize: 50, mode: "incremental" });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data?.message || "Incremental RAG indexing started" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rag/reindex-global/status"] });
    },
    onError: (err: any) => {
      toast({
        title: err?.message || "Failed to start incremental RAG indexing",
        variant: "destructive",
      });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/rag/reindex-global/stop", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data?.message || "Stop signal sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rag/reindex-global/status"] });
    },
    onError: (err: any) => {
      toast({
        title: err?.message || "Failed to stop global RAG indexing",
        variant: "destructive",
      });
    },
  });

  const status = reindexStatusResponse?.status;

  return (
    <Card className="bg-card border-border rounded-[2rem]" data-testid="global-rag-index-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] font-black text-primary">
              Global RAG Indexing
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Use <span className="text-emerald-300 font-semibold">Index Missing Only</span> for faster backfills, or <span className="text-foreground font-semibold">Index All</span> for full rebuild.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status?.running ? (
              <Button
                variant="ghost"
                className="text-red-300 border border-red-500/40 rounded-xl text-[10px] uppercase tracking-widest font-black"
                onClick={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
                data-testid="button-stop-global-rag-index"
              >
                {stopMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <X size={14} />}
                <span>Stop</span>
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="text-emerald-200 border border-emerald-500/40 rounded-xl text-[10px] uppercase tracking-widest font-black"
                  onClick={() => startIncrementalMutation.mutate()}
                  disabled={startIncrementalMutation.isPending || startMutation.isPending || isLoading}
                  data-testid="button-start-global-rag-index-incremental"
                >
                  {startIncrementalMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                  <span>Index Missing Only</span>
                </Button>
                <Button
                  className="bg-primary text-slate-950 rounded-xl text-[10px] uppercase tracking-widest font-black"
                  onClick={() => startMutation.mutate()}
                  disabled={startMutation.isPending || startIncrementalMutation.isPending || isLoading}
                  data-testid="button-start-global-rag-index"
                >
                  {startMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
                  <span>Index All (Batch 50)</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="animate-spin" size={14} />
            <span>Loading status...</span>
          </div>
        ) : status ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Total Docs</p>
                <p className="text-sm font-bold text-foreground">{(status.aggregate.totalDocuments || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Processed</p>
                <p className="text-sm font-bold text-blue-300">{(status.aggregate.processed || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Indexed</p>
                <p className="text-sm font-bold text-emerald-300">{(status.aggregate.indexed || 0).toLocaleString()}</p>
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Failed</p>
                <p className="text-sm font-bold text-red-300">{(status.aggregate.failed || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className={status.running ? "text-primary font-bold" : "text-foreground font-bold"}>
                {status.running ? "Running" : "Idle"}
              </span>
              <span>•</span>
              <span>Mode: {status.mode === "incremental" ? "Missing Only" : "Full Reindex"}</span>
              <span>•</span>
              <span>Active Source: {status.activeSourceLabel || "None"}</span>
            </div>

            <div className="space-y-2">
              {(status.sources || []).map((source) => (
                <div key={source.key} className="rounded-xl border border-border bg-background px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-foreground">{source.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {source.processed.toLocaleString()} / {source.totalDocuments.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Indexed {source.indexed.toLocaleString()} • Failed {source.failed.toLocaleString()} • {status.mode === "incremental"
                      ? `Cursor ${(source.nextCursorId || 0).toLocaleString()}`
                      : `Next offset ${source.nextOffset.toLocaleString()}`}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatsSection() {
  const { data: stats, isLoading } = useQuery<SystemStats>({ queryKey: ["/api/admin/stats"] });
  const { data: costData, isLoading: costLoading } = useQuery<CostAnalytics>({ queryKey: ["/api/admin/cost-analytics"] });
  const { data: seoStatus, isLoading: seoLoading } = useQuery<SeoStatus>({
    queryKey: ["/api/admin/seo/status"],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  const statItems = [
    { label: "Total Users", value: stats?.totalUsers || 0, icon: Users, color: "text-blue-400" },
    { label: "Chat Threads", value: stats?.totalThreads || 0, icon: FileText, color: "text-emerald-400" },
    { label: "Messages", value: stats?.totalMessages || 0, icon: BarChart3, color: "text-primary" },
    { label: "Documents", value: stats?.totalDocuments || 0, icon: Database, color: "text-primary" },
    { label: "Knowledge Entries", value: stats?.totalKnowledge || 0, icon: Database, color: "text-cyan-400" },
    { label: "Cache Entries", value: stats?.totalCacheEntries || 0, icon: BarChart3, color: "text-pink-400" },
    { label: "Usage This Month", value: stats?.totalUsageThisMonth || 0, icon: BarChart3, color: "text-orange-400" },
  ];

  return (
    <div className="space-y-8">
      <GlobalRagIndexCard />
      <CaseLawBadIndexAuditCard />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
        {statItems.map((item) => (
          <Card key={item.label} className="bg-card border-border rounded-[2rem]">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <item.icon size={16} className={item.color} />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  {item.label}
                </span>
              </div>
              <p className="text-3xl font-bold text-foreground tracking-tight" data-testid={`stat-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                {item.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div data-testid="seo-status-section">
        <div className="flex items-center gap-3 mb-4">
          <Globe size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            SEO Readiness
          </span>
        </div>
        {seoLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={20} />
          </div>
        ) : (
          <Card className="bg-card border-border rounded-[2rem]">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {(seoStatus?.healthyChecks || 0).toLocaleString()} / {(seoStatus?.totalChecks || 0).toLocaleString()} checks passed
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">{seoStatus?.siteBase || "N/A"}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={seoStatus?.urls.robots || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground hover:border-primary hover:text-primary"
                  >
                    robots.txt <ExternalLink size={11} />
                  </a>
                  <a
                    href={seoStatus?.urls.sitemap || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground hover:border-primary hover:text-primary"
                  >
                    sitemap.xml <ExternalLink size={11} />
                  </a>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(seoStatus?.checks || []).map((check) => (
                  <div key={check.key} className="rounded-xl border border-border bg-background px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[11px] font-bold text-foreground">{check.label}</span>
                      <Badge className={check.ok ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}>
                        {check.ok ? "Pass" : "Fix"}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{check.detail}</p>
                  </div>
                ))}
              </div>

              {seoStatus?.recommendations && seoStatus.recommendations.length > 0 && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest font-black text-red-300 mb-1">
                    Needs Attention
                  </p>
                  <p className="text-[11px] text-red-100 leading-relaxed">
                    {seoStatus.recommendations.join(" • ")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div data-testid="cost-analytics-section">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Cost Analytics (This Month)
          </span>
        </div>

        {costLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-primary" size={20} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="bg-card border-border rounded-[2rem]">
                <CardContent className="p-6">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground block mb-2">
                    Est. Total Cost
                  </span>
                  <p className="text-2xl font-bold text-emerald-400" data-testid="text-total-cost">
                    ${costData?.totalCost || "0.0000"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border rounded-[2rem]">
                <CardContent className="p-6">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground block mb-2">
                    Total Tokens
                  </span>
                  <p className="text-2xl font-bold text-blue-400" data-testid="text-total-tokens">
                    {(costData?.totalTokens || 0).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-card border-border rounded-[2rem]">
                <CardContent className="p-6">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground block mb-2">
                    Active Features
                  </span>
                  <p className="text-2xl font-bold text-primary">
                    {costData?.byFeature?.length || 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {costData?.byFeature && costData.byFeature.length > 0 && (
              <Card className="bg-card border-border rounded-[2rem]">
                <CardContent className="p-6">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground block mb-4">
                    Cost Breakdown by Feature
                  </span>
                  <div className="space-y-3">
                    {costData.byFeature.map((f) => {
                      const costPercent = costData.totalCost !== "0.0000"
                        ? Math.round((parseFloat(f.totalCost) / parseFloat(costData.totalCost)) * 100)
                        : 0;
                      return (
                        <div key={f.feature} className="space-y-1" data-testid={`cost-feature-${f.feature}`}>
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <span className="text-xs font-bold text-foreground">
                              {FEATURE_LABELS[f.feature] || f.feature}
                            </span>
                            <div className="flex items-center gap-4 flex-wrap">
                              <span className="text-[10px] text-muted-foreground">
                                {f.totalQueries} queries
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {(f.totalInputTokens + f.totalOutputTokens).toLocaleString()} tokens
                              </span>
                              <span className="text-xs font-bold text-emerald-400">
                                ${f.totalCost}
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-card rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${Math.max(costPercent, 2)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function UsersSection() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allUsers, isLoading } = useQuery<AdminUser[]>({ queryKey: ["/api/admin/users"] });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newTier, setNewTier] = useState("free");
  const [newCycle, setNewCycle] = useState<"monthly" | "quarterly" | "yearly">("monthly");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [banReasons, setBanReasons] = useState<Record<string, string>>({});
  const [isExportingUsersCsv, setIsExportingUsersCsv] = useState(false);

  const addUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/users", {
        email: newEmail,
        password: newPassword,
        firstName: newFirstName,
        lastName: newLastName,
        subscriptionTier: newTier,
        subscriptionCycle: newCycle,
        isAdmin: newIsAdmin,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      setShowAddForm(false);
      setNewEmail("");
      setNewPassword("");
      setNewFirstName("");
      setNewLastName("");
      setNewTier("free");
      setNewCycle("monthly");
      setNewIsAdmin(false);
      toast({ title: "User created successfully" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to create user", variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      toast({ title: "User updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update user", variant: "destructive" });
    },
  });

  const resetQuotaMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/reset-monthly-quota`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      const deleted = Number(data?.deleted || 0);
      toast({ title: `Monthly quota reset${deleted > 0 ? ` (${deleted} actions cleared)` : ""}` });
    },
    onError: () => {
      toast({ title: "Failed to reset monthly quota", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      const text = await res.text();
      if (!text) return null;
      try {
        return JSON.parse(text);
      } catch {
        return { message: text };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      setConfirmDeleteId(null);
      toast({ title: "User removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove user", variant: "destructive" });
    },
  });

  const suspendUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/ban`, { reason: reason || "" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      toast({ title: "User account suspended" });
    },
    onError: () => {
      toast({ title: "Failed to suspend user", variant: "destructive" });
    },
  });

  const reactivateUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}/ban`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      toast({ title: "User account reactivated" });
    },
    onError: () => {
      toast({ title: "Failed to reactivate user", variant: "destructive" });
    },
  });

  const csvField = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, "\"\"").replace(/\r?\n/g, " ")}"`;
  };

  const exportUsersCsv = () => {
    try {
      setIsExportingUsersCsv(true);
      const users = allUsers || [];
      if (users.length === 0) {
        toast({ title: "No users to export" });
        return;
      }

      const headers = [
        "user_id",
        "email",
        "first_name",
        "last_name",
        "subscription_tier",
        "subscription_cycle",
        "subscription_start_at",
        "subscription_end_at",
        "is_admin",
        "is_banned",
        "ban_reason",
        "banned_at",
        "created_at",
        "updated_at",
      ];

      const rows = users.map((u) => [
        u.id,
        u.email || "",
        u.firstName || "",
        u.lastName || "",
        u.subscriptionTier || "",
        u.subscriptionCycle || "monthly",
        u.subscriptionStartAt || "",
        u.subscriptionEndAt || "",
        u.isAdmin ? "yes" : "no",
        u.isBanned ? "yes" : "no",
        u.banReason || "",
        u.bannedAt || "",
        u.createdAt || "",
        u.updatedAt || "",
      ]);

      const csv = "\uFEFF" + [headers.map(csvField).join(","), ...rows.map((row) => row.map(csvField).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = objectUrl;
      link.download = `users-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      toast({ title: `CSV downloaded (${users.length} users)` });
    } catch {
      toast({ title: "Failed to download users CSV", variant: "destructive" });
    } finally {
      setIsExportingUsersCsv(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="users-section">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <Users size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            {allUsers?.length || 0} Registered Users
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={exportUsersCsv}
            disabled={isExportingUsersCsv}
            className="bg-primary text-slate-950 hover:bg-primary rounded-xl text-[10px] uppercase tracking-widest font-black"
            data-testid="button-export-users-csv"
          >
            {isExportingUsersCsv ? <Loader2 size={12} className="animate-spin mr-1" /> : <Download size={12} className="mr-1" />}
            <span>{isExportingUsersCsv ? "Exporting..." : "Download CSV"}</span>
          </Button>
          <Button
            variant={showAddForm ? "ghost" : "default"}
            className={`rounded-xl text-[10px] uppercase tracking-widest font-black ${showAddForm ? "text-muted-foreground" : "bg-primary text-slate-950"}`}
            onClick={() => setShowAddForm(!showAddForm)}
            data-testid="button-toggle-add-user"
          >
            <Plus size={14} />
            <span>{showAddForm ? "Cancel" : "Add User"}</span>
          </Button>
        </div>
      </div>

      {showAddForm && (
        <Card className="bg-card border-border rounded-[2rem]" data-testid="add-user-form">
          <CardContent className="p-6 space-y-4">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground block">
              Create New User
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="First name"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-sm"
                data-testid="input-new-firstname"
              />
              <Input
                placeholder="Last name"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-sm"
                data-testid="input-new-lastname"
              />
            </div>
            <Input
              placeholder="Email address"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-sm"
              data-testid="input-new-email"
            />
            <Input
              placeholder="Password (min 8 characters)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-sm"
              data-testid="input-new-password"
            />
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={newTier} onValueChange={setNewTier}>
                <SelectTrigger className="w-40 bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs" data-testid="select-new-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="chamber">Chamber</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
              <Select value={newCycle} onValueChange={(val: "monthly" | "quarterly" | "yearly") => setNewCycle(val)}>
                <SelectTrigger className="w-44 bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs" data-testid="select-new-cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">3 Months</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                className={`rounded-xl text-[10px] uppercase tracking-widest font-black ${newIsAdmin ? "text-primary" : "text-muted-foreground"}`}
                onClick={() => setNewIsAdmin(!newIsAdmin)}
                data-testid="button-new-admin-toggle"
              >
                {newIsAdmin ? <UserCheck size={14} /> : <UserX size={14} />}
                <span>{newIsAdmin ? "Admin" : "Regular User"}</span>
              </Button>
            </div>
            <Button
              onClick={() => addUserMutation.mutate()}
              disabled={addUserMutation.isPending || !newEmail || !newPassword || !newFirstName || !newLastName}
              className="bg-primary text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
              data-testid="button-create-user"
            >
              {addUserMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>{addUserMutation.isPending ? "Creating..." : "Create User"}</span>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {allUsers?.map((u) => (
          <Card key={u.id} className="bg-card border-border rounded-[1.5rem]" data-testid={`user-row-${u.id}`}>
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {u.profileImageUrl ? (
                    <img src={u.profileImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users size={16} className="text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate" data-testid={`text-user-name-${u.id}`}>
                    {u.firstName || u.email || "Unknown"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {u.isAdmin && (
                  <Badge className="bg-primary/20 text-primary border-primary/30 rounded-lg text-[9px]">
                    ADMIN
                  </Badge>
                )}
                {u.isBanned && (
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30 rounded-lg text-[9px]">
                    SUSPENDED
                  </Badge>
                )}
                <span className="text-[10px] text-muted-foreground">
                  Cycle: {String(u.subscriptionCycle || "monthly").toLowerCase() === "yearly"
                    ? "Yearly"
                    : String(u.subscriptionCycle || "monthly").toLowerCase() === "quarterly"
                      ? "3 Months"
                      : "Monthly"}
                  {u.subscriptionEndAt
                    ? ` · Ends ${new Date(String(u.subscriptionEndAt)).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}`
                    : ""}
                </span>

                <Select
                  value={u.subscriptionTier}
                  onValueChange={(val) => updateUserMutation.mutate({ userId: u.id, data: { subscriptionTier: val, resetMonthlyQuota: true } })}
                >
                  <SelectTrigger className="w-32 bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs" data-testid={`select-tier-${u.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="chamber">Chamber</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={(u.subscriptionCycle as "monthly" | "quarterly" | "yearly" | undefined) || "monthly"}
                  onValueChange={(val) => updateUserMutation.mutate({ userId: u.id, data: { subscriptionCycle: val } })}
                >
                  <SelectTrigger className="w-32 bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs" data-testid={`select-cycle-${u.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">3 Months</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  variant="ghost"
                  className="text-sky-300 text-[9px] uppercase tracking-widest font-black"
                  onClick={() => resetQuotaMutation.mutate(u.id)}
                  disabled={resetQuotaMutation.isPending}
                  data-testid={`button-reset-quota-${u.id}`}
                >
                  {resetQuotaMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  <span>Reset Quota</span>
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => updateUserMutation.mutate({ userId: u.id, data: { isAdmin: !u.isAdmin } })}
                  disabled={u.isAdmin && u.id === currentUser?.id}
                  title={u.isAdmin && u.id === currentUser?.id ? "You cannot remove your own admin access" : u.isAdmin ? "Remove admin access" : "Grant admin access"}
                  data-testid={`button-toggle-admin-${u.id}`}
                  className={u.isAdmin ? "text-primary" : "text-muted-foreground"}
                >
                  {u.isAdmin ? <UserCheck size={16} /> : <UserX size={16} />}
                </Button>

                {u.id !== currentUser?.id && (
                  u.isBanned ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-emerald-300 text-[9px] uppercase tracking-widest font-black"
                      onClick={() => reactivateUserMutation.mutate(u.id)}
                      disabled={reactivateUserMutation.isPending}
                      data-testid={`button-reactivate-user-${u.id}`}
                    >
                      <Check size={12} />
                      <span>Reactivate</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-300 text-[9px] uppercase tracking-widest font-black"
                      onClick={() => {
                        const reason = (banReasons[u.id] || "").trim();
                        suspendUserMutation.mutate({ userId: u.id, reason });
                      }}
                      disabled={suspendUserMutation.isPending}
                      data-testid={`button-suspend-user-${u.id}`}
                    >
                      <AlertTriangle size={12} />
                      <span>Suspend</span>
                    </Button>
                  )
                )}

                {u.id !== currentUser?.id && (
                  confirmDeleteId === u.id ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 text-[10px] uppercase tracking-widest font-black"
                        onClick={() => deleteUserMutation.mutate(u.id)}
                        disabled={deleteUserMutation.isPending}
                        data-testid={`button-confirm-delete-${u.id}`}
                      >
                        {deleteUserMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <AlertTriangle size={14} />}
                        <span>Confirm</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground text-[10px] uppercase tracking-widest font-black"
                        onClick={() => setConfirmDeleteId(null)}
                        data-testid={`button-cancel-delete-${u.id}`}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => setConfirmDeleteId(u.id)}
                      title="Remove user"
                      data-testid={`button-delete-user-${u.id}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  )
                )}
              </div>
              {!u.isBanned && u.id !== currentUser?.id && (
                <div className="w-full">
                  <Input
                    placeholder="Suspension reason (optional)"
                    value={banReasons[u.id] || ""}
                    onChange={(e) => setBanReasons((prev) => ({ ...prev, [u.id]: e.target.value }))}
                    className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs"
                    data-testid={`input-ban-reason-${u.id}`}
                  />
                </div>
              )}
              {u.isBanned && (
                <div className="w-full">
                  <p className="text-[10px] text-red-300">
                    Reason: {u.banReason || "No reason provided"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AuditLogsSection() {
  const { data: logs, isLoading } = useQuery<AdminAuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/audit-logs?limit=250");
      return res.json();
    },
  });
  const { data: securityEvents, isLoading: securityLoading } = useQuery<SecurityEventSnapshot[]>({
    queryKey: ["/api/admin/security-events"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/security-events?limit=100");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="audit-logs-section">
      <div className="flex items-center gap-3">
        <Shield size={16} className="text-primary" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
          Audit Events ({logs?.length || 0})
        </span>
      </div>

      {!logs || logs.length === 0 ? (
        <Card className="bg-card border-border rounded-[2rem]">
          <CardContent className="p-12 text-center">
            <Shield size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No audit events yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className="bg-card border-border rounded-[1.5rem]" data-testid={`audit-log-${log.id}`}>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <Badge className="bg-card text-foreground border-border rounded-lg text-[9px]">
                    {log.action}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px] text-foreground flex flex-wrap gap-3">
                  <span>Actor: {log.actorUserId || "system"}</span>
                  <span>Target: {log.targetUserId || "-"}</span>
                </div>
                {log.metadata && (
                  <pre className="text-[10px] text-muted-foreground bg-background border border-border rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-border">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Security Event Stream ({securityEvents?.length || 0})
          </span>
        </div>

        {securityLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-primary" size={20} />
          </div>
        ) : !securityEvents || securityEvents.length === 0 ? (
          <Card className="bg-card border-border rounded-[1.5rem]">
            <CardContent className="p-6 text-center text-muted-foreground text-sm">
              No recent security alerts.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {securityEvents.map((event) => (
              <Card key={`security-event-${event.id}-${event.lastSeenAt}`} className="bg-card border-border rounded-[1.2rem]">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 rounded-lg text-[9px]">
                      {event.type}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">Count: {event.count}</span>
                  </div>
                  <p className="text-[11px] text-foreground break-all">Key: {event.key}</p>
                  <p className="text-[10px] text-muted-foreground">
                    First: {new Date(event.firstSeenAt).toLocaleString()} | Last: {new Date(event.lastSeenAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgeSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: docsPage, isLoading } = useQuery<PagedResponse<AdminKnowledgeDoc>>({
    queryKey: ["/api/admin/knowledge", page, ADMIN_PAGE_SIZE],
    queryFn: async () => {
      const offset = (page - 1) * ADMIN_PAGE_SIZE;
      const res = await fetch(`/api/admin/knowledge?limit=${ADMIN_PAGE_SIZE}&offset=${offset}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch knowledge documents");
      }
      return res.json();
    },
  });
  const docs = docsPage?.items || [];
  const totalDocs = docsPage?.total || 0;
  const [uploadCategory, setUploadCategory] = useState("general");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  useEffect(() => {
    if (page > 1 && docs.length === 0 && totalDocs > 0) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [page, docs.length, totalDocs]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/knowledge/${id}`);
    },
    onSuccess: () => {
      if (page > 1 && docs.length === 1) {
        setPage((p) => Math.max(1, p - 1));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] });
      toast({ title: "Document removed from vault" });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/admin/knowledge");
      return res.json();
    },
    onSuccess: (data: any) => {
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] });
      toast({ title: `${data.deleted} document${data.deleted !== 1 ? "s" : ""} deleted` });
      setShowDeleteAllConfirm(false);
    },
    onError: () => {
      toast({ title: "Failed to delete all documents", variant: "destructive" });
      setShowDeleteAllConfirm(false);
    },
  });

  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, uploaded: 0, errors: 0 });

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      toast({ title: "Please select files to upload", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const BATCH_SIZE = 25;
    const totalFiles = selectedFiles.length;
    let totalUploaded = 0;
    let totalErrors = 0;
    const allErrors: string[] = [];

    setUploadProgress({ current: 0, total: totalFiles, uploaded: 0, errors: 0 });

    try {
      for (let i = 0; i < totalFiles; i += BATCH_SIZE) {
        const batch = selectedFiles.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        setUploadProgress({ current: i + batch.length, total: totalFiles, uploaded: totalUploaded, errors: totalErrors });

        const formData = new FormData();
        formData.append("category", uploadCategory);
        for (const file of batch) {
          formData.append("files", file);
        }

        try {
          const res = await fetch("/api/admin/knowledge", {
            method: "POST",
            credentials: "include",
            body: formData,
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({ message: "Upload failed" }));
            totalErrors += batch.length;
            allErrors.push(`Batch ${batchNum}: ${errData.message || "Upload failed"}`);
            continue;
          }

          const data = await res.json();
          totalUploaded += data.uploaded || 0;
          if (data.errors?.length) {
            totalErrors += data.errors.length;
            allErrors.push(...data.errors);
          }
        } catch {
          totalErrors += batch.length;
          allErrors.push(`Batch ${batchNum}: Network error`);
        }
      }

      setUploadProgress({ current: totalFiles, total: totalFiles, uploaded: totalUploaded, errors: totalErrors });
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] });
      setSelectedFiles([]);
      const fileInput = document.querySelector('[data-testid="input-knowledge-files"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      let msg = `${totalUploaded} document${totalUploaded !== 1 ? "s" : ""} added to vault`;
      if (totalErrors > 0) {
        msg += ` (${totalErrors} skipped)`;
      }
      toast({ title: msg });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0, uploaded: 0, errors: 0 });
    }
  }

  return (
    <div className="space-y-8" data-testid="knowledge-section">
      <Card className="bg-card border-border rounded-[2rem]">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Upload size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Mass Upload to Knowledge Vault
          </span>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <Select value={uploadCategory} onValueChange={setUploadCategory}>
            <SelectTrigger className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs" data-testid="select-knowledge-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="statute">Statute</SelectItem>
              <SelectItem value="case-law">Case Law</SelectItem>
              <SelectItem value="precedent">Precedent</SelectItem>
              <SelectItem value="procedure">Procedure</SelectItem>
            </SelectContent>
          </Select>

          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground block">
              Select Files (.txt, .json, .csv, .pdf, .docx — select multiple)
            </label>
            <Input
              type="file"
              accept=".txt,.json,.csv,.pdf,.doc,.docx"
              multiple
              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
              className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs file:text-muted-foreground file:mr-4"
              data-testid="input-knowledge-files"
            />
            {selectedFiles.length > 0 && (
              <p className="text-[10px] text-primary font-bold">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {isUploading && uploadProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Uploading {uploadProgress.current} of {uploadProgress.total} files...</span>
                <span className="text-primary font-bold">{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-card rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
              </div>
              {uploadProgress.uploaded > 0 && (
                <p className="text-[9px] text-emerald-400">{uploadProgress.uploaded} uploaded{uploadProgress.errors > 0 ? `, ${uploadProgress.errors} failed` : ""}</p>
              )}
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="bg-primary text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
            data-testid="button-upload-knowledge"
          >
            {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            <span>{isUploading ? "Uploading..." : selectedFiles.length > 1 ? `Upload ${selectedFiles.length} Files` : "Add to Vault"}</span>
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Database size={16} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              Vault Documents ({totalDocs})
            </span>
          </div>
          {totalDocs > 0 && !showDeleteAllConfirm && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[9px] font-bold uppercase tracking-widest gap-1.5"
              onClick={() => setShowDeleteAllConfirm(true)}
            >
              <Trash2 size={12} /> Delete All
            </Button>
          )}
          {showDeleteAllConfirm && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertOctagon size={14} className="text-red-400 flex-shrink-0" />
              <span className="text-[10px] text-red-300 font-bold">Delete all {totalDocs} documents?</span>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-foreground text-[9px] font-bold h-7 px-3 rounded-lg"
                onClick={() => deleteAllMutation.mutate()}
                disabled={deleteAllMutation.isPending}
              >
                {deleteAllMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground text-[9px] h-7 px-2 rounded-lg"
                onClick={() => setShowDeleteAllConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : docs.length === 0 ? (
          <Card className="bg-card border-border rounded-[2rem]">
            <CardContent className="p-12 text-center">
              <Database size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No documents in vault yet</p>
            </CardContent>
          </Card>
        ) : (
          docs.map((doc) => (
            <Card key={doc.id} className="bg-card border-border rounded-[1.5rem]" data-testid={`knowledge-doc-${doc.id}`}>
              <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <FileText size={18} className="text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-card text-muted-foreground border-border rounded-lg text-[8px]">
                        {doc.category}
                      </Badge>
                      <span className="text-[9px] text-slate-600">{doc.filename}</span>
                      <span className="text-[9px] text-slate-600">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => deleteMutation.mutate(doc.id)}
                  data-testid={`button-delete-knowledge-${doc.id}`}
                >
                  <Trash2 size={14} />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
        <PaginationStrip page={page} total={totalDocs} pageSize={ADMIN_PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}

type CaseLawEntry = {
  id: number;
  citation: string;
  court: string;
  title: string;
  summary: string;
  keywords: string[];
};

type CaseLawBadIndexSourceKind = "admin" | "github" | "statute" | "user" | "all";

type CaseLawBadIndexTarget = {
  sourceType: "admin" | "github" | "statute" | "user";
  sourceDocId: number;
  sourceFilename: string;
  totalRows: number;
  primaryRows: number;
  citedRows: number;
  uniqueKeys: number;
  duplicateRows: number;
};

type CaseLawBadIndexDuplicateStats = {
  totalRows: number;
  duplicateGroups: number;
  duplicateRows: number;
};

type CaseLawBadIndexReextractStatus = {
  running: boolean;
  shouldStop: boolean;
  sourceKind: CaseLawBadIndexSourceKind;
  minRows: number;
  limit: number;
  maxCitations: number;
  totalTargets: number;
  processedTargets: number;
  reindexedTargets: number;
  skippedNoSource: number;
  skippedNoExtract: number;
  replacedRows: number;
  insertedRows: number;
  activeTarget: {
    sourceType: "admin" | "github" | "statute" | "user";
    sourceDocId: number;
    sourceFilename: string;
  } | null;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
};

type CaseLawSyncToJudgmentsStatus = {
  running: boolean;
  shouldStop: boolean;
  batchSize: number;
  nextCursorId: number | null;
  processed: number;
  imported: number;
  existing: number;
  skipped: number;
  failed: number;
  linked: number;
  unresolved: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  activeRange: { fromId: number; toId: number } | null;
  errors: string[];
};

type CaseLawProcessPendingFilesStatus = {
  running: boolean;
  shouldStop: boolean;
  batchSize: number;
  loops: number;
  processed: number;
  extractedDocuments: number;
  insertedRows: number;
  failed: number;
  skippedNoText: number;
  skippedNoCases: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  activeDocId: number | null;
  activeFilename: string | null;
  errors: string[];
};

type CaseLawProcessPendingDiagnosticsStatusCount = {
  status: string;
  documents: number;
  noExtractDocuments: number;
  extractedDocuments: number;
};

type CaseLawProcessPendingDiagnosticsTopError = {
  error: string;
  documents: number;
};

type CaseLawProcessPendingDiagnosticsResponse = {
  ok: boolean;
  generatedAt: string;
  staleProcessingMinutes: number;
  maxAttempts: number;
  summary: {
    totalDocs: number;
    extractedDocs: number;
    pendingLegacy: number;
    actionablePending: number;
    processingFresh: number;
    maxAttemptsReached: number;
    terminalNoExtract: number;
  };
  statusCounts: CaseLawProcessPendingDiagnosticsStatusCount[];
  topErrors: CaseLawProcessPendingDiagnosticsTopError[];
};

type CaseLawBadIndexAuditResponse = {
  ok: boolean;
  sourceKind: CaseLawBadIndexSourceKind;
  minRows: number;
  limit: number;
  generatedAt: string;
  duplicateStats: CaseLawBadIndexDuplicateStats;
  targets: CaseLawBadIndexTarget[];
  jobStatus: CaseLawBadIndexReextractStatus;
};

function CaseLawBadIndexAuditCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [badIndexSource, setBadIndexSource] = useState<CaseLawBadIndexSourceKind>("admin");
  const [badIndexMinRows, setBadIndexMinRows] = useState("20");
  const [badIndexLimit, setBadIndexLimit] = useState("100");
  const [badIndexMaxCitations, setBadIndexMaxCitations] = useState("40");

  const parsedBadIndexMinRows = Math.max(5, Math.min(5000, Number(badIndexMinRows) || 20));
  const parsedBadIndexLimit = Math.max(1, Math.min(1000, Number(badIndexLimit) || 100));
  const parsedBadIndexMaxCitations = Math.max(1, Math.min(200, Number(badIndexMaxCitations) || 40));

  const { data: badIndexAuditData, isLoading: badIndexAuditLoading, refetch: refetchBadIndexAudit } = useQuery<CaseLawBadIndexAuditResponse>({
    queryKey: ["/api/admin/case-law/bad-index/audit", badIndexSource, parsedBadIndexMinRows, parsedBadIndexLimit],
    queryFn: async () => {
      const params = new URLSearchParams({
        source: badIndexSource,
        minRows: String(parsedBadIndexMinRows),
        limit: String(parsedBadIndexLimit),
      });
      const res = await fetch(`/api/admin/case-law/bad-index/audit?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load bad-index audit");
      }
      return res.json();
    },
  });

  const { data: badIndexStatusData } = useQuery<{ ok: boolean; status: CaseLawBadIndexReextractStatus }>({
    queryKey: ["/api/admin/case-law/bad-index/reextract/status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/case-law/bad-index/reextract/status", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to load bad-index re-extract status");
      }
      return res.json();
    },
    refetchInterval: (query) => {
      const payload = query.state.data as { ok: boolean; status: CaseLawBadIndexReextractStatus } | undefined;
      return payload?.status?.running ? 2500 : 12000;
    },
  });

  const startBadIndexReextractMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/case-law/bad-index/reextract/start", {
        source: badIndexSource,
        minRows: parsedBadIndexMinRows,
        limit: parsedBadIndexLimit,
        maxCitations: parsedBadIndexMaxCitations,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data?.message || "Targeted bad-index re-extract started" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law/bad-index/reextract/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law/bad-index/audit"] });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to start targeted re-extract", variant: "destructive" });
    },
  });

  const stopBadIndexReextractMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/case-law/bad-index/reextract/stop", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data?.message || "Stop requested" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law/bad-index/reextract/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law/bad-index/audit"] });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to stop targeted re-extract", variant: "destructive" });
    },
  });

  const badIndexJobStatus = badIndexStatusData?.status || badIndexAuditData?.jobStatus || null;

  return (
    <Card className="bg-card border-border rounded-[2rem]" data-testid="case-law-bad-index-audit-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Bad Index Audit</p>
            <p className="text-xs text-muted-foreground mt-1">
              Detect duplicate/noisy source docs and run targeted re-extract without full reindex.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-primary rounded-xl text-[10px] uppercase tracking-widest font-black"
              onClick={() => refetchBadIndexAudit()}
              disabled={badIndexAuditLoading}
              data-testid="button-refresh-bad-index-audit"
            >
              {badIndexAuditLoading ? <Loader2 className="animate-spin" size={12} /> : <RotateCcw size={12} />}
              <span>Refresh</span>
            </Button>
            {badIndexJobStatus?.running ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-red-300 border border-red-500/40 rounded-xl text-[10px] uppercase tracking-widest font-black"
                onClick={() => stopBadIndexReextractMutation.mutate()}
                disabled={stopBadIndexReextractMutation.isPending}
                data-testid="button-stop-bad-index-reextract"
              >
                {stopBadIndexReextractMutation.isPending ? <Loader2 className="animate-spin" size={12} /> : <X size={12} />}
                <span>Stop</span>
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-primary text-slate-950 rounded-xl text-[10px] uppercase tracking-widest font-black"
                onClick={() => startBadIndexReextractMutation.mutate()}
                disabled={startBadIndexReextractMutation.isPending}
                data-testid="button-start-bad-index-reextract"
              >
                {startBadIndexReextractMutation.isPending ? <Loader2 className="animate-spin" size={12} /> : <Search size={12} />}
                <span>Run Targeted Re-Extract</span>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-1">Source</p>
            <Select value={badIndexSource} onValueChange={(value: CaseLawBadIndexSourceKind) => setBadIndexSource(value)}>
              <SelectTrigger className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs" data-testid="select-bad-index-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin Knowledge</SelectItem>
                <SelectItem value="github">GitHub</SelectItem>
                <SelectItem value="statute">Statute Docs</SelectItem>
                <SelectItem value="user">User Docs</SelectItem>
                <SelectItem value="all">All Sources</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-1">Min Rows</p>
            <Input
              value={badIndexMinRows}
              onChange={(e) => setBadIndexMinRows(e.target.value)}
              className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs"
              data-testid="input-bad-index-min-rows"
            />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-1">Target Limit</p>
            <Input
              value={badIndexLimit}
              onChange={(e) => setBadIndexLimit(e.target.value)}
              className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs"
              data-testid="input-bad-index-limit"
            />
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground mb-1">Max Citations/Doc</p>
            <Input
              value={badIndexMaxCitations}
              onChange={(e) => setBadIndexMaxCitations(e.target.value)}
              className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs"
              data-testid="input-bad-index-max-citations"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Total Rows</p>
            <p className="text-sm font-bold text-foreground">{(badIndexAuditData?.duplicateStats?.totalRows || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Duplicate Groups</p>
            <p className="text-sm font-bold text-primary">{(badIndexAuditData?.duplicateStats?.duplicateGroups || 0).toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className="text-[9px] uppercase tracking-widest font-black text-muted-foreground">Duplicate Rows</p>
            <p className="text-sm font-bold text-red-300">{(badIndexAuditData?.duplicateStats?.duplicateRows || 0).toLocaleString()}</p>
          </div>
        </div>

        {badIndexJobStatus && (
          <div className="rounded-xl border border-border bg-background px-3 py-2 text-[11px] text-foreground">
            <p className="font-bold text-foreground">
              Job: {badIndexJobStatus.running ? "Running" : "Idle"} · {badIndexJobStatus.processedTargets}/{badIndexJobStatus.totalTargets} processed
            </p>
            <p className="text-muted-foreground mt-1">
              Reindexed {badIndexJobStatus.reindexedTargets} · Skipped(no source) {badIndexJobStatus.skippedNoSource} · Skipped(no extract) {badIndexJobStatus.skippedNoExtract}
            </p>
            <p className="text-muted-foreground">
              Replaced rows {badIndexJobStatus.replacedRows.toLocaleString()} · Inserted rows {badIndexJobStatus.insertedRows.toLocaleString()}
            </p>
            {badIndexJobStatus.activeTarget && (
              <p className="text-primary mt-1">
                Active: {badIndexJobStatus.activeTarget.sourceType}:{badIndexJobStatus.activeTarget.sourceDocId} · {badIndexJobStatus.activeTarget.sourceFilename || "Untitled"}
              </p>
            )}
            {badIndexJobStatus.lastError && (
              <p className="text-red-300 mt-1">Last error: {badIndexJobStatus.lastError}</p>
            )}
          </div>
        )}

        {badIndexAuditLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="animate-spin" size={14} />
            <span>Loading bad-index targets...</span>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(badIndexAuditData?.targets || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No problematic source documents found for current filters.</p>
            ) : (
              (badIndexAuditData?.targets || []).map((target, idx) => (
                <div key={`${target.sourceType}-${target.sourceDocId}-${idx}`} className="rounded-xl border border-border bg-background px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-foreground">
                      {target.sourceType}:{target.sourceDocId}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      dup {target.duplicateRows} · rows {target.totalRows}
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-1">{target.sourceFilename || "Unnamed source"}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    primary {target.primaryRows} · cited {target.citedRows} · unique {target.uniqueKeys}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CaseLawSection() {
  const CASELAW_EXTRACT_TIMEOUT_MS = 180000;
  const CASELAW_EXTRACT_MAX_RETRIES = 2;
  const CASELAW_CLIENT_EXTRACT_MAX_BYTES = 8 * 1024 * 1024;
  const CASELAW_CLIENT_PARALLEL_BATCH = 2;
  const CASELAW_SAVE_BULK_BATCH = 120;
  const CASELAW_PDF_FAST_PATH_ENABLED = String(import.meta.env.VITE_CASELAW_PDF_FAST_PATH || "true").toLowerCase() !== "false";
  const CASELAW_PDF_FAST_PATH_MAX_PAGES = Math.max(1, Number(import.meta.env.VITE_CASELAW_PDF_FAST_PATH_MAX_PAGES || 20));
  const CASELAW_CLIENT_MIN_CONFIDENCE = Math.max(0, Number(import.meta.env.VITE_CASELAW_CLIENT_MIN_CONFIDENCE || 0.45));
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: caseLawPage, isLoading } = useQuery<PagedResponse<CaseLawEntry>>({
    queryKey: ["/api/admin/case-law", page, ADMIN_PAGE_SIZE],
    queryFn: async () => {
      const offset = (page - 1) * ADMIN_PAGE_SIZE;
      const res = await fetch(`/api/admin/case-law?limit=${ADMIN_PAGE_SIZE}&offset=${offset}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch case law entries");
      }
      return res.json();
    },
  });
  const caseLawEntries = caseLawPage?.items || [];
  const totalCaseLawEntries = caseLawPage?.total || 0;
  const { data: syncCitationStatusData } = useQuery<{ ok: boolean; status: CaseLawSyncToJudgmentsStatus }>({
    queryKey: ["/api/admin/case-law/sync-to-judgments/status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/case-law/sync-to-judgments/status", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch citation sync status");
      }
      return res.json();
    },
    refetchInterval: (query) => {
      const payload = query.state.data as { ok: boolean; status: CaseLawSyncToJudgmentsStatus } | undefined;
      return payload?.status?.running ? 2500 : 12000;
    },
  });
  const { data: processPendingStatusData } = useQuery<{ ok: boolean; status: CaseLawProcessPendingFilesStatus }>({
    queryKey: ["/api/admin/case-law/process-pending-files/status"],
    queryFn: async () => {
      const res = await fetch("/api/admin/case-law/process-pending-files/status", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch process-pending status");
      }
      return res.json();
    },
    refetchInterval: (query) => {
      const payload = query.state.data as { ok: boolean; status: CaseLawProcessPendingFilesStatus } | undefined;
      return payload?.status?.running ? 2500 : 12000;
    },
  });
  const { data: processPendingDiagnosticsData, isLoading: processPendingDiagnosticsLoading } = useQuery<CaseLawProcessPendingDiagnosticsResponse>({
    queryKey: ["/api/admin/case-law/process-pending-files/diagnostics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/case-law/process-pending-files/diagnostics", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch process-pending diagnostics");
      }
      return res.json();
    },
    refetchInterval: (query) => {
      const statusPayload = queryClient.getQueryData<{ ok: boolean; status: CaseLawProcessPendingFilesStatus }>([
        "/api/admin/case-law/process-pending-files/status",
      ]);
      if (statusPayload?.status?.running) return 3000;
      const payload = query.state.data as CaseLawProcessPendingDiagnosticsResponse | undefined;
      return payload ? 12000 : 5000;
    },
  });
  const syncCitationStatus = syncCitationStatusData?.status;
  const processPendingStatus = processPendingStatusData?.status;
  const processPendingDiagnostics = processPendingDiagnosticsData || null;
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [extractedCases, setExtractedCases] = useState<Array<{ citation: string; court: string; title: string; summary: string; keywords: string[]; _sourceDocId?: number; _sourceFilename?: string; _alreadySaved?: boolean }>>([]);
  const [autoSaveFailed, setAutoSaveFailed] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0, currentFile: "" });
  const [retryExtractFiles, setRetryExtractFiles] = useState<File[]>([]);
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [formData, setFormData] = useState({ citation: "", court: "", title: "", summary: "", keywords: "" });
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  useEffect(() => {
    if (page > 1 && caseLawEntries.length === 0 && totalCaseLawEntries > 0) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [page, caseLawEntries.length, totalCaseLawEntries]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await apiRequest("POST", "/api/admin/case-law", {
        ...data,
        keywords: data.keywords.split(",").map(k => k.trim()).filter(Boolean),
      });
    },
    onSuccess: () => {
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] });
      toast({ title: "Case law entry added" });
      setFormData({ citation: "", court: "", title: "", summary: "", keywords: "" });
      setShowAddForm(false);
    },
    onError: () => toast({ title: "Failed to add case law", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      await apiRequest("PUT", `/api/admin/case-law/${id}`, {
        ...data,
        keywords: data.keywords.split(",").map(k => k.trim()).filter(Boolean),
      });
    },
    onSuccess: () => {
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] });
      toast({ title: "Case law entry updated" });
      setEditingId(null);
      setFormData({ citation: "", court: "", title: "", summary: "", keywords: "" });
    },
    onError: () => toast({ title: "Failed to update case law", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/case-law/${id}`);
    },
    onSuccess: () => {
      if (page > 1 && caseLawEntries.length === 1) {
        setPage((p) => Math.max(1, p - 1));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] });
      toast({ title: "Case law entry removed" });
    },
    onError: () => toast({ title: "Failed to delete case law", variant: "destructive" }),
  });

  const deleteAllCaseLawMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/admin/case-law");
      return res.json();
    },
    onSuccess: (data: any) => {
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] });
      toast({ title: `${data.deleted} case law entr${data.deleted !== 1 ? "ies" : "y"} deleted` });
      setShowDeleteAllConfirm(false);
    },
    onError: () => {
      toast({ title: "Failed to delete all case law", variant: "destructive" });
      setShowDeleteAllConfirm(false);
    },
  });

  const saveBulkMutation = useMutation({
    mutationFn: async (entries: typeof extractedCases) => {
      const grouped = new Map<number | "none", typeof entries>();
      for (const e of entries) {
        const key = e._sourceDocId || "none";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(e);
      }
      let totalInserted = 0;
      const allErrors: string[] = [];
      const citationTotals = { processed: 0, imported: 0, existing: 0, skipped: 0, failed: 0 };
      let citationSyncLimited = false;
      for (const [key, group] of grouped) {
        for (let i = 0; i < group.length; i += CASELAW_SAVE_BULK_BATCH) {
          const chunk = group.slice(i, i + CASELAW_SAVE_BULK_BATCH);
          const body: any = { entries: chunk };
          if (key !== "none") {
            body.sourceDocId = key;
            body.sourceFilename = group[0]._sourceFilename || "";
          }
          try {
            const res = await apiRequest("POST", "/api/admin/case-law/bulk", body);
            const data = await res.json();
            totalInserted += data.inserted || 0;
            if (data.errors) allErrors.push(...data.errors);
            if (data.citationSync) {
              citationTotals.processed += Number(data.citationSync.processed || 0);
              citationTotals.imported += Number(data.citationSync.imported || 0);
              citationTotals.existing += Number(data.citationSync.existing || 0);
              citationTotals.skipped += Number(data.citationSync.skipped || 0);
              citationTotals.failed += Number(data.citationSync.failed || 0);
            }
            if (data.citationSyncLimited) citationSyncLimited = true;
          } catch (err: any) {
            allErrors.push(`Batch ${Math.floor(i / CASELAW_SAVE_BULK_BATCH) + 1}: ${err?.message || "save failed"}`);
          }
        }
      }
      if (totalInserted === 0 && allErrors.length > 0) {
        throw new Error(allErrors[0]);
      }
      const hasSource = entries.some((e) => e._sourceDocId);
      return { inserted: totalInserted, errors: allErrors, citationTotals, citationSyncLimited, hasSource };
    },
    onSuccess: (data: any) => {
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] });
      const docMsg = data.hasSource ? " (linked to source document)" : "";
      const citationMsg = data.citationTotals?.processed
        ? ` · citation import: ${data.citationTotals.imported} added, ${data.citationTotals.existing} existing`
        : "";
      const limitedMsg = data.citationSyncLimited ? " (partial auto-sync; use Sync Citation DB for full backfill)" : "";
      toast({ title: `${data.inserted} case law entries saved${data.errors?.length ? `, ${data.errors.length} skipped` : ""}${docMsg}${citationMsg}${limitedMsg}` });
      setExtractedCases([]);
      setRetryExtractFiles([]);
      setAutoSaveFailed(false);
      setShowBulkUpload(false);
    },
    onError: (err: any) => toast({ title: err?.message || "Failed to save case law entries", variant: "destructive" }),
  });

  const syncCitationDbMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/case-law/sync-to-judgments", { batchSize: 1500 });
      return res.json();
    },
    onSuccess: (data: any) => {
      const running = Boolean(data?.status?.running);
      if (running) {
        toast({ title: data?.message || "Citation sync started in background" });
      } else {
        const processed = Number(data?.processed || 0);
        const imported = Number(data?.imported || 0);
        const existing = Number(data?.existing || 0);
        const skipped = Number(data?.skipped || 0);
        const failed = Number(data?.failed || 0);
        toast({
          title: `Citation sync complete: ${imported} imported, ${existing} existing, ${skipped} skipped, ${failed} failed (processed ${processed})`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law/sync-to-judgments/status"] });
    },
    onError: () => toast({ title: "Failed to sync case law into citation database", variant: "destructive" }),
  });

  const processPendingFilesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/case-law/process-pending-files", { batchSize: 200 });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data?.message || "Pending case-law processing started in background" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law/process-pending-files/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law/process-pending-files/diagnostics"] });
    },
    onError: () => toast({ title: "Failed to process pending case-law files", variant: "destructive" }),
  });

  const stopProcessPendingFilesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/case-law/process-pending-files/stop", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: data?.message || "Pending case-law stop requested" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law/process-pending-files/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law/process-pending-files/diagnostics"] });
    },
    onError: () => toast({ title: "Failed to stop pending case-law processing", variant: "destructive" }),
  });

  const retryTerminalProcessPendingMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/case-law/process-pending-files/retry-terminal", {
        statuses: ["failed", "no_cases"],
        limit: 5000,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      const updated = Number(data?.updated || 0);
      const message = data?.message || (updated > 0
        ? `Marked ${updated.toLocaleString()} documents for retry`
        : "No failed/no-cases documents found for retry");
      toast({ title: message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law/process-pending-files/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law/process-pending-files/diagnostics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] });
    },
    onError: () => toast({ title: "Failed to mark terminal docs for retry", variant: "destructive" }),
  });

  const processCaseLawFiles = async (files: File[], append: boolean = false) => {
    if (files.length === 0) return;
    setIsExtracting(true);
    if (!append) {
      setExtractedCases([]);
    }
    setExtractProgress({ current: 0, total: files.length, currentFile: "" });

    const allCases: typeof extractedCases = [];
    const failedFileNames: string[] = [];
    const failedFileObjects: File[] = [];
    let clientExtractedFiles = 0;
    let autoSavedFiles = 0;

    const processSingleFile = async (file: File): Promise<{
      cases: typeof extractedCases;
      failed: boolean;
      usedClientExtraction: boolean;
      autoSavedToCaseLaw: boolean;
    }> => {
      try {
        const clientExtract = await extractCaseLawInBrowser(file, CASELAW_CLIENT_EXTRACT_MAX_BYTES, {
          enablePdfFastPath: CASELAW_PDF_FAST_PATH_ENABLED,
          pdfMaxPages: CASELAW_PDF_FAST_PATH_MAX_PAGES,
          pdfMinConfidence: CASELAW_CLIENT_MIN_CONFIDENCE,
        });
        const confidence = typeof clientExtract.confidence === "number" ? clientExtract.confidence : 1;
        const confidentEnough = confidence >= CASELAW_CLIENT_MIN_CONFIDENCE;
        if (clientExtract.supported && confidentEnough && clientExtract.content && clientExtract.cases.length > 0) {
          const clientRes = await fetch("/api/admin/case-law/extract-client", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              filename: file.name,
              content: clientExtract.content,
              cases: clientExtract.cases,
              sourceType: clientExtract.sourceType || "browser-hybrid",
              confidence,
            }),
          });
          if (clientRes.ok) {
            const clientData = await clientRes.json();
            const validCases = Array.isArray(clientData.cases)
              ? clientData.cases
                .filter((c: any) => c.citation && c.title)
                .map((c: any) => ({
                  ...c,
                  _sourceDocId: clientData.savedDocId || undefined,
                  _sourceFilename: clientData.savedFilename || file.name,
                  _alreadySaved: Boolean(clientData.autoSavedToCaseLaw),
                }))
              : [];
            return {
              cases: validCases,
              failed: false,
              usedClientExtraction: true,
              autoSavedToCaseLaw: Boolean(clientData.autoSavedToCaseLaw),
            };
          }
        }
      } catch {
        // Fall through to server extraction path.
      }

      for (let attempt = 1; attempt <= CASELAW_EXTRACT_MAX_RETRIES; attempt++) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), CASELAW_EXTRACT_TIMEOUT_MS);

        try {
          const res = await fetch("/api/admin/case-law/extract", {
            method: "POST",
            credentials: "include",
            body: formDataUpload,
            signal: controller.signal,
          });

          if (!res.ok) {
            if (attempt === CASELAW_EXTRACT_MAX_RETRIES) {
              return { cases: [], failed: true, usedClientExtraction: false, autoSavedToCaseLaw: false };
            }
            continue;
          }

          const data = await res.json();
          const validCases = data.cases && data.cases.length > 0
            ? data.cases
              .filter((c: any) => c.citation && c.title)
              .map((c: any) => ({
                ...c,
                _sourceDocId: data.savedDocId || undefined,
                _sourceFilename: data.savedFilename || file.name,
                _alreadySaved: Boolean(data.autoSavedToCaseLaw),
              }))
            : [];
          return {
            cases: validCases,
            failed: false,
            usedClientExtraction: false,
            autoSavedToCaseLaw: Boolean(data.autoSavedToCaseLaw),
          };
        } catch {
          if (attempt === CASELAW_EXTRACT_MAX_RETRIES) {
            return { cases: [], failed: true, usedClientExtraction: false, autoSavedToCaseLaw: false };
          }
        } finally {
          window.clearTimeout(timeoutId);
        }
      }

      return { cases: [], failed: true, usedClientExtraction: false, autoSavedToCaseLaw: false };
    };

    let completed = 0;
    for (let i = 0; i < files.length; i += CASELAW_CLIENT_PARALLEL_BATCH) {
      const batch = files.slice(i, i + CASELAW_CLIENT_PARALLEL_BATCH);
      const results = await Promise.all(
        batch.map(async (file) => {
          const result = await processSingleFile(file);
          completed += 1;
          setExtractProgress({ current: completed, total: files.length, currentFile: file.name });
          return { file, result };
        }),
      );

      for (const { file, result } of results) {
        if (result.usedClientExtraction) {
          clientExtractedFiles += 1;
        }
        if (result.autoSavedToCaseLaw) {
          autoSavedFiles += 1;
        }
        if (result.failed) {
          failedFileNames.push(file.name);
          failedFileObjects.push(file);
          continue;
        }
        if (result.cases.length > 0) {
          allCases.push(...result.cases);
        }
      }
    }

    let mergedForSave: typeof extractedCases = [];
    if (allCases.length > 0) {
      const dedupe = (base: typeof extractedCases, incoming: typeof extractedCases) => {
        const merged = [...base];
        const seen = new Set(merged.map((item) => `${item.citation}|${item.title}|${item._sourceDocId || "none"}`));
        for (const item of incoming) {
          const key = `${item.citation}|${item.title}|${item._sourceDocId || "none"}`;
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(item);
        }
        return merged;
      };
      mergedForSave = append ? dedupe(extractedCases, allCases) : allCases;
      setExtractedCases(mergedForSave);
    }

    setRetryExtractFiles(failedFileObjects);

    if (allCases.length > 0) {
      let msg = `Extracted ${allCases.length} cases from ${files.length - failedFileNames.length} file${files.length - failedFileNames.length !== 1 ? "s" : ""}`;
      if (failedFileNames.length > 0) msg += ` (${failedFileNames.length} file${failedFileNames.length !== 1 ? "s" : ""} failed)`;
      if (clientExtractedFiles > 0) msg += ` · ${clientExtractedFiles} via browser extraction`;
      if (autoSavedFiles > 0) msg += ` · ${autoSavedFiles} auto-saved`;
      const pendingForSave = mergedForSave.filter((entry) => !entry._alreadySaved);
      if (pendingForSave.length > 0) {
        toast({ title: `${msg} · saving automatically...` });
        try {
          setAutoSaveFailed(false);
          await saveBulkMutation.mutateAsync(pendingForSave);
        } catch {
          setAutoSaveFailed(true);
        }
      } else {
        toast({ title: `${msg} · all extracted entries already saved and synced` });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] });
        setExtractedCases([]);
        setRetryExtractFiles([]);
        setAutoSaveFailed(false);
        setShowBulkUpload(false);
      }
    } else {
      toast({
        title: failedFileNames.length > 0
          ? `Failed to process ${failedFileNames.length} file(s)`
          : "No case law entries could be identified in the uploaded documents",
        variant: "destructive",
      });
    }

    setIsExtracting(false);
    setExtractProgress({ current: 0, total: 0, currentFile: "" });
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await processCaseLawFiles(files, false);
    const input = e.target;
    if (input) input.value = "";
  };

  const removeExtractedCase = (index: number) => {
    setExtractedCases(prev => prev.filter((_, i) => i !== index));
  };

  const startEdit = (entry: CaseLawEntry) => {
    setEditingId(entry.id);
    setFormData({
      citation: entry.citation,
      court: entry.court,
      title: entry.title,
      summary: entry.summary,
      keywords: entry.keywords.join(", "),
    });
    setShowAddForm(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ citation: "", court: "", title: "", summary: "", keywords: "" });
  };

  const CaseLawForm = ({ isEdit }: { isEdit: boolean }) => (
    <Card className="bg-card border-border rounded-[2rem]">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
            {isEdit ? "Edit Case Law" : "Add Case Law Entry"}
          </span>
          <Button size="icon" variant="ghost" className="text-muted-foreground" onClick={() => isEdit ? cancelEdit() : setShowAddForm(false)} data-testid="button-cancel-form">
            <X size={14} />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            placeholder="Citation (e.g. PLD 2024 SC 123)"
            value={formData.citation}
            onChange={(e) => setFormData(prev => ({ ...prev, citation: e.target.value }))}
            className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-sm"
            data-testid="input-caselaw-citation"
          />
          <Input
            placeholder="Court (e.g. Supreme Court of Pakistan)"
            value={formData.court}
            onChange={(e) => setFormData(prev => ({ ...prev, court: e.target.value }))}
            className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-sm"
            data-testid="input-caselaw-court"
          />
        </div>
        <Input
          placeholder="Title (e.g. State vs Ahmed - Property Dispute)"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-sm"
          data-testid="input-caselaw-title"
        />
        <Textarea
          placeholder="Summary of the case and legal principle established"
          value={formData.summary}
          onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
          className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-sm resize-none"
          rows={3}
          data-testid="input-caselaw-summary"
        />
        <Input
          placeholder="Keywords (comma-separated, e.g. bail, cheque, fraud)"
          value={formData.keywords}
          onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
          className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-sm"
          data-testid="input-caselaw-keywords"
        />
        <Button
          onClick={() => isEdit && editingId ? updateMutation.mutate({ id: editingId, data: formData }) : createMutation.mutate(formData)}
          disabled={!formData.citation || !formData.court || !formData.title || !formData.summary || createMutation.isPending || updateMutation.isPending}
          className="bg-primary text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
          data-testid="button-save-caselaw"
        >
          {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
          <span>{isEdit ? "Update Entry" : "Add Entry"}</span>
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Scale size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Case Law Database ({totalCaseLawEntries})
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="ghost"
            className="text-primary rounded-xl text-[10px] uppercase tracking-widest font-black"
            onClick={() => syncCitationDbMutation.mutate()}
            disabled={syncCitationDbMutation.isPending || isAutoScanning || processPendingFilesMutation.isPending || Boolean(syncCitationStatus?.running)}
            data-testid="button-sync-citation-db"
          >
            {syncCitationDbMutation.isPending || syncCitationStatus?.running ? <Loader2 className="animate-spin" size={14} /> : <Database size={14} />}
            <span>{syncCitationStatus?.running ? `Syncing (${syncCitationStatus.processed})` : "Sync Citation DB"}</span>
          </Button>
          <Button
            variant="ghost"
            className="text-primary rounded-xl text-[10px] uppercase tracking-widest font-black"
            onClick={() => processPendingFilesMutation.mutate()}
            disabled={processPendingFilesMutation.isPending || isAutoScanning || syncCitationDbMutation.isPending || Boolean(processPendingStatus?.running)}
            data-testid="button-process-pending-caselaw-files"
          >
            {processPendingFilesMutation.isPending || processPendingStatus?.running ? <Loader2 className="animate-spin" size={14} /> : <RotateCcw size={14} />}
            <span>{processPendingStatus?.running ? `Processing (${processPendingStatus.processed})` : "Process Pending Files"}</span>
          </Button>
          <Button
            variant="ghost"
            className="text-rose-300 rounded-xl text-[10px] uppercase tracking-widest font-black"
            onClick={() => stopProcessPendingFilesMutation.mutate()}
            disabled={stopProcessPendingFilesMutation.isPending || !Boolean(processPendingStatus?.running)}
            data-testid="button-stop-process-pending-caselaw-files"
          >
            {stopProcessPendingFilesMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <StopCircle size={14} />}
            <span>{stopProcessPendingFilesMutation.isPending ? "Stopping..." : "Stop Pending Process"}</span>
          </Button>
          <Button
            variant="ghost"
            className="text-primary rounded-xl text-[10px] uppercase tracking-widest font-black"
            onClick={() => retryTerminalProcessPendingMutation.mutate()}
            disabled={retryTerminalProcessPendingMutation.isPending}
            data-testid="button-retry-terminal-caselaw-files"
          >
            {retryTerminalProcessPendingMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <AlertOctagon size={14} />}
            <span>{retryTerminalProcessPendingMutation.isPending ? "Marking..." : "Retry Failed/No-Cases"}</span>
          </Button>
          <Button
            variant="ghost"
            className="text-primary rounded-xl text-[10px] uppercase tracking-widest font-black"
            onClick={async () => {
              setIsAutoScanning(true);
              try {
                const res = await apiRequest("POST", "/api/admin/case-law/auto-extract");
                const data = await res.json();
                toast({ title: data.message || "Auto-extraction started" });
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] }), 15000);
                setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] }), 45000);
              } catch {
                toast({ title: "Failed to start auto-extraction", variant: "destructive" });
              } finally {
                setIsAutoScanning(false);
              }
            }}
            disabled={isAutoScanning || processPendingFilesMutation.isPending || Boolean(processPendingStatus?.running)}
            data-testid="button-auto-scan"
          >
            {isAutoScanning ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
            <span>Scan All Sources</span>
          </Button>
          <Button
            variant="ghost"
            className="text-primary rounded-xl text-[10px] uppercase tracking-widest font-black"
            onClick={() => { setShowBulkUpload(!showBulkUpload); setShowAddForm(false); cancelEdit(); setExtractedCases([]); setRetryExtractFiles([]); setAutoSaveFailed(false); }}
            data-testid="button-toggle-bulk-upload"
          >
            <FileUp size={14} />
            <span>Upload Document</span>
          </Button>
          <Button
            className="bg-primary text-slate-950 rounded-xl text-[10px] uppercase tracking-widest font-black"
            onClick={() => { setShowAddForm(!showAddForm); setShowBulkUpload(false); cancelEdit(); }}
            data-testid="button-add-caselaw"
          >
            <Plus size={14} />
            <span>Add Entry</span>
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border rounded-[2rem]" data-testid="case-law-pending-diagnostics-card">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Pending Pipeline Diagnostics</span>
            {processPendingDiagnostics?.generatedAt ? (
              <span className="text-[10px] text-muted-foreground">
                Updated {new Date(processPendingDiagnostics.generatedAt).toLocaleTimeString()}
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground">Waiting for diagnostics...</span>
            )}
          </div>

          {processPendingDiagnosticsLoading && !processPendingDiagnostics ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="animate-spin" size={14} />
              <span>Loading pending diagnostics...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-[10px]">
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-muted-foreground uppercase tracking-wider">Actionable Pending</p>
                  <p className="text-primary font-bold text-sm">{(processPendingDiagnostics?.summary.actionablePending || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-muted-foreground uppercase tracking-wider">Legacy No Extract</p>
                  <p className="text-foreground font-bold text-sm">{(processPendingDiagnostics?.summary.pendingLegacy || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-muted-foreground uppercase tracking-wider">Terminal No Extract</p>
                  <p className="text-rose-300 font-bold text-sm">{(processPendingDiagnostics?.summary.terminalNoExtract || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-muted-foreground uppercase tracking-wider">Processing (Fresh)</p>
                  <p className="text-sky-300 font-bold text-sm">{(processPendingDiagnostics?.summary.processingFresh || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-muted-foreground uppercase tracking-wider">Max Attempts</p>
                  <p className="text-orange-300 font-bold text-sm">{(processPendingDiagnostics?.summary.maxAttemptsReached || 0).toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-muted-foreground uppercase tracking-wider">Extracted Docs</p>
                  <p className="text-emerald-300 font-bold text-sm">
                    {(processPendingDiagnostics?.summary.extractedDocs || 0).toLocaleString()}
                    <span className="text-muted-foreground font-normal"> / {(processPendingDiagnostics?.summary.totalDocs || 0).toLocaleString()}</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Status Breakdown</p>
                  {(processPendingDiagnostics?.statusCounts || []).length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">No status rows yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(processPendingDiagnostics?.statusCounts || []).slice(0, 8).map((row) => (
                        <div key={row.status} className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="text-foreground font-semibold">{row.status}</span>
                          <span className="text-muted-foreground">
                            total {row.documents.toLocaleString()} · no-extract {row.noExtractDocuments.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Top Failure Reasons</p>
                  {(processPendingDiagnostics?.topErrors || []).length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">No failure reasons available.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(processPendingDiagnostics?.topErrors || []).slice(0, 8).map((row, idx) => (
                        <div key={`${idx}-${row.error.slice(0, 40)}`} className="flex items-start justify-between gap-2 text-[10px]">
                          <span className="text-foreground line-clamp-2">{row.error}</span>
                          <span className="text-rose-300 font-semibold shrink-0">{row.documents.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {processPendingDiagnostics && (
                <p className="text-[10px] text-muted-foreground">
                  Rules: actionable uses max attempts {processPendingDiagnostics.maxAttempts} and stale processing threshold {processPendingDiagnostics.staleProcessingMinutes} min.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CaseLawBadIndexAuditCard />

      {showAddForm && !editingId && <CaseLawForm isEdit={false} />}
      {editingId && <CaseLawForm isEdit={true} />}

      {showBulkUpload && (
        <Card className="bg-card border-border rounded-[2rem]">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                AI-Powered Case Law Extraction
              </span>
              <Button size="icon" variant="ghost" className="text-muted-foreground" onClick={() => { setShowBulkUpload(false); setExtractedCases([]); setRetryExtractFiles([]); setAutoSaveFailed(false); }} data-testid="button-cancel-bulk">
                <X size={14} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Upload one or multiple <span className="text-primary font-bold">PDF</span>, <span className="text-primary font-bold">DOC/DOCX</span>, <span className="text-primary font-bold">TXT/MD</span>, <span className="text-primary font-bold">JSON</span>, or <span className="text-primary font-bold">CSV</span> files containing case law.
              Select multiple files at once for batch processing. The AI will extract individual cases with citations, court names, summaries, and keywords.
              JSON and CSV files with proper columns are imported instantly without AI processing.
            </p>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md,.json,.csv"
              multiple
              onChange={handleDocumentUpload}
              disabled={isExtracting}
              className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-sm"
              data-testid="input-bulk-document-file"
            />
            {!isExtracting && retryExtractFiles.length > 0 && (
              <div className="flex items-center justify-between gap-3 bg-background border border-border rounded-xl px-3 py-2">
                <p className="text-[10px] text-primary font-bold">
                  {retryExtractFiles.length} file{retryExtractFiles.length !== 1 ? "s" : ""} failed in the last run.
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-primary rounded-xl text-[10px] uppercase tracking-widest font-black"
                  onClick={() => processCaseLawFiles(retryExtractFiles, true)}
                  data-testid="button-retry-failed-caselaw-files"
                >
                  <Upload size={12} />
                  <span>Resume Failed</span>
                </Button>
              </div>
            )}
            {isExtracting && (
              <div className="flex items-center gap-3 py-8 justify-center">
                <Loader2 className="animate-spin text-primary" size={24} />
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {extractProgress.total > 1
                      ? `Processing file ${extractProgress.current} of ${extractProgress.total}...`
                      : "AI is reading your document..."}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {extractProgress.currentFile && extractProgress.total > 1
                      ? extractProgress.currentFile
                      : "Extracting citations, summaries, and keywords. This may take a minute for large documents."}
                  </p>
                  {extractProgress.total > 1 && (
                    <div className="mt-2 w-full bg-card rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${(extractProgress.current / extractProgress.total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            {extractedCases.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-xs text-foreground font-bold">
                      {extractedCases.length} cases extracted{autoSaveFailed ? " — auto-save failed, review and save manually" : ""}
                    </span>
                    {extractedCases.some(e => e._sourceDocId) && (
                      <span className="block text-[10px] text-emerald-400 mt-0.5">Document saved to Knowledge Base — cases will be linked for document preview</span>
                    )}
                  </div>
                  <Button
                    onClick={() => saveBulkMutation.mutate(extractedCases)}
                    disabled={saveBulkMutation.isPending}
                    className="bg-primary text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
                    data-testid="button-confirm-bulk-upload"
                  >
                    {saveBulkMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                    <span>Save All {extractedCases.length} Cases</span>
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {extractedCases.map((entry, idx) => (
                    <Card key={idx} className="bg-background border-border rounded-xl" data-testid={`extracted-case-${idx}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-foreground">{entry.citation}</p>
                            <p className="text-[10px] text-primary">{entry.court}</p>
                            <p className="text-[10px] text-foreground mt-1">{entry.title}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{entry.summary}</p>
                            {entry.keywords.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {entry.keywords.map((kw, i) => (
                                  <Badge key={i} className="bg-card text-muted-foreground border-border rounded-lg text-[7px]">{kw}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button size="icon" variant="ghost" className="text-slate-600 flex-shrink-0" onClick={() => removeExtractedCase(idx)} data-testid={`button-remove-extracted-${idx}`}>
                            <X size={12} />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-3">
          <Scale size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Case Law Entries ({totalCaseLawEntries})
          </span>
        </div>
        {totalCaseLawEntries > 0 && !showDeleteAllConfirm && (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[9px] font-bold uppercase tracking-widest gap-1.5"
            onClick={() => setShowDeleteAllConfirm(true)}
          >
            <Trash2 size={12} /> Delete All
          </Button>
        )}
        {showDeleteAllConfirm && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            <AlertOctagon size={14} className="text-red-400 flex-shrink-0" />
            <span className="text-[10px] text-red-300 font-bold">Delete all {totalCaseLawEntries} entries?</span>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-foreground text-[9px] font-bold h-7 px-3 rounded-lg"
              onClick={() => deleteAllCaseLawMutation.mutate()}
              disabled={deleteAllCaseLawMutation.isPending}
            >
              {deleteAllCaseLawMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground text-[9px] h-7 px-2 rounded-lg"
              onClick={() => setShowDeleteAllConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : caseLawEntries.length === 0 ? (
        <Card className="bg-card border-border rounded-[2rem]">
          <CardContent className="p-12 text-center">
            <Scale size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No case law entries yet. Add individual entries or upload a CSV file.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {caseLawEntries.map((entry) => (
            <Card key={entry.id} className="bg-card border-border rounded-[1.5rem]" data-testid={`caselaw-entry-${entry.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-foreground">{entry.citation}</p>
                    <p className="text-xs text-primary mt-1">{entry.court}</p>
                    <p className="text-xs text-foreground mt-1">{entry.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{entry.summary}</p>
                    {entry.keywords.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {entry.keywords.map((kw, i) => (
                          <Badge key={i} className="bg-card text-muted-foreground border-border rounded-lg text-[8px]">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="text-muted-foreground" onClick={() => startEdit(entry)} data-testid={`button-edit-caselaw-${entry.id}`}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-muted-foreground" onClick={() => deleteMutation.mutate(entry.id)} data-testid={`button-delete-caselaw-${entry.id}`}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <PaginationStrip page={page} total={totalCaseLawEntries} pageSize={ADMIN_PAGE_SIZE} onPageChange={setPage} />
    </div>
  );
}

function ClientLeadsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const { data: leadsPage, isLoading } = useQuery<PagedResponse<ClientLead>>({
    queryKey: ["/api/admin/client-leads", page, ADMIN_PAGE_SIZE, search],
    queryFn: async () => {
      const offset = (page - 1) * ADMIN_PAGE_SIZE;
      const q = encodeURIComponent(search.trim());
      const res = await fetch(`/api/admin/client-leads?limit=${ADMIN_PAGE_SIZE}&offset=${offset}&q=${q}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch client leads");
      return res.json();
    },
  });

  const { data: selectedLead, isFetching: leadLoading } = useQuery<ClientLead>({
    queryKey: ["/api/admin/client-leads", selectedLeadId],
    enabled: !!selectedLeadId,
    queryFn: async () => {
      const res = await fetch(`/api/admin/client-leads/${selectedLeadId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load lead details");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/client-leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/client-leads"] });
      setSelectedLeadId(null);
      toast({ title: "Lead deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete lead", variant: "destructive" });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/admin/client-leads/${id}`, { status: "completed" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/client-leads"] });
      if (selectedLeadId) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/client-leads", selectedLeadId] });
      }
      toast({ title: "Lead marked as completed" });
    },
    onError: () => {
      toast({ title: "Failed to update lead status", variant: "destructive" });
    },
  });

  const leads = leadsPage?.items || [];
  const totalLeads = leadsPage?.total || 0;

  useEffect(() => {
    setPage(1);
  }, [search]);

  const csvField = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return `"${text.replace(/"/g, "\"\"").replace(/\r?\n/g, " ")}"`;
  };

  const exportAllClientLeadsCsv = async () => {
    try {
      setIsExportingCsv(true);
      const q = encodeURIComponent(search.trim());
      const exportPageSize = 200;
      let offset = 0;
      const allLeads: ClientLead[] = [];

      while (true) {
        const res = await fetch(`/api/admin/client-leads?limit=${exportPageSize}&offset=${offset}&q=${q}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to fetch leads for CSV export");
        const data = (await res.json()) as PagedResponse<ClientLead>;
        const items = data?.items || [];
        allLeads.push(...items);
        if (!data.hasMore || items.length === 0) break;
        offset += exportPageSize;
      }

      if (allLeads.length === 0) {
        toast({ title: "No leads to export" });
        return;
      }

      const headers = [
        "lead_id",
        "name",
        "phone",
        "email",
        "case_type",
        "city",
        "urgency",
        "status",
        "case_description",
        "ip_address",
        "preferred_callback_time",
        "consent_to_contact",
        "submitted_at",
        "status_updated_at",
      ];

      const rows = allLeads.map((lead) => [
        lead.id,
        lead.name,
        lead.phone,
        lead.email,
        lead.caseType,
        lead.city || "",
        lead.urgency,
        lead.status,
        lead.caseDescription,
        lead.ipAddress,
        lead.preferredCallbackTime || "",
        lead.consentToContact ? "yes" : "no",
        lead.createdAt,
        lead.statusUpdatedAt,
      ]);

      const csv = "\uFEFF" + [headers.map(csvField).join(","), ...rows.map((row) => row.map(csvField).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.href = objectUrl;
      link.download = `client-leads-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      toast({ title: `CSV downloaded (${allLeads.length} leads)` });
    } catch (err: any) {
      toast({ title: err?.message || "Failed to download leads CSV", variant: "destructive" });
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="client-leads-section">
      <Card className="bg-card border-border rounded-[2rem]">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <FileText size={16} className="text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                Client Leads ({totalLeads})
              </span>
            </div>
            <div className="w-full sm:w-auto flex items-center gap-2">
              <Input
                placeholder="Search leads..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-72 bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs"
                data-testid="input-search-client-leads"
              />
              <Button
                onClick={exportAllClientLeadsCsv}
                disabled={isExportingCsv}
                className="bg-primary text-slate-950 hover:bg-primary rounded-xl text-[10px] uppercase tracking-widest font-black"
                data-testid="button-export-client-leads-csv"
              >
                {isExportingCsv ? <Loader2 size={12} className="animate-spin mr-1" /> : <Download size={12} className="mr-1" />}
                <span>{isExportingCsv ? "Exporting..." : "Download CSV"}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : leads.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">No leads found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[1200px]">
                <thead>
                  <tr className="text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-black uppercase tracking-wide">Lead ID</th>
                    <th className="py-2 pr-3 font-black uppercase tracking-wide">Name</th>
                    <th className="py-2 pr-3 font-black uppercase tracking-wide">Phone</th>
                    <th className="py-2 pr-3 font-black uppercase tracking-wide">Email</th>
                    <th className="py-2 pr-3 font-black uppercase tracking-wide">Case Type</th>
                    <th className="py-2 pr-3 font-black uppercase tracking-wide">City</th>
                    <th className="py-2 pr-3 font-black uppercase tracking-wide">Urgency</th>
                    <th className="py-2 pr-3 font-black uppercase tracking-wide">Status</th>
                    <th className="py-2 pr-3 font-black uppercase tracking-wide">Case Description</th>
                    <th className="py-2 pr-3 font-black uppercase tracking-wide">IP Address</th>
                    <th className="py-2 pr-3 font-black uppercase tracking-wide">Submission Date</th>
                    <th className="py-2 font-black uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-900">
                      <td className="py-2 pr-3 text-muted-foreground">{lead.id.slice(0, 8)}...</td>
                      <td className="py-2 pr-3 text-foreground font-semibold">{lead.name}</td>
                      <td className="py-2 pr-3 text-foreground">{lead.phone}</td>
                      <td className="py-2 pr-3 text-foreground">{lead.email}</td>
                      <td className="py-2 pr-3 text-primary">{lead.caseType}</td>
                      <td className="py-2 pr-3 text-foreground">{lead.city || "-"}</td>
                      <td className="py-2 pr-3 text-foreground uppercase">{lead.urgency}</td>
                      <td className="py-2 pr-3">
                        <Badge className={lead.status === "completed"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 rounded-md"
                          : "bg-primary/15 text-primary border-primary/40 rounded-md"}
                        >
                          {lead.status === "completed" ? "Completed" : "Open"}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground max-w-[260px] truncate">{lead.caseDescription}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{lead.ipAddress}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{new Date(lead.createdAt).toLocaleString()}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-primary text-[10px] h-7 px-2"
                            onClick={() => setSelectedLeadId(lead.id)}
                            data-testid={`button-view-lead-${lead.id}`}
                          >
                            View
                          </Button>
                          {lead.status === "open" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-emerald-300 text-[10px] h-7 px-2"
                              onClick={() => completeMutation.mutate(lead.id)}
                              disabled={completeMutation.isPending}
                              data-testid={`button-complete-lead-${lead.id}`}
                            >
                              <Check size={12} className="mr-1" /> Completed
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-300 text-[10px] h-7 px-2"
                            onClick={() => deleteMutation.mutate(lead.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-lead-${lead.id}`}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <PaginationStrip page={page} total={totalLeads} pageSize={ADMIN_PAGE_SIZE} onPageChange={setPage} />
        </CardContent>
      </Card>

      {selectedLeadId && (
        <Card className="bg-card border-border rounded-[1.5rem]">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              Lead Details
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setSelectedLeadId(null)}
            >
              <X size={14} />
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {leadLoading || !selectedLead ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <p className="text-foreground"><span className="text-muted-foreground">Name:</span> {selectedLead.name}</p>
                  <p className="text-foreground"><span className="text-muted-foreground">Phone:</span> {selectedLead.phone}</p>
                  <p className="text-foreground"><span className="text-muted-foreground">Email:</span> {selectedLead.email}</p>
                  <p className="text-foreground"><span className="text-muted-foreground">Case Type:</span> {selectedLead.caseType}</p>
                  <p className="text-foreground"><span className="text-muted-foreground">City:</span> {selectedLead.city || "-"}</p>
                  <p className="text-foreground"><span className="text-muted-foreground">Urgency:</span> <span className="uppercase">{selectedLead.urgency}</span></p>
                  <p className="text-foreground"><span className="text-muted-foreground">Preferred Callback:</span> {selectedLead.preferredCallbackTime || "Not provided"}</p>
                  <p className="text-foreground"><span className="text-muted-foreground">Consent:</span> {selectedLead.consentToContact ? "Yes" : "No"}</p>
                  <p className="text-foreground">
                    <span className="text-muted-foreground">Status:</span>{" "}
                    <span className={selectedLead.status === "completed" ? "text-emerald-300 font-semibold" : "text-primary font-semibold"}>
                      {selectedLead.status === "completed" ? "Completed" : "Open"}
                    </span>
                  </p>
                  <p className="text-foreground"><span className="text-muted-foreground">IP Address:</span> {selectedLead.ipAddress}</p>
                  <p className="text-foreground"><span className="text-muted-foreground">Submitted:</span> {new Date(selectedLead.createdAt).toLocaleString()}</p>
                </div>
                {selectedLead.status === "open" && (
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 h-8 text-[11px] font-bold"
                      onClick={() => completeMutation.mutate(selectedLead.id)}
                      disabled={completeMutation.isPending}
                    >
                      <Check size={13} className="mr-1" /> Mark as Completed
                    </Button>
                  </div>
                )}
                <div className="rounded-xl border border-border bg-background p-3">
                  <p className="text-[11px] text-muted-foreground mb-1 uppercase tracking-wider font-bold">Case Description</p>
                  <p className="text-foreground whitespace-pre-wrap text-sm">{selectedLead.caseDescription}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type StatuteDoc = {
  id: number;
  title: string;
  filename: string;
  category: string;
  createdAt: string;
};

function StatuteDocumentsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: docsPage, isLoading } = useQuery<PagedResponse<StatuteDoc>>({
    queryKey: ["/api/admin/statute-documents", page, ADMIN_PAGE_SIZE],
    queryFn: async () => {
      const offset = (page - 1) * ADMIN_PAGE_SIZE;
      const res = await fetch(`/api/admin/statute-documents?limit=${ADMIN_PAGE_SIZE}&offset=${offset}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch statute documents");
      }
      return res.json();
    },
  });
  const docs = docsPage?.items || [];
  const totalDocs = docsPage?.total || 0;
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, uploaded: 0, errors: 0 });
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  useEffect(() => {
    if (page > 1 && docs.length === 0 && totalDocs > 0) {
      setPage((p) => Math.max(1, p - 1));
    }
  }, [page, docs.length, totalDocs]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/statute-documents/${id}`);
    },
    onSuccess: () => {
      if (page > 1 && docs.length === 1) {
        setPage((p) => Math.max(1, p - 1));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/statute-documents"] });
      toast({ title: "Statute document removed" });
    },
    onError: () => {
      toast({ title: "Failed to delete", variant: "destructive" });
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/admin/statute-documents");
      return res.json();
    },
    onSuccess: (data: any) => {
      setPage(1);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/statute-documents"] });
      toast({ title: `${data.deleted} statute document${data.deleted !== 1 ? "s" : ""} deleted` });
      setShowDeleteAllConfirm(false);
    },
    onError: () => {
      toast({ title: "Failed to delete all statute documents", variant: "destructive" });
      setShowDeleteAllConfirm(false);
    },
  });

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      toast({ title: "Please select files to upload", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    const totalFiles = selectedFiles.length;
    let totalUploaded = 0;
    let totalErrors = 0;
    setUploadProgress({ current: 0, total: totalFiles, uploaded: 0, errors: 0 });

    try {
      for (let i = 0; i < totalFiles; i += 1) {
        const file = selectedFiles[i];
        const formData = new FormData();
        formData.append("files", file);

        try {
          const res = await fetch("/api/admin/statute-documents", {
            method: "POST",
            credentials: "include",
            body: formData,
          });

          if (!res.ok) {
            totalErrors += 1;
            setUploadProgress({ current: i + 1, total: totalFiles, uploaded: totalUploaded, errors: totalErrors });
            continue;
          }

          const data = await res.json();
          const failed = Number(data?.failed || 0);
          const reportedCount = Number(data?.count);
          const uploaded = Number.isFinite(reportedCount) ? reportedCount : Math.max(0, 1 - failed);
          totalUploaded += uploaded;
          totalErrors += failed;
          setUploadProgress({ current: i + 1, total: totalFiles, uploaded: totalUploaded, errors: totalErrors });
        } catch {
          totalErrors += 1;
          setUploadProgress({ current: i + 1, total: totalFiles, uploaded: totalUploaded, errors: totalErrors });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/admin/statute-documents"] });
      setPage(1);
      setSelectedFiles([]);
      const fileInput = document.querySelector('[data-testid="input-statute-doc-files"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      let message = `${totalUploaded} statute document${totalUploaded !== 1 ? "s" : ""} uploaded`;
      if (totalErrors > 0) message += `, ${totalErrors} failed`;
      toast({ title: message });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0, uploaded: 0, errors: 0 });
    }
  }

  return (
    <div className="space-y-8" data-testid="statute-docs-section">
      <Card className="bg-card border-border rounded-[2rem]">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Upload size={16} className="text-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Upload Statute Documents
          </span>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground">
            Upload full statute documents that users can search and read in the PDF viewer. Supports .txt, .pdf, .json, .csv files (up to 500 files, 50 MB each).
          </p>

          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground block">
              Select Files (.txt, .json, .csv, .pdf)
            </label>
            <Input
              type="file"
              accept=".txt,.json,.csv,.pdf"
              multiple
              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
              className="bg-background border-[hsl(var(--preview-border))] text-foreground rounded-xl text-xs file:text-muted-foreground file:mr-4"
              data-testid="input-statute-doc-files"
            />
            {selectedFiles.length > 0 && (
              <p className="text-[10px] text-primary font-bold">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {isUploading && uploadProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Uploading {uploadProgress.current} of {uploadProgress.total} files...</span>
                <span className="text-primary font-bold">{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-card rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
              <div className="text-[9px] flex flex-wrap gap-3">
                <span className="text-emerald-400 font-bold">Uploaded: {uploadProgress.uploaded}</span>
                <span className="text-red-400 font-bold">Failed: {uploadProgress.errors}</span>
                <span className="text-muted-foreground font-bold">Remaining: {Math.max(uploadProgress.total - uploadProgress.current, 0)}</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="bg-primary text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
            data-testid="button-upload-statute-docs"
          >
            {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            <span>{isUploading ? "Uploading..." : selectedFiles.length > 1 ? `Upload ${selectedFiles.length} Files` : "Upload Statute"}</span>
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText size={16} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              Statute Library ({totalDocs})
            </span>
          </div>
          {totalDocs > 0 && !showDeleteAllConfirm && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 text-[9px] font-bold uppercase tracking-widest gap-1.5"
              onClick={() => setShowDeleteAllConfirm(true)}
            >
              <Trash2 size={12} /> Delete All
            </Button>
          )}
          {showDeleteAllConfirm && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertOctagon size={14} className="text-red-400 flex-shrink-0" />
              <span className="text-[10px] text-red-300 font-bold">Delete all {totalDocs} documents?</span>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-foreground text-[9px] font-bold h-7 px-3 rounded-lg"
                onClick={() => deleteAllMutation.mutate()}
                disabled={deleteAllMutation.isPending}
              >
                {deleteAllMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground text-[9px] h-7 px-2 rounded-lg"
                onClick={() => setShowDeleteAllConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : docs.length === 0 ? (
          <Card className="bg-card border-border rounded-[2rem]">
            <CardContent className="p-12 text-center">
              <FileText size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No statute documents uploaded yet</p>
            </CardContent>
          </Card>
        ) : (
          docs.map((doc) => (
            <Card key={doc.id} className="bg-card border-border rounded-[1.5rem]" data-testid={`statute-doc-${doc.id}`}>
              <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <FileText size={18} className="text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-card text-muted-foreground border-border rounded-lg text-[8px]">
                        {doc.category}
                      </Badge>
                      <span className="text-[9px] text-slate-600">{doc.filename}</span>
                      <span className="text-[9px] text-slate-600">
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground"
                  onClick={() => deleteMutation.mutate(doc.id)}
                  data-testid={`button-delete-statute-doc-${doc.id}`}
                >
                  <Trash2 size={14} />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
        <PaginationStrip page={page} total={totalDocs} pageSize={ADMIN_PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  );
}
