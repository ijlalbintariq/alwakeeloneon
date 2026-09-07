import fs from 'fs';

const filePath = './client/src/experimental/pages/PreviewHistory.tsx';
let code = fs.readFileSync(filePath, 'utf-8');

// Add useMutation import
if (!code.includes('useMutation')) {
  code = code.replace(
    `import { useQuery } from "@tanstack/react-query";`,
    `import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";`
  );
  if (!code.includes('useQueryClient')) {
    code = code.replace(
      `import React, { useState, useEffect, useMemo } from "react";`,
      `import React, { useState, useEffect, useMemo } from "react";\nimport { useMutation, useQueryClient } from "@tanstack/react-query";\nimport { apiRequest } from "@/lib/queryClient";`
    );
  }
}

// Modify PreviewHistory component body
const hooksTarget = `  // Primary data source`;
const newHooks = `  const queryClient = useQueryClient();

  const clearHistoryMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/search-history");
    },
    onSuccess: () => {
      setHistoryList([]);
      setIsClearModalOpen(false);
      toast({
        title: "Search History Cleared",
        description: "All query logs and audit trails removed.",
      });
    }
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith("th-")) {
        const threadId = id.replace("th-", "");
        await apiRequest("DELETE", \`/api/threads/\${threadId}\`);
      } else if (id.startsWith("sh-")) {
        const historyId = id.replace("sh-", "");
        await apiRequest("DELETE", \`/api/search-history/\${historyId}\`);
      }
    },
    onSuccess: (_, id) => {
      setHistoryList((prev) => prev.filter((h) => h.id !== id));
      if (inspectEntry?.id === id) setInspectEntry(null);
      toast({ title: "Log Record Deleted" });
    }
  });

  // Primary data source`;

code = code.replace(hooksTarget, newHooks);

// Replace handleConfirmClearHistory
const handleClearTarget = `  // Clear all history
  const handleConfirmClearHistory = () => {
    setHistoryList([]);
    setIsClearModalOpen(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    toast({
      title: "Search History Cleared",
      description: "All local query logs and consultation audit trails removed.",
    });
  };`;

const handleClearNew = `  // Clear all history
  const handleConfirmClearHistory = () => {
    clearHistoryMutation.mutate();
  };`;

code = code.replace(handleClearTarget, handleClearNew);

// Replace handleDeleteEntry
const handleDeleteTarget = `  // Delete individual entry
  const handleDeleteEntry = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const entryToDelete = historyList.find((h) => h.id === id);
    if (!entryToDelete) return;

    if (id.startsWith("th-")) {
      const threadId = id.replace("th-", "");
      try {
        await fetch(\`/api/threads/\${threadId}\`, {
          method: "DELETE",
          credentials: "include",
        });
      } catch (err) {
        console.warn("Backend thread delete failed, proceeding with local deletion:", err);
      }
    }

    setHistoryList((prev) => prev.filter((h) => h.id !== id));
    if (inspectEntry?.id === id) setInspectEntry(null);

    toast({
      title: "Query Removed from Audit Log",
      description: "Log record deleted.",
      action: (
        <button
          onClick={() => {
            setHistoryList((prev) => [entryToDelete, ...prev]);
            toast({ title: "Log Entry Restored" });
          }}
          className="px-3 py-1 bg-white text-[#105B38] font-bold rounded-lg border border-emerald-200 text-xs shadow-xs"
        >
          Undo
        </button>
      ),
    });
  };`;

const handleDeleteNew = `  // Delete individual entry
  const handleDeleteEntry = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    deleteEntryMutation.mutate(id);
  };`;

code = code.replace(handleDeleteTarget, handleDeleteNew);

fs.writeFileSync(filePath, code);
