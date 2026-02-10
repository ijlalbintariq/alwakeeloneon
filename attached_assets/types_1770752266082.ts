
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  isPro: boolean;
  status?: 'active' | 'banned';
  joinedDate?: Date;
  password?: string;
}

export interface SearchSource {
  title: string;
  uri: string;
}

export interface TokenUsage {
  promptTokens: number;
  responseTokens: number;
  totalTokens: number;
}

export interface IngestedDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: Date;
  chunkCount: number;
  hash: string;
  content?: string; // Full extracted content for preview
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: SearchSource[];
  tokenUsage?: TokenUsage;
}

export interface BookmarkItem {
  id: string;
  title: string;
  content: string;
  timestamp: Date;
  type: 'al-wakeelo' | 'draft' | 'contract';
  category: string;
  caseName?: string;
}

export interface ChatSession {
  id: string;
  type: 'al-wakeelo' | 'draft' | 'contract';
  messages: Message[];
  lastUpdated: Date;
}

export interface HistoryItem {
  id: string;
  type: 'judgment' | 'statute' | 'chat' | 'draft' | 'contract';
  query: string;
  timestamp: Date;
}

// Added Statute interface for local database support
export interface Statute {
  shortTitle: string;
  section: string;
  description: string;
  punishment: string;
}

// Added CaseLaw interface for local database support
export interface CaseLaw {
  citation: string;
  court: string;
  title: string;
  summary: string;
  keywords: string[];
}

export type AppTab = 
  | 'dashboard'
  | 'judgment-search' 
  | 'statute-search' 
  | 'al-wakeelo' 
  | 'draft' 
  | 'contract-drafting'
  | 'case-documents'
  | 'bookmarks' 
  | 'history'
  | 'database';
