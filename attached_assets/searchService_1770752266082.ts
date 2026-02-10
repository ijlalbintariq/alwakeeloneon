
import { Statute, CaseLaw } from '../types';
import { LOCAL_STATUTES, LOCAL_CASE_LAW } from '../legalDatabase';

export interface SearchResult<T> {
  item: T;
  score: number;
}

class LegalSearchService {
  private statuteIndex: string[] = [];
  private caseLawIndex: string[] = [];

  constructor() {
    this.reindex();
  }

  reindex() {
    this.statuteIndex = LOCAL_STATUTES.map(s => 
      `${s.shortTitle} ${s.section} ${s.description} ${s.punishment}`.toLowerCase()
    );
    this.caseLawIndex = LOCAL_CASE_LAW.map(c => 
      `${c.citation} ${c.court} ${c.title} ${c.summary} ${c.keywords.join(' ')}`.toLowerCase()
    );
  }

  searchStatutes(query: string): Statute[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) return [];

    const scored = LOCAL_STATUTES.map((item, idx) => {
      let score = 0;
      const text = this.statuteIndex[idx];
      
      tokens.forEach(token => {
        // Section matches are highest priority
        if (item.section.toLowerCase() === token) score += 100;
        else if (item.section.toLowerCase().includes(token)) score += 40;
        
        // Title matches
        if (item.shortTitle.toLowerCase().includes(token)) score += 20;
        
        // Content matches
        if (text.includes(token)) score += 10;
        
        // Phrase match
        if (query.length > 3 && text.includes(query.toLowerCase())) score += 50;
      });

      return { item, score };
    });

    return scored
      .filter(res => res.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(res => res.item);
  }

  searchCaseLaw(query: string): CaseLaw[] {
    const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    if (tokens.length === 0) return [];

    const scored = LOCAL_CASE_LAW.map((item, idx) => {
      let score = 0;
      const text = this.caseLawIndex[idx];
      
      tokens.forEach(token => {
        // Citation matches are highest priority
        if (item.citation.toLowerCase().includes(token)) score += 100;
        
        // Keyword matches
        if (item.keywords.some(k => k.toLowerCase() === token)) score += 60;
        else if (item.keywords.some(k => k.toLowerCase().includes(token))) score += 30;
        
        // Title matches
        if (item.title.toLowerCase().includes(token)) score += 40;
        
        // Summary match
        if (text.includes(token)) score += 10;

        // Exact phrase bonus
        if (query.length > 3 && text.includes(query.toLowerCase())) score += 50;
      });

      return { item, score };
    });

    return scored
      .filter(res => res.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(res => res.item);
  }
}

export const searchService = new LegalSearchService();
