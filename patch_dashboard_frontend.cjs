const fs = require('fs');
const path = 'client/src/experimental/pages/PreviewDashboard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace all those useQuery calls with one!
const oldQueries = \`  const { data: usage, isLoading: isLoadingUsage } = useQuery<UsageData>({
    queryKey: ["/api/usage"],
  });

  const { data: activitySummary } = useQuery<ActivitySummary>({
    queryKey: ["/api/activity/summary"],
  });

  const { data: todayAgenda = [] } = useQuery<any[]>({
    queryKey: ["/api/calendar/events", { date: new Date().toISOString().split("T")[0] }],
    queryFn: async () => {
      const res = await fetch("/api/calendar/events");
      if (!res.ok) return [];
      const events = await res.json();
      return events.filter((e: any) => e.date && e.date.startsWith(new Date().toISOString().split("T")[0]));
    }
  });

  const { data: upcomingDeadlines = [] } = useQuery<any[]>({
    queryKey: ["/api/calendar/events/upcoming"],
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/documents/recent"],
  });

  const { data: threads = [] } = useQuery<any[]>({
    queryKey: ["/api/chat/threads"],
  });

  const { data: caseFiles = [] } = useQuery<any[]>({
    queryKey: ["/api/cases/recent"],
  });

  const { data: searchHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/search/history"],
  });\`;

const newQuery = \`  const { data: dashboardData, isLoading: isLoadingDashboard } = useQuery<any>({
    queryKey: ["/api/dashboard-summary"],
    staleTime: 60000 // Cache for 1 min to prevent rapid re-fetching
  });

  const usage = dashboardData?.usage;
  const isLoadingUsage = isLoadingDashboard;
  const activitySummary = dashboardData?.activitySummary;
  const todayAgenda = dashboardData?.todayAgenda || [];
  const upcomingDeadlines = dashboardData?.upcomingDeadlines || [];
  const documents = dashboardData?.documents || [];
  const threads = dashboardData?.threads || [];
  const caseFiles = dashboardData?.caseFiles || [];
  const searchHistory = dashboardData?.searchHistory || [];\`;

content = content.replace(oldQueries, newQuery);
fs.writeFileSync(path, content, 'utf8');
