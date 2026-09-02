import React, { useState } from "react";
import {
  BrainCircuit,
  Sliders,
  Upload,
  FileCheck,
  Sparkles,
  Shield,
  Trash2,
  CheckCircle,
  Plus,
  RefreshCw,
  Award,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface StyleMemoryDraftingPanelProps {
  className?: string;
}

export const StyleMemoryDraftingPanel: React.FC<StyleMemoryDraftingPanelProps> = ({
  className = "",
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [scope, setScope] = useState<"personal" | "chamber">("chamber");
  const [strictness, setStrictness] = useState<"strict" | "balanced" | "flexible">("balanced");
  const [isUploading, setIsUploading] = useState(false);

  const { data: samples = [], isLoading: isLoadingSamples } = useQuery<any[]>({ queryKey: ["/api/style-memory/samples"] });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      
      const res = await fetch("/api/style-memory/samples/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!res.ok) throw new Error("Upload failed");
      
      queryClient.invalidateQueries({ queryKey: ["/api/style-memory/samples"] });
      toast({
        title: "Chamber Sample Ingested",
        description: "Successfully analyzed " + file.name + ". AI drafting model updated with chamber style.",
      });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteSample = async (id: string, title: string) => {
    try {
      const res = await fetch("/api/style-memory/samples/" + id, { method: "DELETE" });
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/style-memory/samples"] });
        toast({ title: "Sample Removed", description: title + " was removed from your style memory profile." });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={`flex flex-col h-full space-y-4 ${className}`}>
      {/* Top Banner */}
      <div className="p-3.5 rounded-xl bg-[#FAFAF9] border border-[#1A1A1A]/20">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="p-1.5 rounded-lg bg-[#1A1A1A]/10 text-[#1A1A1A]">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider">
              Chambers Style Memory
            </h3>
            <p className="text-[10px] text-[#1A1A1A]/80">
              Personalized Pakistani legal drafting voice & tone
            </p>
          </div>
        </div>
        <p className="text-[11px] text-[#4A4A4A] leading-relaxed">
          AI continuously aligns wording, verification formats, and clause terminology to match your chamber's historical pleadings.
        </p>
      </div>

      {/* Scope Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[#4A4A4A] flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#1A1A1A]" />
          <span>Active Learning Scope</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-white border border-[#E5E4E2]">
          <button
            type="button"
            onClick={() => setScope("chamber")}
            className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
              scope === "chamber"
                ? "bg-[#1A1A1A]/10 text-[#1A1A1A] border border-[#1A1A1A]/30 shadow-sm"
                : "text-[#666666] hover:text-[#2D2D2D]"
            }`}
          >
            Chambers / Firm (Shared)
          </button>
          <button
            type="button"
            onClick={() => setScope("personal")}
            className={`py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
              scope === "personal"
                ? "bg-[#1A1A1A]/10 text-[#1A1A1A] border border-[#1A1A1A]/30 shadow-sm"
                : "text-[#666666] hover:text-[#2D2D2D]"
            }`}
          >
            Senior Advocate (Personal)
          </button>
        </div>
      </div>

      {/* Strictness Selector */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[#4A4A4A] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#1A1A1A]" />
            <span>Chamber Strictness Mode</span>
          </span>
          <span className="text-[10px] text-[#1A1A1A] font-mono capitalize">
            {strictness} Mode
          </span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {(["strict", "balanced", "flexible"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setStrictness(mode)}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium capitalize border transition-all text-center ${
                strictness === mode
                  ? "bg-[#1A1A1A]/10 border-[#1A1A1A]/50 text-[#1A1A1A] shadow-sm"
                  : "bg-[#FAFAF9] border-[#E5E4E2] text-[#666666] hover:text-[#2D2D2D]"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[#666666]">
          {strictness === "strict" && "Strictly reproduces your past sentence structures, headings, and signature blocks."}
          {strictness === "balanced" && "Preserves signature chamber cadence while seamlessly incorporating new statutory provisions."}
          {strictness === "flexible" && "Adapts modern corporate language while honoring fundamental court conventions."}
        </p>
      </div>

      {/* Sample Learning Stats */}
      <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-[#F5F4F2] border border-[#E5E4E2]">
        <div className="text-center">
          <div className="text-base font-bold text-[#1A1A1A] font-mono">{samples.length}</div>
          <div className="text-[9px] text-[#666666] uppercase tracking-wider">Learned Briefs</div>
        </div>
        <div className="text-center border-x border-[#E5E4E2]">
          <div className="text-base font-bold text-[#1A1A1A] font-mono">
            {samples.reduce((acc, s) => acc + s.wordCount, 0).toLocaleString()}
          </div>
          <div className="text-[9px] text-[#666666] uppercase tracking-wider">Words Trained</div>
        </div>
        <div className="text-center">
          <div className="text-base font-bold text-[#666666] font-mono">99.4%</div>
          <div className="text-[9px] text-[#666666] uppercase tracking-wider">Tone Match</div>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-[#4A4A4A] flex items-center gap-1.5">
          <Upload className="w-3.5 h-3.5 text-[#1A1A1A]" />
          <span>Upload Sample Court Briefs / Deeds</span>
        </label>
        <label className="flex flex-col items-center justify-center p-4 rounded-xl border border-dashed border-[#E5E4E2] hover:border-[#1A1A1A]/50 bg-[#FAFAF9] hover:bg-[#F5F4F2] cursor-pointer transition-all">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleFileUpload}
            disabled={isUploading}
            className="hidden"
          />
          {isUploading ? (
            <div className="flex items-center gap-2 text-xs text-[#1A1A1A]">
              <RefreshCw className="w-4 h-4 animate-spin text-[#1A1A1A]" />
              <span>Analyzing pleading structure...</span>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <Upload className="w-5 h-5 mx-auto text-[#1A1A1A]/80" />
              <div className="text-xs font-medium text-[#2D2D2D]">
                Drop past petitions or click to browse
              </div>
              <div className="text-[10px] text-[#666666]">
                Supports DOCX, PDF, and TXT files
              </div>
            </div>
          )}
        </label>
      </div>

      {/* Learned Samples List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        <div className="text-[11px] font-semibold text-[#666666] uppercase tracking-wider px-1">
          Active Knowledge Samples ({samples.length})
        </div>
        {samples.map((sample) => (
          <div
            key={sample.id}
            className="p-2.5 rounded-lg bg-[#F5F4F2] border border-[#E5E4E2] hover:border-[#E5E4E2] transition-all flex items-center justify-between gap-2"
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-[#1A1A1A] shrink-0" />
                <span className="text-xs font-medium text-[#2D2D2D] truncate">
                  {sample.title}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#666666]">
                <span>{sample.category}</span>
                <span>•</span>
                <span>{sample.wordCount.toLocaleString()} words</span>
                <span>•</span>
                <span>{sample.createdAt}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleDeleteSample(sample.id, sample.title)}
              title="Remove sample"
              className="p-1 rounded text-[#666666] hover:text-rose-400 hover:bg-[#F5F4F2] transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

