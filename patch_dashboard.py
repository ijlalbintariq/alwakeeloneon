import re

with open('client/src/experimental/pages/PreviewDashboard.tsx', 'r') as f:
    content = f.read()

# The block to replace:
start_str = 'const { data: usage, isLoading: isLoadingUsage } = useQuery<UsageData>({'
end_str = 'const { data: searchHistory = [] } = useQuery<any[]>({'

if start_str in content and end_str in content:
    start_idx = content.find(start_str)
    end_idx = content.find('});', content.find(end_str)) + 3
    
    replacement = """
  const { data: dashboardData, isLoading: isLoadingDashboard } = useQuery<any>({
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
  const searchHistory = dashboardData?.searchHistory || [];
"""
    
    new_content = content[:start_idx] + replacement.strip() + content[end_idx:]
    with open('client/src/experimental/pages/PreviewDashboard.tsx', 'w') as f:
        f.write(new_content)
    print("Dashboard refactored successfully")
else:
    print("Could not find the block to replace")
