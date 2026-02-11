import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  User as UserIcon, Mail, Crown, BarChart3, Loader2, Save, TrendingUp, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { TIER_LIMITS } from "@shared/schema";
import type { User } from "@shared/models/auth";

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
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery<User>({ queryKey: ["/api/profile"] });
  const { data: usage } = useQuery<UsageData>({ queryKey: ["/api/usage"] });

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

  const isNearLimit = usage && usage.percentage >= 80;
  const isAtLimit = usage && usage.percentage >= 100;

  const tierColor = profile?.subscriptionTier === "enterprise"
    ? "text-purple-400"
    : profile?.subscriptionTier === "pro"
      ? "text-amber-400"
      : "text-slate-400";

  const tierBg = profile?.subscriptionTier === "enterprise"
    ? "bg-purple-500/20 border-purple-500/30"
    : profile?.subscriptionTier === "pro"
      ? "bg-amber-500/20 border-amber-500/30"
      : "bg-slate-800 border-slate-700";

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-amber-500" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in max-w-2xl" data-testid="user-panel-page">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <UserIcon size={20} className="text-amber-500" />
          <h1 className="text-2xl font-bold tracking-tight text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
            Account Settings
          </h1>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-black">
          Manage Your Profile
        </p>
      </div>

      <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <UserIcon size={16} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Profile Information
          </span>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
              {profile?.profileImageUrl ? (
                <img src={profile.profileImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={24} className="text-slate-500" />
              )}
            </div>
            <div>
              <p className="font-bold text-white" data-testid="text-profile-name">
                {profile?.firstName || profile?.email || "Advocate"}
              </p>
              <div className="flex items-center gap-2">
                <Mail size={12} className="text-slate-500" />
                <p className="text-xs text-slate-500" data-testid="text-profile-email">{profile?.email}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                First Name
              </label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="bg-slate-800 border-slate-700 rounded-xl text-sm"
                data-testid="input-first-name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                Last Name
              </label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="bg-slate-800 border-slate-700 rounded-xl text-sm"
                data-testid="input-last-name"
              />
            </div>
          </div>

          <Button
            onClick={() => updateProfileMutation.mutate()}
            disabled={updateProfileMutation.isPending}
            className="bg-amber-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
            data-testid="button-save-profile"
          >
            {updateProfileMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            <span>Save Changes</span>
          </Button>
        </CardContent>
      </Card>

      <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem]">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <Crown size={16} className="text-amber-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
            Subscription Plan
          </span>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          <div className="flex items-center gap-4">
            <Badge className={`${tierBg} ${tierColor} rounded-lg text-xs font-black uppercase`} data-testid="badge-tier">
              {profile?.subscriptionTier || "free"} Plan
            </Badge>
            {profile?.isAdmin && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 rounded-lg text-[9px]">
                ADMIN
              </Badge>
            )}
          </div>

          <p className="text-xs text-slate-400">
            {TIER_LIMITS[profile?.subscriptionTier || "free"]?.description || "10 AI queries/month"}
          </p>
        </CardContent>
      </Card>

      {usage && (
        <Card
          className={`border rounded-[2rem] ${isAtLimit ? "bg-red-950/30 border-red-800/50" : isNearLimit ? "bg-amber-950/30 border-amber-800/50" : "bg-[#1e293b] border-slate-800"}`}
          data-testid="usage-card"
        >
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            {isAtLimit ? (
              <AlertTriangle size={16} className="text-red-400" />
            ) : (
              <TrendingUp size={16} className="text-amber-500" />
            )}
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
              Monthly Usage
            </span>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div className="flex items-end justify-between gap-4">
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
              <p className="text-xs text-red-400 font-medium">
                You have reached your monthly limit. Upgrade for more queries.
              </p>
            )}
            {isNearLimit && !isAtLimit && (
              <p className="text-xs text-amber-400 font-medium">
                You are approaching your monthly limit ({usage.percentage.toFixed(0)}% used).
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
