import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Gavel,
  Search,
  Calendar,
  Filter,
  Building2,
  Bell,
  RefreshCw,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  BookOpen,
  CalendarPlus,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  CheckCircle2,
  XCircle,
  FileText,
  Bookmark,
  Landmark,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { GoogleCalendarButton } from "@/components/google-calendar-button";

type CourtCauseList = {
  id: number;
  court: string;
  bench: string;
  courtNumber: string | null;
  judgeName: string;
  listType: string;
  hearingDate: string;
  itemCount: number;
  rawPdfUrl: string | null;
  storageKey: string | null;
  status: string;
};

type CourtCauseListItem = {
  id: number;
  causeListId: number;
  serialNumber: number;
  caseNumber: string;
  caseType: string | null;
  caseYear: number | null;
  caseTitle: string;
  petitioner: string | null;
  respondent: string | null;
  petitionerAdvocate: string | null;
  respondentAdvocate: string | null;
  fixationPurpose: string | null;
  isRedList: boolean;
  court?: string;
  bench?: string;
  courtNumber?: string | null;
  judgeName?: string;
  hearingDate?: string;
};

type CauseListTracker = {
  id: number;
  userId: string;
  trackType: "case_number" | "advocate_name";
  query: string;
  court: string | null;
  notifyEmail: boolean;
  notifyDailyDiary: boolean;
  isActive: boolean;
  createdAt: string;
};

type ScrapeRun = {
  id: number;
  court: string;
  bench: string;
  targetDate: string;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "partial" | "failed";
  documentsFound: number;
  documentsParsed: number;
  itemsExtracted: number;
  itemsInserted: number;
  itemsUpdated: number;
  errorMessage: string | null;
};

const COURTS_CONFIG = [
  {
    code: "LHC",
    name: "Lahore High Court",
    benches: [
      { value: "all", label: "All Benches" },
      { value: "Principal Seat", label: "Principal Seat (Lahore)" },
      { value: "Rawalpindi Bench", label: "Rawalpindi Bench" },
      { value: "Multan Bench", label: "Multan Bench" },
      { value: "Bahawalpur Bench", label: "Bahawalpur Bench" },
    ],
  },
  {
    code: "IHC",
    name: "Islamabad High Court",
    benches: [
      { value: "all", label: "All Benches" },
      { value: "Principal Seat", label: "Principal Seat (Islamabad)" },
    ],
  },
  {
    code: "SHC",
    name: "Sindh High Court",
    benches: [
      { value: "all", label: "All Benches" },
      { value: "Principal Seat (Karachi)", label: "Principal Seat (Karachi)" },
      { value: "Sukkur Bench", label: "Sukkur Bench" },
      { value: "Hyderabad Circuit", label: "Hyderabad Circuit" },
      { value: "Larkana Circuit", label: "Larkana Circuit" },
    ],
  },
  {
    code: "SCP",
    name: "Supreme Court",
    category: "Superior Judiciary",
    benches: [
      { value: "all", label: "All Registries" },
      { value: "Principal Seat (Islamabad)", label: "Principal Seat (Islamabad)" },
      { value: "Branch Registry Lahore", label: "Branch Registry Lahore" },
      { value: "Branch Registry Karachi", label: "Branch Registry Karachi" },
      { value: "Branch Registry Peshawar", label: "Branch Registry Peshawar" },
      { value: "Branch Registry Quetta", label: "Branch Registry Quetta" },
    ],
  },
  {
    code: "LHR_DIST",
    name: "Lahore District Courts",
    category: "District Judiciary",
    benches: [
      { value: "all", label: "All Complexes" },
      { value: "Aiwan-e-Adl (Sessions Division)", label: "Aiwan-e-Adl (Sessions Division)" },
      { value: "Civil Courts Complex", label: "Civil Courts Complex" },
      { value: "Model Town Courts", label: "Model Town Courts" },
      { value: "Cantt Courts", label: "Cantt Courts" },
      { value: "Family & Guardian Courts", label: "Family & Guardian Courts" },
      { value: "Special / Banking Courts", label: "Special / Banking Courts" },
    ],
  },
  {
    code: "ISB_DIST",
    name: "Islamabad District Courts",
    category: "District Judiciary",
    benches: [
      { value: "all", label: "All Divisions" },
      { value: "District East (G-11 Judicial Complex)", label: "District East (G-11 Judicial Complex)" },
      { value: "District West (G-11 Judicial Complex)", label: "District West (G-11 Judicial Complex)" },
      { value: "Sessions Division Islamabad", label: "Sessions Division Islamabad" },
      { value: "Special Courts Islamabad", label: "Special Courts Islamabad" },
    ],
  },
  {
    code: "RWP_DIST",
    name: "Rawalpindi District Courts",
    category: "District Judiciary",
    benches: [
      { value: "all", label: "All Complexes" },
      { value: "Judicial Complex Rawalpindi", label: "Judicial Complex Rawalpindi" },
      { value: "Civil Courts Rawalpindi", label: "Civil Courts Rawalpindi" },
      { value: "Gujar Khan Courts", label: "Gujar Khan Courts" },
      { value: "Taxila Courts", label: "Taxila Courts" },
    ],
  },
  {
    code: "FSD_DIST",
    name: "Faisalabad District Courts",
    category: "District Judiciary",
    benches: [
      { value: "all", label: "All Complexes" },
      { value: "Sessions Division Faisalabad", label: "Sessions Division Faisalabad" },
      { value: "Civil Courts Faisalabad", label: "Civil Courts Faisalabad" },
      { value: "Jaranwala Complex", label: "Jaranwala Complex" },
      { value: "Sammundri Complex", label: "Sammundri Complex" },
      { value: "Tandlianwala Complex", label: "Tandlianwala Complex" },
    ],
  },
];

function getTodayString() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function getTomorrowString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function CauseListsPage() {
  const { toast } = useToast();
  const { user } = useAuth();

  // State Filters
  const [selectedCourt, setSelectedCourt] = useState<string>("LHC");
  const [selectedBench, setSelectedBench] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [selectedListType, setSelectedListType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeMainTab, setActiveMainTab] = useState<string>("roster");

  // Expanded Accordion State for Courtrooms
  const [expandedRosters, setExpandedRosters] = useState<Record<number, boolean>>({});

  // Tracker Modal State
  const [isTrackerOpen, setIsTrackerOpen] = useState<boolean>(false);
  const [trackerType, setTrackerType] = useState<"case_number" | "advocate_name">("case_number");
  const [trackerQuery, setTrackerQuery] = useState<string>("");
  const [trackerCourt, setTrackerCourt] = useState<string>("LHC");

  // Manual Trigger Modal State
  const [isManualSyncOpen, setIsManualSyncOpen] = useState<boolean>(false);
  const [manualSyncCourt, setManualSyncCourt] = useState<string>("LHC");
  const [manualSyncDate, setManualSyncDate] = useState<string>(getTomorrowString());

  // Copy Feedback State
  const [copiedCase, setCopiedCase] = useState<string | null>(null);

  const currentCourtConfig = useMemo(
    () => COURTS_CONFIG.find((c) => c.code === selectedCourt) || COURTS_CONFIG[0],
    [selectedCourt]
  );

  // Query: Get Cause Lists for selected filters
  const {
    data: causeListData,
    isLoading: isListsLoading,
    refetch: refetchLists,
  } = useQuery<{
    court: string;
    date: string;
    totalRosters: number;
    causeLists: CourtCauseList[];
  }>({
    queryKey: [
      "/api/cause-lists",
      selectedCourt,
      selectedBench,
      selectedDate,
      selectedListType,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        court: selectedCourt,
        date: selectedDate,
      });
      if (selectedBench && selectedBench !== "all") params.append("bench", selectedBench);
      if (selectedListType && selectedListType !== "all") params.append("listType", selectedListType);

      const res = await fetch(`/api/cause-lists?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load cause lists");
      return res.json();
    },
  });

  // Query: Search Cause List Case Items
  const {
    data: searchData,
    isLoading: isSearchLoading,
  } = useQuery<{
    query: string;
    total: number;
    items: CourtCauseListItem[];
  }>({
    queryKey: ["/api/cause-lists/search", searchQuery, selectedCourt, selectedDate],
    queryFn: async () => {
      if (!searchQuery.trim() || searchQuery.trim().length < 2) {
        return { query: "", total: 0, items: [] };
      }
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        court: selectedCourt,
        date: selectedDate,
      });
      const res = await fetch(`/api/cause-lists/search?${params.toString()}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searchQuery.trim().length >= 2,
  });

  // Query: User Trackers
  const {
    data: trackersData,
    isLoading: isTrackersLoading,
  } = useQuery<{ trackers: CauseListTracker[] }>({
    queryKey: ["/api/cause-lists/user/trackers"],
    queryFn: async () => {
      const res = await fetch("/api/cause-lists/user/trackers");
      if (!res.ok) return { trackers: [] };
      return res.json();
    },
    enabled: !!user,
  });

  // Query: Scrape Run Telemetry
  const {
    data: runsData,
    isLoading: isRunsLoading,
    refetch: refetchRuns,
  } = useQuery<{ runs: ScrapeRun[] }>({
    queryKey: ["/api/admin/cause-lists/runs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cause-lists/runs?limit=15");
      if (!res.ok) return { runs: [] };
      return res.json();
    },
  });

  // Query: Court System Health
  const { data: healthData } = useQuery<{
    status: string;
    courts: Record<string, { healthy: boolean; message: string; latencyMs: number }>;
  }>({
    queryKey: ["/api/admin/cause-lists/health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cause-lists/health");
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Mutation: Create Tracker
  const createTrackerMutation = useMutation({
    mutationFn: async (payload: { trackType: string; query: string; court: string }) => {
      const res = await apiRequest("POST", "/api/cause-lists/user/trackers", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cause-lists/user/trackers"] });
      toast({
        title: "Tracker Activated",
        description: `Now monitoring "${trackerQuery}". You will be notified in Daily Diary when this appears.`,
      });
      setIsTrackerOpen(false);
      setTrackerQuery("");
    },
    onError: (err: any) => {
      toast({
        title: "Failed to Add Tracker",
        description: err?.message || "Error creating tracker subscription.",
        variant: "destructive",
      });
    },
  });

  // Mutation: Delete Tracker
  const deleteTrackerMutation = useMutation({
    mutationFn: async (trackerId: number) => {
      const res = await apiRequest("DELETE", `/api/cause-lists/user/trackers/${trackerId}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cause-lists/user/trackers"] });
      toast({ title: "Tracker Removed", description: "Case tracker removed from your profile." });
    },
  });

  // Mutation: Manual Scrape Trigger
  const manualSyncMutation = useMutation({
    mutationFn: async (payload: { court: string; targetDate: string }) => {
      const res = await apiRequest("POST", "/api/admin/cause-lists/trigger", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cause-lists"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/cause-lists/runs"] });
      toast({
        title: "Sync Triggered Successfully",
        description: `Scraper finished sync for ${manualSyncDate}.`,
      });
      setIsManualSyncOpen(false);
    },
    onError: (err: any) => {
      toast({
        title: "Sync Failed",
        description: err?.message || "Error triggering scraper.",
        variant: "destructive",
      });
    },
  });

  // Mutation: Add to Daily Diary
  const addToDiaryMutation = useMutation({
    mutationFn: async (item: CourtCauseListItem) => {
      const courtroomStr = item.courtNumber ? ` (${item.courtNumber})` : "";
      const title = `Court Hearing: ${item.caseNumber} - ${item.judgeName || "Hon'ble Bench"}${courtroomStr}`;
      const desc = `Court: ${item.court || selectedCourt} (${item.bench || selectedBench})\nListed at Sr. #${item.serialNumber} before ${item.judgeName || "Hon'ble Judge"}\nParties: ${item.caseTitle}\nFixation Purpose: ${item.fixationPurpose || "Hearing"}`;

      const res = await apiRequest("POST", "/api/diary", {
        date: selectedDate,
        time: "09:00",
        title,
        description: desc,
        priority: item.isRedList ? "urgent" : "high",
        causeListItemId: item.id,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/diary"] });
      toast({
        title: "Added to Daily Diary",
        description: "Case hearing has been added to your schedule.",
      });
    },
  });

  const toggleRoster = (id: number) => {
    setExpandedRosters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCase(text);
    setTimeout(() => setCopiedCase(null), 2000);
    toast({ title: "Copied to Clipboard", description: text });
  };

  const handleQuickAddTracker = (caseNumber: string) => {
    setTrackerType("case_number");
    setTrackerQuery(caseNumber);
    setTrackerCourt(selectedCourt);
    setIsTrackerOpen(true);
  };

  const handleCourtChange = (courtCode: string) => {
    setSelectedCourt(courtCode);
    setSelectedBench("all");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-background text-slate-900 dark:text-foreground pb-16">
      {/* Top Header Banner */}
      <div className="border-b border-slate-200 dark:border-border bg-white dark:bg-card/95 backdrop-blur-md sticky top-0 z-10 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Gavel className="w-6 h-6 text-teal-700 dark:text-teal-400" />
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-foreground font-serif">Court Cause Lists</h1>
                <Badge variant="outline" className="border-teal-600/40 text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-500/10 text-xs font-bold">
                  National Automated Sync
                </Badge>
              </div>
              <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
                Live daily hearing schedules, courtroom rosters, judges, and case fixations across Pakistan
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 bg-white dark:bg-card border-slate-300 dark:border-border text-slate-800 dark:text-foreground hover:bg-slate-100 shadow-xs"
                onClick={() => setIsTrackerOpen(true)}
              >
                <Plus className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                Track Case / Lawyer
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 bg-white dark:bg-card border-slate-300 dark:border-border text-slate-800 dark:text-foreground hover:bg-slate-100 shadow-xs"
                onClick={() => {
                  refetchLists();
                  refetchRuns();
                }}
              >
                <RefreshCw className="w-4 h-4 text-slate-600 dark:text-muted-foreground" />
                Refresh
              </Button>

              <Button
                variant="default"
                size="sm"
                className="gap-1.5 bg-teal-700 hover:bg-teal-800 text-white font-semibold shadow-xs"
                onClick={() => setIsManualSyncOpen(true)}
              >
                <Activity className="w-4 h-4" />
                Admin Sync
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-6">
        {/* Court Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-border">
          {COURTS_CONFIG.map((c) => (
            <button
              key={c.code}
              onClick={() => handleCourtChange(c.code)}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shrink-0 ${
                selectedCourt === c.code
                  ? "bg-teal-700 text-white shadow-sm border border-teal-800"
                  : "bg-white dark:bg-card border border-slate-200 dark:border-border/80 hover:bg-slate-100 dark:hover:bg-muted text-slate-700 dark:text-slate-300 shadow-xs"
              }`}
            >
              {c.code === "SCP" ? <Landmark className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
              {c.name}
              <Badge
                variant="secondary"
                className={`text-[10px] px-1.5 py-0.5 font-bold ${
                  selectedCourt === c.code
                    ? "bg-white/20 text-white"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-transparent"
                }`}
              >
                Live Sync
              </Badge>
            </button>
          ))}
        </div>

        {/* Navigation Tabs (Explorer vs Trackers vs Audit) */}
        <div className="mt-6">
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <TabsList className="grid grid-cols-3 max-w-md bg-slate-200/80 dark:bg-muted p-1 border border-slate-300/80 dark:border-border rounded-xl">
                <TabsTrigger value="roster" className="gap-2 text-xs sm:text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-card dark:data-[state=active]:text-foreground">
                  <FileText className="w-4 h-4" />
                  Court Rosters
                </TabsTrigger>
                <TabsTrigger value="trackers" className="gap-2 text-xs sm:text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-card dark:data-[state=active]:text-foreground">
                  <Bell className="w-4 h-4" />
                  My Trackers
                  {trackersData?.trackers && trackersData.trackers.length > 0 && (
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-slate-200 dark:bg-muted text-slate-800 dark:text-foreground">
                      {trackersData.trackers.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="audit" className="gap-2 text-xs sm:text-sm font-semibold data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm dark:data-[state=active]:bg-card dark:data-[state=active]:text-foreground">
                  <Activity className="w-4 h-4" />
                  Scrape Audit
                </TabsTrigger>
              </TabsList>

              {/* Live Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-muted-foreground" />
                <Input
                  type="text"
                  placeholder={`Search ${selectedCourt} Cases (e.g. 12450/2024), Lawyer, or Party...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 text-sm bg-white dark:bg-card border-slate-300 dark:border-border text-slate-900 dark:text-foreground placeholder:text-slate-400 shadow-xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* TAB 1: COURT ROSTERS */}
            <TabsContent value="roster" className="mt-6 space-y-6">
              {/* Filter Row */}
              <Card className="bg-white dark:bg-card border border-slate-200 dark:border-border shadow-xs">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                    {/* Bench Filter */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-muted-foreground">Select Bench / Registry</Label>
                      <Select value={selectedBench} onValueChange={setSelectedBench}>
                        <SelectTrigger className="bg-white dark:bg-background border-slate-300 dark:border-border text-slate-900 dark:text-foreground">
                          <SelectValue placeholder="Select Bench" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-card border-slate-200 dark:border-border">
                          {currentCourtConfig.benches.map((b) => (
                            <SelectItem key={b.value} value={b.value}>
                              {b.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date Quick Buttons & Date Input */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-muted-foreground">Hearing Date</Label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="flex-1 text-sm bg-white dark:bg-background border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
                        />
                      </div>
                    </div>

                    {/* Quick Date Pills */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-muted-foreground">Quick Date</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={selectedDate === getTodayString() ? "default" : "outline"}
                          size="sm"
                          className={`flex-1 text-xs font-bold ${
                            selectedDate === getTodayString()
                              ? "bg-teal-700 hover:bg-teal-800 text-white"
                              : "bg-white dark:bg-background border-slate-300 dark:border-border text-slate-800 dark:text-foreground"
                          }`}
                          onClick={() => setSelectedDate(getTodayString())}
                        >
                          Today
                        </Button>
                        <Button
                          variant={selectedDate === getTomorrowString() ? "default" : "outline"}
                          size="sm"
                          className={`flex-1 text-xs font-bold ${
                            selectedDate === getTomorrowString()
                              ? "bg-teal-700 hover:bg-teal-800 text-white"
                              : "bg-white dark:bg-background border-slate-300 dark:border-border text-slate-800 dark:text-foreground"
                          }`}
                          onClick={() => setSelectedDate(getTomorrowString())}
                        >
                          Tomorrow
                        </Button>
                      </div>
                    </div>

                    {/* List Type Filter */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700 dark:text-muted-foreground">List Category</Label>
                      <Select value={selectedListType} onValueChange={setSelectedListType}>
                        <SelectTrigger className="bg-white dark:bg-background border-slate-300 dark:border-border text-slate-900 dark:text-foreground">
                          <SelectValue placeholder="All Lists" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-card border-slate-200 dark:border-border">
                          <SelectItem value="all">All Lists</SelectItem>
                          <SelectItem value="regular">Regular List</SelectItem>
                          <SelectItem value="urgent">Urgent List</SelectItem>
                          <SelectItem value="supplementary">Supplementary List</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* SEARCH RESULTS VIEW */}
              {searchQuery.trim().length >= 2 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-foreground font-serif">
                      Search Results for "{searchQuery}" in {currentCourtConfig.name}
                    </h2>
                    <Badge variant="outline" className="bg-white dark:bg-card border-slate-300 dark:border-border font-bold">
                      {searchData?.total || 0} cases found
                    </Badge>
                  </div>

                  {isSearchLoading ? (
                    <div className="flex justify-center py-12">
                      <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
                    </div>
                  ) : searchData?.items && searchData.items.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {searchData.items.map((item) => (
                        <Card key={item.id} className="bg-white dark:bg-card border border-slate-200 dark:border-border border-l-4 border-l-teal-600 hover:border-teal-500 transition-all shadow-xs">
                          <CardContent className="p-4 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-base text-teal-800 dark:text-teal-400">
                                  {item.caseNumber}
                                </span>
                                {item.caseType && (
                                  <Badge variant="secondary" className="text-xs bg-slate-100 dark:bg-secondary text-slate-800 dark:text-secondary-foreground font-semibold">
                                    {item.caseType}
                                  </Badge>
                                )}
                                {item.isRedList && (
                                  <Badge className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/40 text-xs font-black">
                                    RED CAUSE LIST
                                  </Badge>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1 text-xs text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted"
                                  onClick={() => copyToClipboard(item.caseNumber)}
                                >
                                  {copiedCase === item.caseNumber ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                  Copy
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 text-xs border-teal-600/50 bg-teal-50/50 dark:bg-transparent text-teal-800 dark:text-teal-300 hover:bg-teal-100 font-semibold"
                                  onClick={() => addToDiaryMutation.mutate(item)}
                                >
                                  <CalendarPlus className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                                  Add to Diary
                                </Button>
                                <GoogleCalendarButton
                                  event={{
                                    title: `Court Hearing: ${item.caseNumber}`,
                                    court: item.court,
                                    bench: item.bench,
                                    courtNumber: item.courtNumber,
                                    judgeName: item.judgeName,
                                    caseNumber: item.caseNumber,
                                    caseTitle: item.caseTitle,
                                    petitionerAdvocate: item.petitionerAdvocate,
                                    respondentAdvocate: item.respondentAdvocate,
                                    fixationPurpose: item.fixationPurpose,
                                    date: item.hearingDate ? new Date(item.hearingDate).toISOString().slice(0, 10) : getTodayString(),
                                    isRedList: item.isRedList,
                                  }}
                                  size="sm"
                                  variant="outline"
                                  className="h-8 bg-white dark:bg-card border-slate-300 dark:border-border"
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 gap-1 text-xs text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted"
                                  onClick={() => handleQuickAddTracker(item.caseNumber)}
                                >
                                  <Bell className="w-3.5 h-3.5 text-slate-600 dark:text-muted-foreground" />
                                  Track
                                </Button>
                              </div>
                            </div>

                            <p className="text-sm font-bold text-slate-900 dark:text-foreground">{item.caseTitle}</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-muted-foreground pt-2 border-t border-slate-200 dark:border-border">
                              <div>
                                <span className="font-bold text-slate-900 dark:text-foreground">Courtroom:</span>{" "}
                                {item.judgeName} {item.courtNumber ? `(${item.courtNumber})` : ""} &bull; Sr. #{item.serialNumber}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 dark:text-foreground">Advocates:</span>{" "}
                                {item.petitionerAdvocate || item.respondentAdvocate || "Not Specified"}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="bg-white dark:bg-card border border-slate-200 dark:border-border text-center py-12 shadow-xs">
                      <CardContent>
                        <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-900 dark:text-foreground">No Matching Court Cases Found</h3>
                        <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
                          Try searching for a different case number (e.g. "12450/2024") or lawyer name.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                /* REGULAR CAUSE LIST ROSTER CARDS */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-foreground font-serif">
                        {currentCourtConfig.name} Cause Lists &bull; {selectedDate}
                      </h2>
                      <p className="text-xs text-slate-600 dark:text-muted-foreground">
                        {causeListData?.causeLists?.length || 0} courtrooms active
                      </p>
                    </div>
                  </div>

                  {isListsLoading ? (
                    <div className="flex justify-center py-16">
                      <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
                    </div>
                  ) : causeListData?.causeLists && causeListData.causeLists.length > 0 ? (
                    <div className="grid grid-cols-1 gap-4">
                      {causeListData.causeLists.map((roster) => {
                        const isExpanded = !!expandedRosters[roster.id];

                        return (
                          <Card key={roster.id} className="bg-white dark:bg-card border border-slate-200 dark:border-border transition-all shadow-xs">
                            <CardHeader className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-muted/40 transition-colors" onClick={() => toggleRoster(roster.id)}>
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <Gavel className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                                    <CardTitle className="text-base font-bold text-slate-900 dark:text-foreground">
                                      {roster.judgeName}
                                    </CardTitle>
                                    {roster.courtNumber && (
                                      <Badge variant="outline" className="text-xs bg-slate-100 dark:bg-muted text-slate-800 dark:text-foreground font-bold border-slate-300 dark:border-border">
                                        {roster.courtNumber}
                                      </Badge>
                                    )}
                                  </div>
                                  <CardDescription className="text-xs flex items-center gap-3 text-slate-600 dark:text-muted-foreground">
                                    <span><strong>Bench:</strong> {roster.bench}</span>
                                    <span>&bull;</span>
                                    <span><strong>List:</strong> {roster.listType.toUpperCase()}</span>
                                    <span>&bull;</span>
                                    <span><strong>Total Cases:</strong> {roster.itemCount}</span>
                                  </CardDescription>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted">
                                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    {isExpanded ? "Hide Cases" : `View ${roster.itemCount} Cases`}
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>

                            {isExpanded && (
                              <CardContent className="p-4 pt-0 border-t border-slate-200 dark:border-border bg-slate-50/50 dark:bg-card">
                                <RosterItemsList causeListId={roster.id} onAddToDiary={addToDiaryMutation.mutate} onTrack={handleQuickAddTracker} />
                              </CardContent>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <Card className="bg-white dark:bg-card border border-slate-200 dark:border-border text-center py-16 shadow-xs">
                      <CardContent>
                        <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-slate-900 dark:text-foreground">No Cause Lists Uploaded For This Date Yet</h3>
                        <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1 max-w-md mx-auto">
                          Courts publish cause lists in the evening between 6:00 PM and 10:30 PM. Click "Admin Sync" to test or re-trigger.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4 gap-1.5 bg-white dark:bg-card border-slate-300 dark:border-border font-bold text-slate-800 dark:text-foreground hover:bg-slate-100 shadow-xs"
                          onClick={() => setIsManualSyncOpen(true)}
                        >
                          <Activity className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                          Trigger Scraper Sync
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: MY TRACKED CASES & ADVOCATES */}
            <TabsContent value="trackers" className="mt-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-foreground font-serif">Active Case & Advocate Trackers</h2>
                  <p className="text-sm text-slate-600 dark:text-muted-foreground">
                    Whenever these case numbers or advocate names appear in daily court rosters across Pakistan, Alwakeelo auto-syncs them to your Daily Diary.
                  </p>
                </div>

                <Button className="gap-1.5 bg-teal-700 hover:bg-teal-800 text-white font-bold shadow-xs" onClick={() => setIsTrackerOpen(true)}>
                  <Plus className="w-4 h-4" />
                  Add Tracker
                </Button>
              </div>

              {isTrackersLoading ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : trackersData?.trackers && trackersData.trackers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trackersData.trackers.map((tracker) => (
                    <Card key={tracker.id} className="bg-white dark:bg-card border border-slate-200 dark:border-border relative shadow-xs">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs capitalize bg-slate-100 dark:bg-secondary text-slate-800 dark:text-secondary-foreground font-bold">
                            {tracker.trackType === "case_number" ? "Case Number" : "Advocate Name"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => deleteTrackerMutation.mutate(tracker.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-foreground mt-2">{tracker.query}</CardTitle>
                        <CardDescription className="text-xs text-slate-600 dark:text-muted-foreground">
                          {tracker.court ? `Court: ${tracker.court}` : "All Superior Courts"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 text-xs text-slate-600 dark:text-muted-foreground flex items-center gap-3 border-t border-slate-100 dark:border-border mt-2">
                        <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Daily Diary Sync Active
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="bg-white dark:bg-card border border-slate-200 dark:border-border text-center py-12 shadow-xs">
                  <CardContent>
                    <Bell className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-foreground">No Trackers Configured Yet</h3>
                    <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1 max-w-sm mx-auto">
                      Add your case numbers or lawyer name to automatically populate your Daily Diary whenever your cases are fixed.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 gap-1.5 bg-white dark:bg-card border-slate-300 dark:border-border font-bold text-slate-800 dark:text-foreground hover:bg-slate-100 shadow-xs"
                      onClick={() => setIsTrackerOpen(true)}
                    >
                      <Plus className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                      Add Your First Tracker
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* TAB 3: SCRAPE AUDIT & OBSERVABILITY */}
            <TabsContent value="audit" className="mt-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-foreground font-serif">Scraper Run Logs & Observability</h2>
                  <p className="text-sm text-slate-600 dark:text-muted-foreground">
                    Live telemetry tracking automated multi-wave syncs across all superior courts in Pakistan.
                  </p>
                </div>

                {/* Health Pills for Superior Courts */}
                <div className="flex flex-wrap items-center gap-2">
                  {healthData?.courts &&
                    Object.entries(healthData.courts).map(([courtCode, health]) => (
                      <Badge
                        key={courtCode}
                        variant={health.healthy ? "default" : "destructive"}
                        className={`gap-1 text-xs font-bold ${
                          health.healthy
                            ? "bg-emerald-600 text-white"
                            : "bg-red-600 text-white"
                        }`}
                      >
                        <Activity className="w-3 h-3" />
                        {courtCode}: {health.healthy ? "Online" : "Down"} ({health.latencyMs}ms)
                      </Badge>
                    ))}
                </div>
              </div>

              {isRunsLoading ? (
                <div className="flex justify-center py-12">
                  <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
                </div>
              ) : runsData?.runs && runsData.runs.length > 0 ? (
                <div className="overflow-x-auto border border-slate-200 dark:border-border rounded-xl bg-white dark:bg-card shadow-xs">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 dark:bg-muted text-xs uppercase text-slate-700 dark:text-muted-foreground border-b border-slate-200 dark:border-border font-bold">
                      <tr>
                        <th className="p-3">Court / Bench</th>
                        <th className="p-3">Target Date</th>
                        <th className="p-3">Started At</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Docs Parsed</th>
                        <th className="p-3">Cases Inserted</th>
                        <th className="p-3">Errors</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-border text-slate-800 dark:text-foreground">
                      {runsData.runs.map((run) => (
                        <tr key={run.id} className="hover:bg-slate-50 dark:hover:bg-muted/50">
                          <td className="p-3 font-bold text-slate-900 dark:text-foreground">{run.court} ({run.bench})</td>
                          <td className="p-3 font-mono text-xs text-slate-700 dark:text-muted-foreground">{run.targetDate}</td>
                          <td className="p-3 text-xs text-slate-600 dark:text-muted-foreground">
                            {new Date(run.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={
                                run.status === "success"
                                  ? "default"
                                  : run.status === "partial"
                                  ? "secondary"
                                  : run.status === "running"
                                  ? "outline"
                                  : "destructive"
                              }
                              className="text-[11px] font-bold capitalize"
                            >
                              {run.status}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono">{run.documentsParsed}/{run.documentsFound}</td>
                          <td className="p-3 font-mono text-emerald-700 dark:text-emerald-400 font-bold">+{run.itemsInserted}</td>
                          <td className="p-3 text-xs text-slate-500 dark:text-muted-foreground max-w-xs truncate">
                            {run.errorMessage || "None"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Card className="bg-white dark:bg-card border border-slate-200 dark:border-border text-center py-12 shadow-xs">
                  <CardContent>
                    <Activity className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-foreground">No Scrape Runs Recorded Yet</h3>
                    <p className="text-sm text-slate-600 dark:text-muted-foreground mt-1">
                      Scrape runs will appear here as the multi-wave background scheduler runs.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* DIALOG 1: ADD TRACKER */}
      <Dialog open={isTrackerOpen} onOpenChange={setIsTrackerOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-900 dark:text-foreground shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-foreground font-serif">
              <Bell className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              Add Case or Lawyer Tracker
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-muted-foreground">
              Subscribe to automated Daily Diary alerts when this case or lawyer appears in court cause lists.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-muted-foreground">Tracking Type</Label>
              <Select
                value={trackerType}
                onValueChange={(val: any) => setTrackerType(val)}
              >
                <SelectTrigger className="bg-white dark:bg-background border-slate-300 dark:border-border text-slate-900 dark:text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-card border-slate-200 dark:border-border">
                  <SelectItem value="case_number">Case Number (e.g. W.P. 12345/2024)</SelectItem>
                  <SelectItem value="advocate_name">Advocate Name (e.g. Aitzaz Ahsan)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-muted-foreground">
                {trackerType === "case_number" ? "Enter Case Number" : "Enter Advocate Name"}
              </Label>
              <Input
                type="text"
                placeholder={trackerType === "case_number" ? "e.g. W.P. No. 12450/2024" : "e.g. Chaudhry Aitzaz Ahsan"}
                value={trackerQuery}
                onChange={(e) => setTrackerQuery(e.target.value)}
                className="bg-white dark:bg-background border-slate-300 dark:border-border text-slate-900 dark:text-foreground placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-muted-foreground">Court Filter</Label>
              <Select value={trackerCourt} onValueChange={setTrackerCourt}>
                <SelectTrigger className="bg-white dark:bg-background border-slate-300 dark:border-border text-slate-900 dark:text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-card border-slate-200 dark:border-border">
                  <SelectItem value="LHC">Lahore High Court</SelectItem>
                  <SelectItem value="IHC">Islamabad High Court</SelectItem>
                  <SelectItem value="SHC">Sindh High Court</SelectItem>
                  <SelectItem value="SCP">Supreme Court</SelectItem>
                  <SelectItem value="LHR_DIST">Lahore District Courts</SelectItem>
                  <SelectItem value="ISB_DIST">Islamabad District Courts</SelectItem>
                  <SelectItem value="RWP_DIST">Rawalpindi District Courts</SelectItem>
                  <SelectItem value="FSD_DIST">Faisalabad District Courts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-white dark:bg-background border-slate-300 dark:border-border text-slate-800 dark:text-foreground" onClick={() => setIsTrackerOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold"
              disabled={!trackerQuery.trim() || createTrackerMutation.isPending}
              onClick={() =>
                createTrackerMutation.mutate({
                  trackType: trackerType,
                  query: trackerQuery.trim(),
                  court: trackerCourt,
                })
              }
            >
              {createTrackerMutation.isPending ? "Activating..." : "Save Tracker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: MANUAL SCRAPE TRIGGER */}
      <Dialog open={isManualSyncOpen} onOpenChange={setIsManualSyncOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-card border border-slate-200 dark:border-border text-slate-900 dark:text-foreground shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-foreground font-serif">
              <Activity className="w-5 h-5 text-teal-700 dark:text-teal-400" />
              Trigger Live Court Scraper Sync
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-muted-foreground">
              Manually trigger real-time scraping of official court portals and parse PDF/HTML rosters into Neon PostgreSQL.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-muted-foreground">Target Court</Label>
              <Select value={manualSyncCourt} onValueChange={setManualSyncCourt}>
                <SelectTrigger className="bg-white dark:bg-background border-slate-300 dark:border-border text-slate-900 dark:text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-card border-slate-200 dark:border-border">
                  <SelectItem value="LHC">Lahore High Court (All 4 Benches)</SelectItem>
                  <SelectItem value="IHC">Islamabad High Court (Principal Seat)</SelectItem>
                  <SelectItem value="SHC">Sindh High Court (4 Benches/Circuits)</SelectItem>
                  <SelectItem value="SCP">Supreme Court of Pakistan (5 Registries)</SelectItem>
                  <SelectItem value="LHR_DIST">Lahore District Courts (6 Complexes)</SelectItem>
                  <SelectItem value="ISB_DIST">Islamabad District Courts (East & West)</SelectItem>
                  <SelectItem value="RWP_DIST">Rawalpindi District Courts</SelectItem>
                  <SelectItem value="FSD_DIST">Faisalabad District Courts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-muted-foreground">Target Hearing Date</Label>
              <Input
                type="date"
                value={manualSyncDate}
                onChange={(e) => setManualSyncDate(e.target.value)}
                className="bg-white dark:bg-background border-slate-300 dark:border-border text-slate-900 dark:text-foreground"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="bg-white dark:bg-background border-slate-300 dark:border-border text-slate-800 dark:text-foreground" onClick={() => setIsManualSyncOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-teal-700 hover:bg-teal-800 text-white font-bold"
              disabled={manualSyncMutation.isPending}
              onClick={() =>
                manualSyncMutation.mutate({
                  court: manualSyncCourt,
                  targetDate: manualSyncDate,
                })
              }
            >
              {manualSyncMutation.isPending ? "Scraping & Parsing..." : "Start Scraper Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Sub-component: Renders individual courtroom cases when an accordion is expanded
 */
function RosterItemsList({
  causeListId,
  onAddToDiary,
  onTrack,
}: {
  causeListId: number;
  onAddToDiary: (item: CourtCauseListItem) => void;
  onTrack: (caseNumber: string) => void;
}) {
  const { data, isLoading } = useQuery<{
    causeList: CourtCauseList;
    items: CourtCauseListItem[];
  }>({
    queryKey: [`/api/cause-lists/${causeListId}/items`],
    queryFn: async () => {
      const res = await fetch(`/api/cause-lists/${causeListId}/items`);
      if (!res.ok) throw new Error("Failed to load roster items");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <RefreshCw className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!data?.items || data.items.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-slate-500 dark:text-muted-foreground font-medium">
        No case items found in this roster.
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-3">
      {data.items.map((item) => (
        <div
          key={item.id}
          className={`p-3.5 rounded-xl border text-sm transition-all shadow-xs ${
            item.isRedList
              ? "border-red-300 dark:border-red-500/40 bg-red-50/90 dark:bg-red-500/10 text-slate-900 dark:text-foreground"
              : "bg-white dark:bg-card/90 hover:bg-slate-50 dark:hover:bg-muted/40 border-slate-200 dark:border-border text-slate-900 dark:text-foreground"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs font-bold bg-slate-100 dark:bg-muted text-slate-800 dark:text-foreground border-slate-300 dark:border-border">
                Sr. #{item.serialNumber}
              </Badge>
              <span className="font-mono font-bold text-sm text-teal-800 dark:text-teal-400">
                {item.caseNumber}
              </span>
              {item.caseType && (
                <Badge variant="secondary" className="text-[11px] bg-slate-100 dark:bg-secondary text-slate-800 dark:text-secondary-foreground font-semibold">
                  {item.caseType}
                </Badge>
              )}
              {item.isRedList && (
                <Badge className="bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/40 text-[10px] font-black">
                  RED CAUSE LIST
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted font-semibold"
                onClick={() => onAddToDiary(item)}
              >
                <CalendarPlus className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                Add to Diary
              </Button>
              <GoogleCalendarButton
                event={{
                  title: `Court Hearing: ${item.caseNumber}`,
                  court: data?.causeList?.court,
                  bench: data?.causeList?.bench,
                  courtNumber: data?.causeList?.courtNumber,
                  judgeName: data?.causeList?.judgeName,
                  caseNumber: item.caseNumber,
                  caseTitle: item.caseTitle,
                  petitionerAdvocate: item.petitionerAdvocate,
                  respondentAdvocate: item.respondentAdvocate,
                  fixationPurpose: item.fixationPurpose,
                  date: data?.causeList?.hearingDate ? new Date(data.causeList.hearingDate).toISOString().slice(0, 10) : getTodayString(),
                  isRedList: item.isRedList,
                }}
                size="sm"
                variant="ghost"
                showLabel={false}
                className="h-7 w-7 p-0 text-slate-600 dark:text-muted-foreground hover:text-emerald-600"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-slate-700 dark:text-foreground hover:bg-slate-100 dark:hover:bg-muted"
                onClick={() => onTrack(item.caseNumber)}
              >
                <Bell className="w-3.5 h-3.5 text-slate-500 dark:text-muted-foreground" />
                Track
              </Button>
            </div>
          </div>

          <div className="mt-2 font-bold text-slate-900 dark:text-foreground">{item.caseTitle}</div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 dark:text-muted-foreground mt-2 pt-2 border-t border-slate-200 dark:border-border">
            <div>
              <span className="font-bold text-slate-900 dark:text-foreground">Advocates:</span>{" "}
              {item.petitionerAdvocate || item.respondentAdvocate || "Not listed"}
            </div>
            <div>
              <span className="font-bold text-slate-900 dark:text-foreground">Purpose:</span>{" "}
              {item.fixationPurpose || "For Hearing"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
