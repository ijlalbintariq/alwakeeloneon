import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  User as UserIcon, Mail, Crown, Loader2, Save, TrendingUp, AlertTriangle, Shield, LogOut, Sparkles, Camera, Trash2
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

  const tierColor = profile?.subscriptionTier === "enterprise"
    ? "text-emerald-400"
    : profile?.subscriptionTier === "chamber"
      ? "text-violet-300"
    : profile?.subscriptionTier === "pro"
      ? "text-amber-400"
      : "text-slate-400";

  const tierBg = profile?.subscriptionTier === "enterprise"
    ? "bg-emerald-500/20 border-emerald-500/30"
    : profile?.subscriptionTier === "chamber"
      ? "bg-violet-500/20 border-violet-500/30"
    : profile?.subscriptionTier === "pro"
      ? "bg-amber-500/20 border-amber-500/30"
      : "bg-slate-800 border-slate-700";
  const effectiveTier = usage?.tier || profile?.subscriptionTier || "free";
  const upgradeHref = getUpgradeCheckoutPath(effectiveTier);
  const upgradeLabel = getUpgradeActionLabel(effectiveTier);

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
        <Loader2 className="animate-spin text-amber-500" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in max-w-5xl" data-testid="user-panel-page">
      <div className="preview-elevated rounded-[1.8rem] p-8 md:p-10">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                <UserIcon size={18} className="text-amber-400" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                Profile Settings
              </h1>
            </div>
            <p className="text-xs uppercase tracking-[0.26em] text-slate-400 font-black">
              Identity, plan, and account controls
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${tierBg} ${tierColor} rounded-lg text-xs font-black uppercase`} data-testid="badge-tier">
              {profile?.subscriptionTier || "free"} Plan
            </Badge>
            {profile?.isAdmin && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 rounded-lg text-[9px]">
                ADMIN
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="preview-surface rounded-[1.5rem] xl:col-span-2">
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <UserIcon size={16} className="text-amber-500" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              Profile Information
            </span>
          </CardHeader>
          <CardContent className="space-y-6 pt-2">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#0d1728] border border-[hsl(var(--preview-border))] flex items-center justify-center overflow-hidden">
                {profile?.profileImageUrl ? (
                  <img src={profile.profileImageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon size={24} className="text-slate-500" />
                )}
              </div>
              <div>
                <p className="font-bold text-white text-lg" data-testid="text-profile-name">
                  {[profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || profile?.email || "Advocate"}
                </p>
                <div className="flex items-center gap-2">
                  <Mail size={12} className="text-slate-500" />
                  <p className="text-xs text-slate-400" data-testid="text-profile-email">{profile?.email}</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleSelectAvatar}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadAvatarMutation.isPending}
                    className="h-7 px-2.5 rounded-lg border-[hsl(var(--preview-border))] text-slate-300"
                    data-testid="button-upload-avatar"
                  >
                    {uploadAvatarMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
                    <span className="text-[10px] uppercase tracking-wider">Upload Photo</span>
                  </Button>
                  {profile?.profileImageUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => removeAvatarMutation.mutate()}
                      disabled={removeAvatarMutation.isPending}
                      className="h-7 px-2.5 rounded-lg border-red-500/30 text-red-300 hover:bg-red-500/10"
                      data-testid="button-remove-avatar"
                    >
                      {removeAvatarMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                      <span className="text-[10px] uppercase tracking-wider">Remove</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                  First Name
                </label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="bg-[#0d1728] border-[hsl(var(--preview-border))] rounded-xl text-sm text-white"
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Last Name
                </label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="bg-[#0d1728] border-[hsl(var(--preview-border))] rounded-xl text-sm text-white"
                  data-testid="input-last-name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                Email Address
              </label>
              <Input
                value={profile?.email || ""}
                readOnly
                className="bg-[#0a1323] border-[hsl(var(--preview-border))] rounded-xl text-sm text-slate-400 cursor-not-allowed"
                data-testid="input-email-readonly"
              />
              <p className="text-[10px] text-slate-500">Email is managed by your account authentication provider.</p>
            </div>

            <Button
              onClick={() => updateProfileMutation.mutate()}
              disabled={updateProfileMutation.isPending}
              className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest hover:from-amber-300 hover:to-amber-400"
              data-testid="button-save-profile"
            >
              {updateProfileMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              <span>Save Profile</span>
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="preview-surface rounded-[1.5rem]">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Crown size={16} className="text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Plan Overview
              </span>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <p className="text-xs text-slate-400">
                {TIER_LIMITS[profile?.subscriptionTier || "free"]?.description || "10 AI chats + 1 legal draft + 1 contract draft/month"}
              </p>
              <div className="rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f1a2c] px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-500">Model Access</p>
                <p className="text-xs text-slate-300 mt-1">
                  {profile?.subscriptionTier === "chamber" || profile?.subscriptionTier === "enterprise"
                    ? "Standard, Turbo, and Apex model menu enabled."
                    : profile?.subscriptionTier === "pro"
                      ? "Standard and Turbo model menu enabled."
                      : "Standard mode enabled. Upgrade to unlock Turbo and Apex."}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  asChild
                  className="h-9 rounded-xl bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest hover:bg-amber-400"
                  data-testid="button-upgrade-plan-profile"
                >
                  <a href={upgradeHref}>{upgradeLabel}</a>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-9 rounded-xl border-[hsl(var(--preview-border))] text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-slate-800/60 hover:text-white"
                  data-testid="button-compare-plans-profile"
                >
                  <a href="/#pricing">Compare Plans</a>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="preview-surface rounded-[1.5rem]">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Shield size={16} className="text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Security
              </span>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="rounded-xl border border-[hsl(var(--preview-border))] bg-[#0f1a2c] px-3 py-2.5">
                <p className="text-[9px] uppercase tracking-[0.2em] font-black text-slate-500">Account Status</p>
                <p className="text-xs text-emerald-300 mt-1 flex items-center gap-2">
                  <Sparkles size={12} /> Protected session is active
                </p>
              </div>
              <Button
                onClick={() => logout()}
                variant="outline"
                className="w-full rounded-xl border-red-500/30 text-red-300 hover:text-red-200 hover:bg-red-500/10"
                data-testid="button-logout-profile"
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {usage && (
        <Card
          className={`border rounded-[1.5rem] ${isAtLimit ? "bg-red-950/30 border-red-800/50" : isNearLimit ? "bg-amber-950/30 border-amber-800/50" : "preview-surface"}`}
          data-testid="usage-card"
        >
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            {isAtLimit ? (
              <AlertTriangle size={16} className="text-red-400" />
            ) : (
              <TrendingUp size={16} className="text-amber-500" />
            )}
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
              Monthly Usage
            </span>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-3xl font-bold text-white tracking-tight" data-testid="text-usage-count">
                  {usage.used}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                  of {usage.monthlyLimit === Infinity ? "unlimited" : usage.monthlyLimit} queries used
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-amber-500" data-testid="text-usage-remaining">
                  {usage.remaining === Infinity ? "Unlimited" : usage.remaining}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">remaining</p>
              </div>
            </div>

            {usage.monthlyLimit !== Infinity && (
              <Progress
                value={Math.min(usage.percentage, 100)}
                className="h-2 bg-slate-800 rounded-full"
                data-testid="progress-usage"
              />
            )}

            {isAtLimit && (
              <div className="space-y-2">
                <p className="text-xs text-red-300 font-medium">
                  You have reached your monthly limit. Upgrade for more queries.
                </p>
                <a
                  href={upgradeHref}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-colors"
                  data-testid="link-upgrade-limit-profile"
                >
                  {upgradeLabel}
                </a>
              </div>
            )}
            {isNearLimit && !isAtLimit && (
              <div className="space-y-2">
                <p className="text-xs text-amber-300 font-medium">
                  You are approaching your monthly limit ({usage.percentage.toFixed(0)}% used).
                </p>
                <a
                  href={upgradeHref}
                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-widest hover:border-amber-400 hover:text-amber-200 transition-colors"
                  data-testid="link-upgrade-near-limit-profile"
                >
                  View Upgrade Options
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
