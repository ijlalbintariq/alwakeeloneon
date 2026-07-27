// User object — matches the actual safeUser response from the backend
export interface User {
  id: string;                    // UUID, NOT number
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  profileImageUrl: string | null;
  authProvider: string;          // "email" or "google"
  subscriptionTier: string;      // "free", "pro", "enterprise"
  subscriptionCycle: string;
  emailVerified: boolean;
  isAdmin: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
}

// Case law result — matches actual DB fields
export interface CaseLawResult {
  id: number;
  title: string;                 // NOT caseTitle
  citation: string;
  summary: string;               // NOT headnote
  source: string;
  sourceType: string;
  citationYear: number | null;
  citationReport: string | null; // journal code
  citationPage: string | null;
  court: string | null;
}

// Statute result
export interface StatuteResult {
  id: number;
  title: string;
  content: string;
  category: string | null;
}

// Chat message for local state
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Contract template
export interface ContractTemplate {
  id: string;
  name: string;
  description: string;
}

// Usage info
export interface UsageInfo {
  tier: string;
  tierLabel: string;
  used: number;
  remaining: number;
  monthlyLimit: number;
  percentage: number;
  isAtLimit: boolean;
}

export type StreamChunk = 
  | { type: 'text'; text: string }
  | { type: 'status'; searching?: boolean; query?: string; found?: number }
  | { type: 'thinking' }
  | { type: 'done'; model?: string };

// In dev: webpack proxy handles /api/* → http://localhost:5001 (same-origin, no CORS)
// In prod: direct to alwakeelo.com
const API_BASE = process.env.NODE_ENV === 'production' 
  ? 'https://www.alwakeelo.com' 
  : '';

export async function login(email: string, password: string): Promise<User> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    let message = 'Login failed';
    try {
      const err = await res.json();
      if (err && err.message) {
        message = err.message;
      }
    } catch (e) {
      // Ignore JSON parse error
    }
    throw new Error(message);
  }

  return res.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });
}

export async function getUser(): Promise<User | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/user`, {
      method: 'GET',
      credentials: 'include'
    });
    
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (error) {
    return null;
  }
}

export async function searchCaseLaw(query: string, filters?: { year?: number; court?: string; report?: string }): Promise<CaseLawResult[]> {
  const params = new URLSearchParams();
  params.append('q', query);
  params.append('limit', '25');
  
  if (filters) {
    if (filters.year) params.append('year', filters.year.toString());
    if (filters.court) params.append('court', filters.court);
    if (filters.report) params.append('report', filters.report);
  }

  const res = await fetch(`${API_BASE}/api/case-law/search?${params.toString()}`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch case law');
  }

  return res.json();
}

export async function searchStatutes(query: string): Promise<StatuteResult[]> {
  const params = new URLSearchParams();
  params.append('q', query);

  const res = await fetch(`${API_BASE}/api/statutes/search?${params.toString()}`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch statutes');
  }

  return res.json();
}

export async function searchCitations(year: number, journal: string, page: string | number): Promise<CaseLawResult[]> {
  const params = new URLSearchParams();
  params.append('year', year.toString());
  params.append('journal', journal);
  params.append('page', page.toString());

  const res = await fetch(`${API_BASE}/api/citation-search?${params.toString()}`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch citations');
  }

  return res.json();
}

export async function* streamAIChat(
  userMessage: string, 
  moduleType: string = 'al-wakeelo'
): AsyncGenerator<StreamChunk> {
  const res = await fetch(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      messages: [{ role: 'user', content: userMessage }],
      type: moduleType,
      stream: true
    })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'AI request failed' }));
    throw new Error(err.message || 'AI request failed');
  }
  
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      
      const jsonStr = trimmed.slice(6);
      if (jsonStr === '[DONE]') return;
      
      try {
        const data = JSON.parse(jsonStr);
        if (data.done) {
          yield { type: 'done', model: data.model };
          return;
        } else if (data.text) {
          yield { type: 'text', text: data.text };
        } else if (data.searching !== undefined) {
          yield { type: 'status', searching: data.searching, query: data.query, found: data.found };
        } else if (data.thinking) {
          yield { type: 'thinking' };
        }
      } catch {
        // Skip unparseable lines
      }
    }
  }
}

export async function getUsage(): Promise<UsageInfo> {
  const res = await fetch(`${API_BASE}/api/usage`, {
    method: 'GET',
    credentials: 'include'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch usage information');
  }

  return res.json();
}

export async function getLawJournals(): Promise<{ id: number; code: string; name: string }[]> {
  try {
    const res = await fetch(`${API_BASE}/api/journals`, {
      method: 'GET',
      credentials: 'include'
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export function getContractTemplates(): ContractTemplate[] {
  return [
    { id: '1', name: 'Non-Disclosure Agreement', description: 'Standard mutual NDA' },
    { id: '2', name: 'Employment Contract', description: 'Standard employment agreement' },
    { id: '3', name: 'Service Agreement', description: 'General service level agreement' }
  ];
}
