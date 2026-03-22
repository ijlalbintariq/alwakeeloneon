import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building2,
  Check,
  Crown,
  FileText,
  Filter,
  Loader2,
  Mail,
  MoreVertical,
  Plus,
  Search,
  Send,
  Shield,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Org {
  id: number;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt?: string;
}

interface OrgMember {
  id: number;
  orgId: number;
  userId: string;
  role: "owner" | "admin" | "member" | string;
  joinedAt?: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

interface OrgInvite {
  id: number;
  orgId: number;
  email: string;
  invitedBy: string;
  status: "pending" | "accepted" | "declined" | string;
  createdAt: string;
}

interface PendingInvite {
  id: number;
  orgId: number;
  email: string;
  invitedBy: string;
  status: "pending" | "accepted" | "declined" | string;
  createdAt: string;
  orgName: string;
}

interface OrgKnowledgeDoc {
  id: number;
  orgId: number;
  title: string;
  filename: string;
  content: string;
  category: string;
  uploadedBy: string | null;
  createdAt: string;
}

type OrgView = "team" | "vault";

function formatDate(value?: string | null): string {
  if (!value) return "N/A";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

function displayName(member: OrgMember): string {
  const name = `${member.firstName || ""} ${member.lastName || ""}`.trim();
  return name || member.email || "Unknown Member";
}

function getRoleMeta(role: string): { label: string; badge: string; icon: "crown" | "shield" | "user" } {
  if (role === "owner") {
    return {
      label: "Owner",
      badge: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
      icon: "crown",
    };
  }
  if (role === "admin") {
    return {
      label: "Admin",
      badge: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
      icon: "shield",
    };
  }
  return {
    label: "Member",
    badge: "bg-slate-500/20 text-slate-300 border border-slate-500/30",
    icon: "user",
  };
}

function initialsFromName(name: string): string {
  const parts = name.split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "U";
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function excerpt(content: string, max = 130): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}...`;
}

function categoryChip(category: string): string {
  const c = category.toLowerCase();
  if (c.includes("case")) return "bg-amber-500/20 text-amber-300 border border-amber-500/30";
  if (c.includes("statute")) return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
  if (c.includes("contract")) return "bg-blue-500/20 text-blue-300 border border-blue-500/30";
  if (c.includes("precedent")) return "bg-purple-500/20 text-purple-300 border border-purple-500/30";
  return "bg-slate-500/20 text-slate-300 border border-slate-500/30";
}

export default function OrganizationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [view, setView] = useState<OrgView>("team");
  const [orgName, setOrgName] = useState("");
  const [orgDesc, setOrgDesc] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [docSearch, setDocSearch] = useState("");
  const [docCategoryFilter, setDocCategoryFilter] = useState("all");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("general");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [previewDoc, setPreviewDoc] = useState<OrgKnowledgeDoc | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: org, isLoading: orgLoading } = useQuery<Org | null>({
    queryKey: ["/api/org"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/org");
      return (await res.json()) as Org | null;
    },
  });

  const { data: members = [] } = useQuery<OrgMember[]>({
    queryKey: ["/api/org/members", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/org/${org!.id}/members`);
      return (await res.json()) as OrgMember[];
    },
  });

  const { data: invites = [] } = useQuery<OrgInvite[]>({
    queryKey: ["/api/org/invites", org?.id],
    enabled: !!org?.id && org?.ownerId === user?.id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/org/${org!.id}/invites`);
      return (await res.json()) as OrgInvite[];
    },
  });

  const { data: knowledge = [] } = useQuery<OrgKnowledgeDoc[]>({
    queryKey: ["/api/org/knowledge", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/org/${org!.id}/knowledge`);
      return (await res.json()) as OrgKnowledgeDoc[];
    },
  });

  const { data: pendingInvites = [] } = useQuery<PendingInvite[]>({
    queryKey: ["/api/org/invites/pending"],
    enabled: !org,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/org/invites/pending");
      return (await res.json()) as PendingInvite[];
    },
  });

  const createOrg = useMutation({
    mutationFn: async (payload: { name: string; description: string }) => {
      const res = await apiRequest("POST", "/api/org", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Organization created" });
      setOrgName("");
      setOrgDesc("");
      queryClient.invalidateQueries({ queryKey: ["/api/org"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org/invites/pending"] });
    },
    onError: (err: any) => {
      toast({ title: "Create failed", description: err?.message || "Could not create organization.", variant: "destructive" });
    },
  });

  const acceptInvite = useMutation({
    mutationFn: async (inviteId: number) => {
      await apiRequest("POST", `/api/org/invites/${inviteId}/accept`);
    },
    onSuccess: () => {
      toast({ title: "Invite accepted" });
      queryClient.invalidateQueries({ queryKey: ["/api/org"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org/invites/pending"] });
    },
    onError: (err: any) => {
      toast({ title: "Accept failed", description: err?.message || "Could not accept invite.", variant: "destructive" });
    },
  });

  const declineInvite = useMutation({
    mutationFn: async (inviteId: number) => {
      await apiRequest("POST", `/api/org/invites/${inviteId}/decline`);
    },
    onSuccess: () => {
      toast({ title: "Invite declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/invites/pending"] });
    },
    onError: (err: any) => {
      toast({ title: "Decline failed", description: err?.message || "Could not decline invite.", variant: "destructive" });
    },
  });

  const inviteMember = useMutation({
    mutationFn: async (email: string) => {
      if (!org?.id) throw new Error("Organization not available");
      const res = await apiRequest("POST", `/api/org/${org.id}/invite`, { email });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation sent" });
      setInviteEmail("");
      setShowInviteModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/org/invites"] });
    },
    onError: (err: any) => {
      toast({ title: "Invite failed", description: err?.message || "Could not send invite.", variant: "destructive" });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      if (!org?.id) throw new Error("Organization not available");
      await apiRequest("DELETE", `/api/org/${org.id}/members/${memberId}`);
    },
    onSuccess: () => {
      toast({ title: "Member removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
    },
    onError: (err: any) => {
      toast({ title: "Remove failed", description: err?.message || "Could not remove member.", variant: "destructive" });
    },
  });

  const uploadKnowledge = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("Organization not available");
      if (!selectedFile) throw new Error("Please select a file");

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", docTitle.trim() || selectedFile.name);
      formData.append("category", docCategory);

      const res = await fetch(`/api/org/${org.id}/knowledge`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(body?.message || "Upload failed");
      }

      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document uploaded" });
      setShowUploadModal(false);
      setDocTitle("");
      setDocCategory("general");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: ["/api/org/knowledge"] });
    },
    onError: (err: any) => {
      toast({ title: "Upload failed", description: err?.message || "Could not upload file.", variant: "destructive" });
    },
  });

  const deleteKnowledge = useMutation({
    mutationFn: async (docId: number) => {
      if (!org?.id) throw new Error("Organization not available");
      await apiRequest("DELETE", `/api/org/${org.id}/knowledge/${docId}`);
    },
    onSuccess: () => {
      toast({ title: "Document deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/knowledge"] });
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err?.message || "Could not delete document.", variant: "destructive" });
    },
  });

  const deleteOrg = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("Organization not available");
      await apiRequest("DELETE", `/api/org/${org.id}`);
    },
    onSuccess: () => {
      toast({ title: "Organization deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/org"] });
      queryClient.invalidateQueries({ queryKey: ["/api/org/invites/pending"] });
      setView("team");
    },
    onError: (err: any) => {
      toast({ title: "Delete failed", description: err?.message || "Could not delete organization.", variant: "destructive" });
    },
  });

  const canCreateOrg = !!(user?.subscriptionTier === "chamber" || user?.subscriptionTier === "enterprise" || user?.isAdmin);
  const isOwner = !!(org && user && org.ownerId === user.id);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const full = displayName(m).toLowerCase();
      return full.includes(q) || (m.email || "").toLowerCase().includes(q) || (m.role || "").toLowerCase().includes(q);
    });
  }, [memberSearch, members]);

  const pendingOrgInvites = useMemo(
    () => invites.filter((i) => i.status === "pending"),
    [invites],
  );

  const filteredPendingOrgInvites = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return pendingOrgInvites;
    return pendingOrgInvites.filter((i) => i.email.toLowerCase().includes(q));
  }, [memberSearch, pendingOrgInvites]);

  const filteredKnowledge = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return knowledge.filter((doc) => {
      const categoryOk = docCategoryFilter === "all" || doc.category === docCategoryFilter;
      const queryOk =
        !q ||
        doc.title.toLowerCase().includes(q) ||
        doc.filename.toLowerCase().includes(q) ||
        doc.category.toLowerCase().includes(q) ||
        (doc.content || "").toLowerCase().includes(q);
      return categoryOk && queryOk;
    });
  }, [docCategoryFilter, docSearch, knowledge]);

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      map.set(m.userId, displayName(m));
    }
    return map;
  }, [members]);

  const knowledgeCategories = useMemo(() => {
    const set = new Set<string>();
    for (const doc of knowledge) {
      if (doc.category) set.add(doc.category);
    }
    return Array.from(set).sort();
  }, [knowledge]);

  if (orgLoading) {
    return (
      <section className="h-full rounded-xl md:rounded-[1.8rem] border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-bg))] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-amber-500" />
      </section>
    );
  }

  if (!org) {
    if (!canCreateOrg) {
      return (
        <section className="h-full rounded-xl md:rounded-[1.8rem] overflow-y-auto border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-bg))] p-6 md:p-10 text-[hsl(var(--preview-text-primary))]">
          <div className="mx-auto max-w-3xl space-y-6">
            <div className="rounded-2xl border border-amber-500/20 bg-[hsl(var(--preview-surface))/0.7] p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-amber-400 mt-0.5" size={20} />
                <div>
                  <h2 className="text-2xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                    Organization Features Locked
                  </h2>
                  <p className="mt-2 text-sm text-slate-300">
                    Upgrade to Chamber or Enterprise to create and manage an organization workspace.
                  </p>
                </div>
              </div>
            </div>

            {pendingInvites.length > 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-[hsl(var(--preview-surface))/0.65] p-6 space-y-4">
                <h3 className="text-lg font-bold text-white">Pending Invitations</h3>
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="rounded-xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-bg))/0.8] p-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-100">{invite.orgName}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Received {formatDate(invite.createdAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptInvite.mutate(invite.id)}
                        className="h-9 px-4 rounded-lg bg-amber-500 text-[hsl(var(--preview-bg))] text-sm font-bold hover:bg-amber-400 transition-colors"
                        data-testid={`button-accept-invite-${invite.id}`}
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => declineInvite.mutate(invite.id)}
                        className="h-9 px-4 rounded-lg border border-slate-600 text-slate-300 text-sm font-semibold hover:bg-slate-800 transition-colors"
                        data-testid={`button-decline-invite-${invite.id}`}
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );
    }

    return (
      <section className="h-full rounded-xl md:rounded-[1.8rem] overflow-hidden border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-bg))] text-[hsl(var(--preview-text-primary))]">
        <div className="flex h-full min-h-0 flex-col">
          <header className="shrink-0 border-b border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.9] backdrop-blur-md px-6 md:px-10 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="text-amber-400" size={24} />
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Al Wakeelo</h2>
            </div>
            <div className="text-xs text-slate-400">Organization Setup</div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto relative p-4 md:p-8">
            <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-amber-500/10 blur-[90px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-amber-500/5 blur-[80px] pointer-events-none" />

            <div className="relative mx-auto max-w-3xl space-y-5">
              {pendingInvites.length > 0 && (
                <div className="rounded-2xl border border-amber-500/20 bg-[hsl(var(--preview-surface))/0.65] p-5 space-y-3">
                  <h3 className="text-base font-bold text-white">Pending Invitations</h3>
                  {pendingInvites.map((invite) => (
                    <div key={invite.id} className="rounded-xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-bg))/0.75] p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{invite.orgName}</p>
                        <p className="text-xs text-slate-500">{invite.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => acceptInvite.mutate(invite.id)}
                          className="h-8 px-3 rounded-lg bg-amber-500 text-[hsl(var(--preview-bg))] text-xs font-bold"
                          data-testid={`button-accept-invite-${invite.id}`}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => declineInvite.mutate(invite.id)}
                          className="h-8 px-3 rounded-lg border border-slate-600 text-slate-300 text-xs font-semibold"
                          data-testid={`button-decline-invite-${invite.id}`}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.6] backdrop-blur-xl shadow-2xl overflow-hidden">
                <div className="h-36 md:h-40 relative bg-[hsl(var(--preview-surface-elevated))] border-b border-[hsl(var(--preview-border))]">
                  <div className="absolute inset-0 bg-gradient-to-t from-[hsl(var(--preview-surface))/0.9] to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6 md:p-8 flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-[hsl(var(--preview-bg))] flex items-center justify-center shadow-lg">
                      <Building2 size={24} />
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                      Create Private Organization
                    </h1>
                  </div>
                </div>

                <div className="p-6 md:p-8 space-y-6">
                  <p className="text-slate-300 text-lg leading-relaxed">
                    Set up your digital headquarters to collaborate with your legal team and share a secure, private knowledge base.
                  </p>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-200">Organization Name</label>
                    <div className="relative">
                      <Building2 size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder="e.g., Malik & Associates"
                        className="w-full h-12 rounded-xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-bg))/0.8] pl-11 pr-4 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        data-testid="input-org-name"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-200">Description <span className="text-slate-500 font-normal">(Optional)</span></label>
                    <div className="relative">
                      <FileText size={16} className="absolute left-4 top-4 text-slate-500" />
                      <textarea
                        value={orgDesc}
                        onChange={(e) => setOrgDesc(e.target.value)}
                        placeholder="Enter brief details about your firm's practice areas..."
                        className="w-full min-h-[140px] rounded-xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-bg))/0.8] pl-11 pr-4 py-3 text-slate-100 placeholder:text-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                        data-testid="input-org-description"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <button
                      onClick={() => {
                        setOrgName("");
                        setOrgDesc("");
                      }}
                      className="text-sm font-medium text-slate-400 hover:text-amber-400 transition-colors"
                      data-testid="button-org-cancel"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={() => createOrg.mutate({ name: orgName.trim(), description: orgDesc.trim() })}
                      disabled={!orgName.trim() || createOrg.isPending}
                      className="h-12 px-7 rounded-xl bg-amber-500 text-[hsl(var(--preview-bg))] text-base font-bold hover:bg-amber-400 disabled:opacity-50 flex items-center gap-2"
                      data-testid="button-create-org"
                    >
                      {createOrg.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Create Organization
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>

                <div className="px-6 md:px-8 pb-6 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-amber-500" />
                  <div className="h-1.5 flex-1 rounded-full bg-slate-700" />
                  <div className="h-1.5 flex-1 rounded-full bg-slate-700" />
                  <span className="ml-3 text-xs text-slate-500">Step 1 of 3</span>
                </div>
              </div>
            </div>
          </main>
        </div>
      </section>
    );
  }

  return (
    <section className="h-full rounded-xl md:rounded-[1.8rem] overflow-hidden border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-bg))] text-[hsl(var(--preview-text-primary))] fade-in">
      <div className="flex h-full min-h-0">
        <aside className="w-[76px] lg:w-[260px] shrink-0 border-r border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.95]">
          <div className="h-full flex flex-col p-4">
            <div className="mb-8 px-1">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
                  <Building2 size={18} />
                </div>
                <div className="hidden lg:block min-w-0">
                  <h1 className="text-slate-100 text-base font-bold truncate">{org.name}</h1>
                  <p className="text-slate-400 text-xs truncate">Organization</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 space-y-2">
              <button
                onClick={() => setView("team")}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                  view === "team"
                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
                data-testid="button-org-view-team"
              >
                <Users size={18} />
                <span className="hidden lg:block text-sm font-medium">Team Members</span>
              </button>

              <button
                onClick={() => setView("vault")}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                  view === "vault"
                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-300"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                }`}
                data-testid="button-org-view-vault"
              >
                <BookOpen size={18} />
                <span className="hidden lg:block text-sm font-medium">Shared Vault</span>
              </button>
            </nav>

            <div className="space-y-2">
              {isOwner && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="w-full h-10 rounded-xl bg-amber-500 text-[hsl(var(--preview-bg))] text-sm font-bold flex items-center justify-center gap-2 hover:bg-amber-400 transition-colors"
                  data-testid="button-open-invite-modal"
                >
                  <UserPlus size={14} />
                  <span className="hidden lg:inline">Invite Member</span>
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => {
                    if (confirm("Delete this organization and all organization data?")) {
                      deleteOrg.mutate();
                    }
                  }}
                  className="w-full h-10 rounded-xl border border-red-500/30 text-red-300 text-sm font-semibold hover:bg-red-500/10 transition-colors"
                  data-testid="button-delete-org"
                >
                  <span className="hidden lg:inline">Delete Organization</span>
                  <span className="lg:hidden">Del</span>
                </button>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 min-h-0 overflow-y-auto relative p-4 lg:p-8">
          <div className="absolute top-0 right-0 w-[460px] h-[460px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[380px] h-[380px] bg-blue-900/10 rounded-full blur-[90px] pointer-events-none" />

          <div className="relative z-10 max-w-6xl mx-auto flex flex-col gap-7">
            {view === "team" ? (
              <>
                <div className="flex flex-wrap justify-between items-end gap-4 pb-4 border-b border-amber-500/10">
                  <div>
                    <h2 className="text-slate-100 text-3xl lg:text-4xl font-black leading-tight">Organization Management</h2>
                    <p className="text-slate-400 text-base font-medium mt-1">Manage your firm's private space and team access.</p>
                  </div>
                  <div className="flex gap-3">
                    <a
                      href="/settings"
                      className="h-10 px-6 rounded-xl bg-[hsl(var(--preview-surface-elevated))] border border-[hsl(var(--preview-border))] text-slate-300 text-sm font-bold flex items-center gap-2 hover:bg-[hsl(var(--preview-surface-elevated))/0.9] transition-colors"
                    >
                      Settings
                    </a>
                    {isOwner && (
                      <button
                        onClick={() => setShowInviteModal(true)}
                        className="h-10 px-6 rounded-xl bg-amber-500 text-[hsl(var(--preview-bg))] text-sm font-bold shadow-[0_0_15px_rgba(249,164,6,0.28)] hover:bg-amber-400 transition-colors flex items-center gap-2"
                        data-testid="button-invite-top"
                      >
                        <Plus size={15} />
                        Invite Member
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.7] backdrop-blur-xl p-6">
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Shared Documents</p>
                    <p className="text-4xl font-bold text-slate-100 mt-1">{knowledge.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.7] backdrop-blur-xl p-6">
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Team Members</p>
                    <p className="text-4xl font-bold text-slate-100 mt-1">{members.length}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-slate-100 text-2xl font-bold">Team Members</h3>
                    <div className="w-64 max-w-full flex items-center gap-2 rounded-lg px-3 py-1.5 bg-[hsl(var(--preview-surface-elevated))/0.9] border border-[hsl(var(--preview-border))]">
                      <Search size={16} className="text-slate-400" />
                      <input
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                        placeholder="Search members..."
                        data-testid="input-member-search"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.7] backdrop-blur-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[760px]">
                        <thead>
                          <tr className="bg-[hsl(var(--preview-surface-elevated))/0.5] border-b border-slate-700/50">
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Name</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Role</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Email</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">Status</th>
                            <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/30">
                          {filteredMembers.map((member) => {
                            const name = displayName(member);
                            const role = getRoleMeta(member.role);

                            return (
                              <tr key={member.userId} className="hover:bg-white/5 transition-colors" data-testid={`member-row-${member.userId}`}>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-sm">
                                      {initialsFromName(name)}
                                    </div>
                                    <div>
                                      <p className="text-sm font-semibold text-slate-100">{name}</p>
                                      <p className="text-xs text-slate-500">Joined {formatDate(member.joinedAt || null)}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${role.badge}`}>
                                    {role.icon === "crown" && <Crown size={12} />}
                                    {role.icon === "shield" && <Shield size={12} />}
                                    {role.icon === "user" && <User size={12} />}
                                    {role.label}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-400">{member.email || "N/A"}</td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2 text-sm text-slate-300">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                    Active
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {isOwner && member.userId !== user?.id ? (
                                    <button
                                      onClick={() => removeMember.mutate(member.userId)}
                                      className="text-slate-400 hover:text-red-300 transition-colors"
                                      data-testid={`button-remove-member-${member.userId}`}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  ) : (
                                    <span className="text-slate-500 inline-flex"><MoreVertical size={16} /></span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {isOwner && filteredPendingOrgInvites.map((inv) => (
                            <tr key={`invite-${inv.id}`} className="hover:bg-white/5 transition-colors" data-testid={`invite-row-${inv.id}`}>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-sm">
                                    {initialsFromName(inv.email)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-100">{inv.email.split("@")[0]}</p>
                                    <p className="text-xs text-slate-500">Invited {formatDate(inv.createdAt)}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/20">
                                  Invited
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-400">{inv.email}</td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2 text-sm text-slate-300">
                                  <span className="h-2 w-2 rounded-full bg-slate-500" />
                                  Pending
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => inviteMember.mutate(inv.email)}
                                  className="text-amber-400 hover:text-amber-300 text-sm font-semibold"
                                  data-testid={`button-resend-invite-${inv.id}`}
                                >
                                  Resend
                                </button>
                              </td>
                            </tr>
                          ))}

                          {filteredMembers.length === 0 && filteredPendingOrgInvites.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">No members or invites found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="px-6 py-4 border-t border-slate-700/50 flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        Showing {filteredMembers.length + filteredPendingOrgInvites.length} entries
                      </p>
                      <div className="text-xs text-slate-500">Total team: {members.length}</div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-wrap justify-between items-end gap-4 pb-4 border-b border-amber-500/10">
                  <div>
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 mb-2">
                      {org.name}
                    </div>
                    <h2 className="text-slate-100 text-3xl lg:text-4xl font-black leading-tight">Shared Knowledge Vault</h2>
                    <p className="text-slate-400 text-base font-medium mt-1">Access and manage your firm's collaborative legal library.</p>
                  </div>
                  <div className="flex gap-3">
                    <select
                      value={docCategoryFilter}
                      onChange={(e) => setDocCategoryFilter(e.target.value)}
                      className="h-10 px-4 rounded-xl bg-[hsl(var(--preview-surface-elevated))/0.9] border border-[hsl(var(--preview-border))] text-slate-300 text-sm font-bold"
                      data-testid="select-vault-filter"
                    >
                      <option value="all">All Categories</option>
                      {knowledgeCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="h-10 px-6 rounded-xl bg-amber-500 text-[hsl(var(--preview-bg))] text-sm font-bold shadow-[0_0_15px_rgba(249,164,6,0.3)] hover:bg-amber-400 transition-colors flex items-center gap-2"
                      data-testid="button-open-upload-modal"
                    >
                      <Upload size={15} />
                      Upload Document
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.7] backdrop-blur-xl p-6">
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Shared Documents</p>
                    <p className="text-4xl font-bold text-slate-100 mt-1">{knowledge.length}</p>
                  </div>
                  <div className="rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.7] backdrop-blur-xl p-6">
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">Team Members</p>
                    <p className="text-4xl font-bold text-slate-100 mt-1">{members.length}</p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-slate-100 text-2xl font-bold">Vault Library</h3>
                    <div className="w-64 max-w-full flex items-center gap-2 rounded-lg px-3 py-1.5 bg-[hsl(var(--preview-surface-elevated))/0.9] border border-[hsl(var(--preview-border))]">
                      <Search size={16} className="text-slate-400" />
                      <input
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        className="w-full bg-transparent border-none p-0 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                        placeholder="Search documents..."
                        data-testid="input-vault-search"
                      />
                    </div>
                  </div>

                  {filteredKnowledge.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.45] p-10 text-center">
                      <FileText size={40} className="mx-auto mb-4 text-slate-600" />
                      <p className="text-lg font-semibold text-slate-300">No documents found</p>
                      <p className="text-sm text-slate-500 mt-1">Upload files or adjust your search/filter.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {filteredKnowledge.map((doc) => (
                        <article
                          key={doc.id}
                          className="rounded-xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.7] p-5 flex flex-col gap-4 transition-all duration-300 hover:border-amber-500/30 hover:bg-[hsl(var(--preview-surface-elevated))/0.8] hover:-translate-y-[2px] cursor-pointer"
                          onClick={() => setPreviewDoc(doc)}
                          data-testid={`vault-doc-${doc.id}`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="bg-[hsl(var(--preview-surface-elevated))/0.8] p-2.5 rounded-lg text-amber-300 border border-amber-500/10">
                              <BookOpen size={18} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${categoryChip(doc.category)}`}>
                                {doc.category}
                              </span>
                              {isOwner && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteKnowledge.mutate(doc.id);
                                  }}
                                  className="text-slate-500 hover:text-red-300 transition-colors"
                                  data-testid={`button-delete-vault-doc-${doc.id}`}
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-slate-100 font-bold text-xl mb-1 line-clamp-2">{doc.title}</h4>
                            <p className="text-slate-400 text-sm line-clamp-3">{excerpt(doc.content || "")}</p>
                          </div>

                          <div className="mt-auto pt-4 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
                            <div>
                              <span className="uppercase tracking-wide text-[10px] text-slate-500">Shared By</span>
                              <p className="font-medium text-slate-300 mt-0.5">
                                {doc.uploadedBy ? memberNameById.get(doc.uploadedBy) || "Team Member" : "Team Member"}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="uppercase tracking-wide text-[10px] text-slate-500">Date</span>
                              <p className="font-medium text-slate-300 mt-0.5">{formatDate(doc.createdAt)}</p>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {showInviteModal && isOwner && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={() => setShowInviteModal(false)}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div className="relative w-full max-w-[520px] rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.9] backdrop-blur-xl shadow-2xl p-8" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
              data-testid="button-close-invite-modal"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-5">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
                <UserPlus size={22} />
              </div>
              <h3 className="text-white text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>Invite Team Member</h3>
              <p className="text-slate-400 text-sm mt-2">Invite a colleague to collaborate on Al Wakeelo.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    type="email"
                    placeholder="colleague@lawfirm.com"
                    className="w-full h-11 rounded-xl bg-[hsl(var(--preview-bg))/0.8] border border-[hsl(var(--preview-border))] pl-10 pr-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    data-testid="input-invite-email"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-bg))/0.5] p-3 text-xs text-slate-400 flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 text-amber-400" />
                Invitees join as <span className="text-slate-200 font-semibold">Member</span> role by default in this version.
              </div>
            </div>

            <div className="pt-5 space-y-3">
              <button
                onClick={() => inviteMember.mutate(inviteEmail.trim())}
                disabled={!inviteEmail.trim() || inviteMember.isPending}
                className="w-full h-11 rounded-xl bg-gradient-to-b from-amber-500 to-amber-600 text-[hsl(var(--preview-bg))] font-bold hover:to-amber-500 disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="button-send-invite"
              >
                {inviteMember.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send Invitation
              </button>
              <button
                onClick={() => setShowInviteModal(false)}
                className="w-full h-11 rounded-xl border border-[hsl(var(--preview-border))] text-slate-400 font-medium hover:bg-[hsl(var(--preview-surface-elevated))/0.8]"
                data-testid="button-cancel-invite"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={() => setShowUploadModal(false)}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div className="relative w-full max-w-[560px] rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))/0.92] backdrop-blur-xl shadow-2xl p-7" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
              data-testid="button-close-upload-modal"
            >
              <X size={18} />
            </button>

            <h3 className="text-white text-2xl font-bold mb-1">Upload Shared Document</h3>
            <p className="text-sm text-slate-400 mb-5">Upload TXT, PDF, or DOCX to your organization's private vault.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Document Title</label>
                <input
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g., Firm Precedents"
                  className="w-full h-11 rounded-xl bg-[hsl(var(--preview-bg))/0.8] border border-[hsl(var(--preview-border))] px-4 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  data-testid="input-upload-title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">Category</label>
                <div className="relative">
                  <Filter size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                    className="w-full h-11 rounded-xl bg-[hsl(var(--preview-bg))/0.8] border border-[hsl(var(--preview-border))] pl-9 pr-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    data-testid="select-upload-category"
                  >
                    <option value="general">General</option>
                    <option value="case-law">Case Law</option>
                    <option value="statutes">Statutes</option>
                    <option value="contracts">Contracts</option>
                    <option value="precedents">Precedents</option>
                    <option value="internal">Internal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">File</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.pdf,.docx"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="w-full rounded-xl bg-[hsl(var(--preview-bg))/0.8] border border-[hsl(var(--preview-border))] px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-3 file:py-1.5 file:text-[hsl(var(--preview-bg))] file:font-semibold"
                  data-testid="input-upload-file"
                />
                {selectedFile && <p className="text-xs text-slate-500 mt-1">Selected: {selectedFile.name}</p>}
              </div>
            </div>

            <div className="pt-5 space-y-3">
              <button
                onClick={() => uploadKnowledge.mutate()}
                disabled={!selectedFile || uploadKnowledge.isPending}
                className="w-full h-11 rounded-xl bg-amber-500 text-[hsl(var(--preview-bg))] font-bold hover:bg-amber-400 disabled:opacity-50 flex items-center justify-center gap-2"
                data-testid="button-upload-doc"
              >
                {uploadKnowledge.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Upload Document
              </button>
              <button
                onClick={() => setShowUploadModal(false)}
                className="w-full h-11 rounded-xl border border-[hsl(var(--preview-border))] text-slate-400 font-medium hover:bg-[hsl(var(--preview-surface-elevated))/0.8]"
                data-testid="button-cancel-upload"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {previewDoc && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" onClick={() => setPreviewDoc(null)}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div className="relative w-full max-w-3xl max-h-[85vh] rounded-2xl border border-[hsl(var(--preview-border))] bg-[hsl(var(--preview-surface))] shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[hsl(var(--preview-border))] flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">{previewDoc.title}</h3>
                <p className="text-xs text-slate-500">{previewDoc.filename} • {previewDoc.category}</p>
              </div>
              <button onClick={() => setPreviewDoc(null)} className="text-slate-400 hover:text-white" data-testid="button-close-doc-preview">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap text-sm text-slate-200 leading-relaxed">{previewDoc.content || "No content extracted."}</pre>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
