import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  User as UserIcon, Mail, Crown, Loader2, Save, TrendingUp, AlertTriangle, Shield, LogOut, Sparkles, Camera, Trash2, Bell, Key, Copy, Check
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { TIER_LIMITS } from "@shared/schema";
import type { User } from "@shared/models/auth";
import { getUpgradeActionLabel, getUpgradeCheckoutPath } from "@/lib/upgrade-path";

type UsageData = {
  tier: string;
  tierLabel: string;
  tierDescription: string;
  subscriptionCycle?: "monthly" | "quarterly" | "yearly" | string;
  subscriptionStartAt?: string | null;
  subscriptionEndAt?: string | null;
  monthlyLimit: number;
  used: number;
  remaining: number;
  percentage: number;
};

export default function UserPanelPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery<User>({ queryKey: ["/api/profile"] });
  const { data: usage } = useQuery<UsageData>({ queryKey: ["/api/usage"] });
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const { data: apiKeysList, isLoading: apiKeysLoading } = useQuery<any[]>({
    queryKey: ["/api/settings/keys"],
    enabled: !!profile,
  });

  const createKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/settings/keys", { name });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedKey(data.token);
      setNewKeyName("");
      queryClient.invalidateQueries({ queryKey: ["/api/settings/keys"] });
      toast({ title: "API Key created successfully" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to generate API Key",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/settings/keys/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/keys"] });
      toast({ title: "API Key revoked successfully" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to revoke key",
        description: err.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleCopyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied to clipboard" });
    }
  };

  const handleCopyUrl = () => {
    if (generatedKey) {
      const fullUrl = `https://alwakeelo.com/api/mcp?token=${generatedKey}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      toast({ title: "Integration URL copied to clipboard" });
    }
  };

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || "");
      setLastName(profile.lastName || "");
    }
  }, [profile]);


  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/profile", { firstName, lastName });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile updated" });
    },
    onError: () => {
      toast({ title: "Failed to update profile", variant: "destructive" });
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("avatar", file);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to upload image" }));
        throw new Error(err.message || "Failed to upload image");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile picture updated" });
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to upload profile picture", variant: "destructive" });
    },
  });

  const removeAvatarMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/profile/avatar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile picture removed" });
    },
    onError: () => {
      toast({ title: "Failed to remove profile picture", variant: "destructive" });
    },
  });

  const isNearLimit = usage && usage.percentage >= 80;
  const isAtLimit = usage && usage.percentage >= 100;

  // Notification preferences
  const { data: notifPrefs } = useQuery<any>({ queryKey: ["/api/settings/notifications"] });
  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [sendTime, setSendTime] = useState("19:00");

  useEffect(() => {
    if (notifPrefs) {
      setDailyEnabled(notifPrefs.dailyEmailEnabled ?? false);
      setWeeklyEnabled(notifPrefs.weeklyEmailEnabled ?? false);
      setSendTime(notifPrefs.preferredTime || "19:00");
    }
  }, [notifPrefs]);

  const updateNotifMutation = useMutation({
    mutationFn: async (updates: any) => {
      const res = await apiRequest("PATCH", "/api/settings/notifications", updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/notifications"] });
      toast({ title: "Notification preferences updated" });
    },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/notifications/test");
      return res.json();
    },
    onSuccess: (data: any) => toast({ title: data?.ok ? "Test email sent! Check your inbox." : "Failed to send test email" }),
    onError: () => toast({ title: "Failed to send test email", variant: "destructive" }),
  });

  const tierColor = profile?.subscriptionTier === "enterprise"
    ? "text-emerald-400"
    : profile?.subscriptionTier === "chamber"
      ? "text-violet-300"
    : profile?.subscriptionTier === "pro"
      ? "text-primary"
      : "text-muted-foreground";

  const tierBg = profile?.subscriptionTier === "enterprise"
    ? "bg-emerald-500/20 border-emerald-500/30"
    : profile?.subscriptionTier === "chamber"
      ? "bg-violet-500/20 border-violet-500/30"
    : profile?.subscriptionTier === "pro"
      ? "bg-primary/20 border-primary/30"
      : "bg-card border-border";
  const effectiveTier = usage?.tier || profile?.subscriptionTier || "free";
  const upgradeHref = getUpgradeCheckoutPath(effectiveTier);
  const upgradeLabel = getUpgradeActionLabel(effectiveTier);
  const cycleLabel = String(usage?.subscriptionCycle || profile?.subscriptionCycle || "monthly").toLowerCase();
  const normalizedCycleLabel =
    cycleLabel === "yearly" ? "Yearly" : cycleLabel === "quarterly" ? "3 Months" : "Monthly";
  const renewalLabel = usage?.subscriptionEndAt
    ? new Date(usage.subscriptionEndAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })
    : "Not set";

  const handleSelectAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      toast({ title: "Unsupported image format", description: "Use JPG, PNG, WEBP, or GIF.", variant: "destructive" });
      return;
    }
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: "Image too large", description: "Maximum size is 2MB.", variant: "destructive" });
      return;
    }
    uploadAvatarMutation.mutate(file);
    e.currentTarget.value = "";
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in max-w-4xl" data-testid="user-panel-page">
      <div className="preview-elevated rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <UserIcon size={15} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>Settings</h1>
              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-black">Identity, plan & notifications</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${tierBg} ${tierColor} rounded-lg text-[10px] font-black uppercase`} data-testid="badge-tier">
              {profile?.subscriptionTier || "free"}
            </Badge>
            {profile?.isAdmin && <Badge className="bg-primary/20 text-primary border-primary/30 rounded-lg text-[8px]">ADMIN</Badge>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="preview-surface rounded-2xl">
          <CardHeader className="flex flex-row items-center gap-2 pb-1 pt-4 px-4">
            <UserIcon size={14} className="text-primary" />
            <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Profile</span>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 pt-1">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-background border border-[hsl(var(--preview-border))] flex items-center justify-center overflow-hidden shrink-0">
                {profile?.profileImageUrl ? (
                  <img src={profile.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={18} className="text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground text-sm truncate" data-testid="text-profile-name">
                  {[profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.email || "Advocate"}
                </p>
                <div className="flex items-center gap-1.5">
                  <Mail size={10} className="text-muted-foreground shrink-0" />
                  <p className="text-[10px] text-muted-foreground truncate" data-testid="text-profile-email">{profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleSelectAvatar} />
                <Button type="button" size="sm" variant="outline" onClick={() => avatarInputRef.current?.click()} disabled={uploadAvatarMutation.isPending} className="h-6 px-2 rounded-lg border-[hsl(var(--preview-border))] text-foreground" data-testid="button-upload-avatar">
                  {uploadAvatarMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Camera size={10} />}
                </Button>
                {profile?.profileImageUrl && (
                  <Button type="button" size="sm" variant="outline" onClick={() => removeAvatarMutation.mutate()} disabled={removeAvatarMutation.isPending} className="h-6 px-2 rounded-lg border-red-500/30 text-red-300 hover:bg-red-500/10" data-testid="button-remove-avatar">
                    {removeAvatarMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">First Name</label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-background border-[hsl(var(--preview-border))] rounded-lg text-xs h-8 text-foreground" data-testid="input-first-name" />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">Last Name</label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-background border-[hsl(var(--preview-border))] rounded-lg text-xs h-8 text-foreground" data-testid="input-last-name" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">Email</label>
              <Input value={profile?.email || ""} readOnly className="bg-background border-[hsl(var(--preview-border))] rounded-lg text-xs h-8 text-muted-foreground cursor-not-allowed" data-testid="input-email-readonly" />
            </div>
            <Button onClick={() => updateProfileMutation.mutate()} disabled={updateProfileMutation.isPending} className="w-full h-8 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-black text-[9px] uppercase tracking-widest" data-testid="button-save-profile">
              {updateProfileMutation.isPending ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
              <span>Save</span>
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="preview-surface rounded-2xl">
            <CardHeader className="flex flex-row items-center gap-2 pb-1 pt-4 px-4">
              <Crown size={14} className="text-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Plan</span>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 pt-1">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {TIER_LIMITS[profile?.subscriptionTier || "free"]?.description || "10 AI chats + 1 legal draft + 1 contract draft/month"}
              </p>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-lg border border-[hsl(var(--preview-border))] bg-background px-2.5 py-2">
                  <p className="text-[8px] uppercase tracking-[0.15em] font-black text-muted-foreground">Billing</p>
                  <p className="text-foreground mt-0.5">{normalizedCycleLabel} · <span className="text-primary">{renewalLabel}</span></p>
                </div>
                <div className="rounded-lg border border-[hsl(var(--preview-border))] bg-background px-2.5 py-2">
                  <p className="text-[8px] uppercase tracking-[0.15em] font-black text-muted-foreground">Models</p>
                  <p className="text-foreground mt-0.5">
                    {(profile?.subscriptionTier === "chamber" || profile?.subscriptionTier === "enterprise") ? "All models" : profile?.subscriptionTier === "pro" ? "Standard + Turbo" : "Standard only"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button asChild className="h-7 rounded-lg bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-wider" data-testid="button-upgrade-plan-profile">
                  <a href={upgradeHref}>{upgradeLabel}</a>
                </Button>
                <Button asChild variant="outline" className="h-7 rounded-lg border-[hsl(var(--preview-border))] text-[9px] font-black uppercase tracking-wider text-foreground" data-testid="button-compare-plans-profile">
                  <a href="/#pricing">Compare</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="preview-surface rounded-2xl">
            <CardHeader className="flex flex-row items-center gap-2 pb-1 pt-4 px-4">
              <Shield size={14} className="text-emerald-400" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Security</span>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 pt-1">
              <div className="rounded-lg border border-[hsl(var(--preview-border))] bg-background px-2.5 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles size={10} className="text-emerald-400" />
                  <p className="text-[10px] text-emerald-300">Session active</p>
                </div>
              </div>
              <Button onClick={() => logout()} variant="outline" className="w-full h-7 rounded-lg border-red-500/30 text-red-300 hover:text-red-200 hover:bg-red-500/10 text-[9px]" data-testid="button-logout-profile">
                <LogOut size={12} />
                <span>Sign Out</span>
              </Button>
            </CardContent>
          </Card>

          <Card className="preview-surface rounded-2xl">
            <CardHeader className="flex flex-row items-center gap-2 pb-1 pt-4 px-4">
              <Key size={14} className="text-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">API Integration (MCP)</span>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 pt-1">
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Connect AlWakeelo directly to AI applications like Claude Desktop, Cursor, or Gemini. Your search limits and quotas apply.
              </p>

              {/* Generated Key Section */}
              {generatedKey && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2 space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-primary">Your New API Key</span>
                      <span className="text-[8px] text-amber-300 font-bold uppercase">Shown once!</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <code className="text-[10px] bg-background border px-2 py-1 rounded block flex-1 truncate text-foreground font-mono select-all">
                        {generatedKey}
                      </code>
                      <Button onClick={handleCopyKey} size="sm" variant="outline" className="h-7 w-7 p-0 border-primary/30 text-primary">
                        {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-primary/10 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase tracking-wider text-primary">Claude / ChatGPT Connection URL</span>
                      <span className="text-[7.5px] text-muted-foreground leading-none">Use directly in app settings</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <code className="text-[10px] bg-background border px-2 py-1 rounded block flex-1 truncate text-foreground font-mono select-all">
                        {`https://alwakeelo.com/api/mcp?token=${generatedKey}`}
                      </code>
                      <Button onClick={handleCopyUrl} size="sm" variant="outline" className="h-7 w-7 p-0 border-primary/30 text-primary">
                        {copiedUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Generate Key Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Key name (e.g. Claude Desktop)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="bg-background border-[hsl(var(--preview-border))] rounded-lg text-[10px] h-7 text-foreground flex-1"
                />
                <Button
                  onClick={() => createKeyMutation.mutate(newKeyName)}
                  disabled={createKeyMutation.isPending || !newKeyName.trim()}
                  className="h-7 px-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0"
                >
                  {createKeyMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : "Generate"}
                </Button>
              </div>

              {/* Keys List */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground block">Active Keys</span>
                {apiKeysLoading ? (
                  <div className="flex justify-center py-2"><Loader2 size={12} className="animate-spin text-primary" /></div>
                ) : apiKeysList && apiKeysList.length > 0 ? (
                  <div className="space-y-1.5">
                    {apiKeysList.map((k) => (
                      <div key={k.id} className="rounded-lg border border-[hsl(var(--preview-border))] bg-background px-2.5 py-1.5 flex items-center justify-between gap-3 text-[10px]">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-foreground truncate">{k.name}</p>
                          <code className="text-[8px] text-muted-foreground font-mono">{k.preview}</code>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[8px] text-muted-foreground uppercase">
                            {k.lastUsedAt ? `Used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"}
                          </span>
                          <Button
                            onClick={() => deleteKeyMutation.mutate(k.id)}
                            disabled={deleteKeyMutation.isPending}
                            variant="ghost"
                            className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md"
                          >
                            <Trash2 size={10} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[9px] text-muted-foreground italic py-1">No API keys generated yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="preview-surface rounded-2xl">
            <CardHeader className="flex flex-row items-center gap-2 pb-1 pt-4 px-4">
              <Bell size={14} className="text-primary" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Diary Notifications</span>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4 pt-1">
              <div className="rounded-lg border border-[hsl(var(--preview-border))] bg-background px-2.5 py-1.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-foreground">Daily Reminder</p>
                  <p className="text-[9px] text-muted-foreground">Tomorrow's schedule</p>
                </div>
                <button onClick={() => { const v = !dailyEnabled; setDailyEnabled(v); updateNotifMutation.mutate({ dailyEmailEnabled: v }); }} className={`w-9 h-[18px] rounded-full transition-colors ${dailyEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${dailyEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="rounded-lg border border-[hsl(var(--preview-border))] bg-background px-2.5 py-1.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-foreground">Weekly Summary</p>
                  <p className="text-[9px] text-muted-foreground">Saturday overview</p>
                </div>
                <button onClick={() => { const v = !weeklyEnabled; setWeeklyEnabled(v); updateNotifMutation.mutate({ weeklyEmailEnabled: v }); }} className={`w-9 h-[18px] rounded-full transition-colors ${weeklyEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${weeklyEnabled ? "translate-x-[18px]" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <select value={sendTime} onChange={e => { setSendTime(e.target.value); updateNotifMutation.mutate({ preferredTime: e.target.value }); }} className="bg-background border border-[hsl(var(--preview-border))] rounded-lg px-2 py-1 text-[10px] text-foreground outline-none flex-1">
                  <option value="18:00">6 PM PKT</option>
                  <option value="19:00">7 PM PKT</option>
                  <option value="20:00">8 PM PKT</option>
                  <option value="21:00">9 PM PKT</option>
                </select>
                <Button onClick={() => testEmailMutation.mutate()} disabled={testEmailMutation.isPending} variant="outline" className="h-7 rounded-lg border-primary/30 text-primary text-[9px] font-black uppercase tracking-wider hover:bg-primary/10 flex-1">
                  {testEmailMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <Mail size={10} />}
                  <span>Test Email</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {usage && (
        <Card className={`border rounded-2xl ${isAtLimit ? "bg-red-950/30 border-red-800/50" : isNearLimit ? "bg-amber-950/30 border-amber-800/50" : "preview-surface"}`} data-testid="usage-card">
          <CardContent className="px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                {isAtLimit ? <AlertTriangle size={14} className="text-red-400" /> : <TrendingUp size={14} className="text-primary" />}
                <span className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">Usage</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-foreground" data-testid="text-usage-count">{usage.used}</span>
                <span className="text-[10px] text-muted-foreground">/ {usage.monthlyLimit === Infinity ? "∞" : usage.monthlyLimit}</span>
                <span className="text-sm font-bold text-primary" data-testid="text-usage-remaining">{usage.remaining === Infinity ? "∞" : usage.remaining} left</span>
              </div>
            </div>
            {usage.monthlyLimit !== Infinity && <Progress value={Math.min(usage.percentage, 100)} className="h-1.5 bg-card rounded-full mt-2" data-testid="progress-usage" />}
            {isAtLimit && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-red-300">Monthly limit reached.</p>
                <a href={upgradeHref} className="rounded-lg px-2.5 py-1 bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-wider" data-testid="link-upgrade-limit-profile">{upgradeLabel}</a>
              </div>
            )}
            {isNearLimit && !isAtLimit && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-[10px] text-primary">{usage.percentage.toFixed(0)}% used</p>
                <a href={upgradeHref} className="rounded-lg px-2.5 py-1 border border-primary/40 text-primary text-[9px] font-black uppercase tracking-wider" data-testid="link-upgrade-near-limit-profile">Upgrade</a>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
