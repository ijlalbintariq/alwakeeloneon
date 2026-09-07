import { QueryClient, QueryFunction } from "@tanstack/react-query";

export class AppError extends Error {
  status: number;
  data?: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.data = data;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText;
    let parsedData = null;
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json") || contentType.includes("application/problem+json")) {
      parsedData = await res.json().catch(() => null);
      if (parsedData && typeof parsedData.message === "string") {
        message = parsedData.message;
      } else if (parsedData && typeof parsedData.detail === "string") {
        message = parsedData.detail;
      } else if (parsedData) {
        message = JSON.stringify(parsedData);
      }
    } else {
      const text = await res.text().catch(() => "");
      if (text) {
        try {
          parsedData = JSON.parse(text);
          if (parsedData && typeof parsedData.message === "string") {
            message = parsedData.message;
          } else if (parsedData && typeof parsedData.detail === "string") {
            message = parsedData.detail;
          } else {
            message = text;
          }
        } catch {
          message = text;
        }
      }
    }

    throw new AppError(message, res.status, parsedData);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const upperMethod = method.toUpperCase();
  const res = await fetch(url, {
    method,
    cache: upperMethod === "GET" ? "no-store" : undefined,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      cache: "no-store",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
