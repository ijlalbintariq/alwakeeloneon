
import { IngestedDocument } from '../types';

export interface DocumentChunk {
  id: string;
  docId: string;
  docName: string;
  content: string;
  timestamp: number;
  hash: string;
}

const DB_NAME = 'AlWakeeloKB_V2';
const DB_VERSION = 1;
const CHUNK_SIZE = 1200;
const OVERLAP = 150;
const CONCURRENCY_LIMIT = 5;

class KnowledgeBaseService {
  private db: IDBDatabase | null = null;

  async init() {
    if (this.db) return;
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject("Failed to open Knowledge Base DB");
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('chunks')) {
          const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
          chunkStore.createIndex('docId', 'docId', { unique: false });
          chunkStore.createIndex('hash', 'hash', { unique: false });
        }
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('hash', 'hash', { unique: true });
        }
      };
    });
  }

  private async calculateHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Changed to public to allow usage in App.tsx for file attachment processing
  public async parsePdf(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(" ");
        fullText += `[Page ${i}] ${pageText}\n`;
      }
      return fullText;
    } catch (e) {
      throw new Error(`PDF Parse Error: ${file.name}`);
    }
  }

  // Changed to public to allow usage in App.tsx for file attachment processing
  public async parseDocx(file: File): Promise<string> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await (window as any).mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (e) {
      throw new Error(`DOCX Parse Error: ${file.name}`);
    }
  }

  private chunkText(text: string): string[] {
    const chunks = [];
    let start = 0;
    const cleanText = text.replace(/\s+/g, ' ').trim();
    while (start < cleanText.length) {
      const end = Math.min(start + CHUNK_SIZE, cleanText.length);
      chunks.push(cleanText.slice(start, end));
      start += CHUNK_SIZE - OVERLAP;
    }
    return chunks;
  }

  async ingest(file: File): Promise<void> {
    await this.init();
    const hash = await this.calculateHash(file);

    // Check for duplicate
    const existingDocs = await this.getAllDocuments();
    if (existingDocs.some(d => d.hash === hash)) {
      throw new Error(`Document "${file.name}" already exists in the vault.`);
    }

    let text = "";
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith('.pdf')) {
      text = await this.parsePdf(file);
    } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.toLowerCase().endsWith('.docx')) {
      text = await this.parseDocx(file);
    } else {
      text = await file.text();
    }

    if (!text || !text.trim()) throw new Error("File appears empty.");

    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const chunks = this.chunkText(text);
    
    const docMeta: IngestedDocument = {
      id: docId,
      name: file.name,
      type: file.name.split('.').pop()?.toUpperCase() || 'TXT',
      size: file.size,
      uploadedAt: new Date(),
      chunkCount: chunks.length,
      hash,
      content: text // Store full content for preview
    };

    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not initialized");
      const transaction = this.db.transaction(['documents', 'chunks'], 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      transaction.objectStore('documents').add(docMeta);
      const chunkStore = transaction.objectStore('chunks');
      chunks.forEach((chunk, index) => {
        chunkStore.add({
          id: `${docId}_${index}`,
          docId,
          docName: file.name,
          content: chunk,
          timestamp: Date.now(),
          hash
        });
      });
    });
  }

  async ingestBatch(files: FileList, onProgress: (msg: string) => void): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;
    const fileArray = Array.from(files);

    for (let i = 0; i < fileArray.length; i += CONCURRENCY_LIMIT) {
      const batch = fileArray.slice(i, i + CONCURRENCY_LIMIT);
      await Promise.all(batch.map(async (file) => {
        try {
          onProgress(`Processing ${success + failed + 1}/${fileArray.length}: ${file.name}`);
          await this.ingest(file);
          success++;
        } catch (err) {
          console.warn(err);
          failed++;
        }
      }));
    }
    return { success, failed };
  }

  async getAllDocuments(): Promise<IngestedDocument[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not initialized");
      const transaction = this.db.transaction('documents', 'readonly');
      const store = transaction.objectStore('documents');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDocument(docId: string): Promise<IngestedDocument | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not initialized");
      const transaction = this.db.transaction('documents', 'readonly');
      const store = transaction.objectStore('documents');
      const request = store.get(docId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDocument(docId: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("Database not initialized");
      const transaction = this.db.transaction(['documents', 'chunks'], 'readwrite');
      transaction.objectStore('documents').delete(docId);
      const chunkStore = transaction.objectStore('chunks');
      const index = chunkStore.index('docId');
      const request = index.openCursor(IDBKeyRange.only(docId));
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async search(query: string, limit: number = 6): Promise<string> {
    await this.init();
    if (!query.trim() || !this.db) return "";

    return new Promise((resolve) => {
      const transaction = this.db!.transaction('chunks', 'readonly');
      const store = transaction.objectStore('chunks');
      const request = store.getAll();

      request.onsuccess = () => {
        const allChunks: DocumentChunk[] = request.result;
        const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        
        const scoredChunks = allChunks.map(chunk => {
          let score = 0;
          const content = chunk.content.toLowerCase();
          queryTerms.forEach(term => {
            if (content.includes(term)) score += 5;
            const termRegex = new RegExp(`\\b${term}\\b`, 'g');
            const matches = content.match(termRegex);
            if (matches) score += matches.length * 10;
          });
          if (content.includes(query.toLowerCase())) score += 50;
          return { ...chunk, score };
        });

        const topChunks = scoredChunks
          .filter(c => c.score > 10)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

        if (topChunks.length === 0) return resolve("");
        
        const context = topChunks.map(c => 
          `[Source: Internal Knowledge Vault | File: ${c.docName}]\n${c.content}\n`
        ).join("\n---\n");
        
        resolve(context);
      };
    });
  }
}

export const knowledgeBase = new KnowledgeBaseService();
