import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Redirect } from "wouter";
import {
  Shield, Users, BarChart3, Database, Upload, Trash2, Crown,
  UserCheck, UserX, Loader2, FileText, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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

export default function AdminPanelPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"stats" | "users" | "knowledge">("stats");

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
    </div>
  );
}

function StatsSection() {
  const { data: stats, isLoading } = useQuery<SystemStats>({ queryKey: ["/api/admin/stats"] });

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
  );
}

function UsersSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: allUsers, isLoading } = useQuery<User[]>({ queryKey: ["/api/admin/users"] });

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-amber-500" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="users-section">
      <div className="flex items-center gap-3 mb-4">
        <Users size={16} className="text-amber-500" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
          {allUsers?.length || 0} Registered Users
        </span>
      </div>

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
                  data-testid={`button-toggle-admin-${u.id}`}
                  className={u.isAdmin ? "text-amber-400" : "text-slate-500"}
                >
                  {u.isAdmin ? <UserCheck size={16} /> : <UserX size={16} />}
                </Button>
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
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState("general");
  const [uploadContent, setUploadContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
    if (!uploadTitle.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!selectedFile && !uploadContent.trim()) {
      toast({ title: "Provide a file or content", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("title", uploadTitle.trim());
      formData.append("category", uploadCategory);
      if (selectedFile) {
        formData.append("file", selectedFile);
      } else {
        formData.append("content", uploadContent.trim());
      }

      const res = await fetch("/api/admin/knowledge", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload failed");

      queryClient.invalidateQueries({ queryKey: ["/api/admin/knowledge"] });
      setUploadTitle("");
      setUploadContent("");
      setSelectedFile(null);
      toast({ title: "Document added to vault" });
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
            Upload to Knowledge Vault
          </span>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <Input
            placeholder="Document title"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            className="bg-slate-800 border-slate-700 rounded-xl text-sm"
            data-testid="input-knowledge-title"
          />

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
              Upload File (.txt, up to 10MB)
            </label>
            <Input
              type="file"
              accept=".txt"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="bg-slate-800 border-slate-700 rounded-xl text-xs file:text-slate-400 file:mr-4"
              data-testid="input-knowledge-file"
            />
          </div>

          {!selectedFile && (
            <Textarea
              placeholder="Or paste document content here..."
              value={uploadContent}
              onChange={(e) => setUploadContent(e.target.value)}
              className="bg-slate-800 border-slate-700 rounded-xl text-sm min-h-[120px]"
              data-testid="input-knowledge-content"
            />
          )}

          <Button
            onClick={handleUpload}
            disabled={isUploading}
            className="bg-amber-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
            data-testid="button-upload-knowledge"
          >
            {isUploading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            <span>{isUploading ? "Uploading..." : "Add to Vault"}</span>
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
