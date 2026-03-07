
import { z } from 'zod';
import { caseLeadStatusSchema, insertThreadSchema, insertMessageSchema, insertBookmarkSchema, insertSearchHistorySchema, threads, messages, documents, caseLeads } from './schema';

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
      input: z.object({
        title: z.string().min(1),
        content: z.string().optional(),
      }),
      responses: {
        201: z.custom<typeof documents.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/documents/:id' as const,
      input: z.object({
        title: z.string().optional(),
        content: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof documents.$inferSelect>(),
        401: errorSchemas.unauthorized,
        404: errorSchemas.notFound,
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
  citation: {
    journals: {
      method: 'GET' as const,
      path: '/api/journals' as const,
    },
    search: {
      method: 'GET' as const,
      path: '/api/citation-search' as const,
    },
    judgmentDetail: {
      method: 'GET' as const,
      path: '/api/judgments/:id' as const,
    },
    createJudgment: {
      method: 'POST' as const,
      path: '/api/judgments' as const,
    },
  },
  rag: {
    indexDocument: {
      method: 'POST' as const,
      path: '/api/rag/index-document' as const,
    },
    ask: {
      method: 'POST' as const,
      path: '/api/rag/ask' as const,
    },
    deleteVectors: {
      method: 'DELETE' as const,
      path: '/api/rag/documents/:documentId/vectors' as const,
    },
  },
  publicChat: {
    send: {
      method: "POST" as const,
      path: "/api/public-chat" as const,
      input: z.object({
        message: z.string().min(1),
      }),
    },
    submitCase: {
      method: "POST" as const,
      path: "/api/public-chat/submit-case" as const,
      input: z.object({
        name: z.string().min(1).max(120),
        phone: z.string().min(6).max(40),
        email: z.string().email().max(160),
        city: z.string().min(1).max(80),
        caseType: z.string().min(1).max(120),
        urgency: z.enum(["low", "normal", "high", "urgent"]).optional(),
        preferredCallbackTime: z.string().max(120).optional(),
        caseDescription: z.string().min(20).max(6000),
        consentToContact: z.literal(true),
        sessionId: z.string().min(8).max(120).optional(),
      }),
      responses: {
        201: z.custom<typeof caseLeads.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    event: {
      method: "POST" as const,
      path: "/api/public-chat/event" as const,
      input: z.object({
        eventType: z.enum(["widget_open", "message_sent", "lead_form_open", "lead_submitted", "contact_click"]),
        sessionId: z.string().min(8).max(120).optional(),
        metadata: z.record(z.any()).optional(),
      }),
    },
  },
  admin: {
    clientLeads: {
      list: {
        method: "GET" as const,
        path: "/api/admin/client-leads" as const,
      },
      get: {
        method: "GET" as const,
        path: "/api/admin/client-leads/:id" as const,
      },
      delete: {
        method: "DELETE" as const,
        path: "/api/admin/client-leads/:id" as const,
      },
      update: {
        method: "PATCH" as const,
        path: "/api/admin/client-leads/:id" as const,
        input: z.object({
          status: caseLeadStatusSchema,
        }),
      },
    },
  },
  styleMemory: {
    getSettings: {
      method: "GET" as const,
      path: "/api/style-memory/settings" as const,
    },
    updateSettings: {
      method: "PUT" as const,
      path: "/api/style-memory/settings" as const,
      input: z.object({
        module: z.enum(["legal-drafting", "contract-drafting"]),
        enabled: z.boolean().optional(),
        ownershipMode: z.enum(["user", "org", "user-org"]).optional(),
        strictness: z.enum(["strict", "balanced", "flexible"]).optional(),
      }),
    },
    uploadSamples: {
      method: "POST" as const,
      path: "/api/style-memory/samples/upload" as const,
    },
    listSamples: {
      method: "GET" as const,
      path: "/api/style-memory/samples" as const,
    },
    deleteSample: {
      method: "DELETE" as const,
      path: "/api/style-memory/samples/:id" as const,
    },
    acceptedRedline: {
      method: "POST" as const,
      path: "/api/style-memory/events/accepted-redline" as const,
      input: z.object({
        module: z.enum(["legal-drafting", "contract-drafting"]),
        draftId: z.union([z.number().int().positive(), z.string().min(1)]),
        acceptedText: z.string().min(10),
        beforeText: z.string().optional(),
      }),
    },
    backfill: {
      method: "POST" as const,
      path: "/api/style-memory/backfill" as const,
      input: z.object({
        module: z.enum(["legal-drafting", "contract-drafting"]),
        limit: z.number().int().min(1).max(200).optional(),
      }),
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
