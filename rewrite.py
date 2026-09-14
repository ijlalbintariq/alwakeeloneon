import sys

file_path = '/Users/macbook/Downloads/Alwakeelo/client/src/pages/bench-simulator.tsx'

content = """import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Scale, Shield, Paperclip, RotateCcw, History as HistoryIcon, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { PreviewShell } from "@/experimental/components/PreviewShell";

type Role = "user" | "assistant";
type Message = { role: Role; content: string };

export default function BenchSimulator() {
  const [config, setConfig] = useState({
    courtLevel: "",
    caseNature: "",
    proceedingStage: "",
    selectedJudgeName: ""
  });
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [score, setScore] = useState(100);
  const [judgeProfile, setJudgeProfile] = useState<any>(null);
  const [round, setRound] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: judgeSuggestions = [] } = useQuery({
    queryKey: ["/api/judges/directory", config.selectedJudgeName],
    queryFn: async () => {
      if (!config.selectedJudgeName || config.selectedJudgeName.length < 2) return [];
      const res = await fetch(`/api/judges/directory?q=${encodeURIComponent(config.selectedJudgeName)}`);
      if (!res.ok) return [];
      return res.json();
    }
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
      setMessages([{ role: "assistant", content: `Session started. Welcome Counsel. You are presenting before the ${config.courtLevel}. Please present your opening argument regarding the ${config.proceedingStage}.` }]);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return;

    const newMessages = [...messages, { role: "user" as Role, content: inputValue }];
    setMessages(newMessages);
    setInputValue("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/bench/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          userMessage: inputValue,
          config
        })
      });

      if (!response.ok) throw new Error("Network error");
      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      let assistantMessage = "";
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") {
              setRound((r) => r + 1);
              setScore((s) => Math.max(0, s - Math.floor(Math.random() * 5)));
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.sessionId && !sessionId) {
                setSessionId(data.sessionId);
                if (data.judgeProfile) setJudgeProfile(data.judgeProfile);
              } else if (data.text) {
                assistantMessage += data.text;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  return [...prev.slice(0, -1), { ...last, content: assistantMessage }];
                });
              }
            } catch (e) {
              console.error("Parse error", e);
            }
          }
        }
      }
    } catch (error) {
      console.error(error);
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
              ({config.courtLevel} - {config.caseNature})
            </span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="text-center hidden sm:block">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Round</div>
              <div className="text-xl font-bold">{round}/5</div>
            </div>
            <div className="text-center mr-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Live Score</div>
              <div className={`text-xl font-bold ${score > 80 ? "text-green-600" : score > 60 ? "text-yellow-600" : "text-red-600"}`}>
                {score}/100
              </div>
            </div>
            {judgeProfile && (
              <div 
                className="hidden lg:flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full border border-primary/20 cursor-help"
                title={`Confidence: ${judgeProfile.confidence} - Based on ${judgeProfile.evidenceJudgmentIds?.length || 0} retrieved judgments.`}
              >
                <span>Judge Basis: {judgeProfile.confidence}</span>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => alert("Session History modal coming soon.")} className="flex gap-2">
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
                    <span className="animate-pulse">The Judge is reviewing your argument...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t bg-card">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2 items-center">
              <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => alert("File attachment analysis for the simulator will be available soon.")}>
                <Paperclip size={20} className="text-muted-foreground" />
              </Button>
              <Input 
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Type your argument..."
                disabled={isStreaming}
                className="flex-1"
              />
              <Button type="submit" disabled={isStreaming || !inputValue.trim()} className="bg-[#2563EB] hover:bg-[#1D4ED8]">
                <Send size={18} className="mr-2" />
                Submit
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <Dialog open={!sessionActive} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-[425px]" hideClose>
            <DialogHeader>
              <DialogTitle>Configure Simulator</DialogTitle>
            </DialogHeader>
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
                <label className="text-sm font-medium">Specific Judge (Optional)</label>
                <Input 
                  list="judge-suggestions"
                  placeholder="e.g. Justice Mansoor Ali Shah" 
                  value={config.selectedJudgeName}
                  onChange={(e) => setConfig({ ...config, selectedJudgeName: e.target.value })}
                />
                <datalist id="judge-suggestions">
                  {judgeSuggestions.map((judge: string) => (
                    <option key={judge} value={judge} />
                  ))}
                </datalist>
                <p className="text-xs text-muted-foreground">If provided, the AI will pull their rulings to build a Judicial Decision Profile.</p>
              </div>
              <Button className="w-full mt-4" onClick={handleStartSession} disabled={!config.courtLevel || !config.caseNature || !config.proceedingStage}>
                Enter the Courtroom
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      </div>
    </PreviewShell>
  );
}
"""

with open(file_path, "w") as f:
    f.write(content)

print("File reconstructed beautifully.")
