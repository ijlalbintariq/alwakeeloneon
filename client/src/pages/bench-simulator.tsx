import React, { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Scale, Paperclip, RotateCcw, History as HistoryIcon, Send } from "lucide-react";
import { PreviewShell } from "@/experimental/components/PreviewShell";
import { useToast } from "@/hooks/use-toast";

type Role = "user" | "assistant";
type Message = { role: Role; content: string };

const formatLabel = (str: string) => str ? str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : "";

export default function BenchSimulator() {
  const { toast } = useToast();
  const [config, setConfig] = useState({
    courtLevel: "",
    caseNature: "",
    proceedingStage: "",
    selectedJudgeName: "",
    selectedJudgeName2: "",
    benchSize: "single"
  });
  const [judgeOpen, setJudgeOpen] = useState(false);
  const [judgeSearchQuery, setJudgeSearchQuery] = useState("");
  const [judgeOpen2, setJudgeOpen2] = useState(false);
  const [judgeSearchQuery2, setJudgeSearchQuery2] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("");
  const [score, setScore] = useState(100);
  const [judgeProfile, setJudgeProfile] = useState<any>(null);
  const [round, setRound] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputValue((prev) => prev + (prev ? "\n\n" : "") + "--- Attachment ---\n" + text.substring(0, 5000));
      toast({ title: "File attached", description: "Contents added to your argument." });
    };
    reader.readAsText(file);
    e.target.value = ""; // reset
  };

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySessions, setHistorySessions] = useState<any[]>([]);

  const loadHistory = async () => {
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/bench/history");
      if (res.ok) {
        setHistorySessions(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadSession = async (id: number) => {
    try {
      const res = await fetch(`/api/bench/history/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session.id);
        setConfig({
          courtLevel: data.session.courtLevel,
          caseNature: data.session.caseNature,
          proceedingStage: data.session.proceedingStage,
          selectedJudgeName: data.session.selectedJudgeName || "",
          selectedJudgeName2: data.session.selectedJudgeName2 || "",
          benchSize: data.session.benchSize || "single"
        });
        setJudgeProfile(data.session.judgeProfile);
        setMessages(data.messages.map((m: any) => ({ role: m.speakerRole === "user" ? "user" : "assistant", content: m.content })));
        setRound(Math.floor(data.messages.length / 2) + 1);
        setSessionActive(true);
        setIsHistoryOpen(false);
      }
    } catch (e) {
      toast({ title: "Error", description: "Could not load session", variant: "destructive" });
    }
  };

  const { data: judgeSuggestions = [] } = useQuery({
    queryKey: ["/api/judges/autocomplete", judgeSearchQuery],
    queryFn: async () => {
      const q = judgeSearchQuery.trim();
      if (q.length < 1) return [];
      const res = await fetch(`/api/judges/autocomplete?q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data as string[]).filter((j: string) => j && j.length > 0);
    },
    staleTime: 30000,
  });

  const { data: judgeSuggestions2 = [] } = useQuery({
    queryKey: ["/api/judges/autocomplete", judgeSearchQuery2],
    queryFn: async () => {
      const q = judgeSearchQuery2.trim();
      if (q.length < 1) return [];
      const res = await fetch(`/api/judges/autocomplete?q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data as string[]).filter((j: string) => j && j.length > 0);
    },
    staleTime: 30000,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleReset = () => {
    if (confirm("Are you sure you want to end this session and reset the simulator?")) {
      setSessionActive(false);
      setSessionId(null);
      setMessages([]);
      setRound(1);
      setScore(100);
    }
  };

  const handleStartSession = () => {
    if (config.courtLevel && config.caseNature && config.proceedingStage) {
      setSessionActive(true);
      setMessages([{ role: "assistant", content: `Session started. Welcome Counsel. You are presenting before the ${formatLabel(config.courtLevel)}. Please present your opening argument regarding the ${formatLabel(config.proceedingStage)}.` }]);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return;

    const newMessages = [...messages, { role: "user" as Role, content: inputValue }];
    setMessages(newMessages);
    setInputValue("");
    setIsStreaming(true);
    setLoadingStatus("");

    try {
      const response = await fetch("/api/bench/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userMessage: inputValue,
          config,
          currentScore: score
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "Network error. Please try again.");
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      let assistantMessage = "";
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") {
              setRound((r) => r + 1);
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.status) {
                setLoadingStatus(data.status);
              } else if (data.sessionId && !sessionId) {
                setLoadingStatus(""); // Clear status when real data arrives
                setSessionId(data.sessionId);
                if (data.judgeProfile) setJudgeProfile(data.judgeProfile);
              } else if (data.text) {
                assistantMessage += data.text;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  return [...prev.slice(0, -1), { ...last, content: assistantMessage }];
                });
              } else if (data.evaluation) {
                if (typeof data.evaluation.score === "number") {
                  setScore(data.evaluation.score);
                }
              }
            } catch (e) {
              console.error("Parse error", e);
            }
          }
        }
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Action Denied",
        description: error.message,
        variant: "destructive"
      });
      // Remove the optimistically added user message
      setMessages(messages);
      if (!sessionId) {
        setSessionActive(false); 
      }
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <PreviewShell noPadding className="h-full">
      <div className="flex-1 w-full h-full flex flex-col bg-background">
      {sessionActive && (
        <div className="flex justify-between items-center bg-card p-4 shadow-sm border-b">
          <div className="flex items-center gap-2">
            <Scale className="text-primary" />
            <h1 className="text-xl font-bold hidden sm:block">The Bench</h1>
            <span className="text-sm text-muted-foreground hidden md:inline-block">
              ({formatLabel(config.courtLevel)} - {formatLabel(config.caseNature)})
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="text-center hidden sm:block">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Round</div>
              <div className="text-xl font-bold">{round}/5</div>
            </div>
            <div className="text-center mr-2 hidden sm:block">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Status</div>
              <div className="text-xl font-bold text-green-600">Active</div>
            </div>
            {judgeProfile && (
              <div 
                className="hidden lg:flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20 cursor-help"
                title={`Confidence: ${judgeProfile.confidence} - Based on ${judgeProfile.evidenceJudgmentIds?.length || 0} judgments where this Judge authored or concurred.`}
              >
                <span>Judge Basis: {judgeProfile.confidence}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={loadHistory} className="flex gap-2">
              <HistoryIcon size={16} />
              <span className="hidden lg:inline">History</span>
            </Button>
            <Button variant="destructive" size="sm" onClick={handleReset} className="flex gap-2">
              <RotateCcw size={16} />
              <span className="hidden lg:inline">Reset</span>
            </Button>
          </div>
        </div>
      )}

      {sessionActive ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${msg.role === "user" ? "bg-[#2563EB] text-white shadow-sm" : "bg-secondary text-secondary-foreground"}`}>
                    {msg.role === "user" ? <User size={20} /> : <Bot size={20} />}
                  </div>
                  <div className={`p-4 rounded-2xl max-w-[80%] ${msg.role === "user" ? "bg-[#2563EB] text-white shadow-sm" : "bg-muted text-foreground"}`}>
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1].role === "user" && (
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-secondary text-secondary-foreground">
                    <Bot size={20} />
                  </div>
                  <div className="p-4 rounded-2xl bg-muted text-foreground">
                    <span className="animate-pulse">{loadingStatus || "The Judge is speaking..."}</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t bg-card">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 items-end">
              <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.csv,.md,.json" onChange={handleFileChange} />
              <Button type="button" variant="outline" size="icon" className="shrink-0 mb-1" onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={20} className="text-muted-foreground" />
              </Button>
              <Textarea 
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isStreaming && inputValue.trim() && round <= 5) {
                      sendMessage();
                      e.currentTarget.style.height = 'auto';
                    }
                  }
                }}
                rows={1}
                placeholder="Type your argument..."
                disabled={isStreaming}
                className="flex-1 min-h-[44px] max-h-[200px] resize-none overflow-y-auto py-3"
              />
              <Button type="submit" disabled={isStreaming || !inputValue.trim() || round > 5} className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white disabled:opacity-50 disabled:text-white flex items-center mb-1">
                <Send size={18} className="mr-2" />
                <span>{round > 5 ? "Session Ended" : "Submit"}</span>
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 p-4 bg-muted/10">
          <div className="w-full max-w-md space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-6 text-amber-900 dark:text-amber-200 shadow-sm">
              <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Legal Disclaimer
              </h3>
              <p className="text-sm leading-relaxed mb-3">
                This simulation is strictly hypothetical and relies entirely on historical judgment patterns and language models. 
              </p>
              <p className="text-sm leading-relaxed mb-3">
                The simulated responses <strong>do not depict the real thinking, opinions, or future rulings</strong> of any actual judge.
              </p>
              <p className="text-sm leading-relaxed font-medium">
                Al wakeelo assumes no legal responsibility for reliance on these simulated outcomes.
              </p>
            </div>
          </div>
          <Card className="w-full max-w-md shadow-lg border">
            <CardHeader>
              <CardTitle>Configure Simulator</CardTitle>
            </CardHeader>
            <CardContent>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Court Level</label>
                <Select onValueChange={(val) => setConfig({ ...config, courtLevel: val })}>
                  <SelectTrigger><SelectValue placeholder="Select court..." /></SelectTrigger>
                  <SelectContent className="bg-background dark:bg-[#0F172A] border shadow-xl z-[100] border-solid opacity-100">
                    <SelectItem value="supreme_court">Supreme Court</SelectItem>
                    <SelectItem value="high_court">High Court</SelectItem>
                    <SelectItem value="district_sessions">District & Sessions Court</SelectItem>
                    <SelectItem value="special_tribunal_nab">Special Tribunal (NAB)</SelectItem>
                    <SelectItem value="special_tribunal_atc">Anti-Terrorism Court (ATC)</SelectItem>
                    <SelectItem value="banking_court">Banking Court</SelectItem>
                    <SelectItem value="customs_appellate">Customs Appellate Tribunal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Case Nature</label>
                <Select onValueChange={(val) => setConfig({ ...config, caseNature: val })}>
                  <SelectTrigger><SelectValue placeholder="Select nature..." /></SelectTrigger>
                  <SelectContent className="bg-background dark:bg-[#0F172A] border shadow-xl z-[100] border-solid opacity-100">
                    <SelectItem value="civil">Civil</SelectItem>
                    <SelectItem value="criminal">Criminal</SelectItem>
                    <SelectItem value="constitutional">Constitutional</SelectItem>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="taxation">Taxation</SelectItem>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="cyber_crime">Cyber Crime</SelectItem>
                    <SelectItem value="quashment">Quashment (482 CrPC)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Proceeding Stage</label>
                <Select onValueChange={(val) => setConfig({ ...config, proceedingStage: val })}>
                  <SelectTrigger><SelectValue placeholder="Select stage..." /></SelectTrigger>
                  <SelectContent className="bg-background dark:bg-[#0F172A] border shadow-xl z-[100] border-solid opacity-100">
                    <SelectItem value="preliminary_hearing">Preliminary Hearing</SelectItem>
                    <SelectItem value="bail_pre_arrest">Bail (Pre-Arrest)</SelectItem>
                    <SelectItem value="bail_post_arrest">Bail (Post-Arrest)</SelectItem>
                    <SelectItem value="framing_of_issues">Framing of Issues</SelectItem>
                    <SelectItem value="framing_of_charge">Framing of Charge</SelectItem>
                    <SelectItem value="cross_examination">Cross-Examination</SelectItem>
                    <SelectItem value="evidence_recording">Evidence Recording</SelectItem>
                    <SelectItem value="final_arguments">Final Arguments</SelectItem>
                    <SelectItem value="appellate_arguments">Appellate Arguments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Bench Size</label>
                <Select value={config.benchSize} onValueChange={(val) => setConfig({ ...config, benchSize: val })}>
                  <SelectTrigger><SelectValue placeholder="Select bench size..." /></SelectTrigger>
                  <SelectContent className="bg-background dark:bg-[#0F172A] border shadow-xl z-[100] border-solid opacity-100">
                    <SelectItem value="single">Single Bench (1 Judge)</SelectItem>
                    <SelectItem value="division">Division Bench (2 Judges)</SelectItem>
                    <SelectItem value="full">Full Bench (3+ Judges)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Presiding Judge (Optional)</label>
                <div className="relative">
                  <Input
                    placeholder="e.g. Justice Mansoor Ali Shah"
                    value={judgeSearchQuery}
                    onChange={(e) => {
                      setJudgeSearchQuery(e.target.value);
                      setConfig(prev => ({ ...prev, selectedJudgeName: e.target.value }));
                      setJudgeOpen(true);
                    }}
                    onFocus={() => setJudgeOpen(true)}
                    onBlur={() => setTimeout(() => setJudgeOpen(false), 150)}
                  />
                  {judgeOpen && judgeSuggestions.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-[200px] overflow-y-auto rounded-md border bg-popover shadow-md">
                      {judgeSuggestions.map((judge: string) => (
                        <div
                          key={judge}
                          className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setConfig(prev => ({ ...prev, selectedJudgeName: judge }));
                            setJudgeSearchQuery(judge);
                            setJudgeOpen(false);
                          }}
                        >
                          {judge}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">If provided, the AI will pull their rulings to build a Judicial Decision Profile.</p>
              </div>
              {(config.benchSize === 'division' || config.benchSize === 'full') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Second Judge (Optional)</label>
                  <div className="relative">
                    <Input
                      placeholder="e.g. Justice Ayesha A. Malik"
                      value={judgeSearchQuery2}
                      onChange={(e) => {
                        setJudgeSearchQuery2(e.target.value);
                        setConfig(prev => ({ ...prev, selectedJudgeName2: e.target.value }));
                        setJudgeOpen2(true);
                      }}
                      onFocus={() => setJudgeOpen2(true)}
                      onBlur={() => setTimeout(() => setJudgeOpen2(false), 150)}
                    />
                    {judgeOpen2 && judgeSuggestions2.length > 0 && (
                      <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-[200px] overflow-y-auto rounded-md border bg-popover shadow-md">
                        {judgeSuggestions2.map((judge: string) => (
                          <div
                            key={judge}
                            className="cursor-pointer px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setConfig(prev => ({ ...prev, selectedJudgeName2: judge }));
                              setJudgeSearchQuery2(judge);
                              setJudgeOpen2(false);
                            }}
                          >
                            {judge}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-4 flex-col sm:flex-row">
                <Button variant="outline" className="w-full" onClick={loadHistory}>
                  Load History
                </Button>
                <Button className="w-full text-white !bg-[#105B38] hover:!bg-[#0D4B2E] bg-none border-[#105B38]" onClick={handleStartSession} disabled={!config.courtLevel || !config.caseNature || !config.proceedingStage}>
                  Enter the Courtroom
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col bg-background border shadow-lg">
          <DialogHeader>
            <DialogTitle>Session History</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto pr-2">
            {historyLoading ? (
              <div className="text-sm text-muted-foreground p-4 text-center">Loading past sessions...</div>
            ) : historySessions.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 text-center">No past sessions found.</div>
            ) : (
              <div className="space-y-3 pt-2">
                {historySessions.map((s) => (
                  <div key={s.id} className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => loadSession(s.id)}>
                    <div className="font-medium">{formatLabel(s.courtLevel)} - {formatLabel(s.caseNature)}</div>
                    <div className="text-sm text-muted-foreground flex justify-between mt-1">
                      <span>{formatLabel(s.proceedingStage)} {s.selectedJudgeName ? `(${s.selectedJudgeName})` : ""}</span>
                      <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </PreviewShell>
  );
}
