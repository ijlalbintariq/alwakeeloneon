import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  Network,
  ListTree,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Search,
  Filter,
  Layers,
  ChevronRight,
  Info,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Copy,
  Check,
  BookOpen,
  Sparkles,
  Gavel,
  Download,
  Move,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PrecedentCitationItem } from "./OverruledAlertBanner";

interface PrecedentGraphProps {
  currentCitation: string;
  currentTitle: string;
  citationsMade: PrecedentCitationItem[];
  citationsReceived: PrecedentCitationItem[];
  onSelectJudgment?: (judgmentId: string) => void;
}

export const PrecedentGraph: React.FC<PrecedentGraphProps> = ({
  currentCitation,
  currentTitle,
  citationsMade,
  citationsReceived,
  onSelectJudgment,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"graph" | "list">("graph");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [selectedNode, setSelectedNode] = useState<PrecedentCitationItem | null>(null);
  const [graphSearchQuery, setGraphSearchQuery] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [copiedNodeId, setCopiedNodeId] = useState<string | null>(null);

  const treatmentBadge = (type: string) => {
    switch (type?.toLowerCase()) {
      case "relied_upon":
      case "followed":
      case "approved":
        return {
          label: "Relied Upon",
          color: "#105B38",
          bg: "bg-emerald-50 text-[#105B38] border-emerald-200",
          nodeColor: "#105B38",
        };
      case "distinguished":
      case "explained":
        return {
          label: "Distinguished",
          color: "#D97706",
          bg: "bg-amber-50 text-amber-800 border-amber-200",
          nodeColor: "#D97706",
        };
      case "overruled":
      case "disapproved":
      case "reversed":
        return {
          label: "Overruled",
          color: "#DC2626",
          bg: "bg-rose-50 text-rose-700 border-rose-200",
          nodeColor: "#DC2626",
        };
      case "referred_to":
      default:
        return {
          label: "Referred To",
          color: "#2563EB",
          bg: "bg-blue-50 text-blue-700 border-blue-200",
          nodeColor: "#2563EB",
        };
    }
  };

  const filteredMade = useMemo(() => {
    return citationsMade.filter((c) => {
      const matchFilter = selectedFilter === "all" || c.citationType === selectedFilter;
      const matchSearch =
        !graphSearchQuery.trim() ||
        (c.linkedCitation || c.citationText || "").toLowerCase().includes(graphSearchQuery.toLowerCase()) ||
        (c.linkedTitle || "").toLowerCase().includes(graphSearchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [citationsMade, selectedFilter, graphSearchQuery]);

  const filteredReceived = useMemo(() => {
    return citationsReceived.filter((c) => {
      const matchFilter = selectedFilter === "all" || c.citationType === selectedFilter;
      const matchSearch =
        !graphSearchQuery.trim() ||
        (c.linkedCitation || c.citationText || "").toLowerCase().includes(graphSearchQuery.toLowerCase()) ||
        (c.linkedTitle || "").toLowerCase().includes(graphSearchQuery.toLowerCase());
      return matchFilter && matchSearch;
    });
  }, [citationsReceived, selectedFilter, graphSearchQuery]);

  const totalCitations = citationsMade.length + citationsReceived.length;

  const handleCopyCitation = (id: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedNodeId(id);
      setTimeout(() => setCopiedNodeId(null), 2000);
      toast({
        title: "Citation Copied",
        description: `"${text}" copied to clipboard.`,
      });
    });
  };

  // Pan / Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  // Export Citation Tree Summary
  const handleExportSummary = () => {
    const lines: string[] = [
      `================================================================`,
      `AL WAKEELO PRECEDENT CITATION GRAPH SUMMARY REPORT`,
      `================================================================`,
      `Anchor Precedent: ${currentCitation}`,
      `Title: ${currentTitle}`,
      `Generated: ${new Date().toLocaleString("en-PK")}`,
      `Total Connected Authorities: ${totalCitations}`,
      ``,
      `--- OUTBOUND AUTHORITIES (CITED BY THIS BENCH: ${citationsMade.length}) ---`,
    ];

    if (citationsMade.length === 0) {
      lines.push(`(No outbound precedent citations recorded)`);
    } else {
      citationsMade.forEach((c, idx) => {
        lines.push(
          `[${idx + 1}] ${c.linkedCitation || c.citationText} | Treatment: ${c.citationType.toUpperCase()} | Title: ${c.linkedTitle || "N/A"}`
        );
        if (c.contextExcerpt) {
          lines.push(`    Excerpt: "${c.contextExcerpt}"`);
        }
      });
    }

    lines.push(``);
    lines.push(`--- INBOUND CITING PRECEDENTS (CITED IN SUBSEQUENT CASE LAW: ${citationsReceived.length}) ---`);

    if (citationsReceived.length === 0) {
      lines.push(`(No subsequent citing judgments recorded)`);
    } else {
      citationsReceived.forEach((c, idx) => {
        lines.push(
          `[${idx + 1}] ${c.linkedCitation || c.citationText} | Treatment: ${c.citationType.toUpperCase()} | Title: ${c.linkedTitle || "N/A"}`
        );
        if (c.contextExcerpt) {
          lines.push(`    Excerpt: "${c.contextExcerpt}"`);
        }
      });
    }

    lines.push(``);
    lines.push(`================================================================`);
    lines.push(`Exported from Al Wakeelo Legal Research Workstation (www.alwakeelo.com)`);

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentCitation.replace(/[^a-zA-Z0-9]/g, "_")}_Citation_Graph_Summary.txt`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Graph Summary Exported",
      description: "Citation network tree downloaded successfully.",
    });
  };

  return (
    <div
      className={cn(
        "rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs space-y-4 transition-all",
        isFullscreen && "fixed inset-4 z-50 overflow-y-auto bg-white shadow-2xl border-[#CBD5E1]"
      )}
    >
      {/* Header with Switcher & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E2E8F0] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-[#105B38] shadow-xs">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
              <span>Precedent Citation Network</span>
              <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-[#105B38] border border-emerald-200">
                {totalCitations} Nodes
              </span>
            </h3>
            <p className="text-[11px] text-[#64748B]">
              Interactive bi-directional precedent authority & judicial treatment graph
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Treatment Filter Pill Buttons */}
          <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] text-xs">
            <button
              type="button"
              onClick={() => setSelectedFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all text-[11px] font-bold",
                selectedFilter === "all"
                  ? "bg-white text-[#105B38] shadow-xs"
                  : "text-[#64748B] hover:text-[#0F172A]"
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter("relied_upon")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all text-[11px] font-bold",
                selectedFilter === "relied_upon"
                  ? "bg-emerald-50 text-[#105B38] border border-emerald-200"
                  : "text-[#64748B] hover:text-[#105B38]"
              )}
            >
              Relied Upon
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter("distinguished")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all text-[11px] font-bold",
                selectedFilter === "distinguished"
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : "text-[#64748B] hover:text-amber-800"
              )}
            >
              Distinguished
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter("overruled")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all text-[11px] font-bold",
                selectedFilter === "overruled"
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "text-[#64748B] hover:text-rose-700"
              )}
            >
              Overruled
            </button>
            <button
              type="button"
              onClick={() => setSelectedFilter("referred_to")}
              className={cn(
                "px-2.5 py-1 rounded-lg transition-all text-[11px] font-bold",
                selectedFilter === "referred_to"
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "text-[#64748B] hover:text-blue-700"
              )}
            >
              Referred
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => setActiveTab("graph")}
              className={cn(
                "p-1.5 rounded-lg text-xs transition-colors",
                activeTab === "graph"
                  ? "bg-white text-[#105B38] font-bold shadow-xs"
                  : "text-[#64748B] hover:text-[#0F172A]"
              )}
              title="Interactive Visual Network Graph"
            >
              <Network className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("list")}
              className={cn(
                "p-1.5 rounded-lg text-xs transition-colors",
                activeTab === "list"
                  ? "bg-white text-[#105B38] font-bold shadow-xs"
                  : "text-[#64748B] hover:text-[#0F172A]"
              )}
              title="Precedent List Matrix"
            >
              <ListTree className="w-4 h-4" />
            </button>
          </div>

          {/* 1-Click Summary Export */}
          <button
            type="button"
            onClick={handleExportSummary}
            className="p-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] transition-colors"
            title="Export Citation Tree Summary"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-xl bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Graph"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {totalCitations === 0 ? (
        <div className="py-12 text-center space-y-2 text-[#64748B] bg-[#F8FAFC] rounded-2xl border border-[#E2E8F0] p-6">
          <Layers className="w-8 h-8 mx-auto text-[#CBD5E1]" />
          <p className="text-xs font-bold text-[#0F172A]">No precedent citation links recorded for this judgment yet.</p>
          <p className="text-[11px] text-[#94A3B8]">Citations and treatment badges will automatically populate upon judicial annotation.</p>
        </div>
      ) : activeTab === "graph" ? (
        /* Visual Interactive Graph */
        <div className="space-y-3">
          {/* Zoom and Search Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={graphSearchQuery}
                onChange={(e) => setGraphSearchQuery(e.target.value)}
                placeholder="Filter graph nodes by citation/title..."
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#105B38]"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-[#F8FAFC] p-1 rounded-xl border border-[#E2E8F0] text-xs">
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))))}
                className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-white"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold text-[#0F172A] px-1">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((z) => Math.min(1.5, Number((z + 0.15).toFixed(2))))}
                className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-white"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                className="p-1 rounded-md text-[#64748B] hover:text-[#0F172A] hover:bg-white border-l border-[#E2E8F0] ml-0.5 pl-1.5"
                title="Reset Zoom & Pan"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={cn(
              "relative w-full rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] overflow-hidden flex items-center justify-center p-4 transition-all select-none cursor-grab active:cursor-grabbing",
              isFullscreen ? "h-[calc(100vh-220px)]" : "h-80 sm:h-96"
            )}
          >
            {/* Grid Pattern Background */}
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, #94a3b8 1px, transparent 0)`,
                backgroundSize: "24px 24px",
              }}
            />

            {/* SVG Network Graph Visualization */}
            {(() => {
              const maxNodes = Math.max(5, filteredMade.length, filteredReceived.length);
              const svgHeight = Math.max(360, maxNodes * 56 + 100);
              const centerY = svgHeight / 2;
              return (
            <svg
              className="w-full h-full transition-transform duration-100"
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                transformOrigin: "center center",
              }}
              viewBox={`0 0 800 ${svgHeight}`}
            >
              {/* Center Anchor Node: Current Judgment */}
              <g transform={`translate(400, ${centerY})`}>
                <circle
                  r="48"
                  fill="#105B38"
                  stroke="#FFFFFF"
                  strokeWidth="3"
                  className="filter drop-shadow-md"
                />
                <text
                  textAnchor="middle"
                  y="-6"
                  fill="#FFFFFF"
                  fontSize="10.5"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {currentCitation?.slice(0, 16) || "CURRENT"}
                </text>
                <text
                  textAnchor="middle"
                  y="12"
                  fill="#D1FAE5"
                  fontSize="8"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  Anchor Precedent
                </text>
              </g>

              {/* Left Column: Outbound Citations Made */}
              <g>
                <text
                  x="140"
                  y="30"
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  ← CITED PRECEDENTS ({filteredMade.length})
                </text>
                {filteredMade.map((item, idx) => {
                  const y = (centerY - (filteredMade.length * 56) / 2) + 28 + idx * 56;
                  const x = 140;
                  const badge = treatmentBadge(item.citationType);
                  const isSelected = selectedNode?.id === item.id;
                  return (
                    <g
                      key={`made-svg-${item.id}`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(item);
                      }}
                    >
                      {/* Connection Line */}
                      <path
                        d={`M 352 ${centerY} C 260 ${centerY}, 240 ${y}, ${x + 65} ${y}`}
                        fill="none"
                        stroke={badge.nodeColor}
                        strokeWidth={isSelected ? "2.5" : "1.5"}
                        strokeDasharray={item.citationType === "overruled" ? "4,4" : "none"}
                        opacity={isSelected ? "1" : "0.7"}
                      />
                      {/* Node Box */}
                      <rect
                        x={x - 70}
                        y={y - 20}
                        width="140"
                        height="40"
                        rx="10"
                        fill="#FFFFFF"
                        stroke={isSelected ? "#105B38" : badge.nodeColor}
                        strokeWidth={isSelected ? "2.5" : "1.5"}
                        className="transition-all filter drop-shadow-xs group-hover:fill-emerald-50/40"
                      />
                      <text
                        x={x}
                        y={y - 4}
                        textAnchor="middle"
                        fill="#0F172A"
                        fontSize="9.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {(item.linkedCitation || item.citationText || "").slice(0, 18)}
                      </text>
                      <text
                        x={x}
                        y={y + 12}
                        textAnchor="middle"
                        fill={badge.nodeColor}
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily="sans-serif"
                      >
                        {badge.label.toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </g>

              {/* Right Column: Inbound Citing Cases */}
              <g>
                <text
                  x="660"
                  y="30"
                  textAnchor="middle"
                  fill="#64748B"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  CITED IN ({filteredReceived.length}) →
                </text>
                {filteredReceived.map((item, idx) => {
                  const y = (centerY - (filteredReceived.length * 56) / 2) + 28 + idx * 56;
                  const x = 660;
                  const badge = treatmentBadge(item.citationType);
                  const isSelected = selectedNode?.id === item.id;
                  return (
                    <g
                      key={`received-svg-${item.id}`}
                      className="cursor-pointer group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(item);
                      }}
                    >
                      {/* Connection Line */}
                      <path
                        d={`M 448 ${centerY} C 540 ${centerY}, 560 ${y}, ${x - 65} ${y}`}
                        fill="none"
                        stroke={badge.nodeColor}
                        strokeWidth={isSelected ? "2.5" : "1.5"}
                        strokeDasharray={item.citationType === "overruled" ? "4,4" : "none"}
                        opacity={isSelected ? "1" : "0.7"}
                      />
                      {/* Node Box */}
                      <rect
                        x={x - 70}
                        y={y - 20}
                        width="140"
                        height="40"
                        rx="10"
                        fill="#FFFFFF"
                        stroke={isSelected ? "#105B38" : badge.nodeColor}
                        strokeWidth={isSelected ? "2.5" : "1.5"}
                        className="transition-all filter drop-shadow-xs group-hover:fill-emerald-50/40"
                      />
                      <text
                        x={x}
                        y={y - 4}
                        textAnchor="middle"
                        fill="#0F172A"
                        fontSize="9.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                      >
                        {(item.linkedCitation || item.citationText || "").slice(0, 18)}
                      </text>
                      <text
                        x={x}
                        y={y + 12}
                        textAnchor="middle"
                        fill={badge.nodeColor}
                        fontSize="8"
                        fontWeight="bold"
                        fontFamily="sans-serif"
                      >
                        {badge.label.toUpperCase()}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
              );
            })()}

            {/* Quick Helper Label */}
            <div className="absolute bottom-3 left-4 flex items-center gap-1.5 text-[11px] font-semibold text-[#64748B] bg-white/90 backdrop-blur-xs px-3 py-1 rounded-xl border border-[#E2E8F0] shadow-xs pointer-events-none">
              <Info className="w-3.5 h-3.5 text-[#105B38]" />
              <span>Click any node to view judicial reasoning | Drag canvas to pan</span>
            </div>
          </div>

          {/* Selected Node Details Flyout */}
          {selectedNode && (
            <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-[#0F172A]">
                    {selectedNode.linkedCitation || selectedNode.citationText}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border",
                      treatmentBadge(selectedNode.citationType).bg
                    )}
                  >
                    {treatmentBadge(selectedNode.citationType).label}
                  </span>
                  {selectedNode.court && (
                    <span className="text-[11px] text-[#64748B] font-medium">
                      · {selectedNode.court}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCitation(
                        String(selectedNode.id),
                        selectedNode.linkedCitation || selectedNode.citationText
                      )
                    }
                    className="p-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] text-xs transition-colors"
                    title="Copy Citation"
                  >
                    {copiedNodeId === String(selectedNode.id) ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {selectedNode.linkedJudgmentId && onSelectJudgment && (
                    <button
                      type="button"
                      onClick={() => onSelectJudgment(selectedNode.linkedJudgmentId!)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white shadow-xs transition-all"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Open Judgment</span>
                    </button>
                  )}
                </div>
              </div>

              {selectedNode.linkedTitle && (
                <p className="text-xs text-[#0F172A] font-bold">{selectedNode.linkedTitle}</p>
              )}

              {selectedNode.contextExcerpt && (
                <p className="text-xs text-[#475569] italic font-serif bg-[#F8FAFC] p-3 rounded-xl border border-[#E2E8F0] leading-relaxed">
                  &quot;{selectedNode.contextExcerpt}&quot;
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Structured List Matrix View */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Citations Made */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#0F172A] px-1">
                <span>Precedents Relied Upon / Citing ({filteredMade.length})</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {filteredMade.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">No outbound citations recorded.</p>
                ) : (
                  filteredMade.map((item) => (
                    <div
                      key={`list-made-${item.id}`}
                      onClick={() => {
                        if (onSelectJudgment) {
                          onSelectJudgment(
                            item.linkedJudgmentId ||
                              item.linkedCitation?.toLowerCase().replace(/\s+/g, "-") ||
                              String(item.id)
                          );
                        }
                      }}
                      className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#105B38] hover:shadow-xs transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[#0F172A]">
                          {item.linkedCitation || item.citationText}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                            treatmentBadge(item.citationType).bg
                          )}
                        >
                          {treatmentBadge(item.citationType).label}
                        </span>
                      </div>
                      {item.linkedTitle && (
                        <p className="text-[11px] text-[#475569] font-medium line-clamp-1">{item.linkedTitle}</p>
                      )}
                      {item.contextExcerpt && (
                        <p className="text-[11px] text-[#64748B] italic line-clamp-2">&quot;{item.contextExcerpt}&quot;</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Citations Received */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#0F172A] px-1">
                <span>Subsequent Judicial Citations ({filteredReceived.length})</span>
              </div>
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {filteredReceived.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] p-3 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">No subsequent citing cases recorded.</p>
                ) : (
                  filteredReceived.map((item) => (
                    <div
                      key={`list-received-${item.id}`}
                      onClick={() => {
                        if (onSelectJudgment) {
                          onSelectJudgment(
                            item.linkedJudgmentId ||
                              item.linkedCitation?.toLowerCase().replace(/\s+/g, "-") ||
                              String(item.id)
                          );
                        }
                      }}
                      className="p-3.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#105B38] hover:shadow-xs transition-all cursor-pointer space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-[#0F172A]">
                          {item.linkedCitation || item.citationText}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
                            treatmentBadge(item.citationType).bg
                          )}
                        >
                          {treatmentBadge(item.citationType).label}
                        </span>
                      </div>
                      {item.linkedTitle && (
                        <p className="text-[11px] text-[#475569] font-medium line-clamp-1">{item.linkedTitle}</p>
                      )}
                      {item.contextExcerpt && (
                        <p className="text-[11px] text-[#64748B] italic line-clamp-2">&quot;{item.contextExcerpt}&quot;</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
