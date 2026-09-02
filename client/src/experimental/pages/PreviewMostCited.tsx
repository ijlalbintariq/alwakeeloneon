import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { PreviewShell } from '@/experimental/components/PreviewShell';
import { useToast } from '@/hooks/use-toast';
import { 
  Trophy, Award, TrendingUp, Hash, Building2, Calendar, 
  ChevronDown, ChevronRight, Loader2, Scale, Filter, 
  ExternalLink, BarChart3, SearchX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface CitedByExample {
  id: string;
  citation: string;
  title: string;
}

interface JudgmentRank {
  rank: number;
  id: string;
  citation: string;
  title: string;
  court: string;
  year: number;
  timesCited: number;
  citedByExamples: CitedByExample[];
}

interface Stats {
  totalLinks: number;
  totalJudgmentsCited: number;
  topCourt: string;
}

interface ApiResponse {
  results: JudgmentRank[];
  total: number;
  page: number;
  totalPages: number;
  courts: string[];
  stats: Stats;
}

export function PreviewMostCited() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Filters and Pagination
  const [page, setPage] = useState(1);
  const [court, setCourt] = useState<string>('');
  const [minYear, setMinYear] = useState<string>('');
  const [maxYear, setMaxYear] = useState<string>('');
  
  const [debouncedMinYear, setDebouncedMinYear] = useState<string>('');
  const [debouncedMaxYear, setDebouncedMaxYear] = useState<string>('');

  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  const limit = 20; // Number of items per page

  // Debounce year inputs
  useEffect(() => {
    const handler = setTimeout(() => {
      // Only reset page if the value actually changed after debounce
      if (debouncedMinYear !== minYear || debouncedMaxYear !== maxYear) {
        setDebouncedMinYear(minYear);
        setDebouncedMaxYear(maxYear);
        setPage(1);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [minYear, maxYear, debouncedMinYear, debouncedMaxYear]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(court && court !== 'all' ? { court } : {}),
        ...(debouncedMinYear ? { minYear: debouncedMinYear } : {}),
        ...(debouncedMaxYear ? { maxYear: debouncedMaxYear } : {})
      });
      
      const response = await fetch(`/api/judgments/most-cited?${queryParams.toString()}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch most cited judgments');
      }
      
      const result: ApiResponse = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error fetching most cited:', error);
      toast({
        title: 'Error',
        description: 'Failed to load leaderboard data. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [page, court, debouncedMinYear, debouncedMaxYear, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleResetFilters = () => {
    setCourt('');
    setMinYear('');
    setMaxYear('');
    setDebouncedMinYear('');
    setDebouncedMaxYear('');
    setPage(1);
  };

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const navigateToJudgment = (id: string) => {
    setLocation(`/preview/judgments/${id}`);
  };

  const renderRankBadge = (rank: number) => {
    if (rank === 1) return <div className="flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 font-bold text-xl border-2 border-yellow-200 dark:border-yellow-800 shadow-sm"><Trophy className="w-5 h-5 mr-1"/> 1</div>;
    if (rank === 2) return <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-bold text-xl border-2 border-gray-200 dark:border-gray-700 shadow-sm">2</div>;
    if (rank === 3) return <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-600 font-bold text-xl border-2 border-amber-200 dark:border-amber-800/30 shadow-sm">3</div>;
    
    return <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-medium text-lg border border-slate-200 dark:border-slate-800">#{rank}</div>;
  };

  return (
    <PreviewShell>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 pb-20">
        
        {/* Header */}
        <div className="space-y-4 text-center md:text-left">
          <Badge className="bg-[#105B38] hover:bg-[#105B38]/90 text-white border-transparent">
            <TrendingUp className="w-3 h-3 mr-1" /> Precedent Intelligence
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Most Cited Precedents
          </h1>
          <p className="text-base text-muted-foreground max-w-3xl">
            Ranked by citation frequency across {data?.stats.totalLinks ? data.stats.totalLinks.toLocaleString() : '616,506'} inter-judgment citation links.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Citation Links</CardTitle>
              <BarChart3 className="h-4 w-4 text-[#10B981]" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {loading && !data ? <Skeleton className="h-8 w-24" /> : data?.stats.totalLinks.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Unique Judgments</CardTitle>
              <Hash className="h-4 w-4 text-[#10B981]" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {loading && !data ? <Skeleton className="h-8 w-24" /> : data?.stats.totalJudgmentsCited.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top Court</CardTitle>
              <Scale className="h-4 w-4 text-[#10B981]" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold truncate">
                {loading && !data ? <Skeleton className="h-8 w-32" /> : data?.stats.topCourt || 'Supreme Court'}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white dark:bg-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Coverage</CardTitle>
              <Calendar className="h-4 w-4 text-[#10B981]" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">
                {loading && !data ? <Skeleton className="h-8 w-24" /> : '1947 - Present'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-slate-50/50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800">
          <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 w-full md:w-1/3">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Court
              </label>
              <Select value={court} onValueChange={(val) => { setCourt(val); setPage(1); }}>
                <SelectTrigger className="!bg-white dark:!bg-zinc-950">
                  <SelectValue placeholder="All Courts" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-950">
                  <SelectItem value="all">All Courts</SelectItem>
                  {data?.courts.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  {/* Fallback courts if API doesn't return list immediately */}
                  {!data?.courts?.length && (
                    <>
                      <SelectItem value="Supreme Court">Supreme Court</SelectItem>
                      <SelectItem value="Lahore High Court">Lahore High Court</SelectItem>
                      <SelectItem value="Sindh High Court">Sindh High Court</SelectItem>
                      <SelectItem value="Islamabad High Court">Islamabad High Court</SelectItem>
                      <SelectItem value="Peshawar High Court">Peshawar High Court</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2 w-full md:w-1/4">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" /> From Year
              </label>
              <Input 
                type="number" 
                placeholder="e.g. 1990" 
                value={minYear} 
                onChange={(e) => setMinYear(e.target.value)}
              />
            </div>
            
            <div className="space-y-2 w-full md:w-1/4">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" /> To Year
              </label>
              <Input 
                type="number" 
                placeholder="e.g. 2023" 
                value={maxYear} 
                onChange={(e) => setMaxYear(e.target.value)}
              />
            </div>

            <Button 
              variant="outline" 
              className="w-full md:w-auto" 
              onClick={handleResetFilters}
              disabled={!court && !minYear && !maxYear}
            >
              <Filter className="w-4 h-4 mr-2" /> Reset
            </Button>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <div className="space-y-4">
          {loading && !data ? (
            // Skeleton state
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 flex items-start gap-4">
                  <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
                  <div className="space-y-3 w-full">
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-5 w-3/4" />
                    <div className="flex gap-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                  <Skeleton className="w-20 h-8 rounded-full" />
                </CardContent>
              </Card>
            ))
          ) : data?.results.length === 0 ? (
            // Empty state
            <div className="text-center py-12 border-2 border-dashed rounded-lg border-slate-200 dark:border-slate-800">
              <SearchX className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium">No results found</h3>
              <p className="text-muted-foreground mt-1">Try adjusting your filters to find more precedents.</p>
              <Button variant="outline" className="mt-4" onClick={handleResetFilters}>
                Clear Filters
              </Button>
            </div>
          ) : (
            // Results
            data?.results.map((item) => (
              <Card key={item.id} className="overflow-hidden border-slate-200 dark:border-slate-800 transition-all hover:border-[#10B981]/50 hover:shadow-md dark:bg-card">
                <div className="p-4 md:p-6 flex flex-col md:flex-row gap-4 md:gap-6 md:items-center relative">
                  {/* Rank */}
                  <div className="flex-shrink-0 absolute md:static top-4 right-4 md:top-auto md:right-auto">
                    {renderRankBadge(item.rank)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-grow space-y-2 pt-8 md:pt-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#105B38] dark:text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded text-sm md:text-base">
                        {item.citation}
                      </span>
                      {item.year && (
                        <Badge variant="outline" className="text-xs text-muted-foreground border-slate-200 dark:border-slate-800">
                          {item.year}
                        </Badge>
                      )}
                    </div>
                    
                    <h3 
                      className="font-medium text-lg text-foreground hover:text-[#105B38] dark:hover:text-[#10B981] cursor-pointer transition-colors line-clamp-2"
                      onClick={() => navigateToJudgment(item.id)}
                    >
                      {item.title}
                    </h3>
                    
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5" />
                        {item.court}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions / Stats */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-4 flex-shrink-0 mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col items-start md:items-end">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Times Cited</span>
                      <Badge className="bg-[#10B981]/10 text-[#10B981] hover:bg-[#10B981]/20 border border-[#10B981]/20 text-lg px-3 py-1 font-bold">
                        {item.timesCited.toLocaleString()}
                      </Badge>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[#105B38] dark:text-[#10B981] hover:bg-[#10B981]/10"
                      onClick={() => navigateToJudgment(item.id)}
                    >
                      Read Case <ExternalLink className="w-4 h-4 ml-1.5" />
                    </Button>
                  </div>
                </div>

                {/* Collapsible Cited By Examples */}
                {item.citedByExamples && item.citedByExamples.length > 0 && (
                  <Collapsible
                    open={expandedItems[item.id]}
                    onOpenChange={() => toggleExpand(item.id)}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full rounded-none h-10 text-xs text-muted-foreground hover:text-foreground flex justify-between px-6 bg-slate-50/50 dark:bg-slate-900/30">
                        <span>See where this was cited ({item.citedByExamples.length} examples)</span>
                        {expandedItems[item.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="bg-slate-50 dark:bg-slate-900/50 p-4 px-6 space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Cited By</h4>
                      <ul className="space-y-2">
                        {item.citedByExamples.map(example => (
                          <li key={example.id} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-sm border-b border-slate-200 dark:border-slate-800 pb-2 last:border-0 last:pb-0">
                            <span 
                              className="font-mono text-[#10B981] hover:underline cursor-pointer flex-shrink-0"
                              onClick={() => navigateToJudgment(example.id)}
                            >
                              {example.citation}
                            </span>
                            <span className="text-muted-foreground truncate" title={example.title}>
                              {example.title}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8">
            <Button
              variant="outline"
              disabled={page === 1 || loading}
              onClick={() => {
                setPage(p => p - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Previous
            </Button>
            <div className="text-sm font-medium text-muted-foreground px-4">
              Page {page} of {data.totalPages}
            </div>
            <Button
              variant="outline"
              disabled={page === data.totalPages || loading}
              onClick={() => {
                setPage(p => p + 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </PreviewShell>
  );
}

export default PreviewMostCited;
