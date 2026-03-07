import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, FileUp, RefreshCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type StyleModule = "legal-drafting" | "contract-drafting";
type ScopeMode = "user" | "org";
type OwnershipMode = "user" | "org" | "user-org";
type Strictness = "strict" | "balanced" | "flexible";

type StyleSettingsResponse = {
  module: StyleModule;
  enabled: boolean;
  ownershipMode: OwnershipMode;
  learningSource: "full-activity";
  coverage: "generation-only";
  strictness: Strictness;
  sampleCounts: { upload: number; savedDraft: number; acceptedRedline: number; total: number };
  lastBackfillAt: string | null;
};

type StyleSampleItem = {
  id: number;
  title: string;
  sourceType: "upload" | "saved-draft" | "accepted-redline";
  createdAt: string | null;
};

export function StyleMemoryPanel({
  module,
  className = "",
}: {
  module: StyleModule;
  className?: string;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scope, setScope] = useState<ScopeMode>("user");
  const [settings, setSettings] = useState<StyleSettingsResponse | null>(null);
  const [samples, setSamples] = useState<StyleSampleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const scopeQuery = useMemo(() => `module=${encodeURIComponent(module)}&scope=${scope}`, [module, scope]);

  const loadSettings = async () => {
    const res = await fetch(`/api/style-memory/settings?${scopeQuery}`, { credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    const data = (await res.json()) as StyleSettingsResponse;
    setSettings(data);
  };

  const loadSamples = async () => {
    const res = await fetch(`/api/style-memory/samples?${scopeQuery}&limit=20&offset=0`, { credentials: "include" });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    setSamples(Array.isArray(data?.items) ? data.items : []);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadSettings(), loadSamples()]);
    } catch (err: any) {
      toast({
        title: "Style memory unavailable",
        description: err?.message || "Could not load style memory.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, [scopeQuery]);

  const updateSettings = async (patch: Partial<{ enabled: boolean; ownershipMode: OwnershipMode; strictness: Strictness }>) => {
    setUpdating(true);
    try {
      const res = await fetch("/api/style-memory/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          module,
          scope,
          ...patch,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as StyleSettingsResponse;
      setSettings(data);
    } catch (err: any) {
      toast({
        title: "Update failed",
        description: err?.message || "Could not update style settings.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const onUploadClick = () => {
    fileInputRef.current?.click();
  };

  const onUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("module", module);
      form.set("scope", scope);
      Array.from(files).forEach((file) => form.append("files", file));
      const res = await fetch("/api/style-memory/samples/upload", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast({
        title: "Style samples indexed",
        description: `${data?.accepted || 0} accepted, ${data?.rejected || 0} rejected`,
      });
      await refreshAll();
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err?.message || "Could not upload style files.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onBackfill = async () => {
    setBackfilling(true);
    try {
      const res = await fetch("/api/style-memory/backfill", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ module, scope, limit: 50 }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast({
        title: "Backfill complete",
        description: `Processed ${data?.processed || 0}, indexed ${data?.indexed || 0}, deduped ${data?.deduped || 0}`,
      });
      await refreshAll();
    } catch (err: any) {
      toast({
        title: "Backfill failed",
        description: err?.message || "Could not backfill style memory.",
        variant: "destructive",
      });
    } finally {
      setBackfilling(false);
    }
  };

  const deleteSample = async (id: number) => {
    try {
      const res = await fetch(`/api/style-memory/samples/${id}?${scopeQuery}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      setSamples((prev) => prev.filter((item) => item.id !== id));
      await loadSettings();
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err?.message || "Could not delete sample.",
        variant: "destructive",
      });
    }
  };

  return (
    <section className={`rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/10 via-slate-900/30 to-slate-800/30 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Brain size={14} className="text-amber-300" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-amber-200 uppercase tracking-[0.16em]">Style Memory</div>
            <div className="text-[11px] text-slate-300">
              {settings?.enabled ? "Enabled" : "Disabled"} · {settings?.sampleCounts.total || 0} sample(s)
            </div>
          </div>
        </div>
        <button
          onClick={() => setScope((prev) => (prev === "user" ? "org" : "user"))}
          className="text-[10px] px-2 py-1 rounded border border-amber-500/30 text-amber-200 hover:bg-amber-500/10"
          disabled={loading || updating}
          data-testid="button-style-scope-toggle"
        >
          Scope: {scope}
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-slate-300">
        <label className="flex items-center justify-between rounded-md border border-slate-700/70 bg-slate-900/40 px-2 py-1">
          Enabled
          <input
            type="checkbox"
            checked={!!settings?.enabled}
            disabled={updating || loading || !settings}
            onChange={(e) => void updateSettings({ enabled: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between rounded-md border border-slate-700/70 bg-slate-900/40 px-2 py-1">
          Strictness
          <select
            value={settings?.strictness || "balanced"}
            disabled={updating || loading || !settings}
            onChange={(e) => void updateSettings({ strictness: e.target.value as Strictness })}
            className="bg-transparent text-[10px] outline-none"
          >
            <option value="strict">strict</option>
            <option value="balanced">balanced</option>
            <option value="flexible">flexible</option>
          </select>
        </label>
        <label className="col-span-2 flex items-center justify-between rounded-md border border-slate-700/70 bg-slate-900/40 px-2 py-1">
          Ownership Mode
          <select
            value={settings?.ownershipMode || "user-org"}
            disabled={updating || loading || !settings}
            onChange={(e) => void updateSettings({ ownershipMode: e.target.value as OwnershipMode })}
            className="bg-transparent text-[10px] outline-none"
          >
            <option value="user">user</option>
            <option value="org">org</option>
            <option value="user-org">user-org</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-amber-300/30 text-amber-100 bg-amber-500/10 hover:bg-amber-500/20"
          onClick={onUploadClick}
          disabled={uploading}
          data-testid="button-style-upload"
        >
          <FileUp size={12} className="mr-1" />
          {uploading ? "Uploading..." : "Upload"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 border-amber-300/30 text-amber-100 bg-amber-500/10 hover:bg-amber-500/20"
          onClick={onBackfill}
          disabled={backfilling || loading}
          data-testid="button-style-backfill"
        >
          <RefreshCcw size={12} className="mr-1" />
          {backfilling ? "Backfilling..." : "Backfill"}
        </Button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.pdf,.docx"
        className="hidden"
        onChange={(e) => void onUploadFiles(e.target.files)}
      />

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
        <div className="rounded-md border border-slate-700/70 bg-slate-900/40 px-2 py-1">
          <div className="text-slate-400">Upload</div>
          <div className="font-semibold text-amber-200">{settings?.sampleCounts.upload || 0}</div>
        </div>
        <div className="rounded-md border border-slate-700/70 bg-slate-900/40 px-2 py-1">
          <div className="text-slate-400">Saved</div>
          <div className="font-semibold text-amber-200">{settings?.sampleCounts.savedDraft || 0}</div>
        </div>
        <div className="rounded-md border border-slate-700/70 bg-slate-900/40 px-2 py-1">
          <div className="text-slate-400">Redline</div>
          <div className="font-semibold text-amber-200">{settings?.sampleCounts.acceptedRedline || 0}</div>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 max-h-28 overflow-y-auto pr-1">
        {samples.slice(0, 8).map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-700/60 bg-slate-900/30 px-2 py-1">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-200 truncate">{item.title}</p>
              <p className="text-[9px] text-slate-500">{item.sourceType}</p>
            </div>
            <button
              onClick={() => void deleteSample(item.id)}
              className="text-rose-300 hover:text-rose-200"
              title="Delete sample"
              data-testid={`button-style-delete-${item.id}`}
            >
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {!samples.length && !loading && (
          <p className="text-[10px] text-slate-400">Upload style samples or continue drafting to train style memory.</p>
        )}
      </div>
    </section>
  );
}

