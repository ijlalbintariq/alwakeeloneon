import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'wouter';
import { PreviewShell } from '@/experimental/components/PreviewShell';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Search, Scale, Building2, Calendar, ChevronRight,
  Loader2, Gavel, ArrowUpDown, ChevronUp, ChevronLeft
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

export interface Judge {
  name: string;
  caseCount: number;
  courts: string[];
  earliestYear: number;
  latestYear: number;
}

export interface JudgeDetail extends Judge {
  recentCases: {
    id: string;
    citation: string;
    title: string;
    court: string;
    year: number;
  }[];
}

export interface DirectoryResponse {
  judges: Judge[];
  total: number;
  page: number;
  totalPages: number;
  courts: string[];
}

export function PreviewJudges() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [judges, setJudges] = useState<Judge[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [courtsList, setCourtsList] = useState<string[]>([]);
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [court, setCourt] = useState('all');
  const [sort, setSort] = useState('cases_desc');
  
  const [isLoading, setIsLoading] = useState(true);
  
  const [expandedJudge, setExpandedJudge] = useState<string | null>(null);
  const [judgeDetails, setJudgeDetails] = useState<Record<string, JudgeDetail>>({});
  const [isLoadingDetail, setIsLoadingDetail] = useState<Record<string, boolean>>({});

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset page on search
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const handleCourtChange = (val: string) => {
    setCourt(val);
    setPage(1);
  };
  
  const handleSortChange = (val: string) => {
    setSort(val);
    setPage(1);
  };

  const fetchDirectory = useCallback(async () => {
    setIsLoading(true);
    try {
      const courtParam = court === 'all' ? '' : court;
      const res = await fetch(`/api/judges/directory?page=${page}&limit=50&search=${encodeURIComponent(debouncedSearch)}&court=${encodeURIComponent(courtParam)}&sort=${sort}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch judges');
      const data: DirectoryResponse = await res.json();
      setJudges(data.judges);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      if (data.courts && data.courts.length > 0 && courtsList.length === 0) {
        setCourtsList(data.courts);
      }
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'Could not load judges directory',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, debouncedSearch, court, sort, courtsList.length, toast]);

  useEffect(() => {
    fetchDirectory();
  }, [fetchDirectory]);

  const toggleJudge = async (judgeName: string) => {
    if (expandedJudge === judgeName) {
      setExpandedJudge(null);
      return;
    }
    
    setExpandedJudge(judgeName);
    
    if (!judgeDetails[judgeName]) {
      setIsLoadingDetail(prev => ({ ...prev, [judgeName]: true }));
      try {
        const res = await fetch(`/api/judges/directory/${encodeURIComponent(judgeName)}`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch judge details');
        const data: JudgeDetail = await res.json();
        setJudgeDetails(prev => ({ ...prev, [judgeName]: data }));
      } catch (err) {
        console.error(err);
        toast({
          title: 'Error',
          description: 'Could not load details for ' + judgeName,
          variant: 'destructive'
        });
      } finally {
        setIsLoadingDetail(prev => ({ ...prev, [judgeName]: false }));
      }
    }
  };

  return (
    <PreviewShell>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8 space-y-4">
          <Badge className="bg-[#105B38] text-white hover:bg-[#105B38]/90">
            <Gavel className="w-3 h-3 mr-1" />
            Judges Directory
          </Badge>
          <h1 className="text-3xl md:text-4xl font-bold font-serif text-foreground">
            Pakistani Bench & Judiciary Directory
          </h1>
          <p className="text-base text-muted-foreground max-w-3xl">
            Browse {total > 0 ? total.toLocaleString() : '...'} judges across Supreme Court & High Courts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card">
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-[#105B38]/10 rounded-full">
                <Users className="w-6 h-6 text-[#105B38]" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Judges</p>
                <h3 className="text-xl font-bold">{total.toLocaleString()}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-emerald-500/10 rounded-full">
                <Scale className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Courts Covered</p>
                <h3 className="text-xl font-bold">{courtsList.length || '...'}</h3>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card">
            <CardContent className="p-6 flex items-center space-x-4">
              <div className="p-3 bg-slate-500/10 rounded-full">
                <Calendar className="w-6 h-6 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Historical Records</p>
                <h3 className="text-xl font-bold">1947 - Present</h3>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search judges by name..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={court} onValueChange={handleCourtChange}>
              <SelectTrigger className="w-full sm:w-[200px] !bg-white dark:!bg-zinc-950">
                <div className="flex items-center">
                  <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All Courts" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-zinc-950">
                <SelectItem value="all">All Courts</SelectItem>
                {courtsList.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={handleSortChange}>
              <SelectTrigger className="w-full sm:w-[200px] !bg-white dark:!bg-zinc-950">
                <div className="flex items-center">
                  <ArrowUpDown className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Sort By" />
                </div>
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-zinc-950">
                <SelectItem value="cases_desc">Most Cases</SelectItem>
                <SelectItem value="name_asc">Name A-Z</SelectItem>
                <SelectItem value="name_desc">Name Z-A</SelectItem>
                <SelectItem value="recent">Most Recent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="bg-card">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-1/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : judges.length === 0 ? (
          <div className="text-center py-24 bg-card rounded-lg border border-border">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No judges found</h3>
            <p className="text-muted-foreground">
              Try adjusting your search or filters to find what you're looking for.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {judges.map((judge) => {
                const isExpanded = expandedJudge === judge.name;
                const detail = judgeDetails[judge.name];
                const detailLoading = isLoadingDetail[judge.name];

                return (
                  <Card 
                    key={judge.name} 
                    className="bg-card overflow-hidden border-slate-200 dark:border-slate-800 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => toggleJudge(judge.name)}
                  >
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-bold font-serif text-foreground leading-tight pr-4">
                          {judge.name}
                        </h3>
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                          {judge.caseCount.toLocaleString()} cases
                        </Badge>
                      </div>

                      <div className="space-y-3 mb-4">
                        <div className="flex items-start text-sm text-muted-foreground">
                          <Building2 className="w-4 h-4 mr-2 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{judge.courts.join(', ')}</span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4 mr-2 shrink-0" />
                          <span>{judge.earliestYear} &mdash; {judge.latestYear}</span>
                        </div>
                      </div>

                      <div className="border-t border-border pt-4 mt-4 flex items-center justify-between text-sm text-[#105B38] font-medium">
                        <span>{isExpanded ? 'Hide Recent Cases' : 'View Recent Cases'}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-border" onClick={e => e.stopPropagation()}>
                          {detailLoading ? (
                            <div className="flex justify-center py-4">
                              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            </div>
                          ) : detail && detail.recentCases.length > 0 ? (
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold mb-2">Recent Judgments</h4>
                              {detail.recentCases.map(c => (
                                <div 
                                  key={c.id} 
                                  className="group p-3 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-border"
                                  onClick={() => setLocation(`/preview/judgments/${c.id}`)}
                                >
                                  <div className="flex justify-between items-start mb-1">
                                    <span className="font-semibold text-sm text-[#105B38] group-hover:underline">
                                      {c.citation}
                                    </span>
                                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                      {c.year}
                                    </span>
                                  </div>
                                  <p className="text-xs font-medium line-clamp-1 mb-1">{c.title}</p>
                                  <p className="text-xs text-muted-foreground truncate">{c.court}</p>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground italic">No recent cases found.</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2">
                <Button 
                  variant="outline" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <div className="text-sm font-medium text-muted-foreground">
                  Page {page} of {totalPages}
                </div>
                <Button 
                  variant="outline" 
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </PreviewShell>
  );
}

export default PreviewJudges;
