import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Building2, Users, Upload, Trash2, UserPlus, Crown, Shield, User, FileText, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function OrganizationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [orgName, setOrgName] = useState("");
  const [orgDesc, setOrgDesc] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState("general");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["/api/org"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/org");
      return res.json();
    },
  });

  const { data: members } = useQuery({
    queryKey: ["/api/org/members", org?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/org/${org.id}/members`);
      return res.json();
    },
    enabled: !!org?.id,
  });

  const { data: invites } = useQuery({
    queryKey: ["/api/org/invites", org?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/org/${org.id}/invites`);
      return res.json();
    },
    enabled: !!org?.id && org?.ownerId === user?.id,
  });

  const { data: knowledge } = useQuery({
    queryKey: ["/api/org/knowledge", org?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/org/${org.id}/knowledge`);
      return res.json();
    },
    enabled: !!org?.id,
  });

  const { data: pendingInvites } = useQuery({
    queryKey: ["/api/org/invites/pending"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/org/invites/pending");
      return res.json();
    },
    enabled: !org,
  });

  const createOrg = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/org", { name: orgName, description: orgDesc });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Organization created" });
      queryClient.invalidateQueries({ queryKey: ["/api/org"] });
      setOrgName("");
      setOrgDesc("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const inviteMember = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/org/${org.id}/invite`, { email: inviteEmail });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation sent" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/invites"] });
      setInviteEmail("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      await apiRequest("DELETE", `/api/org/${org.id}/members/${memberId}`);
    },
    onSuccess: () => {
      toast({ title: "Member removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/members"] });
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
  });

  const declineInvite = useMutation({
    mutationFn: async (inviteId: number) => {
      await apiRequest("POST", `/api/org/invites/${inviteId}/decline`);
    },
    onSuccess: () => {
      toast({ title: "Invite declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/invites/pending"] });
    },
  });

  const uploadKnowledge = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", docTitle || selectedFile.name);
      formData.append("category", docCategory);
      const res = await fetch(`/api/org/${org.id}/knowledge`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Document uploaded" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/knowledge"] });
      setSelectedFile(null);
      setDocTitle("");
      setDocCategory("general");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteKnowledge = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/org/${org.id}/knowledge/${docId}`);
    },
    onSuccess: () => {
      toast({ title: "Document deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/org/knowledge"] });
    },
  });

  const deleteOrg = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/org/${org.id}`);
    },
    onSuccess: () => {
      toast({ title: "Organization deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/org"] });
    },
  });

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  const isOwner = org && org.ownerId === user?.id;
  const canCreateOrg = user?.subscriptionTier === "pro" || user?.subscriptionTier === "enterprise" || user?.isAdmin;

  if (!org && !canCreateOrg) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Card className="border-amber-500/20 bg-zinc-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <Building2 className="h-5 w-5" />
              Organization
            </CardTitle>
            <CardDescription>
              Organization features are available for Pro and Enterprise subscribers.
              Upgrade your plan to create an organization with team collaboration and shared knowledge base.
            </CardDescription>
          </CardHeader>
        </Card>

        {pendingInvites && pendingInvites.length > 0 && (
          <Card className="border-amber-500/20 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg">Pending Invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInvites.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <span className="text-sm">{inv.orgName}</span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => acceptInvite.mutate(inv.id)}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => declineInvite.mutate(inv.id)}>Decline</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (!org) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {pendingInvites && pendingInvites.length > 0 && (
          <Card className="border-amber-500/20 bg-zinc-900">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-amber-400" />
                Pending Invitations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInvites.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                  <span className="text-sm">{inv.orgName}</span>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => acceptInvite.mutate(inv.id)}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => declineInvite.mutate(inv.id)}>Decline</Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-amber-500/20 bg-zinc-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-400">
              <Building2 className="h-5 w-5" />
              Create Organization
            </CardTitle>
            <CardDescription>
              Set up your organization to collaborate with your legal team and share a private knowledge base.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Organization Name</Label>
              <Input value={orgName} onChange={e => setOrgName(e.target.value)} placeholder="e.g., Khan & Associates" className="bg-zinc-800 border-zinc-700" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea value={orgDesc} onChange={e => setOrgDesc(e.target.value)} placeholder="Brief description of your organization" className="bg-zinc-800 border-zinc-700" />
            </div>
            <Button onClick={() => createOrg.mutate()} disabled={!orgName.trim() || createOrg.isPending} className="bg-amber-600 hover:bg-amber-700">
              {createOrg.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
              Create Organization
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleIcon = (role: string) => {
    if (role === "owner") return <Crown className="h-4 w-4 text-amber-400" />;
    if (role === "admin") return <Shield className="h-4 w-4 text-blue-400" />;
    return <User className="h-4 w-4 text-zinc-400" />;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-400 flex items-center gap-2">
            <Building2 className="h-6 w-6" />
            {org.name}
          </h1>
          {org.description && <p className="text-zinc-400 text-sm mt-1">{org.description}</p>}
        </div>
        {isOwner && (
          <Button variant="destructive" size="sm" onClick={() => {
            if (confirm("Are you sure? This will delete the organization and all its data.")) {
              deleteOrg.mutate();
            }
          }}>
            Delete Organization
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-amber-500/20 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-400" />
              Team Members ({members?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {members?.map((m: any) => (
              <div key={m.userId} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div className="flex items-center gap-3">
                  {roleIcon(m.role)}
                  <div>
                    <div className="text-sm font-medium">
                      {m.firstName || m.lastName ? `${m.firstName || ""} ${m.lastName || ""}`.trim() : m.email}
                    </div>
                    <div className="text-xs text-zinc-500">{m.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">{m.role}</Badge>
                  {isOwner && m.userId !== user?.id && (
                    <Button size="sm" variant="ghost" onClick={() => removeMember.mutate(m.userId)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {isOwner && (
              <>
                <Separator className="bg-zinc-700" />
                <div className="flex gap-2">
                  <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Invite by email..." className="bg-zinc-800 border-zinc-700 flex-1" />
                  <Button onClick={() => inviteMember.mutate()} disabled={!inviteEmail.trim() || inviteMember.isPending} size="sm" className="bg-amber-600 hover:bg-amber-700">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>

                {invites && invites.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <p className="text-xs text-zinc-500 font-medium">Sent Invitations</p>
                    {invites.map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between text-sm p-2 bg-zinc-800/50 rounded">
                        <span className="text-zinc-400">{inv.email}</span>
                        <Badge variant="outline" className="text-xs capitalize">{inv.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-zinc-900">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-400" />
              Knowledge Base ({knowledge?.length || 0})
            </CardTitle>
            <CardDescription>
              Upload private legal documents for your team. These are automatically used as context by the AI assistant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {knowledge?.map((doc: any) => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                <div>
                  <div className="text-sm font-medium">{doc.title}</div>
                  <div className="text-xs text-zinc-500">{doc.filename} · {doc.category}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteKnowledge.mutate(doc.id)} className="text-red-400 hover:text-red-300">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}

            <Separator className="bg-zinc-700" />
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Document Title</Label>
                <Input value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="e.g., Firm Precedents" className="bg-zinc-800 border-zinc-700" />
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <select value={docCategory} onChange={e => setDocCategory(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm">
                  <option value="general">General</option>
                  <option value="case-law">Case Law</option>
                  <option value="statutes">Statutes</option>
                  <option value="contracts">Contracts</option>
                  <option value="precedents">Precedents</option>
                  <option value="internal">Internal</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">File (TXT, PDF, DOCX)</Label>
                <Input type="file" accept=".txt,.pdf,.docx" onChange={e => setSelectedFile(e.target.files?.[0] || null)} className="bg-zinc-800 border-zinc-700" />
              </div>
              <Button onClick={() => uploadKnowledge.mutate()} disabled={!selectedFile || uploadKnowledge.isPending} className="w-full bg-amber-600 hover:bg-amber-700">
                {uploadKnowledge.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                Upload Document
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
