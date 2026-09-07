import re

with open('server/routes.ts', 'r') as f:
    content = f.read()

api_code = """
  // OPTIMIZED DASHBOARD API
  app.get("/api/dashboard-summary", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      const [
        usage,
        activity,
        agenda,
        documents,
        threads,
        cases,
        history
      ] = await Promise.all([
        db.query.usageRecords.findFirst({ where: eq(usageRecords.userId, userId) }),
        db.query.orgActivityLogs.findMany({ where: eq(orgActivityLogs.userId, userId), orderBy: [desc(orgActivityLogs.timestamp)], limit: 10 }),
        db.query.calendarEvents.findMany({ where: eq(calendarEvents.userId, userId), limit: 5 }),
        db.query.caseDocuments.findMany({ where: eq(caseDocuments.userId, userId), orderBy: [desc(caseDocuments.updatedAt)], limit: 5 }),
        db.query.chatThreads.findMany({ where: eq(chatThreads.userId, userId), orderBy: [desc(chatThreads.updatedAt)], limit: 5 }),
        db.query.caseFiles.findMany({ where: eq(caseFiles.userId, userId), orderBy: [desc(caseFiles.updatedAt)], limit: 5 }),
        db.query.searchHistory.findMany({ where: eq(searchHistory.userId, userId), orderBy: [desc(searchHistory.timestamp)], limit: 5 })
      ]);
      
      res.json({
        usage: usage || { 
            tier: "free", 
            aiQueriesUsed: 0, 
            monthlyAiLimit: 10, 
            documentsDrafted: 0, 
            monthlyDraftLimit: 1, 
            contractsDrafted: 0, 
            monthlyContractLimit: 1 
        },
        activitySummary: activity || [],
        todayAgenda: agenda || [],
        upcomingDeadlines: agenda || [],
        documents: documents || [],
        threads: threads || [],
        caseFiles: cases || [],
        searchHistory: history || []
      });
    } catch (error) {
      console.error("[Dashboard Summary Error]", error);
      res.status(500).json({ error: "Failed to load dashboard summary" });
    }
  });

"""

if 'dashboard-summary' not in content:
    content = content.replace('export function registerRoutes(app: Express, server: Server) {', 'export function registerRoutes(app: Express, server: Server) {\n' + api_code)
    with open('server/routes.ts', 'w') as f:
        f.write(content)
        print("Injected successfully")
else:
    print("Already exists")
