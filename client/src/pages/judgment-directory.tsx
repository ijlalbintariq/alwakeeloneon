import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  Gavel, 
  BookOpen, 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  ArrowLeft,
  Sparkles
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface Court {
  id: number;
  code: string;
  name: string;
  level: string;
}

interface Journal {
  id: number;
  code: string;
  name: string;
}

interface DirectoryIndex {
  courts: Court[];
  journals: Journal[];
  years: number[];
}

interface JudgmentItem {
  id: string;
  year: number;
  page: number;
  citation: string;
  title: string;
  decisionDate: string | null;
  courtName: string | null;
  courtSnapshot: string | null;
  journalCode: string;
}

interface ListResponse {
  items: JudgmentItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export default function JudgmentDirectoryPage() {
  const [location] = useLocation();
  
  // Parse query parameters for server-side-crawling friendly states
  const params = new URLSearchParams(window.location.search);
  const courtId = params.get("courtId") ? Number(params.get("courtId")) : undefined;
  const journalId = params.get("journalId") ? Number(params.get("journalId")) : undefined;
  const year = params.get("year") ? Number(params.get("year")) : undefined;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const limit = 50;

  // 1. Fetch directory index (Courts, Journals, Years)
  const { data: indexData, isLoading: isIndexLoading } = useQuery<DirectoryIndex>({
    queryKey: ["/api/public/browse/index"],
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
  });

  // 2. Fetch paginated judgments list if any filter is active
  const hasFilters = courtId !== undefined || journalId !== undefined || year !== undefined;
  const listQueryString = new URLSearchParams();
  if (courtId !== undefined) listQueryString.set("courtId", String(courtId));
  if (journalId !== undefined) listQueryString.set("journalId", String(journalId));
  if (year !== undefined) listQueryString.set("year", String(year));
  listQueryString.set("page", String(page));
  listQueryString.set("limit", String(limit));

  const { data: listData, isLoading: isListLoading } = useQuery<ListResponse>({
    queryKey: ["/api/public/browse/list", listQueryString.toString()],
    enabled: true, // Always load or fallback to all judgments for broad crawling
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getActiveFilterLabel = () => {
    if (!indexData) return "";
    if (courtId !== undefined) {
      const court = indexData.courts.find(c => c.id === courtId);
      return court ? court.name : `Court #${courtId}`;
    }
    if (journalId !== undefined) {
      const journal = indexData.journals.find(j => j.id === journalId);
      return journal ? `${journal.name} (${journal.code})` : `Journal #${journalId}`;
    }
    if (year !== undefined) {
      return `Year: ${year}`;
    }
    return "All Judgments";
  };

  const formatDecisionDate = (value: string | null): string => {
    if (!value) return "Date not available";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date not available";
    return date.toLocaleDateString("en-PK", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const buildBrowseLink = (filters: { courtId?: number; journalId?: number; year?: number; page?: number }) => {
    const nextParams = new URLSearchParams();
    if (filters.courtId !== undefined) nextParams.set("courtId", String(filters.courtId));
    else if (courtId !== undefined && filters.journalId === undefined && filters.year === undefined) {
      nextParams.set("courtId", String(courtId));
    }

    if (filters.journalId !== undefined) nextParams.set("journalId", String(filters.journalId));
    else if (journalId !== undefined && filters.courtId === undefined && filters.year === undefined) {
      nextParams.set("journalId", String(journalId));
    }

    if (filters.year !== undefined) nextParams.set("year", String(filters.year));
    else if (year !== undefined && filters.courtId === undefined && filters.journalId === undefined) {
      nextParams.set("year", String(year));
    }

    if (filters.page !== undefined) nextParams.set("page", String(filters.page));
    
    const query = nextParams.toString();
    return `/judgments/browse${query ? `?${query}` : ""}`;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Dynamic SEO Head Title & Meta elements handled server-side. */}
      
      {/* Premium Dark-Gold Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border border-amber-500/20 p-8 md:p-12 shadow-2xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/5 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-600/5 blur-3xl" />
        
        <div className="relative max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
            <Sparkles className="h-3 w-3" />
            <span>Case Law Index</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200 bg-clip-text text-transparent" style={{ fontFamily: "'Playfair Display', serif" }}>
            Pakistani Judgments Directory
          </h1>
          
          <p className="text-neutral-400 text-base md:text-lg max-w-2xl leading-relaxed">
            Browse our complete and organized database of judgments and precedents. Categorized dynamically by court jurisdiction, law journal publishing, and year of decision to enable discovery of case precedents.
          </p>
        </div>
      </div>

      {/* Main Browse Directories or Filtered Listings */}
      {!hasFilters ? (
        <div className="space-y-8">
          {isIndexLoading ? (
            <div className="space-y-8">
              <Skeleton className="h-[200px] w-full rounded-2xl" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton className="h-[300px] rounded-xl" />
                <Skeleton className="h-[300px] rounded-xl" />
                <Skeleton className="h-[300px] rounded-xl" />
              </div>
            </div>
          ) : (
            <Tabs defaultValue="courts" className="w-full space-y-6">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <TabsList className="bg-neutral-900 border border-neutral-800">
                  <TabsTrigger value="courts" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
                    <Gavel className="h-4 w-4 mr-2" />
                    Courts
                  </TabsTrigger>
                  <TabsTrigger value="journals" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Law Journals
                  </TabsTrigger>
                  <TabsTrigger value="years" className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-400">
                    <CalendarDays className="h-4 w-4 mr-2" />
                    Decisional Years
                  </TabsTrigger>
                </TabsList>
                <div className="text-xs text-neutral-500 hidden sm:block">
                  Select a category to start browsing
                </div>
              </div>

              {/* Courts Browse View */}
              <TabsContent value="courts" className="mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {indexData?.courts.map((court) => (
                    <Link key={court.id} href={buildBrowseLink({ courtId: court.id })}>
                      <a className="group block focus:outline-none">
                        <Card className="h-full bg-neutral-950/40 border-neutral-800 hover:border-amber-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/5 group-hover:-translate-y-1">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 group-hover:border-amber-500/30 transition-colors">
                                <Gavel className="h-5 w-5 text-amber-500/80 group-hover:text-amber-400" />
                              </div>
                              <Badge variant="outline" className="border-neutral-800 text-neutral-400 uppercase text-[10px]">
                                {court.level}
                              </Badge>
                            </div>
                            <CardTitle className="text-lg font-bold text-neutral-200 group-hover:text-amber-400 transition-colors pt-2 leading-snug">
                              {court.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <span className="text-xs font-semibold text-amber-500/80 inline-flex items-center gap-1 group-hover:text-amber-400">
                              Browse judgements
                              <ChevronRight className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" />
                            </span>
                          </CardContent>
                        </Card>
                      </a>
                    </Link>
                  ))}
                </div>
              </TabsContent>

              {/* Journals Browse View */}
              <TabsContent value="journals" className="mt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {indexData?.journals.map((journal) => (
                    <Link key={journal.id} href={buildBrowseLink({ journalId: journal.id })}>
                      <a className="group block focus:outline-none">
                        <Card className="h-full bg-neutral-950/40 border-neutral-800 hover:border-amber-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/5 group-hover:-translate-y-1">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 group-hover:border-amber-500/30 transition-colors">
                                <BookOpen className="h-5 w-5 text-amber-500/80 group-hover:text-amber-400" />
                              </div>
                              <Badge variant="outline" className="border-neutral-800 text-amber-400 font-mono text-[10px]">
                                {journal.code}
                              </Badge>
                            </div>
                            <CardTitle className="text-lg font-bold text-neutral-200 group-hover:text-amber-400 transition-colors pt-2 leading-snug">
                              {journal.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <span className="text-xs font-semibold text-amber-500/80 inline-flex items-center gap-1 group-hover:text-amber-400">
                              Browse judgements
                              <ChevronRight className="h-3 w-3 transform group-hover:translate-x-1 transition-transform" />
                            </span>
                          </CardContent>
                        </Card>
                      </a>
                    </Link>
                  ))}
                </div>
              </TabsContent>

              {/* Decisional Years Browse View */}
              <TabsContent value="years" className="mt-0">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                  {indexData?.years.map((y) => (
                    <Link key={y} href={buildBrowseLink({ year: y })}>
                      <a className="group block text-center focus:outline-none">
                        <div className="rounded-xl border border-neutral-850 bg-neutral-950/40 py-4 hover:border-amber-500/40 hover:bg-neutral-900/50 hover:shadow-md hover:shadow-amber-500/5 transition-all duration-200 group-hover:-translate-y-1">
                          <CalendarDays className="h-4 w-4 text-amber-500/60 group-hover:text-amber-400 mx-auto mb-1 transition-colors" />
                          <span className="text-base font-bold text-neutral-300 group-hover:text-amber-400 transition-colors">
                            {y}
                          </span>
                        </div>
                      </a>
                    </Link>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Breadcrumb / Back Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/judgments/browse">
              <a className="inline-flex items-center text-sm font-semibold text-neutral-450 hover:text-amber-400 transition-colors gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Directory Directory
              </a>
            </Link>
            <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/5 px-3 py-1 font-medium">
              {getActiveFilterLabel()}
            </Badge>
          </div>

          {/* Judgment List view */}
          <div className="space-y-4">
            {isListLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, idx) => (
                  <Skeleton key={idx} className="h-[120px] w-full rounded-xl" />
                ))}
              </div>
            ) : listData && listData.items.length > 0 ? (
              <>
                <div className="grid grid-cols-1 gap-4">
                  {listData.items.map((item) => (
                    <Link key={item.id} href={`/judgment/${item.id}`}>
                      <a className="group block focus:outline-none">
                        <Card className="bg-neutral-950/40 border-neutral-800 hover:border-amber-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/5">
                          <CardHeader className="pb-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-450 font-medium">
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-amber-500/80" />
                                <span className="font-mono text-amber-400/90 font-bold bg-amber-500/5 border border-amber-500/10 rounded px-1.5 py-0.5">
                                  {item.citation}
                                </span>
                              </div>
                              <span className="text-neutral-500">
                                {formatDecisionDate(item.decisionDate)}
                              </span>
                            </div>
                            <CardTitle className="text-base font-bold text-neutral-200 group-hover:text-amber-400 transition-colors pt-2 leading-snug">
                              {item.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 pb-4 text-xs text-neutral-450 flex items-center justify-between">
                            <span className="truncate max-w-[80%] text-neutral-400">
                              {item.courtName || item.courtSnapshot || "Supreme Court of Pakistan"}
                            </span>
                            <span className="text-amber-500/80 font-semibold group-hover:text-amber-400 flex items-center gap-0.5">
                              View case
                              <ChevronRight className="h-3 w-3 transform group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          </CardContent>
                        </Card>
                      </a>
                    </Link>
                  ))}
                </div>

                {/* Crawl-friendly Standard Link Pagination */}
                {listData.pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-neutral-850 pt-6">
                    <div className="text-xs text-neutral-500">
                      Showing page {listData.pagination.page} of {listData.pagination.totalPages} ({listData.pagination.total} cases)
                    </div>
                    <div className="flex items-center gap-2">
                      {listData.pagination.page > 1 ? (
                        <Link href={buildBrowseLink({ page: listData.pagination.page - 1 })}>
                          <a className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 text-sm font-medium text-neutral-350 hover:border-amber-500/30 hover:text-amber-400 transition-all">
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </a>
                        </Link>
                      ) : (
                        <button disabled className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-900 bg-neutral-950/20 px-3 text-sm font-medium text-neutral-600 dark:text-neutral-400 cursor-not-allowed">
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </button>
                      )}

                      {/* Display small window of pages */}
                      {(() => {
                        const current = listData.pagination.page;
                        const total = listData.pagination.totalPages;
                        const pages = [];
                        const start = Math.max(1, current - 2);
                        const end = Math.min(total, current + 2);
                        for (let p = start; p <= end; p++) {
                          pages.push(p);
                        }
                        return pages.map(p => (
                          <Link key={p} href={buildBrowseLink({ page: p })}>
                            <a className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-semibold border transition-all ${
                              p === current 
                                ? "bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-sm shadow-amber-500/5" 
                                : "border-neutral-800 bg-neutral-950/40 text-neutral-400 hover:border-amber-500/20 hover:text-amber-400"
                            }`}>
                              {p}
                            </a>
                          </Link>
                        ));
                      })()}

                      {listData.pagination.hasMore ? (
                        <Link href={buildBrowseLink({ page: listData.pagination.page + 1 })}>
                          <a className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 text-sm font-medium text-neutral-350 hover:border-amber-500/30 hover:text-amber-400 transition-all">
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </a>
                        </Link>
                      ) : (
                        <button disabled className="inline-flex h-9 items-center justify-center rounded-lg border border-neutral-900 bg-neutral-950/20 px-3 text-sm font-medium text-neutral-600 dark:text-neutral-400 cursor-not-allowed">
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Card className="bg-neutral-950/40 border-neutral-800 text-center py-12">
                <CardContent className="space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
                    <FileText className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-lg font-bold text-neutral-300">No Judgments Found</CardTitle>
                  <CardDescription className="text-neutral-500 max-w-sm mx-auto">
                    We couldn't find any judgments under this category in our directory. New cases are being ingested daily.
                  </CardDescription>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
