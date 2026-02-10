
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AL_WAKEELO_SYSTEM_PROMPT, AL_WAKEELO_GITHUB_URL } from "../constants";
import { Message, SearchSource, TokenUsage, CaseLaw, Statute } from "../types";
import { knowledgeBase } from "./knowledgeBase";

export interface Attachment {
  data?: string;
  mimeType: string;
  name?: string;
  textData?: string;
}

export interface GeminiResponse {
  text: string;
  sources?: SearchSource[];
  usage?: TokenUsage;
  isQuotaError?: boolean;
}

export interface EnhancedCaseLaw extends CaseLaw {
  uri?: string;
}

export interface EnhancedStatute extends Statute {
  uri?: string;
  keywords?: string[];
  source?: 'internal' | 'external';
}

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Helper to wrap API calls with exponential backoff for 429/Quota errors.
   */
  private async withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      const isQuota = error?.message?.toLowerCase().includes('quota') || 
                      error?.message?.includes('429') ||
                      error?.status === 429;
                      
      if (retries > 0 && isQuota) {
        console.warn(`Al Wakeelo: Quota hit. Retrying in ${delay}ms... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.withRetry(fn, retries - 1, delay * 2);
      }
      throw error;
    }
  }

  async generateResponse(
    history: Message[], 
    model: string = 'gemini-3-flash-preview',
    attachments?: Attachment[]
  ): Promise<GeminiResponse> {
    return this.withRetry(async () => {
      try {
        const ai = this.getAI();
        const contents: any[] = history.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

        const lastMessage = history[history.length - 1];
        if (lastMessage.role === 'user') {
          const context = await knowledgeBase.search(lastMessage.content);
          const lastIndex = contents.length - 1;
          
          let contextInstruction = `\n\n=== SOURCE HIERARCHY & PRIORITY INSTRUCTIONS ===\n`;
          contextInstruction += `1. [STRICT PRIORITY] SEARCH INTERNAL CHAMBERS KNOWLEDGE BASE BELOW.\n`;
          contextInstruction += `2. ONLY if the answer is missing from the vault, use Google Search for: ${AL_WAKEELO_GITHUB_URL}.\n`;
          contextInstruction += `3. Cite internal sources as "Internal Knowledge Vault".\n`;

          if (context) {
            contents[lastIndex].parts[0].text = `${contextInstruction}\n\n=== INTERNAL CHAMBERS KNOWLEDGE BASE ===\n${context}\n\n=== USER QUERY ===\n${lastMessage.content}`;
          } else {
            contents[lastIndex].parts[0].text = `${contextInstruction}\n\n${lastMessage.content}`;
          }
        }

        if (attachments && attachments.length > 0) {
          const lastIndex = contents.length - 1;
          attachments.forEach(attachment => {
            if (attachment.textData) {
              contents[lastIndex].parts.push({ text: `\n\n[FILE: ${attachment.name}]\n${attachment.textData}` });
            } else if (attachment.data) {
              contents[lastIndex].parts.push({ inlineData: { data: attachment.data, mimeType: attachment.mimeType } });
            }
          });
        }

        const config: any = {
          systemInstruction: AL_WAKEELO_SYSTEM_PROMPT,
          tools: [{ googleSearch: {} }],
          temperature: 0.6,
        };

        if (model.includes('gemini-3')) {
          config.maxOutputTokens = 8000; 
          config.thinkingConfig = { thinkingBudget: 4000 };
        }

        const response = await ai.models.generateContent({ model, contents, config });
        const text = response.text || "";
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const sources: SearchSource[] = groundingChunks ? groundingChunks
          .map((chunk: any) => chunk.web ? { title: chunk.web.title || 'Legal Resource', uri: chunk.web.uri } : null)
          .filter((s: any): s is SearchSource => !!s) : [];

        const usage = response.usageMetadata ? {
          promptTokens: response.usageMetadata.promptTokenCount,
          responseTokens: response.usageMetadata.candidatesTokenCount,
          totalTokens: response.usageMetadata.totalTokenCount
        } : undefined;

        return { text, sources, usage };
      } catch (error: any) {
        if (error?.message?.toLowerCase().includes('quota') || error?.status === 429) {
          return {
            text: "Al Wakeelo is currently overwhelmed with high-stakes cases (API Quota Exceeded). Please allow the Chambers a few minutes to clear the docket before trying again.",
            isQuotaError: true
          };
        }
        throw error;
      }
    });
  }

  async searchLegalJudgments(query: string): Promise<EnhancedCaseLaw[]> {
    return this.withRetry(async () => {
      try {
        const prompt = `You are Al Wakeelo's Research Engine. Use Google Search to find detailed Pakistani Case Law/Judgments for the following query: "${query}".
        
        REQUIREMENTS:
        1. Find judgments from official sources like PLD, SCMR, YLR, MLD, etc.
        2. For each judgment, provide structured data including citation, court, title, summary, keywords, and uri.
        
        Format the output as a JSON array of objects.`;

        const ai = this.getAI();
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  citation: { type: Type.STRING },
                  court: { type: Type.STRING },
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  uri: { type: Type.STRING }
                },
                required: ["citation", "court", "title", "summary", "keywords"]
              }
            }
          }
        });

        return JSON.parse(response.text || "[]");
      } catch (e) {
        console.error("AI Judgment Search Failed:", e);
        return [];
      }
    });
  }

  async searchLegalStatutes(query: string): Promise<EnhancedStatute[]> {
    return this.withRetry(async () => {
      try {
        const prompt = `You are Al Wakeelo's Statutory Research Engine. Use Google Search to find specific Sections, Acts, or Amendments in Pakistani Law for the following query: "${query}".
        
        REQUIREMENTS:
        1. Search for specific sections of the PPC, CrPC, CPC, or specialized Pakistani Acts.
        2. For each statute/section, provide:
           - shortTitle: Name of the Act.
           - section: Specific section number.
           - description: Technical legal description.
           - punishment: Specific penalty or remedy.
           - uri: Direct link to Gazette or official portal.
           - keywords: 3-5 tags.
        
        Format the output as a JSON array of objects.`;

        const ai = this.getAI();
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            tools: [{ googleSearch: {} }],
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  shortTitle: { type: Type.STRING },
                  section: { type: Type.STRING },
                  description: { type: Type.STRING },
                  punishment: { type: Type.STRING },
                  uri: { type: Type.STRING },
                  keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["shortTitle", "section", "description", "punishment"]
              }
            }
          }
        });

        return JSON.parse(response.text || "[]");
      } catch (e) {
        console.error("AI Statute Search Failed:", e);
        return [];
      }
    });
  }

  async summarizeStatuteFindings(query: string, findings: EnhancedStatute[]): Promise<string> {
    return this.withRetry(async () => {
      try {
        const data = findings.slice(0, 5).map(f => `${f.shortTitle} Section ${f.section}: ${f.description}`).join('\n');
        const prompt = `A user searched for "${query}". Here are the findings:\n${data}\n\nSummarize these Pakistani legal findings into a concise, 2-3 sentence "Advocate's Take". Use a professional, strategic tone. Focus on the core legal remedy or liability.`;
        
        const response = await this.getAI().models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: prompt }] }]
        });
        return response.text || "";
      } catch (e) { return "Al Wakeelo's summary engine is currently throttled due to high traffic."; }
    });
  }

  async generateStatuteBrief(statute: EnhancedStatute): Promise<string> {
    return this.withRetry(async () => {
      try {
        const prompt = `Provide a detailed "Chambers Briefing" for ${statute.shortTitle} Section ${statute.section} (${statute.description}).
        
        STRUCTURE:
        1. Legal Context: Why this exists in Pakistani Law.
        2. The Strategic Move: How an advocate uses this in court.
        3. Procedural Checklist: What is required to invoke this section.
        4. Cross-References: Relevant sections of CrPC, CPC, or Constitution.
        
        TONE: Professional, sophisticated, high-density legal prose. Font style: Bookman Old Style 12 (implicit in formatting).`;

        const ai = this.getAI();
        const response = await ai.models.generateContent({
          model: "gemini-3-pro-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: { tools: [{ googleSearch: {} }] }
        });
        return response.text || "";
      } catch (e) { return "Strategic brief generation failed due to server limitations. Please retry later."; }
    });
  }

  async getSearchSuggestions(query: string, type: 'judgment' | 'statute'): Promise<string[]> {
    return this.withRetry(async () => {
      try {
        const prompt = `You are Al Wakeelo's Search Intelligence. A user is searching the Pakistani ${type} registry for: "${query || 'General Legal Topics'}". Suggest 6 technical, refined legal search terms.
        Return EXACTLY a JSON string array of 6 strings.`;
        
        const response = await this.getAI().models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        });
        return JSON.parse(response.text || "[]");
      } catch (e) { return []; }
    });
  }

  async getContractSuggestions(type: string): Promise<string[]> {
    return this.withRetry(async () => {
      try {
        const prompt = `You are Al Wakeelo's Contract Strategist. Suggest 6 "Airtight Clauses" for a "${type}" agreement in Pakistan.
        Return EXACTLY a JSON string array of 6 strings.`;
        
        const response = await this.getAI().models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        });
        return JSON.parse(response.text || "[]");
      } catch (e) { return []; }
    });
  }
}

export const gemini = new GeminiService();
