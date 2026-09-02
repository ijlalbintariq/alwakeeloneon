import React, { useState, useEffect, useMemo } from "react";
import { useLocation, useRoute } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, Search, Scale, ChevronRight, FileText, Share2, Printer, Sparkles, Building2, Calendar, User } from 'lucide-react';

interface PublicJudgmentData {
  id: string;
  citation: string;
  title: string;
  petitioner: string | null;
  respondent: string | null;
  court: string | null;
  decisionDate: string | null;
  headnotes: string | null;
  previewText: string;
  previewWordCount: number;
  totalWordCount: number;
  isPreview: boolean;
  isTruncated: boolean;
  citations: { made: any[], received: any[] };
}

export default function PreviewPublicJudgment() {
  const [match, params] = useRoute('/preview/p/:id');
  const [data, setData] = useState<PublicJudgmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!match || !params?.id) return;

    const fetchJudgment = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/public/judgments/${encodeURIComponent(params.id)}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Judgment not found");
          if (res.status === 429) throw new Error("Too many requests. Please try again later.");
          throw new Error("Failed to load judgment");
        }
        const json = await res.json();
        setData(json);
        
        // Inject SEO Metadata
        document.title = `${json.citation} | ${json.title} - AL WAKEELO Law Library`;
      } catch (err: any) {
        console.error("Public judgment fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchJudgment();
    
    // Cleanup title on unmount
    return () => {
      document.title = 'AL WAKEELO AI Legal Platform';
    };
  }, [match, params?.id]);

  
  const formattedParagraphs = useMemo(() => {
    if (!data?.previewText) return [];
    let t = data.previewText.replace(/\r\n/g, "\n");
    t = t.replace(/\n\n+/g, "\n__PARAGRAPH__\n");
    
    const lines = t.split("\n");
    let result = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === "__PARAGRAPH__") {
        result += "\n\n";
        continue;
      }
      result += line;
      
      const nextLine = lines[i+1] || "";
      const isNextLineNewParagraph = /^\s*(\d+\.|[A-Z]\.|[ivx]+\.)\s/.test(nextLine) || /^\s*(JUDGMENT|ORDER|BACKGROUND|FACTS|HELD|DECISION|COURT|CASE DETAILS)\b/.test(nextLine) || nextLine === "__PARAGRAPH__";
      
      const isNextLineHeader = /^(Date of hearing|Appellant|Complainant|State|Respondent|Petitioner)/i.test(nextLine);
      const isCurrentLineHeader = /^(Date of hearing|Appellant|Complainant|State|Respondent|Petitioner|Criminal Appeal|Murder Reference|Civil Appeal|Writ Petition)/i.test(line.trim());

      if (line.trim().length > 33 && !isNextLineNewParagraph && !isNextLineHeader && !isCurrentLineHeader) {
        result += " ";
      } else {
        result += "\n";
      }
    }
    return result.split("\n").map(p => p.trim()).filter(Boolean);
  }, [data?.previewText]);

  const handleSignup = () => {
    setLocation('/preview/register?mode=register');
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => setLocation("/preview")}>
            <img src="/logo.svg" alt="Al Wakeelo" className="w-8 h-8 object-contain mr-3" />
            <span className="font-bold font-serif text-xl text-slate-900 tracking-tight">AL WAKEELO</span>
          </div>
          <Button onClick={() => setLocation("/preview/login")} variant="outline" className="border-slate-300 text-slate-700">
            Sign In
          </Button>
        </div>
      </header>
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Record Not Found</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <Button onClick={() => setLocation('/preview')} className="bg-[#105B38] hover:bg-[#0D4B2E]">
              Return to Homepage
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans selection:bg-[#105B38]/20">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center cursor-pointer" onClick={() => setLocation("/preview")}>
            <div className="w-8 h-8 rounded-lg bg-[#105B38] flex items-center justify-center mr-3">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold font-serif text-xl text-slate-900 tracking-tight">AL WAKEELO</span>
          </div>
          <Button onClick={() => setLocation("/preview/login")} variant="outline" className="border-slate-300 text-slate-700">
            Sign In
          </Button>
        </div>
      </header>
      
      {/* Search Header Bar (SEO pattern) */}
      <div className="bg-white border-b border-slate-200 py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center text-xs text-slate-500 font-medium">
            <span className="hover:text-[#105B38] cursor-pointer" onClick={() => setLocation('/preview')}>Library</span>
            <ChevronRight className="w-3 h-3 mx-1" />
            <span>Pakistan</span>
            <ChevronRight className="w-3 h-3 mx-1" />
            {loading ? <Skeleton className="w-20 h-4" /> : <span>{data?.court || 'Appellate Courts'}</span>}
            <ChevronRight className="w-3 h-3 mx-1" />
            {loading ? <Skeleton className="w-16 h-4" /> : <span className="text-slate-900">{data?.citation}</span>}
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        {/* Main Content Area */}
        <div className="flex-1 min-w-0">
          
          {/* Document Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-[#105B38]/10 text-[#105B38] hover:bg-[#105B38]/20 border-0 rounded-md font-mono">
                {loading ? <Skeleton className="w-24 h-4 bg-[#105B38]/20" /> : data?.citation}
              </Badge>
              <Badge variant="outline" className="text-slate-600 border-slate-200">
                Public Record
              </Badge>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold font-serif text-slate-900 mb-6 leading-tight">
              {loading ? (
                <div className="space-y-3">
                  <Skeleton className="w-full h-10" />
                  <Skeleton className="w-3/4 h-10" />
                </div>
              ) : (
                data?.title
              )}
            </h1>

            <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600 border-t border-b border-slate-200 py-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-400" />
                {loading ? <Skeleton className="w-32 h-4" /> : <span className="font-medium">{data?.court}</span>}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                {loading ? <Skeleton className="w-24 h-4" /> : <span>{data?.decisionDate ? new Date(data.decisionDate).toLocaleDateString('en-PK', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Date not recorded'}</span>}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 hover:text-[#105B38]" onClick={() => {
                  const url = window.location.href;
                  const title = data?.citation ? `${data.citation} - ${data.title}` : document.title;
                  if (navigator.share) {
                    navigator.share({ title, url }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(url).then(() => {
                      toast({ title: "Link copied", description: "Judgment URL copied to clipboard" });
                    });
                  }
                }}>
                  <Share2 className="w-4 h-4 mr-1.5" /> Share
                </Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 hover:text-[#105B38]" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-1.5" /> Print
                </Button>
              </div>
            </div>
          </div>

          {/* Judgment Body */}
          <Card className="bg-white shadow-sm border-slate-200 rounded-xl overflow-hidden relative">
            <CardContent className="p-8 md:p-12">
              
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-full h-4" />
                  <Skeleton className="w-5/6 h-4" />
                  <Skeleton className="w-full h-4 mt-8" />
                  <Skeleton className="w-4/5 h-4" />
                </div>
              ) : (
                <>
                  {/* Parties */}
                  {(data?.petitioner || data?.respondent) && (
                    <div className="mb-8 p-6 bg-slate-50 rounded-lg border border-slate-100 text-center font-serif text-lg">
                      <div className="font-semibold text-slate-900">{data?.petitioner || 'UNKNOWN PETITIONER'}</div>
                      <div className="my-3 text-sm text-slate-400 italic font-sans">— VERSUS —</div>
                      <div className="font-semibold text-slate-900">{data?.respondent || 'UNKNOWN RESPONDENT'}</div>
                    </div>
                  )}

                  {/* Headnotes */}
                  {data?.headnotes && (
                    <div className="mb-8">
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" /> Headnotes
                      </h4>
                      <div className="text-slate-700 leading-relaxed text-sm p-5 bg-[#FBFBFA] border-l-4 border-[#105B38] whitespace-pre-wrap rounded-r-lg">
                        {data.headnotes}
                      </div>
                    </div>
                  )}

                  {/* Body Text */}
                  <div className="prose prose-slate max-w-none font-serif text-lg leading-loose text-slate-800">
                    {formattedParagraphs.map((p, idx) => (
                      <p key={idx} className="mb-6">{p}</p>
                    ))}
                  </div>
                </>
              )}
            </CardContent>

            {/* Paywall / Authwall Overlay if truncated */}
            {data?.isTruncated && !loading && (
              <div className="absolute bottom-0 left-0 right-0 h-[400px] flex flex-col justify-end p-8 md:p-12 bg-gradient-to-t from-white via-white to-transparent">
                <div className="bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl p-8 shadow-xl max-w-2xl mx-auto text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#105B38] to-emerald-400"></div>
                  
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-200 shadow-sm">
                    <Lock className="w-7 h-7 text-[#105B38]" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">Keep reading this judgment</h3>
                  <p className="text-slate-600 mb-6 max-w-md mx-auto leading-relaxed">
                    You've reached the end of the free preview ({data.previewWordCount.toLocaleString()} of {data.totalWordCount.toLocaleString()} words). 
                    Create a free account to unlock the full text, AI summaries, and citation network.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button 
                      onClick={handleSignup} 
                      className="bg-[#105B38] hover:bg-[#0D4B2E] text-white px-8 h-12 text-base font-semibold rounded-lg shadow-sm"
                    >
                      Create Free Account
                    </Button>
                    <Button 
                      onClick={() => setLocation('/preview/login')} 
                      variant="outline" 
                      className="px-8 h-12 text-base font-semibold rounded-lg border-slate-300 text-slate-700 hover:bg-slate-50"
                    >
                      Sign In
                    </Button>
                  </div>
                  <p className="text-xs text-slate-400 mt-6">
                    Join 15,000+ legal professionals on AL WAKEELO.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-6">
          <Card className="border shadow-lg overflow-hidden relative" style={{ backgroundColor: "#f0fdf4", borderColor: "#105B38", color: "#111827" }}>
            <div className="absolute top-0 right-0 p-4" style={{ opacity: 0.06 }}>
              <Sparkles className="w-24 h-24" />
            </div>
            <CardContent className="p-6 relative z-10">
              <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-md mb-4" style={{ backgroundColor: "#105B38", color: "#ffffff" }}>AL WAKEELO AI</span>
              <h3 className="text-xl font-bold font-serif mb-2" style={{ color: "#111827" }}>Analyze this Case</h3>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "#374151" }}>
                Unlock our Style-Memory AI to extract the Ratio Decidendi, identify precedents, or draft an appeal instantly based on this judgment.
              </p>
              <Button onClick={handleSignup} className="w-full font-bold" style={{ backgroundColor: "#105B38", color: "#ffffff" }}>
                Unlock AI Features
              </Button>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 shadow-sm bg-white">
            <CardContent className="p-5">
              <h4 className="font-semibold text-slate-900 mb-4 flex items-center">
                <FileText className="w-4 h-4 mr-2 text-slate-400" />
                Case Meta
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">Citation</span>
                  <span className="font-medium text-slate-900">{loading ? <Skeleton className="w-16 h-4" /> : data?.citation}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">Word Count</span>
                  <span className="font-medium text-slate-900">{loading ? <Skeleton className="w-12 h-4" /> : data?.totalWordCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-slate-500">Citations Made</span>
                  <span className="font-medium text-slate-900">{loading ? <Skeleton className="w-8 h-4" /> : (data?.citations?.made?.length || 0)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Cited By</span>
                  <span className="font-medium text-slate-900">{loading ? <Skeleton className="w-8 h-4" /> : (data?.citations?.received?.length || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
