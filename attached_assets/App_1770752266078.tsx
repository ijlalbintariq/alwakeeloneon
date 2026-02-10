
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Scale, LayoutDashboard, Gavel, Book, FileText, Bookmark, History as HistoryIcon, 
  Trash2, Search, Loader2, LogOut, User as UserIcon, Lock, Database, 
  Upload, UserPlus, Download, ShieldAlert, Sparkles, PanelLeftClose, 
  PanelLeftOpen, Check, AlertCircle, RefreshCw, Send, Mic, MicOff, 
  Paperclip, ExternalLink, ChevronRight, Copy, FileIcon, Volume2, 
  Plus, History, FileBadge, Save, Briefcase, Filter, Tags, X, MoreHorizontal, Eye, File,
  ImageIcon, Lightbulb, Zap, VolumeX, Edit3, ArrowLeft, Mail, Trophy, TrendingUp, Globe, FileSearch, Library,
  FileBox, FileTextIcon
} from 'lucide-react';
import { Message, User, AppTab, SearchSource, BookmarkItem, HistoryItem, TokenUsage, IngestedDocument, Statute, CaseLaw } from './types';
import { gemini, Attachment, EnhancedCaseLaw, EnhancedStatute } from './services/geminiService';
import { knowledgeBase } from './services/knowledgeBase';
import { searchService } from './services/searchService';
import { NAVIGATION_ITEMS, CHAMBER_DRIVE_URL, AL_WAKEELO_GITHUB_URL, COMMON_STATUTES, CONTRACT_TYPES } from './constants';
import { LOCAL_STATUTES, LOCAL_CASE_LAW } from './legalDatabase';

const icons: Record<string, any> = {
  LayoutDashboard, Gavel, Book, Scale, FileText, Bookmark, History, FileBadge, Sparkles, Database
};

const STORAGE_KEYS = {
  USERS: 'al_wakeelo_users',
  BOOKMARKS: 'al_wakeelo_bookmarks',
  HISTORY: 'al_wakeelo_history',
  SAVED_USER: 'al_wakeelo_saved_user',
  CHATS: 'al_wakeelo_active_chats'
};

const INITIAL_USERS: User[] = [
  { id: 'admin_001', name: 'Chief Admin Ijlal', email: 'admin@chambers.com', password: 'admin123', role: 'admin', isPro: true, status: 'active' },
  { id: 'user_001', name: 'Valued Client', email: 'client@gmail.com', password: 'client123', role: 'user', isPro: false, status: 'active' },
];

const downloadAsTxt = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// --- Sub-Modules ---

const StatuteBriefModal = ({ statute, brief, isLoading, onClose }: { statute: EnhancedStatute | null, brief: string, isLoading: boolean, onClose: () => void }) => {
  if (!statute && !isLoading) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-[#0f172a]/95 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-[#1e293b] border border-slate-700 w-full max-w-4xl h-[85vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden relative">
        <div className="p-8 border-b border-slate-800 bg-[#0f172a]/50 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-blue-500/10 text-blue-400 rounded-2xl">
              <FileSearch size={28} />
            </div>
            <div>
              <h3 className="text-2xl font-serif font-bold text-white uppercase tracking-tight">{statute?.shortTitle} Section {statute?.section}</h3>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mt-1">High-Density Strategic Chambers Briefing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-red-500/10 rounded-2xl text-slate-400 hover:text-red-500 transition-all">
            <X size={28} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-12 bg-white/5 scrollbar-hide">
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
              <Loader2 size={48} className="animate-spin text-blue-500" />
              <p className="text-sm font-black uppercase tracking-widest text-slate-500 animate-pulse">Drafting Strategic Analysis...</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="legal-draft-font whitespace-pre-wrap selection:bg-blue-500/30">
                {brief}
              </div>
            </div>
          )}
        </div>

        <div className="p-8 border-t border-slate-800 bg-[#0f172a]/50 flex justify-between items-center">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">Al Wakeelo Digital Chambers • Proprietary Intelligence</p>
          {!isLoading && (
            <button 
              onClick={() => downloadAsTxt(brief, `brief-${statute?.shortTitle}-${statute?.section}.txt`)}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all"
            >
              <Download size={14} /> Export Brief
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const DocumentPreviewModal = ({ doc, onClose }: { doc: IngestedDocument | null, onClose: () => void }) => {
  if (!doc) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-6 bg-[#0f172a]/90 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-[#1e293b] border border-slate-700 w-full max-w-5xl h-[90vh] rounded-[3rem] shadow-2xl flex flex-col overflow-hidden relative">
        <div className="p-6 border-b border-slate-800 bg-[#0f172a]/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
              <FileText size={24} />
            </div>
            <div>
              <h3 className="text-xl font-serif font-bold text-white line-clamp-1">{doc.name}</h3>
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{doc.type} • {(doc.size / 1024).toFixed(1)} KB • Vault Document</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadAsTxt(doc.content || "", doc.name)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all">
              <Download size={20} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-500 transition-all">
              <X size={24} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-12 bg-white/5 scrollbar-hide">
          <div className="max-w-3xl mx-auto bg-white/[0.02] p-12 rounded-[2rem] border border-white/5 shadow-inner">
            <div className="legal-draft-font whitespace-pre-wrap selection:bg-amber-500/30">
              {doc.content || "Document indexed..."}
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-slate-800 bg-[#0f172a]/50 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-600">Al Wakeelo Digital Chambers Vault</p>
        </div>
      </div>
    </div>
  );
};

const CaseDocumentsModule = () => {
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<IngestedDocument | null>(null);

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const docs = await knowledgeBase.getAllDocuments();
      setDocuments(docs);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadDocs(); }, []);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      <div>
        <h2 className="text-5xl font-serif font-bold text-white italic tracking-tight">Case Documents</h2>
        <p className="text-slate-500 mt-2 font-medium">Browse verified legal materials and indexed evidence from the Chambers Registry.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {documents.map((doc) => (
          <div key={doc.id} className="p-8 bg-[#1e293b] border border-slate-800 rounded-[3rem] shadow-xl hover:border-amber-500/40 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
              <FileIcon size={120} />
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl">
                <FileIcon size={24} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white line-clamp-1">{doc.name}</h4>
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{doc.type} • {(doc.size / 1024).toFixed(1)} KB</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 line-clamp-3 mb-8 italic">Registry entry indexed on {new Date(doc.uploadedAt).toLocaleDateString()}. Full text available for strategic review.</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPreviewDoc(doc)} className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2">
                <Eye size={14} /> Strategic View
              </button>
              <button onClick={() => downloadAsTxt(doc.content || "", doc.name)} className="p-3 bg-slate-800 text-slate-400 rounded-xl hover:text-white transition-all">
                <Download size={14} />
              </button>
            </div>
          </div>
        ))}
        {documents.length === 0 && !isLoading && (
          <div className="col-span-full py-40 text-center bg-[#1e293b]/50 border border-dashed border-slate-800 rounded-[4rem]">
             <FileSearch size={48} className="mx-auto text-slate-700 mb-6" />
             <p className="text-slate-500 italic font-medium">No documents currently indexed in the Chambers Registry.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const KnowledgeVaultModule = () => {
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [previewDoc, setPreviewDoc] = useState<IngestedDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const docs = await knowledgeBase.getAllDocuments();
      setDocuments(docs);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadDocs(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsLoading(true);
    try {
      const res = await knowledgeBase.ingestBatch(files, setStatusMsg);
      setStatusMsg(`Registry updated: ${res.success} ingested.`);
      loadDocs();
    } catch (e: any) { setStatusMsg(`Error: ${e.message}`); }
    finally { setIsLoading(false); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Wipe this document from the Registry?")) return;
    await knowledgeBase.deleteDocument(id);
    loadDocs();
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl font-serif font-bold text-white italic tracking-tight">Knowledge Vault</h2>
          <p className="text-slate-500 mt-2 font-medium">Manage the global intelligence registry for Al Wakeelo Counsel Engine.</p>
        </div>
        <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="px-8 py-4 bg-amber-500 text-slate-950 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-amber-400 transition-all shadow-xl flex items-center gap-3">
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 
          Ingest Registry Items
        </button>
        <input type="file" multiple ref={fileInputRef} onChange={handleUpload} className="hidden" accept=".pdf,.docx,.txt" />
      </div>

      {statusMsg && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-xs font-bold text-amber-500 uppercase tracking-widest">
           <AlertCircle size={16} /> {statusMsg}
        </div>
      )}

      <div className="bg-[#1e293b] border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead className="bg-slate-900/50 border-b border-slate-800">
            <tr>
              <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Document</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
              <th className="p-8 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Vault Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="p-8">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-800 rounded-xl text-amber-500"><FileText size={18} /></div>
                    <div><p className="text-sm font-bold text-white">{doc.name}</p><p className="text-[9px] uppercase tracking-widest text-slate-600">Indexed Registry Entry</p></div>
                  </div>
                </td>
                <td className="p-8 text-[10px] font-black uppercase tracking-widest text-emerald-500">Live in Vault</td>
                <td className="p-8">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => setPreviewDoc(doc)} className="p-3 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"><Eye size={18} /></button>
                    <button onClick={() => handleDelete(doc.id)} className="p-3 hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ContractDraftingModule = ({ messages, setMessages, onBookmark, onAddToHistory, onClearChat }: any) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const handleTemplateSelect = (template: string) => {
    setSelectedTemplate(template);
    setMessages([
      ...messages,
      { 
        id: Date.now().toString(), 
        role: 'user', 
        content: `I need to draft an airtight ${template}. Please guide me through the required clauses and Pakistani legal specifics.`, 
        timestamp: new Date() 
      }
    ]);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl font-serif font-bold text-white italic tracking-tight">Contract Drafting</h2>
          <p className="text-slate-500 mt-2 font-medium">Precision-engineered legal agreements for the Pakistani jurisdiction.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#1e293b] border border-slate-800 rounded-[2.5rem] p-8 shadow-xl">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 mb-6">Agreement Vault</h4>
            <div className="space-y-3 overflow-y-auto max-h-[50vh] scrollbar-hide pr-2">
              {CONTRACT_TYPES.map((type) => (
                <button 
                  key={type} 
                  onClick={() => handleTemplateSelect(type)}
                  className={`w-full text-left p-4 rounded-2xl text-[11px] font-bold transition-all border ${selectedTemplate === type ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-lg' : 'bg-[#0f172a] text-slate-400 border-slate-800 hover:border-slate-600'}`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-[2rem] p-6">
             <div className="flex items-center gap-3 mb-3 text-amber-500">
               <Sparkles size={18} />
               <span className="text-[10px] font-black uppercase tracking-widest">Airtight Move</span>
             </div>
             <p className="text-[10px] text-slate-500 leading-relaxed italic">Strategic contracts don't just protect—they win disputes before they start. Select a pillar to begin.</p>
          </div>
        </div>
        <div className="lg:col-span-3">
          <ChatModule type="contract-drafting" messages={messages} setMessages={setMessages} onBookmark={onBookmark} onAddToHistory={onAddToHistory} onClearChat={onClearChat} />
        </div>
      </div>
    </div>
  );
};

const BookmarksModule = ({ bookmarks, setBookmarks }: { bookmarks: BookmarkItem[], setBookmarks: React.Dispatch<React.SetStateAction<BookmarkItem[]>> }) => {
  const [previewBookmark, setPreviewBookmark] = useState<BookmarkItem | null>(null);

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {previewBookmark && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-[#0f172a]/95 backdrop-blur-md animate-in zoom-in-95 duration-300">
          <div className="bg-[#1e293b] border border-slate-700 w-full max-w-3xl h-[70vh] rounded-[3.5rem] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-8 border-b border-slate-800 bg-[#0f172a]/50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-serif font-bold text-white italic">Saved Strategy Preview</h3>
                <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mt-1">{previewBookmark.category} • {previewBookmark.type}</p>
              </div>
              <button onClick={() => setPreviewBookmark(null)} className="p-3 hover:bg-slate-800 rounded-2xl text-slate-400 hover:text-white transition-all"><X size={24} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-12 bg-white/5 scrollbar-hide">
              <div className="legal-draft-font whitespace-pre-wrap leading-relaxed">{previewBookmark.content}</div>
            </div>
            <div className="p-8 border-t border-slate-800 bg-[#0f172a]/50 flex justify-end gap-3">
               <button onClick={() => downloadAsTxt(previewBookmark.content, `bookmark-${previewBookmark.id}.txt`)} className="px-6 py-3 bg-amber-500 text-slate-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all flex items-center gap-2">
                 <Download size={14} /> Export Text
               </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-5xl font-serif font-bold text-white italic tracking-tight">Bookmarks</h2>
        <p className="text-slate-500 mt-2 font-medium">Your personal strategic vault of saved legal advice and research.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {bookmarks.map(b => (
          <div key={b.id} className="p-10 bg-[#1e293b] border border-slate-800 rounded-[3.5rem] shadow-xl relative group hover:border-amber-500/30 transition-all flex flex-col h-full">
            <div className="flex justify-between items-start mb-6">
              <p className="text-[10px] font-black uppercase text-amber-500 tracking-[0.2em]">{b.category} • {b.type}</p>
              <button onClick={() => setBookmarks(prev => prev.filter(x => x.id !== b.id))} className="text-slate-700 hover:text-red-500 transition-colors p-1"><Trash2 size={16} /></button>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed line-clamp-4 italic mb-8">"{b.content.substring(0, 150)}..."</p>
            <div className="mt-auto pt-6 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{new Date(b.timestamp).toLocaleDateString()}</span>
              <button onClick={() => setPreviewBookmark(b)} className="text-amber-500 hover:text-amber-400 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">View Strategy <ChevronRight size={12} /></button>
            </div>
          </div>
        ))}
        {bookmarks.length === 0 && (
          <div className="col-span-full py-40 text-center bg-[#1e293b]/30 border border-dashed border-slate-800 rounded-[4rem]">
             <Bookmark size={48} className="mx-auto text-slate-800 mb-6" />
             <p className="text-slate-600 italic font-medium">Your strategic vault is currently empty. Bookmark advice from Al Wakeelo to save it here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const LoginModule = ({ onLogin, users }: { onLogin: (u: User, remember: boolean) => void, users: User[] }) => {
  const [view, setView] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    setTimeout(() => {
      const foundUser = users.find(u => u.email === email && u.password === password);
      if (foundUser) {
        onLogin(foundUser, rememberMe);
      } else {
        setError("Access Denied: Invalid Chambers Registry Credentials.");
      }
      setIsLoading(false);
    }, 800);
  };

  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setTimeout(() => {
      const userExists = users.some(u => u.email === email);
      if (userExists) setSuccess(`Recovery protocol initiated for ${email}. Check your secure inbox.`);
      else setError("Registry error: This email is not on our dockets.");
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px]"></div>
      <div className="w-full max-w-md bg-[#1e293b] border border-slate-800 p-10 rounded-[4rem] shadow-2xl relative z-10 animate-in zoom-in-95 duration-700">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
            <Scale size={32} className="text-slate-900" />
          </div>
          <h1 className="text-4xl font-serif font-bold text-white uppercase tracking-tighter italic">Al Wakeelo</h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-black mt-2">Digital Chambers Secure Access</p>
        </div>

        {view === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Registered Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl pl-12 pr-4 py-5 text-sm text-white focus:ring-2 focus:ring-amber-500/50 transition-all outline-none" placeholder="advocate@chambers.com" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secret Passkey</label>
                <button type="button" onClick={() => { setView('forgot'); setError(''); }} className="text-[10px] font-black text-amber-500 hover:text-amber-400 uppercase tracking-widest transition-colors">Lost Access?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl pl-12 pr-4 py-5 text-sm text-white focus:ring-2 focus:ring-amber-500/50 transition-all outline-none" placeholder="••••••••" />
              </div>
            </div>
            <div className="px-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="peer appearance-none w-5 h-5 border border-slate-700 rounded-lg bg-[#0f172a] checked:bg-amber-500 checked:border-amber-500 transition-all" />
                  <Check className="absolute w-3.5 h-3.5 text-slate-900 scale-0 peer-checked:scale-100 transition-transform pointer-events-none" />
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-slate-300 transition-colors">Maintain Registry Session</span>
              </label>
            </div>
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 animate-in fade-in duration-300">
                <ShieldAlert size={18} className="text-red-500" />
                <span className="text-xs text-red-400 font-medium">{error}</span>
              </div>
            )}
            <button type="submit" disabled={isLoading} className="w-full bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-xs py-5 rounded-2xl hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-amber-500/10">
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Validate & Enter"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="space-y-6 animate-in slide-in-from-left-4 duration-500">
             <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Account Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-[#0f172a] border border-slate-700 rounded-2xl pl-12 pr-4 py-5 text-sm text-white focus:ring-2 focus:ring-amber-500/50 transition-all outline-none" placeholder="advocate@chambers.com" />
              </div>
            </div>
            {error && <p className="text-xs text-red-400 px-2 font-medium">{error}</p>}
            {success && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3">
                <Check size={18} className="text-emerald-500" />
                <span className="text-xs text-emerald-400 font-medium">{success}</span>
              </div>
            )}
            {!success ? (
              <button type="submit" disabled={isLoading} className="w-full bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-xs py-5 rounded-2xl hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Initiate Recovery"}
              </button>
            ) : null}
            <button type="button" onClick={() => { setView('login'); setSuccess(''); setError(''); }} className="w-full text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors py-2">Back to Registry</button>
          </form>
        )}
      </div>
    </div>
  );
};

const ChatModule = ({ type, messages, setMessages, onBookmark, onAddToHistory, onClearChat }: any) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, isLoading]);

  const handleSend = async () => {
    if ((!input.trim() && !attachment) || isLoading) return;
    setApiError(null);
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: attachment ? `${input}\n\n[Attached: ${attachment.name}]` : input, timestamp: new Date() };
    const updated = [...messages, userMsg];
    setMessages(updated); setInput(''); setAttachment(null); setIsLoading(true);
    try {
      const res = await gemini.generateResponse(updated, type === 'draft' || type === 'contract-drafting' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview', attachment ? [attachment] : undefined);
      setMessages([...updated, { id: (Date.now() + 1).toString(), role: 'assistant', content: res.text, timestamp: new Date(), sources: res.sources }]);
      if (res.isQuotaError) setApiError("Quota limit reached. Al Wakeelo's engine is cooling down.");
      onAddToHistory({ type: 'chat', query: input.substring(0, 50) });
    } catch (err: any) {
      setMessages([...updated, { id: (Date.now() + 1).toString(), role: 'assistant', content: "Error: Communication with chambers disrupted.", timestamp: new Date() }]);
      setApiError(err?.message || "Communication disruption.");
    } finally { setIsLoading(false); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-[#1e293b] border border-slate-800 rounded-[3rem] overflow-hidden shadow-2xl relative">
      <div className="p-6 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner"><Scale size={24}/></div>
          <div>
            <h3 className="text-sm font-bold text-white capitalize">{type.replace('-', ' ')} Session</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${apiError ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{apiError ? 'Engine Throttled' : 'Counsel Engine Active'}</p>
            </div>
          </div>
        </div>
        <button onClick={onClearChat} className="px-4 py-2 hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all"><Trash2 size={14}/> Reset Session</button>
      </div>
      <div ref={scrollRef} className="flex-1 p-10 overflow-y-auto space-y-8 scrollbar-hide">
        {messages.map((m: Message) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4`}>
            <div className={`max-w-[85%] p-8 rounded-[2.5rem] shadow-xl relative group ${m.role === 'user' ? 'bg-amber-500 text-slate-950 font-bold rounded-tr-none' : 'bg-[#0f172a] border border-slate-700 text-slate-200 rounded-tl-none'}`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</p>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onBookmark(m, type, 'Chat Strategy')} className={`p-2 rounded-xl border ${m.role === 'user' ? 'border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-amber-500' : 'border-slate-700 text-slate-400 hover:text-amber-500'}`} title="Bookmark Clause"><Bookmark size={14} /></button>
              </div>
              {m.sources && m.sources.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-800/50 space-y-3">
                  <p className="text-[10px] font-black uppercase text-amber-500/60 tracking-widest">Grounding Citations</p>
                  {m.sources.map((s, idx) => (<a key={idx} href={s.uri} target="_blank" className="flex items-center gap-2 text-[10px] text-slate-400 hover:text-amber-500 transition-colors"><ExternalLink size={10} /> {s.title}</a>))}
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && <div className="flex justify-start"><div className="bg-[#0f172a] p-6 rounded-3xl border border-slate-800 flex items-center gap-3"><div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce delay-75"></div><div className="w-2 h-2 bg-amber-500 rounded-full animate-bounce delay-150"></div><span className="text-xs text-slate-500 font-black uppercase tracking-widest ml-2">Reasoning Protocol...</span></div></div>}
      </div>
      
      {apiError && (
        <div className="px-8 py-3 bg-red-500/10 border-t border-red-500/20 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500" />
          <span className="text-xs font-bold text-red-400 uppercase tracking-widest">{apiError}</span>
        </div>
      )}

      <div className="p-8 bg-[#0f172a]/50 border-t border-slate-800">
        <div className="flex gap-4 bg-[#1e293b] border border-slate-700 p-2 rounded-[2rem] shadow-2xl">
          <input className="flex-1 bg-transparent border-none px-6 py-4 text-sm text-white focus:ring-0 placeholder:text-slate-600" placeholder="Consult Al Wakeelo..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} />
          <button onClick={handleSend} disabled={isLoading} className="p-5 bg-amber-500 text-slate-950 rounded-2xl hover:bg-amber-400 shadow-xl shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50"><Send size={20} /></button>
        </div>
      </div>
    </div>
  );
};

const LegalSearchModule = ({ type, title, placeholder, onAddToHistory }: { type: 'judgment' | 'statute', title: string, placeholder: string, onAddToHistory: (h: any) => void }) => {
  const [query, setQuery] = useState('');
  const [localResults, setLocalResults] = useState<any[]>([]);
  const [externalResults, setExternalResults] = useState<any[]>([]);
  const [searchSummary, setSearchSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExternalLoading, setIsExternalLoading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [selectedStatuteForBrief, setSelectedStatuteForBrief] = useState<EnhancedStatute | null>(null);
  const [statuteBrief, setStatuteBrief] = useState('');
  const [isBriefing, setIsBriefing] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async (overrideQuery?: string, overrideLabel?: string) => {
    const activeQuery = (overrideQuery || query).trim();
    if (!activeQuery) return;
    setIsLoading(true); setExternalResults([]); setSearchSummary(''); setSearchError(null);
    onAddToHistory({ type, query: overrideLabel || activeQuery });
    
    const lResults = type === 'statute' ? searchService.searchStatutes(activeQuery) : searchService.searchCaseLaw(activeQuery);
    setLocalResults(lResults);
    
    setIsExternalLoading(true);
    let ext: any[] = [];
    try {
      if (type === 'judgment') ext = await gemini.searchLegalJudgments(activeQuery);
      else ext = await gemini.searchLegalStatutes(activeQuery);
      setExternalResults(ext);
    } catch (err: any) { 
      console.error(err);
      if (err?.message?.includes('quota') || err?.message?.includes('429')) {
        setSearchError("Registry Throttled (Quota Reached). Using Internal Chambers Vault.");
      }
    } finally { setIsExternalLoading(false); }

    if (type === 'statute' && (lResults.length > 0 || ext.length > 0)) {
      setIsSummarizing(true);
      try {
        const joint = [...lResults, ...ext];
        const summary = await gemini.summarizeStatuteFindings(activeQuery, joint);
        setSearchSummary(summary);
      } catch (e) { console.error(e); } finally { setIsSummarizing(false); }
    }
    setIsLoading(false);
  };

  const handleReadBrief = async (statute: EnhancedStatute) => {
    setSelectedStatuteForBrief(statute); setStatuteBrief(''); setIsBriefing(true);
    try {
      const brief = await gemini.generateStatuteBrief(statute);
      setStatuteBrief(brief);
    } catch (e) { setStatuteBrief("Brief generation failed. Chambers reasoning engine is at capacity."); } finally { setIsBriefing(false); }
  };

  const jointResults = useMemo(() => {
    const normalizedLocal = localResults.map(item => ({ ...item, source: 'internal' }));
    const normalizedExternal = externalResults.map(item => ({ ...item, source: 'external' }));
    return [...normalizedLocal, ...normalizedExternal];
  }, [localResults, externalResults]);

  return (
    <div className="space-y-10 animate-in fade-in duration-500 pb-20">
      <StatuteBriefModal statute={selectedStatuteForBrief} brief={statuteBrief} isLoading={isBriefing} onClose={() => setSelectedStatuteForBrief(null)} />

      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h2 className="text-5xl font-serif font-bold text-white italic tracking-tight">{title}</h2>
          <p className="text-slate-500 mt-2 font-medium">Verified Chambers Vaults & Grounded Pakistani Legal Search.</p>
        </div>
        <div className="flex flex-col gap-2 w-full lg:w-[35rem]">
          <div className="flex gap-3 bg-[#1e293b] p-3 rounded-[2.5rem] border border-slate-800 shadow-2xl">
            <input className="flex-1 bg-transparent border-none px-6 py-3 text-sm text-white focus:ring-0 placeholder:text-slate-600" placeholder={placeholder} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <button onClick={() => handleSearch()} disabled={isLoading} className="p-4 bg-amber-500 text-slate-950 rounded-[2rem] hover:bg-amber-400 transition-all shadow-xl active:scale-95">{isLoading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}</button>
          </div>
          {searchError && (
            <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 animate-in fade-in">
              <AlertCircle size={14} className="text-red-500" />
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">{searchError}</span>
            </div>
          )}
        </div>
      </div>

      {type === 'statute' && (
        <div className="bg-[#1e293b] border border-slate-800 rounded-[3rem] p-12 shadow-2xl space-y-12 overflow-hidden relative">
          <div className="absolute top-0 right-0 p-16 opacity-[0.03] pointer-events-none scale-150"><Book size={300} /></div>
          <div className="flex items-center gap-5 relative z-10">
             <div className="p-4 bg-amber-500/10 text-amber-500 rounded-3xl shadow-inner"><Library size={32} /></div>
             <div>
               <h4 className="text-xl font-serif font-bold text-white tracking-tight uppercase italic">Pakistani Legal Pillars: Quick Access</h4>
               <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Direct groundings for strategic statutory pillars.</p>
             </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 relative z-10">
            {COMMON_STATUTES.map((cat, idx) => (
              <div key={idx} className="space-y-6 animate-in fade-in duration-700" style={{ animationDelay: `${idx * 150}ms` }}>
                <div className="border-b border-slate-800 pb-4">
                  <h5 className="text-[11px] font-black uppercase tracking-[0.3em] text-amber-500 mb-2">{cat.category}</h5>
                  <p className="text-[10px] text-slate-500 leading-relaxed italic font-medium">{cat.description}</p>
                </div>
                <div className="space-y-4">
                  {cat.items.map((stat, i) => (
                    <button key={i} onClick={() => handleSearch(stat.query, stat.label)} className="w-full text-left p-5 bg-[#0f172a] border border-slate-800 rounded-[2rem] transition-all hover:border-amber-500/50 hover:shadow-lg group relative overflow-hidden">
                      <div className="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      <div className="flex items-center justify-between mb-2 relative z-10">
                        <span className="text-[12px] font-bold text-slate-300 group-hover:text-white transition-colors">{stat.label}</span>
                        <ChevronRight size={14} className="text-slate-700 group-hover:text-amber-500 transition-all translate-x-0 group-hover:translate-x-1" />
                      </div>
                      <p className="text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors leading-relaxed line-clamp-2">{stat.detail}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(searchSummary || isSummarizing) && type === 'statute' && (
        <div className="p-12 bg-amber-500/5 border border-amber-500/30 rounded-[4rem] shadow-xl animate-in slide-in-from-top-4 duration-700">
           <div className="flex items-center gap-4 mb-8">
             <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl shadow-xl"><Scale size={24} /></div>
             <h3 className="text-sm font-black uppercase tracking-[0.4em] text-amber-500">Advocate's Take: Chambers Brief</h3>
             {isSummarizing && <Loader2 size={20} className="animate-spin ml-auto text-amber-500" />}
           </div>
           <div className="legal-draft-font italic text-2xl leading-relaxed text-slate-200 selection:bg-amber-500/40">
              {isSummarizing ? "Synthesizing statutory data for chambers..." : searchSummary}
           </div>
        </div>
      )}

      <div className="space-y-8">
        <div className="flex items-center gap-4 mb-10">
          <div className="flex-1 h-px bg-slate-800"></div>
          <h3 className="text-[11px] font-black uppercase text-slate-600 tracking-[0.5em] flex items-center gap-4">Joint Intelligence Docket ({jointResults.length})</h3>
          <div className="flex-1 h-px bg-slate-800"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {jointResults.map((item, idx) => {
            const isPdf = item.uri?.toLowerCase().endsWith('.pdf');
            return (
              <div key={idx} className={`p-12 rounded-[3.5rem] shadow-2xl transition-all relative border ${item.source === 'external' ? 'bg-[#1e293b]/80 border-blue-500/10 hover:border-blue-500/30' : 'bg-[#1e293b] border-slate-800 hover:border-amber-500/30'}`}>
                <div className="flex justify-between items-start mb-8">
                  <div className="flex gap-3">
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${item.source === 'external' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>{item.source === 'external' ? 'Research Feed' : 'Internal Registry'}</span>
                    <span className="px-4 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 text-[10px] font-black uppercase tracking-widest">{type === 'statute' ? item.shortTitle : item.court}</span>
                  </div>
                </div>
                <h4 className="text-2xl font-serif font-bold text-white mb-5 leading-snug">{type === 'statute' ? item.description : item.title}</h4>
                <p className="text-[13px] leading-relaxed mb-10 text-slate-500 line-clamp-4">{type === 'statute' ? item.punishment : item.summary}</p>
                <div className="flex items-center gap-4 mt-auto">
                  {type === 'statute' && (
                    <button onClick={() => handleReadBrief(item as EnhancedStatute)} className="flex-1 bg-blue-600/10 text-blue-400 text-[11px] font-black uppercase tracking-widest py-5 rounded-[2rem] hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-3">
                      <FileSearch size={18}/> Read Brief
                    </button>
                  )}
                  {item.uri && (
                    <a href={item.uri} target="_blank" className="flex-1 bg-emerald-600/10 text-emerald-400 text-[11px] font-black uppercase tracking-widest py-5 rounded-[2rem] hover:bg-emerald-600 hover:text-white transition-all text-center flex items-center justify-center gap-3">
                       {isPdf ? <FileBox size={18} /> : <ExternalLink size={18}/>} {isPdf ? 'View PDF' : 'Official Portal'}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SAVED_USER);
    if (saved) setUser(JSON.parse(saved));
    const savedBookmarks = localStorage.getItem(STORAGE_KEYS.BOOKMARKS);
    if (savedBookmarks) setBookmarks(JSON.parse(savedBookmarks));
    const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  const [alWakeeloMessages, setAlWakeeloMessages] = useState<Message[]>([]);
  const [draftMessages, setDraftMessages] = useState<Message[]>([]);
  const [contractMessages, setContractMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.BOOKMARKS, JSON.stringify(bookmarks)); }, [bookmarks]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history)); }, [history]);

  const handleLogin = (u: User, rem: boolean) => {
    setUser(u); if (rem) localStorage.setItem(STORAGE_KEYS.SAVED_USER, JSON.stringify(u));
  };

  const handleLogout = () => { setUser(null); localStorage.removeItem(STORAGE_KEYS.SAVED_USER); };
  const onBookmark = (m: Message, type: any, category: string) => {
    const newBookmark: BookmarkItem = { id: `${m.id}_${Date.now()}`, title: m.content.substring(0, 50), content: m.content, timestamp: new Date(), type, category };
    setBookmarks(prev => [newBookmark, ...prev]);
  };
  const onAddToHistory = (h: any) => setHistory([{...h, id: Date.now().toString(), timestamp: new Date()}, ...history]);

  if (!user) return <LoginModule onLogin={handleLogin} users={INITIAL_USERS} />;

  const filteredNavigation = NAVIGATION_ITEMS.filter(item => 
    item.id !== 'database' || user.role === 'admin'
  );

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-200 overflow-hidden font-sans selection:bg-amber-500/40">
      <aside className={`${isSidebarOpen ? 'w-84' : 'w-24'} bg-[#1e293b] border-r border-slate-800 transition-all duration-300 flex flex-col z-50 shadow-2xl`}>
        <div className="p-10 flex items-center gap-5 border-b border-slate-800/50">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center text-slate-900 shadow-xl shadow-amber-500/20"><Scale size={24} /></div>
          {isSidebarOpen && <h1 className="text-2xl font-serif font-bold text-white tracking-tighter uppercase italic">Al Wakeelo</h1>}
        </div>
        <nav className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-hide">
          {filteredNavigation.map((item) => {
            const Icon = icons[item.icon]; const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id as AppTab)} className={`w-full flex items-center gap-5 px-5 py-4 rounded-[1.5rem] transition-all group ${isActive ? 'bg-amber-500 text-slate-950 shadow-xl shadow-amber-500/20 font-black' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <div className={`${isActive ? 'text-slate-950' : 'text-slate-500 group-hover:text-amber-500'} transition-colors`}><Icon size={22} /></div>
                {isSidebarOpen && <span className="text-[12px] uppercase tracking-widest line-clamp-1">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-6 border-t border-slate-800/50">
          <button onClick={handleLogout} className="w-full flex items-center gap-5 px-5 py-4 rounded-[1.5rem] text-slate-500 hover:text-red-500 hover:bg-red-500/5 transition-all group"><LogOut size={22} />{isSidebarOpen && <span className="text-[12px] font-black uppercase tracking-widest">Exit Vault</span>}</button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-24 border-b border-slate-800 bg-[#0f172a]/50 flex items-center justify-between px-10">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-3 bg-slate-800/50 rounded-2xl text-slate-500 hover:text-white transition-all shadow-inner"><PanelLeftClose size={22} /></button>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-black uppercase text-white tracking-widest">{user.name}</p>
              <p className="text-[10px] font-black uppercase text-amber-500/60 tracking-[0.2em]">{user.role} Counsel</p>
            </div>
            <div className="w-14 h-14 rounded-3xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 shadow-xl"><UserIcon size={24} /></div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-12 bg-[#0f172a]">
          <div className="max-w-7xl mx-auto h-full">
            {activeTab === 'dashboard' && (
              <div className="space-y-12 animate-in fade-in duration-500">
                <div className="p-20 bg-gradient-to-br from-amber-500 to-amber-600 rounded-[5rem] text-slate-950 shadow-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-16 opacity-10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-1000"><Scale size={320} /></div>
                  <div className="relative z-10">
                    <p className="text-[12px] font-black uppercase tracking-[0.5em] mb-6 text-slate-900/60">Chambers Secure Protocol • ActiveCounsel-v3</p>
                    <h2 className="text-8xl font-serif font-bold mb-8 tracking-tighter italic leading-none">"Justice is for all,<br/>but wins are for the smart."</h2>
                    <p className="text-2xl font-medium opacity-80 max-w-2xl leading-relaxed">Al Wakeelo core engine synchronized. Chambers vaults and grounded registries are online.</p>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 'al-wakeelo' && <ChatModule type="al-wakeelo" messages={alWakeeloMessages} setMessages={setAlWakeeloMessages} onBookmark={onBookmark} onAddToHistory={onAddToHistory} onClearChat={() => setAlWakeeloMessages([])} />}
            {activeTab === 'draft' && <ChatModule type="draft" messages={draftMessages} setMessages={setDraftMessages} onBookmark={onBookmark} onAddToHistory={onAddToHistory} onClearChat={() => setDraftMessages([])} />}
            {activeTab === 'contract-drafting' && <ContractDraftingModule messages={contractMessages} setMessages={setContractMessages} onBookmark={onBookmark} onAddToHistory={onAddToHistory} onClearChat={() => setContractMessages([])} />}
            {(activeTab === 'judgment-search' || activeTab === 'statute-search') && <LegalSearchModule type={activeTab === 'judgment-search' ? 'judgment' : 'statute'} title={activeTab === 'judgment-search' ? 'Judgment Vault' : 'Statute Registry'} placeholder="Enter Registry Parameters..." onAddToHistory={onAddToHistory} />}
            {activeTab === 'case-documents' && <CaseDocumentsModule />}
            {activeTab === 'bookmarks' && <BookmarksModule bookmarks={bookmarks} setBookmarks={setBookmarks} />}
            {activeTab === 'history' && (
              <div className="bg-[#1e293b] rounded-[4rem] overflow-hidden shadow-2xl border border-slate-800">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-800"><tr><th className="p-10">Parameter Entry</th><th className="p-10">Timestamp</th></tr></thead>
                  <tbody className="divide-y divide-slate-800">{history.map(h => (<tr key={h.id} className="hover:bg-white/[0.02] transition-colors"><td className="p-10 text-sm font-bold text-white">{h.query} <span className="text-[10px] text-slate-600 font-black uppercase ml-4 tracking-widest">({h.type})</span></td><td className="p-10 text-xs text-slate-500">{new Date(h.timestamp).toLocaleString()}</td></tr>))}</tbody>
                </table>
              </div>
            )}
            {activeTab === 'database' && user.role === 'admin' && <KnowledgeVaultModule />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
