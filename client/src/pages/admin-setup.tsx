import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Redirect, useLocation } from "wouter";
import { Shield, Loader2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function AdminSetupPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: adminCheck, isLoading: checkLoading } = useQuery<{ hasAdmin: boolean }>({
    queryKey: ["/api/admin/check"],
  });

  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/setup");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/check"] });
      toast({ title: "You are now the admin" });
      setLocation("/admin");
    },
    onError: (err: any) => {
      toast({ title: err?.message || "Failed to claim admin access", variant: "destructive" });
    },
  });

  if (authLoading || checkLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0f172a]">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/" />;
  }

  if (adminCheck?.hasAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f172a] p-4" data-testid="admin-setup-page">
      <Card className="bg-[#1e293b] border-slate-800 rounded-[2rem] max-w-md w-full">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto">
            <Shield size={28} className="text-amber-500" />
          </div>

          <div>
            <h1
              className="text-xl font-bold text-white mb-2"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Admin Setup
            </h1>
            <p className="text-sm text-slate-400">
              No admin has been set up yet. As the first person here, you can claim admin access to manage the platform.
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-slate-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Logged in as
              </span>
            </div>
            <p className="text-sm font-bold text-white" data-testid="text-setup-user">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>

          <Button
            onClick={() => claimMutation.mutate()}
            disabled={claimMutation.isPending}
            className="w-full bg-amber-500 text-slate-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
            data-testid="button-claim-admin"
          >
            {claimMutation.isPending ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Shield size={14} />
            )}
            <span>{claimMutation.isPending ? "Setting up..." : "Claim Admin Access"}</span>
          </Button>

          <p className="text-[10px] text-slate-600">
            This option is only available once. After claiming, you can manage other admins from the admin panel.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
