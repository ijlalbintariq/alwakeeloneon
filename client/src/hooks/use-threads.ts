import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertThread, type Message, type Thread } from "@shared/schema";

// Types derived from schema/api
type ThreadResponse = Thread;
type ThreadDetailResponse = { thread: Thread; messages: Message[] };
type CreateThreadInput = { title?: string; firstMessage: string };

export function useThreads() {
  return useQuery({
    queryKey: [api.threads.list.path],
    queryFn: async () => {
      const res = await fetch(api.threads.list.path, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 401) return null; // Handled by auth check usually
        throw new Error("Failed to fetch threads");
      }
      return api.threads.list.responses[200].parse(await res.json());
    },
  });
}

export function useThread(id: number | null) {
  return useQuery({
    queryKey: [api.threads.get.path, id],
    enabled: !!id,
    queryFn: async () => {
      if (!id) throw new Error("Thread ID required");
      const url = buildUrl(api.threads.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Failed to fetch thread details");
      }
      return api.threads.get.responses[200].parse(await res.json());
    },
  });
}

export function useCreateThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateThreadInput) => {
      const res = await fetch(api.threads.create.path, {
        method: api.threads.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create thread");
      return api.threads.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.threads.list.path] });
    },
  });
}

export function useDeleteThread() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.threads.delete.path, { id });
      const res = await fetch(url, {
        method: api.threads.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete thread");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.threads.list.path] });
    },
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ threadId, message }: { threadId: number; message: string }) => {
      const url = buildUrl(api.messages.create.path, { threadId });
      const res = await fetch(url, {
        method: api.messages.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send message");
      return api.messages.create.responses[201].parse(await res.json());
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.threads.get.path, variables.threadId] });
      // Optimistically we might update the cache here too, but simple invalidation is safer for now
    },
  });
}
