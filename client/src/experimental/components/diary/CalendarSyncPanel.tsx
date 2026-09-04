import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Calendar,
  Check,
  RefreshCw,
  Power,
  Link2,
  ExternalLink,
  Download,
  ShieldCheck,
  Sparkles,
  Loader2,
  Clock,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const CalendarSyncPanel: React.FC = () => {
  const { toast } = useToast();

  const { data: calStatus, refetch: refetchCalStatus, isLoading: isStatusLoading } = useQuery<{
    isConnected: boolean;
    email?: string;
    autoSyncEnabled?: boolean;
  }>({
    queryKey: ["/api/calendar/google/status"],
    queryFn: async () => {
      const res = await fetch("/api/calendar/google/status", { credentials: "include" });
      if (!res.ok) return { isConnected: false };
      return res.json();
    },
  });

  const connectGoogleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/calendar/google/auth-url", { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to generate Google auth URL");
      }
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    },
    onError: (err: any) => {
      toast({
        title: "Connection Error",
        description: err.message || "Could not start Google OAuth",
        variant: "destructive",
      });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/calendar/google/sync-all", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: "Google Calendar Synced",
        description: `Successfully pushed hearings to Google Calendar with Asia/Karachi timestamps.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
    },
    onError: (err: any) => {
      toast({
        title: "Sync Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const toggleAutoSyncMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest("POST", "/api/calendar/google/toggle-auto-sync", { enabled });
    },
    onSuccess: () => {
      refetchCalStatus();
      toast({ title: "Auto-sync preference updated" });
    },
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/calendar/google/disconnect", {});
    },
    onSuccess: () => {
      refetchCalStatus();
      toast({ title: "Google Calendar Disconnected" });
    },
  });

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Google Status Info */}
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 flex items-center justify-center text-[#105B38] shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                Pakistani Dual Calendar Sync Hub
              </h3>
              {calStatus?.isConnected ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>OAuth Connected</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#F8FAFC] dark:bg-[#0B131E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border border-[#E2E8F0] dark:border-[#1E2D44]">
                  <span>Available</span>
                </span>
              )}
            </div>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
              {calStatus?.isConnected
                ? `Active sync account: ${calStatus.email || "Google Account"} · Auto-pushes hearings with 60-min court alarms (PKT / UTC+5)`
                : "1-Click instant web links, RFC 5545 .ICS downloads, and automated cloud sync to Google Calendar"}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {calStatus?.isConnected ? (
            <>
              <button
                onClick={() => syncAllMutation.mutate()}
                disabled={syncAllMutation.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] text-xs font-semibold border border-[#E2E8F0] dark:border-[#1E2D44] transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#105B38] ${
                    syncAllMutation.isPending ? "animate-spin" : ""
                  }`}
                />
                <span>Sync All Hearings</span>
              </button>

              <button
                onClick={() => {
                  if (confirm("Disconnect Google Calendar integration?")) {
                    disconnectGoogleMutation.mutate();
                  }
                }}
                disabled={disconnectGoogleMutation.isPending}
                title="Disconnect Google Account"
                className="p-1.5 rounded-xl text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:bg-rose-500/10 transition-colors"
              >
                <Power className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => connectGoogleMutation.mutate()}
              disabled={connectGoogleMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50"
            >
              {connectGoogleMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Link2 className="w-3.5 h-3.5" />
              )}
              <span>Connect Google Calendar</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Methods Features Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44] text-[11px]">
        <div className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] space-y-1">
          <div className="flex items-center gap-1.5 text-[#0F172A] dark:text-[#F8FAFC] font-semibold font-mono">
            <ExternalLink className="w-3.5 h-3.5 text-[#105B38]" />
            <span>1-Click Web Links</span>
          </div>
          <p className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] text-[10px]">
            Pre-fills Google Calendar in 1 click without OAuth permissions.
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] space-y-1">
          <div className="flex items-center gap-1.5 text-[#0F172A] dark:text-[#F8FAFC] font-semibold font-mono">
            <Download className="w-3.5 h-3.5 text-[#105B38]" />
            <span>RFC 5545 .ICS Exports</span>
          </div>
          <p className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] text-[10px]">
            Instant import into Apple Calendar (macOS/iOS) & Outlook.
          </p>
        </div>

        <div className="p-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] space-y-1">
          <div className="flex items-center gap-1.5 text-[#0F172A] dark:text-[#F8FAFC] font-semibold font-mono">
            <Clock className="w-3.5 h-3.5 text-[#105B38]" />
            <span>PKT (UTC+5) Timezone</span>
          </div>
          <p className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] text-[10px]">
            Automatic Asia/Karachi conversion for Supreme Court & High Court hearings.
          </p>
        </div>
      </div>
    </div>
  );
};
export default CalendarSyncPanel;
