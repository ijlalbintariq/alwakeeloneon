import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  StickyNote,
  Plus,
  Trash2,
  Clock,
  User,
  Loader2,
  Sparkles,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export interface CaseNote {
  id: number;
  caseId: number;
  userId: string;
  content: string;
  createdAt: string;
}

interface CaseNotesManagerProps {
  caseId: number;
  notes: CaseNote[];
}

export const CaseNotesManager: React.FC<CaseNotesManagerProps> = ({
  caseId,
  notes,
}) => {
  const { toast } = useToast();
  const [content, setContent] = useState<string>("");

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/case-files/${caseId}/notes`, {
        content: content.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({ title: "Chambers note recorded" });
      setContent("");
    },
    onError: (err: any) => {
      toast({
        title: "Failed to record note",
        description: err?.message || "Could not save strategy memo.",
        variant: "destructive",
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      return apiRequest("DELETE", `/api/case-files/${caseId}/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/case-files/${caseId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/case-files"] });
      toast({ title: "Note removed" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to delete note",
        description: err?.message || "Could not remove note.",
        variant: "destructive",
      });
    },
  });

  const sortedNotes = [...notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-4">
      {/* Add Note Form */}
      <div className="p-4 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-[#105B38]" />
          <span>Record Chambers Strategy & Client Conference Memo</span>
        </h3>

        <textarea
          placeholder="Enter detailed trial notes, client instructions, bench strategy, or statutory citations to rely upon..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#105B38] focus:bg-white resize-none leading-relaxed transition-all"
        />

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => addNoteMutation.mutate()}
            disabled={!content.trim() || addNoteMutation.isPending}
            className="px-4 py-2 rounded-xl bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold text-xs transition-colors shadow-xs disabled:opacity-50 flex items-center gap-1.5"
          >
            {addNoteMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>Add Note</span>
          </button>
        </div>
      </div>

      {/* Notes List */}
      {sortedNotes.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-center space-y-2">
          <StickyNote className="w-8 h-8 text-[#94A3B8] mx-auto" />
          <p className="text-xs font-bold text-[#0F172A]">
            No chambers notes recorded for this matter yet.
          </p>
          <p className="text-xs text-[#64748B]">
            Document key arguments, conference notes, and internal instructions above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedNotes.map((note) => (
            <div
              key={note.id}
              className="p-4 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#105B38]/40 hover:shadow-xs transition-all space-y-2 flex flex-col justify-between"
            >
              <p className="text-xs sm:text-sm text-[#334155] whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>

              <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0] text-xs text-[#64748B] font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#105B38]" />
                  {new Date(note.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>

                <button
                  type="button"
                  onClick={() => deleteNoteMutation.mutate(note.id)}
                  disabled={deleteNoteMutation.isPending}
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Remove note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CaseNotesManager;
