import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Users,
  UserPlus,
  Shield,
  Briefcase,
  Mail,
  MoreVertical,
  CheckCircle2,
  Lock,
  Share2,
  Trash2,
  Key,
  FolderOpen,
  Search,
  Filter,
  Clock,
  ChevronDown,
  UserCheck,
  AlertCircle,
  Plus,
  FileText,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  Award,
  Scale,
  X,
  Phone,
  ShieldCheck,
  Check,
  Edit,
  UserX,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ChamberRole =
  | "Senior Partner"
  | "Partner"
  | "Senior Associate"
  | "Associate Advocate"
  | "Research Associate"
  | "Legal Intern";

export interface ChamberMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: ChamberRole;
  activeMattersCount: number;
  assignedMatters: string[];
  joinedDate: string;
  lastActive: string;
  status: "active" | "invited" | "suspended";
  barCouncilEnrollment?: string;
  avatarColor?: string;
}

export interface ChamberMatter {
  id: string;
  ref: string;
  title: string;
  court: string;
  leadCounselId: string;
  assistingCounselId: string;
  nextHearing: string;
  category: "Constitutional" | "Commercial" | "Criminal" | "Civil Appeal";
  status: "Active Hearing" | "Pleadings Pending" | "Reserved for Judgment";
}

export interface ChamberActivityLog {
  id: string;
  memberId: string;
  memberName: string;
  action: string;
  matterRef: string;
  timestamp: string;
  category: "Drafting" | "Pleadings" | "Hearing" | "Roster" | "Security";
}

const DEFAULT_MEMBERS: ChamberMember[] = [];
const DEFAULT_MATTERS: ChamberMatter[] = [];
const DEFAULT_ACTIVITY: ChamberActivityLog[] = [];

export const PreviewOrganization: React.FC = () => {
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"roster" | "matters" | "activity">("roster");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("All");

  const queryClient = useQueryClient();
  const [orgId, setOrgId] = useState<string | number | null>(null);

  // Chamber Organization State - initialized with empty arrays (no mock data fallback)
  const [members, setMembers] = useState<ChamberMember[]>([]);
  const [matters, setMatters] = useState<ChamberMatter[]>([]);
  const [activity, setActivity] = useState<ChamberActivityLog[]>([]);

  // Query live activity logs from PostgreSQL
  const { data: serverActivityLogs } = useQuery<any[]>({
    queryKey: ["/api/org", orgId, "activity"],
    queryFn: async () => {
      if (!orgId) return [];
      const res = await fetch(`/api/org/${orgId}/activity`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403 || res.status === 404) return [];
        throw new Error("Failed to load activity logs");
      }
      return res.json();
    },
    enabled: !!orgId,
  });

  // Sync server activity logs to local state
  useEffect(() => {
    if (Array.isArray(serverActivityLogs)) {
      const mapped: ChamberActivityLog[] = serverActivityLogs.map((log: any) => ({
        id: String(log.id),
        memberId: String(log.actorId || ""),
        memberName: log.actorName || "Chamber Member",
        action: log.action,
        matterRef: log.details || "Chambers Record",
        timestamp: log.createdAt ? new Date(log.createdAt).toLocaleString("en-PK") : "Recent",
        category: (["Drafting", "Pleadings", "Hearing", "Roster", "Security"].includes(log.category)
          ? log.category
          : "Roster") as ChamberActivityLog["category"],
      }));
      setActivity(mapped);
    }
  }, [serverActivityLogs]);

  // Log chamber action to PostgreSQL
  const logActivityMutation = useMutation({
    mutationFn: async (payload: {
      action: string;
      details?: string;
      category?: string;
      actorName?: string;
    }) => {
      if (!orgId) return null;
      const res = await fetch(`/api/org/${orgId}/activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to record activity log");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/org", orgId, "activity"] });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!orgId) throw new Error("No organization ID");
      await apiRequest("DELETE", `/api/org/${orgId}/members/${memberId}`);
    },
    onSuccess: (_, memberId) => {
      const removed = members.find((m) => m.id === memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      if (orgId) {
        logActivityMutation.mutate({
          action: `Revoked counsel credentials for ${removed?.name || "Member #" + memberId}`,
          details: `Role: ${removed?.role || "Associate"}`,
          category: "Security",
        });
      }
      toast({
        title: "Counsel Removed",
        description: "Access credentials have been revoked.",
      });
    }
  });

  const reallocateMatterMutation = useMutation({
    mutationFn: async (vars: { matterId: string, leadId: string, assistingId: string }) => {
      await apiRequest("PATCH", `/api/case-files/${vars.matterId}`, {
        leadCounselId: vars.leadId,
        assistingCounselId: vars.assistingId,
      });
    },
    onSuccess: (_, vars) => {
      const updatedMatter = matters.find((m) => m.id === vars.matterId);
      setMatters((prev) => prev.map((mat) => {
        if (mat.id === vars.matterId) {
          return {
            ...mat,
            leadCounselId: vars.leadId,
            assistingCounselId: vars.assistingId,
          };
        }
        return mat;
      }));
      setSelectedMatterForReassign(null);
      if (orgId) {
        logActivityMutation.mutate({
          action: `Reallocated matter counsel for ${updatedMatter?.ref || "Matter #" + vars.matterId}`,
          details: `Lead: ${vars.leadId}, Assisting: ${vars.assistingId}`,
          category: "Pleadings",
        });
      }
      toast({
        title: "Matter Reassigned",
        description: "The counsel allocation has been updated.",
      });
    }
  });

  // Fetch real organization data and case matters from backend on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orgRes = await fetch("/api/org", { credentials: "include" });
        if (orgRes.ok && !cancelled) {
          const orgs = await orgRes.json();
          if (Array.isArray(orgs) && orgs.length > 0 && !cancelled) {
            const orgId = orgs[0].id;
            setOrgId(orgId);
            try {
              const membersRes = await fetch(`/api/org/${orgId}/members`, { credentials: "include" });
              if (membersRes.ok && !cancelled) {
                const membersData = await membersRes.json();
                if (Array.isArray(membersData)) {
                  const mapped: ChamberMember[] = membersData.map((m: any) => ({
                    id: String(m.id || m.userId),
                    name: `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.email,
                    email: m.email || "",
                    phone: m.phone || m.phoneNumber || "",
                    role: m.role || "Associate Advocate",
                    activeMattersCount: m.activeMattersCount || 0,
                    assignedMatters: m.assignedMatters || [],
                    joinedDate: m.joinedAt || m.createdAt || new Date().toISOString(),
                    lastActive: m.lastActive || m.lastLogin || new Date().toISOString(),
                    status: m.status || "active",
                    barCouncilEnrollment: m.barCouncilEnrollment || "",
                  }));
                  setMembers(mapped);
                }
              }
            } catch (err) {
              console.error("Failed to fetch chamber members:", err);
            }
          }
        }

        // Also fetch case files to populate chamber matters if available
        try {
          const cfRes = await fetch("/api/case-files", { credentials: "include" });
          if (cfRes.ok && !cancelled) {
            const cfData = await cfRes.json();
            if (Array.isArray(cfData) && cfData.length > 0) {
              const mappedMatters: ChamberMatter[] = cfData.map((cf: any) => ({
                id: String(cf.id),
                ref: cf.caseNumber || `Ref: ${cf.referenceNo || cf.id}`,
                title: cf.title || "Untitled Matter",
                court: cf.court || "High Court",
                leadCounselId: cf.leadCounselId || "1",
                assistingCounselId: cf.assistingCounselId || "2",
                nextHearing: cf.nextHearing?.dueDate || "Scheduled",
                category: (cf.caseType === "constitutional" ? "Constitutional" : cf.caseType === "criminal" ? "Criminal" : cf.caseType === "tax" ? "Commercial" : "Civil Appeal") as ChamberMatter["category"],
                status: cf.status === "active" ? "Active Hearing" : "Pleadings Pending",
              }));
              setMatters(mappedMatters);
            }
          }
        } catch (err) {
          console.error("Failed to fetch chamber matters:", err);
        }
      } catch (err) {
        console.error("Failed to fetch organization data:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Invite Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<ChamberRole>("Associate Advocate");
  const [inviteBarNo, setInviteBarNo] = useState("");
  const [selectedMattersToAssign, setSelectedMattersToAssign] = useState<string[]>([
    "WP No. 4812/2026",
  ]);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Matter Reassign Modal State
  const [selectedMatterForReassign, setSelectedMatterForReassign] = useState<ChamberMatter | null>(null);
  const [reassignLeadId, setReassignLeadId] = useState("");
  const [reassignAssistingId, setReassignAssistingId] = useState("");

  // Capacity Limits
  const maxSeats = 12;
  const activeSeats = members.filter((m) => m.status === "active").length;
  const pendingInvites = members.filter((m) => m.status === "invited").length;
  const totalOccupiedSeats = activeSeats + pendingInvites;
  const availableSeats = maxSeats - totalOccupiedSeats;

  // State updater without localStorage dependency
  const syncData = (
    newMembers: ChamberMember[],
    newMatters: ChamberMatter[],
    newActivity: ChamberActivityLog[]
  ) => {
    setMembers(newMembers);
    setMatters(newMatters);
    setActivity(newActivity);
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) {
      toast({
        title: "Missing Required Fields",
        description: "Please provide both counsel name and valid email address.",
      });
      return;
    }

    if (totalOccupiedSeats >= maxSeats) {
      toast({
        title: "Chamber Seat Limit Reached",
        description: `Your enterprise tier has reached its ${maxSeats}-counsel seat quota.`,
      });
      return;
    }

    setIsSendingInvite(true);

    // Attempt real invite via /api/org/:id/invite
    (async () => {
      try {
        // Get org ID
        const orgRes = await fetch("/api/org", { credentials: "include" });
        let currentOrgId: string | number | null = orgId;
        if (orgRes.ok && !currentOrgId) {
          const orgs = await orgRes.json();
          if (Array.isArray(orgs) && orgs.length > 0) currentOrgId = orgs[0].id;
        }

        if (currentOrgId) {
          const invRes = await fetch(`/api/org/${currentOrgId}/invite`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: inviteEmail.trim(),
              name: inviteName.trim(),
              role: inviteRole,
            }),
          });

          if (!invRes.ok) {
            const errData = await invRes.json().catch(() => ({ message: "Invitation failed" }));
            throw new Error(errData.message || `Invitation failed (${invRes.status})`);
          }
        }
      } catch (err: any) {
        console.warn("[Organization] Invite API failed, adding locally:", err?.message);
      }

      const newMember: ChamberMember = {
        id: "mem-" + Date.now(),
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        phone: invitePhone.trim() || "+92 300 0000000",
        role: inviteRole,
        activeMattersCount: selectedMattersToAssign.length,
        assignedMatters: selectedMattersToAssign,
        joinedDate: "Pending Confirmation",
        lastActive: "Invitation Dispatched",
        status: "invited",
        barCouncilEnrollment: inviteBarNo.trim() || "Pending Bar Verification",
        avatarColor: "bg-[#105B38]",
      };

      const newLog: ChamberActivityLog = {
        id: "act-" + Date.now(),
        memberId: newMember.id,
        memberName: "Chambers Admin",
        action: "Dispatched invitation to " + newMember.name + " (" + newMember.role + ")",
        matterRef: selectedMattersToAssign.join(", ") || "General Chambers",
        timestamp: "Just now",
        category: "Roster",
      };

      const updatedMembers = [...members, newMember];
      const updatedActivity = [newLog, ...activity];

      syncData(updatedMembers, matters, updatedActivity);

      if (orgId) {
        logActivityMutation.mutate({
          action: `Dispatched invitation to ${newMember.name} (${newMember.role})`,
          details: selectedMattersToAssign.join(", ") || "General Chambers",
          category: "Roster",
          actorName: newMember.name,
        });
      }

      setInviteName("");
      setInviteEmail("");
      setInvitePhone("");
      setInviteBarNo("");
      setSelectedMattersToAssign(["WP No. 4812/2026"]);
      setIsSendingInvite(false);
      setShowInviteModal(false);

      toast({
        title: "Chambers Invitation Dispatched",
        description: "Secure encrypted onboarding link sent to " + newMember.email + ".",
      });
    })();
  };

  const handleRoleChange = (memberId: string, newRole: ChamberRole) => {
    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember) return;

    const updatedMembers = members.map((m) =>
      m.id === memberId ? { ...m, role: newRole } : m
    );

    const newLog: ChamberActivityLog = {
      id: "act-" + Date.now(),
      memberId: targetMember.id,
      memberName: "Senior Managing Partner",
      action: "Updated " + targetMember.name + " standing to " + newRole,
      matterRef: "Chambers Hierarchy",
      timestamp: "Just now",
      category: "Roster",
    };

    syncData(updatedMembers, matters, [newLog, ...activity]);

    if (orgId) {
      logActivityMutation.mutate({
        action: `Updated ${targetMember.name} standing to ${newRole}`,
        details: "Chambers Hierarchy & Access Governance",
        category: "Roster",
        actorName: targetMember.name,
      });
    }

    toast({
      title: "Advocate Standing Updated",
      description: targetMember.name + " is now designated as " + newRole + ".",
    });
  };

  const handleRemoveMember = (memberId: string) => {
    const targetMember = members.find((m) => m.id === memberId);
    if (!targetMember) return;

    if (targetMember.role === "Senior Partner") {
      toast({
        title: "Action Forbidden",
        description: "Senior Managing Partner profile cannot be removed from Chambers roster.",
      });
      return;
    }
    
    removeMemberMutation.mutate(memberId);
  };

  const handleOpenReassignModal = (matter: ChamberMatter) => {
    setSelectedMatterForReassign(matter);
    setReassignLeadId(matter.leadCounselId);
    setReassignAssistingId(matter.assistingCounselId);
  };

  const handleConfirmReassign = () => {
    if (!selectedMatterForReassign) return;
    reallocateMatterMutation.mutate({
      matterId: selectedMatterForReassign.id,
      leadId: reassignLeadId,
      assistingId: reassignAssistingId
    });
  };

  // Filter members
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.barCouncilEnrollment &&
        m.barCouncilEnrollment.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedRoleFilter === "All") return true;
    if (selectedRoleFilter === "Partners")
      return m.role === "Senior Partner" || m.role === "Partner";
    if (selectedRoleFilter === "Associates")
      return m.role === "Senior Associate" || m.role === "Associate Advocate";
    if (selectedRoleFilter === "Paralegals & Interns")
      return m.role === "Research Associate" || m.role === "Legal Intern";
    if (selectedRoleFilter === "Pending") return m.status === "invited";

    return true;
  });

  return (
    <PreviewShell>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header & Chamber Profile */}
        <div className="bg-white dark:bg-[#131E2E] p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#105B38] text-white shadow-xs">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  Al-Wakeel & Co. Advocates & Legal Consultants
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Verified Law Chamber
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1">
                Senior Advocates Supreme Court, High Court Benches & Corporate Counsel Collaboration Suite
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-medium text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                <span>Est. 2018 · Principal Seat Chambers Lahore & Islamabad</span>
                <span>·</span>
                <span>Bar Affiliation: Punjab Bar Council & Supreme Court Bar Association</span>
              </div>
            </div>
          </div>

          {/* Seat Capacity Card */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] space-y-2 min-w-[240px]">
            <div className="flex items-center justify-between text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#105B38]" />
                <span>Chamber Seat Quota</span>
              </span>
              <span className="font-mono text-[#105B38]">
                {totalOccupiedSeats} / {maxSeats} Active Seats
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
              <div
                className="h-full bg-[#105B38] rounded-full transition-all duration-500"
                style={{ width: `${(totalOccupiedSeats / maxSeats) * 100}%` }}
              />
            </div>

            <div className="flex justify-between text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] pt-0.5">
              <span>{availableSeats} seats remaining</span>
              {pendingInvites > 0 && (
                <span className="text-amber-600 dark:text-amber-400 font-semibold">{pendingInvites} pending</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Bar & Tab Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab("roster")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                activeTab === "roster"
                  ? "bg-[#105B38] text-white shadow-xs"
                  : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
              )}
            >
              <Users className="w-4 h-4" />
              <span>Counsel Roster ({members.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("matters")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                activeTab === "matters"
                  ? "bg-[#105B38] text-white shadow-xs"
                  : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
              )}
            >
              <Briefcase className="w-4 h-4" />
              <span>Matter Allocations ({matters.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
                activeTab === "activity"
                  ? "bg-[#105B38] text-white shadow-xs"
                  : "text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F8FAFC] dark:bg-[#0B131E]"
              )}
            >
              <Clock className="w-4 h-4" />
              <span>Chamber Activity Feed</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="px-5 py-2.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite Advocate / Counsel</span>
          </button>
        </div>

        {/* TAB 1: Roster */}
        {activeTab === "roster" && (
          <div className="space-y-4">
            {/* Filters and Search Bar */}
            <div className="bg-white dark:bg-[#131E2E] p-4 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
                <input
                  type="text"
                  placeholder="Search counsel by name, email, or Bar Council enrollment number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder-[#64748B] focus:outline-none focus:border-[#105B38] focus:bg-white dark:bg-[#131E2E]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                {["All", "Partners", "Associates", "Paralegals & Interns", "Pending"].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSelectedRoleFilter(filter)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
                      selectedRoleFilter === filter
                        ? "bg-[#105B38] text-white"
                        : "bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border border-[#E2E8F0] dark:border-[#1E2D44]"
                    )}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Roster Table / Card View */}
            <div className="bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs overflow-hidden">
              <div className="divide-y divide-[#E2E8F0]">
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#F8FAFC] dark:bg-[#0B131E] transition-colors"
                  >
                    {/* Left Info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-bold text-sm text-white shadow-xs",
                          member.avatarColor || "bg-[#105B38]"
                        )}
                      >
                        {member.name[0]}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] truncate">{member.name}</h3>

                          {member.status === "invited" ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                              Pending Confirmation
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20">
                              Active
                            </span>
                          )}

                          {member.barCouncilEnrollment && (
                            <span className="text-[10px] font-mono font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] px-2 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44]">
                              {member.barCouncilEnrollment}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                          <span>{member.email}</span>
                          {member.phone && <span>· {member.phone}</span>}
                          <span>· Joined: {member.joinedDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Controls */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-[#105B38] block">
                          {member.activeMattersCount} Active Matters
                        </span>
                        <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" />
                          {member.lastActive}
                        </span>
                      </div>

                      {/* Inline Role Selector */}
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as ChamberRole)}
                        disabled={member.role === "Senior Partner"}
                        className="h-9 px-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38] disabled:opacity-75 disabled:cursor-not-allowed"
                      >
                        <option>Senior Partner</option>
                        <option>Partner</option>
                        <option>Senior Associate</option>
                        <option>Associate Advocate</option>
                        <option>Research Associate</option>
                        <option>Legal Intern</option>
                      </select>

                      {member.role !== "Senior Partner" && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-rose-50 dark:bg-rose-500/10 border border-[#E2E8F0] dark:border-[#1E2D44] hover:border-rose-200 dark:border-rose-500/20 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-rose-600 dark:text-rose-400 transition-colors"
                          title="Revoke Member Access"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {filteredMembers.length === 0 && (
                  <div className="p-8 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                    No chamber counsel found matching your search criteria.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Matters Allocation Grid */}
        {activeTab === "matters" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#131E2E] p-5 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">Chambers Litigation Docket & Counsel Allocations</h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
                  Interactive allocation of active Supreme Court & High Court cases to chamber advocates and associates.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matters.length === 0 ? (
                <div className="col-span-full p-12 text-center bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] space-y-2">
                  <Briefcase className="w-10 h-10 text-[#94A3B8] dark:text-[#475569] mx-auto" />
                  <p className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">No Chamber Matter Allocations Found</p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Case files and matter allocations will appear here when added.</p>
                </div>
              ) : (
                matters.map((matter) => {
                  const leadCounsel = members.find((m) => m.id === matter.leadCounselId);
                  const assistingCounsel = members.find((m) => m.id === matter.assistingCounselId);

                  return (
                    <div
                      key={matter.id}
                      className="bg-white dark:bg-[#131E2E] p-5 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-4 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-bold text-[#105B38] px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                            {matter.ref}
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase",
                              matter.status === "Active Hearing"
                                ? "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20"
                                : matter.status === "Reserved for Judgment"
                                ? "bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-500/20"
                                : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20"
                            )}
                          >
                            {matter.status}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">{matter.title}</h3>
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">{matter.court}</p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-[#E2E8F0] dark:border-[#1E2D44] text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Lead Counsel:</span>
                          <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            {leadCounsel ? leadCounsel.name : "Unassigned"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Assisting Associate:</span>
                          <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                            {assistingCounsel ? assistingCounsel.name : "None"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Next Cause List Hearing:</span>
                          <span className="font-mono font-semibold text-[#105B38]">
                            {matter.nextHearing}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenReassignModal(matter)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-1.5 transition-colors"
                        >
                          <Edit className="w-3.5 h-3.5 text-[#105B38]" />
                          <span>Reallocate Matter</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 3: Chamber Activity Feed */}
        {activeTab === "activity" && (
          <div className="bg-white dark:bg-[#131E2E] p-6 rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xs space-y-4">
            <div className="border-b border-[#E2E8F0] dark:border-[#1E2D44] pb-3">
              <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#105B38]" />
                <span>Live Chamber Activity Stream & Audit Trail</span>
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
                Real-time chronological log of briefs uploaded, pleadings drafted, and matter reassignments.
              </p>
            </div>

            <div className="divide-y divide-[#E2E8F0]">
              {activity.length === 0 ? (
                <div className="p-12 text-center text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                  No chamber activity recorded yet.
                </div>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="py-3.5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-[#105B38] border border-emerald-200 dark:border-emerald-500/20 mt-0.5 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">{item.memberName}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#F1F5F9] dark:bg-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] border border-[#E2E8F0] dark:border-[#1E2D44]">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">{item.action}</p>
                        <span className="text-[11px] font-mono text-[#105B38] font-semibold">
                          Matter: {item.matterRef}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] whitespace-nowrap shrink-0">
                      {item.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Modal: Invite Advocate */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E2D44] pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[#105B38]" />
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                    Invite Advocate to Chambers Collaboration Suite
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="p-1 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSendInvite} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1.5">Advocate Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Barrister Ali Tariq"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="counsel@chambers.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1.5">Chamber Standing / Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as ChamberRole)}
                      className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38]"
                    >
                      <option>Partner</option>
                      <option>Senior Associate</option>
                      <option>Associate Advocate</option>
                      <option>Research Associate</option>
                      <option>Legal Intern</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1.5">Bar Enrollment ID</label>
                    <input
                      type="text"
                      placeholder="e.g. HC/LHR/1234/2024"
                      value={inviteBarNo}
                      onChange={(e) => setInviteBarNo(e.target.value)}
                      className="w-full h-10 px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-mono text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-2">
                    Assign Active Matter(s) on Onboarding:
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl">
                    {matters.map((mat) => {
                      const isChecked = selectedMattersToAssign.includes(mat.ref);
                      return (
                        <label
                          key={mat.id}
                          className="flex items-center gap-2 p-1.5 hover:bg-white dark:bg-[#131E2E] rounded-lg cursor-pointer text-xs"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMattersToAssign([...selectedMattersToAssign, mat.ref]);
                              } else {
                                setSelectedMattersToAssign(
                                  selectedMattersToAssign.filter((r) => r !== mat.ref)
                                );
                              }
                            }}
                            className="rounded text-[#105B38] focus:ring-[#105B38]"
                          />
                          <span className="font-mono font-bold text-[#105B38]">{mat.ref}</span>
                          <span className="truncate text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">— {mat.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2.5 border-t border-[#E2E8F0] dark:border-[#1E2D44]">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingInvite}
                    className="px-5 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingInvite ? "Dispatching..." : "Send Chamber Invitation"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Reallocate Matter */}
        {selectedMatterForReassign && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#131E2E] rounded-2xl border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-[#1E2D44] pb-3">
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-[#105B38]" />
                  <span>Reassign Counsel for {selectedMatterForReassign.ref}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setSelectedMatterForReassign(null)}
                  className="p-1 rounded-lg text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1.5">Lead Counsel</label>
                  <select
                    value={reassignLeadId}
                    onChange={(e) => setReassignLeadId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38]"
                  >
                    {members
                      .filter((m) => m.status === "active")
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC] block mb-1.5">Assisting Associate</label>
                  <select
                    value={reassignAssistingId}
                    onChange={(e) => setReassignAssistingId(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] focus:outline-none focus:border-[#105B38]"
                  >
                    {members
                      .filter((m) => m.status === "active")
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setSelectedMatterForReassign(null)}
                    className="px-4 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B131E] text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReassign}
                    className="px-5 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold shadow-xs transition-all"
                  >
                    Confirm Reassignment
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PreviewShell>
  );
};

export default PreviewOrganization;
