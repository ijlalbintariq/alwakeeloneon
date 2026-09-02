import React, { useRef, useEffect, useCallback } from "react";
import {
  Send,
  Square,
  Paperclip,
  Mic,
  MicOff,
  FolderOpen,
  X,
  FileText,
  File,
  Image as ImageIcon,
  Sparkles,
  Database,
  Radio,
  Loader2,
  CornerDownLeft,
} from "lucide-react";
import { formatDuration } from "@/hooks/use-voice-recorder";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  input: string;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  attachedFiles: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  ragEnabled: boolean;
  onToggleRag: () => void;
  selectedCaseFileId: number | null;
  onSelectCaseFile: (id: number | null) => void;
  caseFiles?: Array<{ id: number; title: string }>;
  isVoiceRecording: boolean;
  isVoiceTranscribing: boolean;
  voiceDuration: number;
  onStartVoiceRecording: () => void;
  onStopVoiceRecording: () => void;
  onCancelVoiceRecording: () => void;
  disabled?: boolean;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  input,
  onInputChange,
  onSend,
  onStop,
  isLoading,
  attachedFiles,
  onAddFiles,
  onRemoveFile,
  ragEnabled,
  onToggleRag,
  selectedCaseFileId,
  onSelectCaseFile,
  caseFiles = [],
  isVoiceRecording,
  isVoiceTranscribing,
  voiceDuration,
  onStartVoiceRecording,
  onStopVoiceRecording,
  onCancelVoiceRecording,
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const autoResizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 160;
    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${Math.max(nextHeight, 48)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    autoResizeTextarea();
  }, [input, autoResizeTextarea]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((input.trim() || attachedFiles.length > 0) && !isLoading) {
        onSend();
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const list: File[] = [];
    for (let i = 0; i < files.length; i++) {
      list.push(files[i]);
    }
    onAddFiles(list);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText className="w-4 h-4 text-rose-600" />;
    if (ext === "doc" || ext === "docx") return <FileText className="w-4 h-4 text-blue-600" />;
    if (ext === "jpg" || ext === "jpeg" || ext === "png") return <ImageIcon className="w-4 h-4 text-emerald-600" />;
    return <File className="w-4 h-4 text-[#64748B]" />;
  };

  return (
    <div className="px-4 py-3 bg-white border-t border-[#E2E8F0] relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
        className="hidden"
      />

      <div className="max-w-4xl mx-auto space-y-2">
        {/* Top bar controls: Integrated Knowledge Vault RAG & Case File Scoper */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Knowledge Vault RAG Toggle */}
            <button
              type="button"
              onClick={onToggleRag}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all border shadow-xs",
                ragEnabled
                  ? "bg-emerald-50 border-emerald-200 text-[#105B38]"
                  : "bg-[#F8FAFC] border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9]"
              )}
              title="Toggle Knowledge Vault (RAG grounding with Pakistani Statutes & Precedents)"
            >
              <Database className={cn("w-3.5 h-3.5", ragEnabled ? "text-[#105B38]" : "text-[#64748B]")} />
              <span>Knowledge Vault</span>
              {ragEnabled && (
                <span className="w-2 h-2 rounded-full bg-[#105B38] animate-pulse" />
              )}
            </button>

            {/* Case File Selector */}
            {ragEnabled && caseFiles.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <FolderOpen className="w-3.5 h-3.5 text-[#64748B]" />
                <select
                  value={selectedCaseFileId ?? ""}
                  onChange={(e) => onSelectCaseFile(e.target.value ? Number(e.target.value) : null)}
                  className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#105B38]"
                >
                  <option value="">All Vault Documents</option>
                  {caseFiles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#64748B] font-mono">
            <span>Press</span>
            <kbd className="px-2 py-0.5 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-semibold text-xs">
              Enter ↵
            </kbd>
            <span>to send</span>
          </div>
        </div>

        {/* Attached Files Strip */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 pb-1">
            {attachedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#0F172A] group shadow-xs"
              >
                {getFileIcon(file.name)}
                <span className="max-w-[160px] truncate font-medium">{file.name}</span>
                <span className="text-xs text-[#64748B]">
                  ({(file.size / 1024).toFixed(0)} KB)
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveFile(idx)}
                  className="p-1 rounded-lg text-[#64748B] hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Voice Recording Active State */}
        {isVoiceRecording && (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-[#105B38]/30 shadow-xs text-[#0F172A] animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping absolute" />
                <span className="w-3 h-3 rounded-full bg-rose-600 relative" />
              </div>
              <div>
                <div className="text-xs font-bold text-[#0F172A] flex items-center gap-1.5 font-mono">
                  <Radio className="w-3.5 h-3.5 animate-pulse text-[#105B38]" />
                  Recording Audio for Whisper Transcription
                </div>
                <div className="text-xs text-[#64748B] mt-0.5">
                  Speak clearly in English or Urdu...
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-mono text-xs font-bold">
                {formatDuration(voiceDuration)}
              </span>
              <button
                type="button"
                onClick={onCancelVoiceRecording}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onStopVoiceRecording}
                className="px-4 py-1.5 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white text-xs font-bold transition-colors shadow-xs"
              >
                Done & Transcribe
              </button>
            </div>
          </div>
        )}

        {/* Voice Transcribing State */}
        {isVoiceTranscribing && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] shadow-xs text-[#0F172A] text-xs animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-[#105B38]" />
            <span className="font-semibold">Transcribing audio with Whisper AI model...</span>
          </div>
        )}

        {/* Main Textarea & Actions Container with Generous Padding */}
        <div className="relative flex items-end gap-2 p-3 rounded-2xl bg-white border border-[#E2E8F0] focus-within:border-[#105B38] focus-within:ring-2 focus-within:ring-[#105B38]/20 transition-all shadow-xs w-full">
          {/* File Attachment Action Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors shrink-0 mb-0.5"
            title="Attach documents, case briefs or screenshots"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Voice Dictation Action Button */}
          <button
            type="button"
            onClick={isVoiceRecording ? onStopVoiceRecording : onStartVoiceRecording}
            className={cn(
              "p-2.5 rounded-xl transition-colors shrink-0 mb-0.5",
              isVoiceRecording
                ? "bg-rose-50 text-rose-600 border border-rose-200 animate-pulse"
                : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
            )}
            title={isVoiceRecording ? "Stop Recording" : "Voice Dictation (Urdu / English)"}
          >
            {isVoiceRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Main Legal Prompt Text Area */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            placeholder="Ask about Pakistani statutes, landmark judgments, bail under CrPC, CPC writs, or drafting..."
            className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none resize-none min-h-[48px] max-h-[160px] leading-relaxed custom-scrollbar font-normal"
            rows={1}
          />

          {/* Send / Stop Action Button */}
          {isLoading ? (
            <button
              type="button"
              onClick={onStop}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs shrink-0 mb-0.5"
              title="Stop Generating"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={(!input.trim() && attachedFiles.length === 0) || disabled}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white transition-all shadow-xs shrink-0 disabled:opacity-40 disabled:cursor-not-allowed mb-0.5"
              title="Send Legal Query"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatComposer;
