import React, { useState, useEffect } from 'react';
import { useLocation, useParams } from 'wouter';
import { PreviewShell } from '@/experimental/components/PreviewShell';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Building2, Calendar, Loader2, ArrowLeft, ChevronLeft, ChevronRight, Gavel, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface JudgeCase {
  id: string;
  citation: string;
  title: string;
  court: string;
  year: number;
  summary: string | null;
}

interface JudgeCasesResponse {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  cases: JudgeCase[];
}

interface JudgeProfile {
  name: string;
  caseCount: number;
  courts: string[];
  earliestYear: number;
  latestYear: number;
}

const PreviewJudgeProfile = () => {
  const [, setLocation] = useLocation();
  const { name } = useParams<{ name: string }>();
  const decodedName = decodeURIComponent(name || '');
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<JudgeProfile | null>(null);
  const [casesData, setCasesData] = useState<JudgeCasesResponse | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingCases, setIsLoadingCases] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!decodedName) return;
    
    const fetchProfile = async () => {
      try {
        const res = await fetch(`/api/judges/directory/${encodeURIComponent(decodedName)}`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch judge profile');
        const data = await res.json();
        setProfile(data);
      } catch (err) {
        console.error(err);
        toast({
          title: 'Error',
          description: 'Failed to load judge profile',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingProfile(false);
      }
    };
    
    fetchProfile();
  }, [decodedName, toast]);

  useEffect(() => {
    if (!decodedName) return;
    
    const fetchCases = async () => {
      setIsLoadingCases(true);
      try {
        const res = await fetch(`/api/judges/directory/${encodeURIComponent(decodedName)}/cases?page=${page}&limit=${limit}&search=${encodeURIComponent(debouncedSearch)}`, {
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Failed to fetch judge cases');
        const data = await res.json();
        setCasesData(data);
      } catch (err) {
        console.error(err);
        toast({
          title: 'Error',
          description: 'Failed to load cases',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingCases(false);
      }
    };
    
    fetchCases();
  }, [decodedName, page, debouncedSearch, toast]);

  return (
    <PreviewShell>
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-500">
        <Button 
          variant="ghost" 
          className="mb-6 -ml-4 text-muted-foreground hover:text-foreground"
          onClick={() => setLocation('/preview/judges')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Judges Directory
        </Button>

        {isLoadingProfile ? (
          <div className="bg-card rounded-lg border border-border p-8 mb-8 shadow-sm">
            <Skeleton className="h-10 w-1/3 mb-4" />
            <Skeleton className="h-6 w-1/4 mb-4" />
            <div className="flex gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        ) : profile ? (
          <div className="bg-card rounded-lg border border-border p-8 mb-8 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
              <div className="flex items-center gap-4 mb-4 md:mb-0">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 border-2 border-emerald-500/20">
                  <Gavel className="w-8 h-8 text-emerald-700 dark:text-emerald-400" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold font-serif text-foreground tracking-tight">
                    {profile.name}
                  </h1>
                  <p className="text-muted-foreground flex items-center mt-1">
                    <Building2 className="w-4 h-4 mr-1" />
                    {profile.courts.join(', ')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-border">
                <div className="text-center px-4 border-r border-border">
                  <p className="text-2xl font-bold text-[#105B38]">{profile.caseCount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Judgments</p>
                </div>
                <div className="text-center px-4">
                  <p className="text-lg font-semibold flex justify-center items-center gap-1">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    {profile.earliestYear} &mdash; {profile.latestYear}
                  </p>
                  <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">Active Period</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-lg border border-border p-8 mb-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Judge Not Found</h2>
            <p className="text-muted-foreground">The judge profile you are looking for does not exist.</p>
          </div>
        )}

                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Gavel className="w-5 h-5 text-emerald-600" />
            All Judgments
            {casesData && (
              <Badge variant="outline" className="bg-white dark:bg-zinc-950 font-normal ml-2">
                Showing {casesData.total === 0 ? 0 : ((page - 1) * limit) + 1}-{Math.min(page * limit, casesData.total)} of {casesData.total.toLocaleString()}
              </Badge>
            )}
          </h2>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search judgments..." 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1); // Reset page on new search
              }}
              className="pl-9 bg-white dark:bg-zinc-950"
            />
          </div>
        </div>

        {isLoadingCases ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="bg-card">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-1/4 mb-3" />
                  <Skeleton className="h-5 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : casesData?.cases.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">No judgments found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {casesData?.cases.map((c) => (
              <Card 
                key={c.id} 
                className="bg-card hover:shadow-md transition-shadow cursor-pointer border-slate-200 dark:border-slate-800"
                onClick={() => setLocation(`/preview/judgments/${c.id}`)}
              >
                <CardContent className="p-5 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                    <Badge className="bg-[#105B38] text-white hover:bg-[#105B38]/90 text-sm py-1 font-semibold rounded-md shadow-sm">
                      {c.citation}
                    </Badge>
                    <div className="flex items-center text-sm font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                      <Calendar className="w-3.5 h-3.5 mr-1.5" />
                      {c.year}
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold leading-snug group-hover:text-[#105B38] transition-colors line-clamp-2">
                    {c.title}
                  </h3>
                  
                  {c.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                      {c.summary}
                    </p>
                  )}
                  
                  <div className="mt-1 flex items-center text-sm text-slate-500 font-medium">
                    <Building2 className="w-4 h-4 mr-1.5 text-slate-400" />
                    {c.court}
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Pagination */}
            {casesData && casesData.totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-8 pt-6 border-t border-border">
                <Button 
                  variant="outline" 
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="bg-white dark:bg-zinc-950"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
                <div className="text-sm font-medium text-muted-foreground min-w-[100px] text-center">
                  Page {page} of {casesData.totalPages}
                </div>
                <Button 
                  variant="outline" 
                  disabled={page === casesData.totalPages}
                  onClick={() => setPage(p => Math.min(casesData.totalPages, p + 1))}
                  className="bg-white dark:bg-zinc-950"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </PreviewShell>
  );
};

export default PreviewJudgeProfile;
