import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Redirect } from "wouter";
import {
  Shield, Users, BarChart3, Database, Upload, Trash2, Crown,
  UserCheck, UserX, Loader2, FileText, AlertTriangle, Plus,
  Scale, Pencil, X, Check, FileUp
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

export default function AdminPanelPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"stats" | "users" | "knowledge" | "case-law" | "statute-docs">("stats");

  if (!user?.isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="space-y-8 fade-in" data-testid="admin-panel-page">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Shield size={20} className="text-amber-500" />
          <h1 className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Admin Control Panel
          </h1>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-black">
          Platform Management
        </p>
      </div>

      <div className="flex gap-2">
        {[
          { id: "stats" as const, label: "Analytics", icon: BarChart3 },
          { id: "users" as const, label: "Users", icon: Users },
          { id: "knowledge" as const, label: "Knowledge Vault", icon: Database },
          { id: "case-law" as const, label: "Case Law", icon: Scale },
          { id: "statute-docs" as const, label: "Statute Library", icon: FileText },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "default" : "ghost"}
            className={`rounded-xl text-[10px] uppercase tracking-widest font-black ${activeTab === tab.id ? "bg-amber-500 text-slate-950" : "text-slate-400"}`}
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
    { label: "Messages", value: stats?.totalMessages || 0, icon: BarChart3, color: "text-purple-400" },
    { label: "Documents", value: stats?.totalDocuments || 0, icon: Database, color: "text-amber-400" },
    { label: "Knowledge Entries", value: stats?.totalKnowledge || 0, icon: Database, color: "text-cyan-400" },
    { label: "Cache Entries", value: stats?.totalCacheEntries || 0, icon: BarChart3, color: "text-pink-400" },
    { label: "Usage This Month", value: stats?.totalUsageThisMonth || 0, icon: BarChart3, color: "text-orange-400" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="stats-grid">
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                  <p className="text-2xl font-bold text-purple-400">
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
  const { data: allUsers, isLoading } = useQuery<User[]>({ queryKey: ["/api/admin/users"] });

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newTier, setNewTier] = useState("free");
  const [newIsAdmin, setNewIsAdmin] = useState(false);

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
      setConfirmDeleteId(null);
      toast({ title: "User removed successfully" });
    },
    onError: () => {
      toast({ title: "Failed to remove user", variant: "destructive" });
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
                className="bg-slate-800 border-slate-700 rounded-xl text-sm"
                data-testid="input-new-firstname"
              />
              <Input
                placeholder="Last name"
                value={newLastName}
                onChange={(e) => setNewLastName(e.target.value)}
                className="bg-slate-800 border-slate-700 rounded-xl text-sm"
                data-testid="input-new-lastname"
              />
            </div>
            <Input
              placeholder="Email address"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="bg-slate-800 border-slate-700 rounded-xl text-sm"
              data-testid="input-new-email"
            />
            <Input
              placeholder="Password (min 8 characters)"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="bg-slate-800 border-slate-700 rounded-xl text-sm"
              data-testid="input-new-password"
            />
            <div className="flex items-center gap-4 flex-wrap">
              <Select value={newTier} onValueChange={setNewTier}>
                <SelectTrigger className="w-40 bg-slate-800 border-slate-700 rounded-xl text-xs" data-testid="select-new-tier">
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

                <Select
                  value={u.subscriptionTier}
                  onValueChange={(val) => updateUserMutation.mutate({ userId: u.id, data: { subscriptionTier: val } })}
                >
                  <SelectTrigger className="w-32 bg-slate-800 border-slate-700 rounded-xl text-xs" data-testid={`select-tier-${u.id}`}>
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
            </CardContent>
          </Card>
        ))}
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

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      toast({ title: "Please select files to upload", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("category", uploadCategory);
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] });
      setSelectedFiles([]);
      const fileInput = document.querySelector('[data-testid="input-knowledge-files"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      let msg = `${data.uploaded} document${data.uploaded !== 1 ? "s" : ""} added to vault`;
      if (data.errors?.length) {
        msg += ` (${data.errors.length} skipped)`;
      }
      toast({ title: msg });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
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
            <SelectTrigger className="bg-slate-800 border-slate-700 rounded-xl text-xs" data-testid="select-knowledge-category">
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
              Select Files (.txt, .json, .csv, .pdf — select multiple)
            </label>
            <Input
              type="file"
              accept=".txt,.json,.csv,.pdf"
              multiple
              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
              className="bg-slate-800 border-slate-700 rounded-xl text-xs file:text-slate-400 file:mr-4"
              data-testid="input-knowledge-files"
            />
            {selectedFiles.length > 0 && (
              <p className="text-[10px] text-amber-400 font-bold">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

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
        <div className="flex items-center gap-3">
          <Database size={16} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Vault Documents ({docs?.length || 0})
          </span>
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
  const [bulkPreview, setBulkPreview] = useState<Array<{ citation: string; court: string; title: string; summary: string; keywords: string }>>([]);
  const [formData, setFormData] = useState({ citation: "", court: "", title: "", summary: "", keywords: "" });

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

  const bulkMutation = useMutation({
    mutationFn: async (entries: typeof bulkPreview) => {
      const res = await apiRequest("POST", "/api/admin/case-law/bulk", {
        entries: entries.map(e => ({
          ...e,
          keywords: e.keywords.split(",").map(k => k.trim()).filter(Boolean),
        })),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/case-law"] });
      toast({ title: `${data.inserted} case law entries uploaded${data.errors?.length ? `, ${data.errors.length} skipped` : ""}` });
      setBulkPreview([]);
      setShowBulkUpload(false);
    },
    onError: () => toast({ title: "Failed to bulk upload case law", variant: "destructive" }),
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const ext = file.name.split(".").pop()?.toLowerCase();

      if (ext === "json") {
        try {
          let jsonData = JSON.parse(text);
          if (!Array.isArray(jsonData)) {
            if (jsonData.entries && Array.isArray(jsonData.entries)) jsonData = jsonData.entries;
            else if (jsonData.caseLaw && Array.isArray(jsonData.caseLaw)) jsonData = jsonData.caseLaw;
            else if (jsonData.cases && Array.isArray(jsonData.cases)) jsonData = jsonData.cases;
            else if (jsonData.data && Array.isArray(jsonData.data)) jsonData = jsonData.data;
            else { toast({ title: "JSON must contain an array of case law entries", variant: "destructive" }); return; }
          }
          const parsed: typeof bulkPreview = [];
          for (const item of jsonData) {
            if (item.citation && item.title) {
              parsed.push({
                citation: String(item.citation || "").trim(),
                court: String(item.court || "").trim(),
                title: String(item.title || "").trim(),
                summary: String(item.summary || item.description || "").trim(),
                keywords: Array.isArray(item.keywords) ? item.keywords.join(", ") : String(item.keywords || ""),
              });
            }
          }
          if (parsed.length === 0) { toast({ title: "No valid entries found. Each entry needs at least citation and title.", variant: "destructive" }); return; }
          setBulkPreview(parsed);
        } catch {
          toast({ title: "Invalid JSON file", variant: "destructive" });
        }
        return;
      }

      const lines = text.split("\n").filter(l => l.trim());
      const parsed: typeof bulkPreview = [];
      const startIdx = lines[0]?.toLowerCase().includes("citation") ? 1 : 0;
      for (let i = startIdx; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length >= 4) {
          parsed.push({
            citation: cols[0].trim(),
            court: cols[1].trim(),
            title: cols[2].trim(),
            summary: cols[3].trim(),
            keywords: cols[4]?.trim() || "",
          });
        }
      }
      setBulkPreview(parsed);
    };
    reader.readAsText(file);
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
            className="bg-slate-900 border-slate-700 text-white rounded-xl text-sm"
            data-testid="input-caselaw-citation"
          />
          <Input
            placeholder="Court (e.g. Supreme Court of Pakistan)"
            value={formData.court}
            onChange={(e) => setFormData(prev => ({ ...prev, court: e.target.value }))}
            className="bg-slate-900 border-slate-700 text-white rounded-xl text-sm"
            data-testid="input-caselaw-court"
          />
        </div>
        <Input
          placeholder="Title (e.g. State vs Ahmed - Property Dispute)"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="bg-slate-900 border-slate-700 text-white rounded-xl text-sm"
          data-testid="input-caselaw-title"
        />
        <Textarea
          placeholder="Summary of the case and legal principle established"
          value={formData.summary}
          onChange={(e) => setFormData(prev => ({ ...prev, summary: e.target.value }))}
          className="bg-slate-900 border-slate-700 text-white rounded-xl text-sm resize-none"
          rows={3}
          data-testid="input-caselaw-summary"
        />
        <Input
          placeholder="Keywords (comma-separated, e.g. bail, cheque, fraud)"
          value={formData.keywords}
          onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
          className="bg-slate-900 border-slate-700 text-white rounded-xl text-sm"
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
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="text-amber-400 rounded-xl text-[10px] uppercase tracking-widest font-black"
            onClick={() => { setShowBulkUpload(!showBulkUpload); setShowAddForm(false); cancelEdit(); }}
            data-testid="button-toggle-bulk-upload"
          >
            <FileUp size={14} />
            <span>Bulk CSV Upload</span>
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
                Bulk CSV Upload
              </span>
              <Button size="icon" variant="ghost" className="text-slate-500" onClick={() => { setShowBulkUpload(false); setBulkPreview([]); }} data-testid="button-cancel-bulk">
                <X size={14} />
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              Upload a <span className="text-amber-400 font-bold">CSV</span> or <span className="text-amber-400 font-bold">JSON</span> file.
              CSV columns: Citation, Court, Title, Summary, Keywords.
              JSON: an array of objects with citation, court, title, summary, keywords fields.
            </p>
            <Input
              type="file"
              accept=".csv,.txt,.json"
              onChange={handleFileUpload}
              className="bg-slate-900 border-slate-700 text-white rounded-xl text-sm"
              data-testid="input-bulk-csv-file"
            />
            {bulkPreview.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs text-slate-300 font-bold">{bulkPreview.length} entries parsed</span>
                  <Button
                    onClick={() => bulkMutation.mutate(bulkPreview)}
                    disabled={bulkMutation.isPending}
                    className="bg-amber-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
                    data-testid="button-confirm-bulk-upload"
                  >
                    {bulkMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                    <span>Upload {bulkPreview.length} Entries</span>
                  </Button>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {bulkPreview.slice(0, 10).map((entry, idx) => (
                    <Card key={idx} className="bg-slate-900 border-slate-700 rounded-xl" data-testid={`bulk-preview-${idx}`}>
                      <CardContent className="p-3">
                        <p className="text-xs font-bold text-white">{entry.citation}</p>
                        <p className="text-[10px] text-slate-400">{entry.court} — {entry.title}</p>
                        <p className="text-[10px] text-slate-500 truncate">{entry.summary}</p>
                      </CardContent>
                    </Card>
                  ))}
                  {bulkPreview.length > 10 && (
                    <p className="text-[10px] text-slate-500 text-center">...and {bulkPreview.length - 10} more</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
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

  async function handleUpload() {
    if (selectedFiles.length === 0) {
      toast({ title: "Please select files to upload", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        formData.append("files", file);
      }

      const res = await fetch("/api/admin/statute-documents", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      queryClient.invalidateQueries({ queryKey: ["/api/admin/statute-documents"] });
      setSelectedFiles([]);
      const fileInput = document.querySelector('[data-testid="input-statute-doc-files"]') as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      toast({ title: `${data.count} statute document${data.count !== 1 ? "s" : ""} uploaded` });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setIsUploading(false);
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
              className="bg-slate-800 border-slate-700 rounded-xl text-xs file:text-slate-400 file:mr-4"
              data-testid="input-statute-doc-files"
            />
            {selectedFiles.length > 0 && (
              <p className="text-[10px] text-amber-400 font-bold">
                {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

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
        <div className="flex items-center gap-3">
          <FileText size={16} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Statute Library ({docs?.length || 0})
          </span>
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
