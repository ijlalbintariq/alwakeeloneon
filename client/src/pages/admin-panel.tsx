import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Redirect } from "wouter";
import {
  Shield, Users, BarChart3, Database, Upload, Trash2, Crown,
  UserCheck, UserX, Loader2, FileText, AlertTriangle, Plus,
  Scale, Pencil, X, Check, FileUp, Search, AlertOctagon
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
  content: string;
  uploadedBy: string;
  createdAt: string;
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

export default function AdminPanelPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"stats" | "users" | "knowledge" | "case-law" | "statute-docs" | "audit">("stats");

  if (!user?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="admin-panel-premium space-y-8 fade-in" data-testid="admin-panel-page">
      <div className="admin-panel-hero">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="admin-panel-shield-wrap">
              <Shield size={18} className="text-amber-400" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
              Admin Control Panel
            </h1>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 font-black">
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
          { id: "case-law" as const, label: "Case Law", icon: Scale },
          { id: "statute-docs" as const, label: "Statute Library", icon: FileText },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            className={`rounded-xl text-[10px] uppercase tracking-widest font-black admin-tab-button ${activeTab === tab.id ? "bg-amber-400 text-slate-950" : "text-slate-300"}`}
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

function StatsSection() {
  const { data: stats, isLoading } = useQuery<SystemStats>({ queryKey: ["/api/admin/stats"] });
  const { data: costData, isLoading: costLoading } = useQuery<CostAnalytics>({ queryKey: ["/api/admin/cost-analytics"] });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-amber-500" size={24} />
      </div>
    );
  }

  const statItems = [
    { label: "Total Users", value: stats?.totalUsers || 0, icon: Users, color: "text-blue-400" },
    { label: "Chat Threads", value: stats?.totalThreads || 0, icon: FileText, color: "text-emerald-400" },
    { label: "Messages", value: stats?.totalMessages || 0, icon: BarChart3, color: "text-amber-400" },
    { label: "Documents", value: stats?.totalDocuments || 0, icon: Database, color: "text-amber-400" },
    { label: "Knowledge Entries", value: stats?.totalKnowledge || 0, icon: Database, color: "text-cyan-400" },
    { label: "Cache Entries", value: stats?.totalCacheEntries || 0, icon: BarChart3, color: "text-pink-400" },
    { label: "Usage This Month", value: stats?.totalUsageThisMonth || 0, icon: BarChart3, color: "text-orange-400" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
        {statItems.map((item) => (
          <Card key={item.label} className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-3">
                <item.icon size={16} className={item.color} />
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                  {item.label}
                </span>
              </div>
              <p className="text-3xl font-bold text-white tracking-tight" data-testid={`stat-${item.label.toLowerCase().replace(/\s+/g, "-")}`}>
                {item.value.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div data-testid="cost-analytics-section">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 size={16} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Cost Analytics (This Month)
          </span>
        </div>

        {costLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="animate-spin text-amber-500" size={20} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
                <CardContent className="p-6">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2">
                    Est. Total Cost
                  </span>
                  <p className="text-2xl font-bold text-emerald-400" data-testid="text-total-cost">
                    ${costData?.totalCost || "0.0000"}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
                <CardContent className="p-6">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2">
                    Total Tokens
                  </span>
                  <p className="text-2xl font-bold text-blue-400" data-testid="text-total-tokens">
                    {(costData?.totalTokens || 0).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
                <CardContent className="p-6">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-2">
                    Active Features
                  </span>
                  <p className="text-2xl font-bold text-amber-400">
                    {costData?.byFeature?.length || 0}
                  </p>
                </CardContent>
              </Card>
            </div>

            {costData?.byFeature && costData.byFeature.length > 0 && (
              <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
                <CardContent className="p-6">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 block mb-4">
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
                            <span className="text-xs font-bold text-slate-300">
                              {FEATURE_LABELS[f.feature] || f.feature}
                            </span>
                            <div className="flex items-center gap-4 flex-wrap">
                              <span className="text-[10px] text-slate-500">
                                {f.totalQueries} queries
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {(f.totalInputTokens + f.totalOutputTokens).toLocaleString()} tokens
                              </span>
                              <span className="text-xs font-bold text-emerald-400">
                                ${f.totalCost}
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-1.5">
                            <div
                              className="bg-amber-500 h-1.5 rounded-full transition-all"
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
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [banReasons, setBanReasons] = useState<Record<string, string>>({});

  const addUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/users", {
        email: newEmail,
        password: newPassword,
        firstName: newFirstName,
        lastName: newLastName,
        subscriptionTier: newTier,
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

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      return res.json();
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-amber-500" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="users-section">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div className="flex items-center gap-3">
          <Users size={16} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            {allUsers?.length || 0} Registered Users
          </span>
        </div>
        <Button
          variant={showAddForm ? "ghost" : "default"}
          className={`rounded-xl text-[10px] uppercase tracking-widest font-black ${showAddForm ? "text-slate-400" : "bg-amber-500 text-slate-950"}`}
          onClick={() => setShowAddForm(!showAddForm)}
          data-testid="button-toggle-add-user"
        >
          <Plus size={14} />
          <span>{showAddForm ? "Cancel" : "Add User"}</span>
        </Button>
      </div>

      {showAddForm && (
        <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]" data-testid="add-user-form">
          <CardContent className="p-6 space-y-4">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 block">
              Create New User
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                placeholder="First name"
                value={newFirstName}
                onChange={(e) => setNewFirstName(e.target.value)}
                className="bg-[#101a2b] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-sm"
                data-testid="input-new-firstname"
              />
              <Input
                placeholder="Last name"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className="bg-[#101a2b] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-sm"
                data-testid="input-new-lastname"
              />
            </div>
            <Input
              placeholder="Email address"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="bg-[#101a2b] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-sm"
              data-testid="input-new-email"
            />
            <Input
              placeholder="Password (min 8 characters)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-[#101a2b] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-sm"
              data-testid="input-new-password"
            />
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={newTier} onValueChange={setNewTier}>
                <SelectTrigger className="w-40 bg-[#101a2b] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-xs" data-testid="select-new-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                className={`rounded-xl text-[10px] uppercase tracking-widest font-black ${newIsAdmin ? "text-amber-400" : "text-slate-500"}`}
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
              className="bg-amber-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
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
          <Card key={u.id} className="bg-[#1e293b] border-slate-800 rounded-[1.5rem]" data-testid={`user-row-${u.id}`}>
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {u.profileImageUrl ? (
                    <img src={u.profileImageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Users size={16} className="text-slate-500" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate" data-testid={`text-user-name-${u.id}`}>
                    {u.firstName || u.email || "Unknown"}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">{u.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {u.isAdmin && (
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 rounded-lg text-[9px]">
                    ADMIN
                  </Badge>
                )}
                {u.isBanned && (
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30 rounded-lg text-[9px]">
                    SUSPENDED
                  </Badge>
                )}

                <Select
                  value={u.subscriptionTier}
                  onValueChange={(val) => updateUserMutation.mutate({ userId: u.id, data: { subscriptionTier: val } })}
                >
                  <SelectTrigger className="w-32 bg-[#101a2b] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-xs" data-testid={`select-tier-${u.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free</SelectItem>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => updateUserMutation.mutate({ userId: u.id, data: { isAdmin: !u.isAdmin } })}
                  disabled={u.isAdmin && u.id === currentUser?.id}
                  title={u.isAdmin && u.id === currentUser?.id ? "You cannot remove your own admin access" : u.isAdmin ? "Remove admin access" : "Grant admin access"}
                  data-testid={`button-toggle-admin-${u.id}`}
                  className={u.isAdmin ? "text-amber-400" : "text-slate-500"}
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
                        className="text-slate-500 text-[10px] uppercase tracking-widest font-black"
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
                      className="text-slate-500"
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
                    className="bg-[#101a2b] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-xs"
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
        <Loader2 className="animate-spin text-amber-500" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="audit-logs-section">
      <div className="flex items-center gap-3">
        <Shield size={16} className="text-amber-500" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          Audit Events ({logs?.length || 0})
        </span>
      </div>

      {!logs || logs.length === 0 ? (
        <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
          <CardContent className="p-12 text-center">
            <Shield size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No audit events yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <Card key={log.id} className="bg-[#1e293b] border-slate-800 rounded-[1.5rem]" data-testid={`audit-log-${log.id}`}>
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <Badge className="bg-slate-800 text-slate-300 border-slate-700 rounded-lg text-[9px]">
                    {log.action}
                  </Badge>
                  <span className="text-[10px] text-slate-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 flex flex-wrap gap-3">
                  <span>Actor: {log.actorUserId || "system"}</span>
                  <span>Target: {log.targetUserId || "-"}</span>
                </div>
                {log.metadata && (
                  <pre className="text-[10px] text-slate-400 bg-[#101a2b] border border-slate-800 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-words">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="pt-4 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle size={16} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Security Event Stream ({securityEvents?.length || 0})
          </span>
        </div>

        {securityLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-amber-500" size={20} />
          </div>
        ) : !securityEvents || securityEvents.length === 0 ? (
          <Card className="bg-[#1e293b] border-slate-800 rounded-[1.5rem]">
            <CardContent className="p-6 text-center text-slate-500 text-sm">
              No recent security alerts.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {securityEvents.map((event) => (
              <Card key={`security-event-${event.id}-${event.lastSeenAt}`} className="bg-[#1e293b] border-slate-800 rounded-[1.2rem]">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 rounded-lg text-[9px]">
                      {event.type}
                    </Badge>
                    <span className="text-[10px] text-slate-500">Count: {event.count}</span>
                  </div>
                  <p className="text-[11px] text-slate-200 break-all">Key: {event.key}</p>
                  <p className="text-[10px] text-slate-500">
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
  const { data: docs, isLoading } = useQuery<AdminKnowledgeDoc[]>({ queryKey: ["/api/admin/knowledge"] });
  const [uploadCategory, setUploadCategory] = useState("general");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/knowledge/${id}`);
    },
    onSuccess: () => {
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
      <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Upload size={16} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Mass Upload to Knowledge Vault
          </span>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <Select value={uploadCategory} onValueChange={setUploadCategory}>
            <SelectTrigger className="bg-[#101a2b] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-xs" data-testid="select-knowledge-category">
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
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 block">
              Select Files (.txt, .json, .csv, .pdf, .docx — select multiple)
            </label>
            <Input
              type="file"
              accept=".txt,.json,.csv,.pdf,.doc,.docx"
              multiple
              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
              className="bg-[#101a2b] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-xs file:text-slate-400 file:mr-4"
              data-testid="input-knowledge-files"
            />
            {selectedFiles.length > 0 && (
              <p className="text-[10px] text-amber-400 font-bold">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {isUploading && uploadProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Uploading {uploadProgress.current} of {uploadProgress.total} files...</span>
                <span className="text-amber-400 font-bold">{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
              </div>
              {uploadProgress.uploaded > 0 && (
                <p className="text-[9px] text-emerald-400">{uploadProgress.uploaded} uploaded{uploadProgress.errors > 0 ? `, ${uploadProgress.errors} failed` : ""}</p>
              )}
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="bg-amber-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
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
            <Database size={16} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              Vault Documents ({docs?.length || 0})
            </span>
          </div>
          {(docs?.length || 0) > 0 && !showDeleteAllConfirm && (
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
              <span className="text-[10px] text-red-300 font-bold">Delete all {docs?.length} documents?</span>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold h-7 px-3 rounded-lg"
                onClick={() => deleteAllMutation.mutate()}
                disabled={deleteAllMutation.isPending}
              >
                {deleteAllMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400 text-[9px] h-7 px-2 rounded-lg"
                onClick={() => setShowDeleteAllConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-amber-500" size={24} />
          </div>
        ) : docs?.length === 0 ? (
          <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
            <CardContent className="p-12 text-center">
              <Database size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No documents in vault yet</p>
            </CardContent>
          </Card>
        ) : (
          docs?.map((doc) => (
            <Card key={doc.id} className="bg-[#1e293b] border-slate-800 rounded-[1.5rem]" data-testid={`knowledge-doc-${doc.id}`}>
              <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <FileText size={18} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-slate-800 text-slate-400 border-slate-700 rounded-lg text-[8px]">
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
                  className="text-slate-500"
                  onClick={() => deleteMutation.mutate(doc.id)}
                  data-testid={`button-delete-knowledge-${doc.id}`}
                >
                  <Trash2 size={14} />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
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

function CaseLawSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: caseLawEntries, isLoading } = useQuery<CaseLawEntry[]>({ queryKey: ["/api/admin/case-law"] });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [extractedCases, setExtractedCases] = useState<Array<{ citation: string; court: string; title: string; summary: string; keywords: string[]; _sourceDocId?: number; _sourceFilename?: string }>>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState({ current: 0, total: 0, currentFile: "" });
  const [isAutoScanning, setIsAutoScanning] = useState(false);
  const [formData, setFormData] = useState({ citation: "", court: "", title: "", summary: "", keywords: "" });
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await apiRequest("POST", "/api/admin/case-law", {
        ...data,
        keywords: data.keywords.split(",").map(k => k.trim()).filter(Boolean),
      });
    },
    onSuccess: () => {
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
      for (const [key, group] of grouped) {
        const body: any = { entries: group };
        if (key !== "none") {
          body.sourceDocId = key;
          body.sourceFilename = group[0]._sourceFilename || "";
        }
        const res = await apiRequest("POST", "/api/admin/case-law/bulk", body);
        const data = await res.json();
        totalInserted += data.inserted || 0;
        if (data.errors) allErrors.push(...data.errors);
      }
      return { inserted: totalInserted, errors: allErrors };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] });
      const hasSource = extractedCases.some(e => e._sourceDocId);
      const docMsg = hasSource ? " (linked to source document)" : "";
      toast({ title: `${data.inserted} case law entries saved to database${data.errors?.length ? `, ${data.errors.length} skipped` : ""}${docMsg}` });
      setExtractedCases([]);
      setShowBulkUpload(false);
    },
    onError: () => toast({ title: "Failed to save case law entries", variant: "destructive" }),
  });

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsExtracting(true);
    setExtractedCases([]);
    setExtractProgress({ current: 0, total: files.length, currentFile: "" });

    const allCases: typeof extractedCases = [];
    const failedFiles: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setExtractProgress({ current: i + 1, total: files.length, currentFile: file.name });
      try {
        const formDataUpload = new FormData();
        formDataUpload.append("file", file);
        const res = await fetch("/api/admin/case-law/extract", {
          method: "POST",
          credentials: "include",
          body: formDataUpload,
        });
        if (!res.ok) {
          failedFiles.push(file.name);
          continue;
        }
        const data = await res.json();
        if (data.cases && data.cases.length > 0) {
          const validCases = data.cases
            .filter((c: any) => c.citation && c.title)
            .map((c: any) => ({
              ...c,
              _sourceDocId: data.savedDocId || undefined,
              _sourceFilename: data.savedFilename || file.name,
            }));
          allCases.push(...validCases);
        }
      } catch {
        failedFiles.push(file.name);
      }
    }

    if (allCases.length > 0) {
      setExtractedCases(allCases);
      let msg = `Extracted ${allCases.length} cases from ${files.length - failedFiles.length} file${files.length - failedFiles.length !== 1 ? "s" : ""}`;
      if (failedFiles.length > 0) msg += ` (${failedFiles.length} file${failedFiles.length !== 1 ? "s" : ""} failed)`;
      toast({ title: msg });
    } else {
      toast({ title: failedFiles.length > 0 ? `Failed to process ${failedFiles.length} file(s)` : "No case law entries could be identified in the uploaded documents", variant: "destructive" });
    }

    setIsExtracting(false);
    setExtractProgress({ current: 0, total: 0, currentFile: "" });
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
    <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">
            {isEdit ? "Edit Case Law" : "Add Case Law Entry"}
          </span>
          <Button size="icon" variant="ghost" className="text-slate-500" onClick={() => isEdit ? cancelEdit() : setShowAddForm(false)} data-testid="button-cancel-form">
            <X size={14} />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            placeholder="Citation (e.g. PLD 2024 SC 123)"
            value={formData.citation}
            onChange={(e) => setFormData(prev => ({ ...prev, citation: e.target.value }))}
            className="bg-[#0d1728] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-sm"
            data-testid="input-caselaw-citation"
          />
          <Input
            placeholder="Court (e.g. Supreme Court of Pakistan)"
            value={formData.court}
            onChange={(e) => setFormData(prev => ({ ...prev, court: e.target.value }))}
            className="bg-[#0d1728] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-sm"
            data-testid="input-caselaw-court"
          />
        </div>
        <Input
          placeholder="Title (e.g. State vs Ahmed - Property Dispute)"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="bg-[#0d1728] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-sm"
          data-testid="input-caselaw-title"
        />
        <Textarea
          placeholder="Summary of the case and legal principle established"
          value={formData.summary}
          onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
          className="bg-[#0d1728] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-sm resize-none"
          rows={3}
          data-testid="input-caselaw-summary"
        />
        <Input
          placeholder="Keywords (comma-separated, e.g. bail, cheque, fraud)"
          value={formData.keywords}
          onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
          className="bg-[#0d1728] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-sm"
          data-testid="input-caselaw-keywords"
        />
        <Button
          onClick={() => isEdit && editingId ? updateMutation.mutate({ id: editingId, data: formData }) : createMutation.mutate(formData)}
          disabled={!formData.citation || !formData.court || !formData.title || !formData.summary || createMutation.isPending || updateMutation.isPending}
          className="bg-amber-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
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
          <Scale size={16} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Case Law Database ({caseLawEntries?.length || 0})
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="ghost"
            className="text-amber-400 rounded-xl text-[10px] uppercase tracking-widest font-black"
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
            disabled={isAutoScanning}
            data-testid="button-auto-scan"
          >
            {isAutoScanning ? <Loader2 className="animate-spin" size={14} /> : <Search size={14} />}
            <span>Scan All Sources</span>
          </Button>
          <Button
            variant="ghost"
            className="text-amber-400 rounded-xl text-[10px] uppercase tracking-widest font-black"
            onClick={() => { setShowBulkUpload(!showBulkUpload); setShowAddForm(false); cancelEdit(); setExtractedCases([]); }}
            data-testid="button-toggle-bulk-upload"
          >
            <FileUp size={14} />
            <span>Upload Document</span>
          </Button>
          <Button
            className="bg-amber-500 text-slate-950 rounded-xl text-[10px] uppercase tracking-widest font-black"
            onClick={() => { setShowAddForm(!showAddForm); setShowBulkUpload(false); cancelEdit(); }}
            data-testid="button-add-caselaw"
          >
            <Plus size={14} />
            <span>Add Entry</span>
          </Button>
        </div>
      </div>

      {showAddForm && !editingId && <CaseLawForm isEdit={false} />}
      {editingId && <CaseLawForm isEdit={true} />}

      {showBulkUpload && (
        <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">
                AI-Powered Case Law Extraction
              </span>
              <Button size="icon" variant="ghost" className="text-slate-500" onClick={() => { setShowBulkUpload(false); setExtractedCases([]); }} data-testid="button-cancel-bulk">
                <X size={14} />
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Upload one or multiple <span className="text-amber-400 font-bold">PDF</span>, <span className="text-amber-400 font-bold">DOC/DOCX</span>, <span className="text-amber-400 font-bold">TXT</span>, <span className="text-amber-400 font-bold">JSON</span>, or <span className="text-amber-400 font-bold">CSV</span> files containing case law.
              Select multiple files at once for batch processing. The AI will extract individual cases with citations, court names, summaries, and keywords.
              JSON and CSV files with proper columns are imported instantly without AI processing.
            </p>
            <Input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.json,.csv"
              multiple
              onChange={handleDocumentUpload}
              disabled={isExtracting}
              className="bg-[#0d1728] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-sm"
              data-testid="input-bulk-document-file"
            />
            {isExtracting && (
              <div className="flex items-center gap-3 py-8 justify-center">
                <Loader2 className="animate-spin text-amber-500" size={24} />
                <div>
                  <p className="text-sm font-bold text-white">
                    {extractProgress.total > 1
                      ? `Processing file ${extractProgress.current} of ${extractProgress.total}...`
                      : "AI is reading your document..."}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {extractProgress.currentFile && extractProgress.total > 1
                      ? extractProgress.currentFile
                      : "Extracting citations, summaries, and keywords. This may take a minute for large documents."}
                  </p>
                  {extractProgress.total > 1 && (
                    <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5">
                      <div
                        className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
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
                    <span className="text-xs text-slate-300 font-bold">{extractedCases.length} cases extracted — review and save</span>
                    {extractedCases.some(e => e._sourceDocId) && (
                      <span className="block text-[10px] text-emerald-400 mt-0.5">Document saved to Knowledge Base — cases will be linked for document preview</span>
                    )}
                  </div>
                  <Button
                    onClick={() => saveBulkMutation.mutate(extractedCases)}
                    disabled={saveBulkMutation.isPending}
                    className="bg-amber-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
                    data-testid="button-confirm-bulk-upload"
                  >
                    {saveBulkMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                    <span>Save All {extractedCases.length} Cases</span>
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {extractedCases.map((entry, idx) => (
                    <Card key={idx} className="bg-slate-900 border-slate-700 rounded-xl" data-testid={`extracted-case-${idx}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white">{entry.citation}</p>
                            <p className="text-[10px] text-amber-400">{entry.court}</p>
                            <p className="text-[10px] text-slate-300 mt-1">{entry.title}</p>
                            <p className="text-[10px] text-slate-500 mt-1">{entry.summary}</p>
                            {entry.keywords.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {entry.keywords.map((kw, i) => (
                                  <Badge key={i} className="bg-slate-800 text-slate-400 border-slate-700 rounded-lg text-[7px]">{kw}</Badge>
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
          <Scale size={16} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Case Law Entries ({caseLawEntries?.length || 0})
          </span>
        </div>
        {(caseLawEntries?.length || 0) > 0 && !showDeleteAllConfirm && (
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
            <span className="text-[10px] text-red-300 font-bold">Delete all {caseLawEntries?.length} entries?</span>
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold h-7 px-3 rounded-lg"
              onClick={() => deleteAllCaseLawMutation.mutate()}
              disabled={deleteAllCaseLawMutation.isPending}
            >
              {deleteAllCaseLawMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 text-[9px] h-7 px-2 rounded-lg"
              onClick={() => setShowDeleteAllConfirm(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-amber-500" size={24} />
        </div>
      ) : caseLawEntries?.length === 0 ? (
        <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
          <CardContent className="p-12 text-center">
            <Scale size={32} className="text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No case law entries yet. Add individual entries or upload a CSV file.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {caseLawEntries?.map((entry) => (
            <Card key={entry.id} className="bg-[#1e293b] border-slate-800 rounded-[1.5rem]" data-testid={`caselaw-entry-${entry.id}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">{entry.citation}</p>
                    <p className="text-xs text-amber-400 mt-1">{entry.court}</p>
                    <p className="text-xs text-slate-300 mt-1">{entry.title}</p>
                    <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{entry.summary}</p>
                    {entry.keywords.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {entry.keywords.map((kw, i) => (
                          <Badge key={i} className="bg-slate-800 text-slate-400 border-slate-700 rounded-lg text-[8px]">
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="text-slate-500" onClick={() => startEdit(entry)} data-testid={`button-edit-caselaw-${entry.id}`}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-slate-500" onClick={() => deleteMutation.mutate(entry.id)} data-testid={`button-delete-caselaw-${entry.id}`}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
  const { data: docs, isLoading } = useQuery<StatuteDoc[]>({ queryKey: ["/api/admin/statute-documents"] });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, uploaded: 0, errors: 0 });
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/statute-documents/${id}`);
    },
    onSuccess: () => {
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
      <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Upload size={16} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Upload Statute Documents
          </span>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <p className="text-xs text-slate-400">
            Upload full statute documents that users can search and read in the PDF viewer. Supports .txt, .pdf, .json, .csv files (up to 500 files, 50 MB each).
          </p>

          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 block">
              Select Files (.txt, .json, .csv, .pdf)
            </label>
            <Input
              type="file"
              accept=".txt,.json,.csv,.pdf"
              multiple
              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
              className="bg-[#101a2b] border-[hsl(var(--preview-border))] text-slate-100 rounded-xl text-xs file:text-slate-400 file:mr-4"
              data-testid="input-statute-doc-files"
            />
            {selectedFiles.length > 0 && (
              <p className="text-[10px] text-amber-400 font-bold">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {isUploading && uploadProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Uploading {uploadProgress.current} of {uploadProgress.total} files...</span>
                <span className="text-amber-400 font-bold">{Math.round((uploadProgress.current / uploadProgress.total) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
              <div className="text-[9px] flex flex-wrap gap-3">
                <span className="text-emerald-400 font-bold">Uploaded: {uploadProgress.uploaded}</span>
                <span className="text-red-400 font-bold">Failed: {uploadProgress.errors}</span>
                <span className="text-slate-400 font-bold">Remaining: {Math.max(uploadProgress.total - uploadProgress.current, 0)}</span>
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="bg-amber-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
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
            <FileText size={16} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              Statute Library ({docs?.length || 0})
            </span>
          </div>
          {(docs?.length || 0) > 0 && !showDeleteAllConfirm && (
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
              <span className="text-[10px] text-red-300 font-bold">Delete all {docs?.length} documents?</span>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold h-7 px-3 rounded-lg"
                onClick={() => deleteAllMutation.mutate()}
                disabled={deleteAllMutation.isPending}
              >
                {deleteAllMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : "Confirm"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400 text-[9px] h-7 px-2 rounded-lg"
                onClick={() => setShowDeleteAllConfirm(false)}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-amber-500" size={24} />
          </div>
        ) : docs?.length === 0 ? (
          <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
            <CardContent className="p-12 text-center">
              <FileText size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500">No statute documents uploaded yet</p>
            </CardContent>
          </Card>
        ) : (
          docs?.map((doc) => (
            <Card key={doc.id} className="bg-[#1e293b] border-slate-800 rounded-[1.5rem]" data-testid={`statute-doc-${doc.id}`}>
              <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <FileText size={18} className="text-slate-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-slate-800 text-slate-400 border-slate-700 rounded-lg text-[8px]">
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
                  className="text-slate-500"
                  onClick={() => deleteMutation.mutate(doc.id)}
                  data-testid={`button-delete-statute-doc-${doc.id}`}
                >
                  <Trash2 size={14} />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
