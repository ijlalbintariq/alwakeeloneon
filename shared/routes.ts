
import { z } from 'zod';
import { insertThreadSchema, insertMessageSchema, insertDocumentSchema, insertBookmarkSchema, insertSearchHistorySchema, threads, messages, documents } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  threads: {
    list: {
      method: 'GET' as const,
      path: '/api/threads' as const,
      responses: {
        200: z.array(z.custom<typeof threads.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/threads' as const,
      input: z.object({
        title: z.string().optional(),
        firstMessage: z.string(),
      }),
      responses: {
        201: z.custom<typeof threads.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/threads/:id' as const,
      responses: {
        200: z.object({
            thread: z.custom<typeof threads.$inferSelect>(),
            messages: z.array(z.custom<typeof messages.$inferSelect>()),
        }),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/threads/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
  },
  messages: {
    create: {
      method: 'POST' as const,
      path: '/api/threads/:threadId/messages' as const,
      input: z.object({
        message: z.string(),
      }),
      responses: {
        201: z.custom<typeof messages.$inferSelect>(),
        404: errorSchemas.notFound,
        401: errorSchemas.unauthorized,
      },
    },
  },
  documents: {
    list: {
      method: 'GET' as const,
      path: '/api/documents' as const,
      responses: {
        200: z.array(z.custom<typeof documents.$inferSelect>()),
        401: errorSchemas.unauthorized,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/documents' as const,
      input: insertDocumentSchema,
      responses: {
        201: z.custom<typeof documents.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/documents/:id' as const,
    },
  },
  bookmarks: {
    list: {
      method: 'GET' as const,
      path: '/api/bookmarks' as const,
    },
    create: {
      method: 'POST' as const,
      path: '/api/bookmarks' as const,
      input: insertBookmarkSchema.omit({ userId: true }),
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/bookmarks/:id' as const,
    },
  },
  searchHistory: {
    list: {
      method: 'GET' as const,
      path: '/api/search-history' as const,
    },
    create: {
      method: 'POST' as const,
      path: '/api/search-history' as const,
      input: insertSearchHistorySchema.omit({ userId: true }),
    },
  },
  statutes: {
    search: {
      method: 'GET' as const,
      path: '/api/statutes/search' as const,
    },
  },
  caseLaw: {
    search: {
      method: 'GET' as const,
      path: '/api/case-law/search' as const,
    },
  },
  usage: {
    get: {
      method: 'GET' as const,
      path: '/api/usage' as const,
    },
  },
  ai: {
    chat: {
      method: 'POST' as const,
      path: '/api/ai/chat' as const,
    },
    searchJudgments: {
      method: 'POST' as const,
      path: '/api/ai/search-judgments' as const,
    },
    searchStatutes: {
      method: 'POST' as const,
      path: '/api/ai/search-statutes' as const,
    },
    summarize: {
      method: 'POST' as const,
      path: '/api/ai/summarize' as const,
    },
    brief: {
      method: 'POST' as const,
      path: '/api/ai/brief' as const,
    },
    judgmentSummary: {
      method: 'POST' as const,
      path: '/api/ai/judgment-summary' as const,
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
