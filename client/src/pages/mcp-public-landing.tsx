import { useState } from "react";
import { useDocumentHead } from "@/hooks/use-document-head";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Key, 
  Terminal, 
  Cpu, 
  Copy, 
  Check, 
  ExternalLink, 
  Compass, 
  BookOpen, 
  ArrowRight,
  Sparkles,
  UserPlus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function McpPublicLandingPage() {
  useDocumentHead({
    title: "AI Integration (MCP) | AL WAKEELO - Pakistan's AI Legal Assistant",
    description: "Connect AL WAKEELO's massive Pakistani legal RAG database directly to Claude Connectors, ChatGPT Custom Actions, or Gemini Spark.",
    path: "/mcp",
  });

  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(identifier);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopiedText(null), 2000);
  };

  const desktopConfigSample = `{
  "mcpServers": {
    "alwakeelo": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://alwakeelo.com/api/mcp?token=YOUR_API_KEY"
      ]
    }
  }
}`;

  return (
    <div className="space-y-12 fade-in max-w-5xl mx-auto pb-16">
      {/* Header Banner */}
      <section className="text-center space-y-4 py-8 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-44 h-44 rounded-full bg-primary/5 blur-3xl" />
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-500 font-bold uppercase tracking-widest">
          <Sparkles size={12} className="animate-pulse" />
          Model Context Protocol
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          Connect AL WAKEELO RAG <br/>
          <span className="text-primary italic">directly to your own AI App</span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Model Context Protocol (MCP) is the universal bridge for AI. Use AL WAKEELO MCP to query 600,000+ Pakistani judgments and statutory acts directly inside Claude, ChatGPT, or Google Gemini.
        </p>
      </section>

      {/* CTA Box to get API Key */}
      <div className="rounded-3xl border border-primary/30 bg-primary/10 p-6 md:p-8 text-center space-y-4 relative overflow-hidden">
        <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
          Generate Your AL WAKEELO API Key to Connect
        </h2>
        <p className="text-xs md:text-sm text-muted-foreground max-w-xl mx-auto">
          To connect your AI application to our database, you will need a secure integration token. Create a free account or log in to generate your API key instantly.
        </p>
        <div className="flex justify-center gap-3">
          {user ? (
            <button
              onClick={() => navigate("/settings")}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Key size={13} />
              Go to API Settings
              <ArrowRight size={12} />
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate("/auth?mode=register")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <UserPlus size={13} />
                Create Free Account
              </button>
              <button
                onClick={() => navigate("/auth?mode=login")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground hover:bg-card/75 transition-colors"
              >
                Log In
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs for different Clients */}
      <Tabs defaultValue="claude" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-11">
          <TabsTrigger value="claude" className="text-xs md:text-sm flex items-center gap-2">
            <Cpu size={14} />
            Claude Connectors
          </TabsTrigger>
          <TabsTrigger value="chatgpt" className="text-xs md:text-sm flex items-center gap-2">
            <Compass size={14} />
            ChatGPT Plugin
          </TabsTrigger>
          <TabsTrigger value="gemini" className="text-xs md:text-sm flex items-center gap-2">
            <Terminal size={14} />
            Gemini Spark
          </TabsTrigger>
        </TabsList>

        {/* CLAUDE CONTENT */}
        <TabsContent value="claude" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Claude Web App */}
            <Card className="preview-surface rounded-2xl border-[hsl(var(--preview-border))]">
              <CardHeader className="p-5 pb-3">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center mb-2">
                  <Compass size={16} />
                </div>
                <CardTitle className="text-base font-bold">Claude Web App (Connectors)</CardTitle>
                <CardDescription className="text-xs">Connect directly in the Claude web client interface.</CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4 text-xs text-muted-foreground leading-relaxed">
                <ol className="list-decimal list-inside space-y-2.5">
                  <li>
                    Open <a href="https://claude.ai" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">claude.ai <ExternalLink size={10} /></a> and log in.
                  </li>
                  <li>
                    Navigate to **Settings** → **Connectors** (or type <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px]">/</kbd> in chat).
                  </li>
                  <li>
                    Click **Add Custom Connector**.
                  </li>
                  <li>
                    Paste your AL WAKEELO URL (containing your secure token):
                    <div className="flex items-center gap-1.5 mt-1.5 bg-background border rounded px-2 py-1 font-mono text-[10px] text-foreground truncate select-all">
                      <span>https://alwakeelo.com/api/mcp?token=YOUR_API_KEY</span>
                    </div>
                  </li>
                  <li>
                    Click **Connect**. Claude will verify and load all legal search tools instantly!
                  </li>
                </ol>
              </CardContent>
            </Card>

            {/* Claude Desktop App */}
            <Card className="preview-surface rounded-2xl border-[hsl(var(--preview-border))]">
              <CardHeader className="p-5 pb-3">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-400 flex items-center justify-center mb-2">
                  <Terminal size={16} />
                </div>
                <CardTitle className="text-base font-bold">Claude Desktop App (Local Config)</CardTitle>
                <CardDescription className="text-xs">Add AL WAKEELO as a native local MCP server configuration.</CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4 text-xs text-muted-foreground leading-relaxed">
                <ol className="list-decimal list-inside space-y-2.5">
                  <li>
                    Open the Claude Desktop configuration file:
                    <ul className="list-disc list-inside pl-4 mt-1 space-y-1 text-muted-foreground">
                      <li>**macOS:** <code className="font-mono text-[10px] bg-background border px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
                      <li>**Windows:** <code className="font-mono text-[10px] bg-background border px-1 rounded">%APPDATA%\Claude\claude_desktop_config.json</code></li>
                    </ul>
                  </li>
                  <li>
                    Paste this snippet into your <code className="font-mono text-[10px] bg-background px-1 rounded">mcpServers</code> config (replace <code className="font-mono text-[10px]">YOUR_API_KEY</code> with your AL WAKEELO token):
                  </li>
                </ol>
                <div className="relative mt-2">
                  <pre className="p-3 rounded-lg bg-background border text-[9px] font-mono text-foreground overflow-x-auto whitespace-pre">
                    {desktopConfigSample}
                  </pre>
                  <Button 
                    onClick={() => handleCopy(desktopConfigSample, "claude-desktop")} 
                    size="sm" 
                    variant="outline" 
                    className="absolute right-2 top-2 h-7 w-7 p-0"
                  >
                    {copiedText === "claude-desktop" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* CHATGPT CONTENT */}
        <TabsContent value="chatgpt" className="space-y-6 outline-none">
          <Card className="preview-surface rounded-2xl border-[hsl(var(--preview-border))]">
            <CardHeader className="p-5 pb-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2">
                <Compass size={16} />
              </div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold">Official ChatGPT Plugin Integration</CardTitle>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full">Official Plugin</span>
              </div>
              <CardDescription className="text-xs">Connect AL WAKEELO's official plugin directly inside ChatGPT.</CardDescription>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4 text-xs text-muted-foreground leading-relaxed">
              <div className="p-3 rounded-xl bg-background border border-border/60 space-y-1">
                <span className="text-[10.5px] font-bold text-foreground block">Official Integration URL:</span>
                <div className="flex items-center justify-between gap-2 bg-muted/50 p-2 rounded-lg font-mono text-[10.5px] text-primary select-all">
                  <span>https://www.alwakeelo.com/mcp</span>
                  <Button 
                    onClick={() => handleCopy("https://www.alwakeelo.com/mcp", "chatgpt-url")} 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  >
                    {copiedText === "chatgpt-url" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </Button>
                </div>
              </div>

              <ol className="list-decimal list-inside space-y-3 pl-1">
                <li>
                  Open <a href="https://chatgpt.com" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">chatgpt.com <ExternalLink size={10} /></a> and log in to your account.
                </li>
                <li>
                  Go to **Settings** → **Apps & Plugins** (or click **Explore GPTs / Plugins**).
                </li>
                <li>
                  Search for **"AL WAKEELO"** in the plugin search bar.
                </li>
                <li>
                  Click **Connect / Install** on the official AL WAKEELO plugin. Complete the quick OAuth login authorization if prompted.
                </li>
                <li>
                  Start a conversation in ChatGPT, type <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px] font-bold text-foreground">@</kbd> in the chat box, and select **AL WAKEELO**.
                </li>
                <li>
                  You can now ask ChatGPT to search 600,000+ judgments, draft legal petitions, or manage your court diary directly!
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GEMINI CONTENT */}
        <TabsContent value="gemini" className="space-y-6 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gemini Spark */}
            <Card className="preview-surface rounded-2xl border-[hsl(var(--preview-border))]">
              <CardHeader className="p-5 pb-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2">
                  <Compass size={16} />
                </div>
                <CardTitle className="text-base font-bold">Gemini Spark (Connected Apps)</CardTitle>
                <CardDescription className="text-xs">Connect your RAG database directly to Workspace Gemini.</CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4 text-xs text-muted-foreground leading-relaxed">
                <ol className="list-decimal list-inside space-y-2.5">
                  <li>
                    Open your **Gemini Spark** administration panel or workspace app.
                  </li>
                  <li>
                    Navigate to **App Settings** → **Connected Data Stores** / **Integrations**.
                  </li>
                  <li>
                    Click **Add Connector** and choose **Custom MCP Server**.
                  </li>
                  <li>
                    Paste your AL WAKEELO URL:
                    <div className="flex items-center gap-1.5 mt-1.5 bg-background border rounded px-2 py-1 font-mono text-[10px] text-foreground truncate select-all">
                      <span>https://alwakeelo.com/api/mcp?token=YOUR_API_KEY</span>
                    </div>
                  </li>
                  <li>
                    Save changes. The AL WAKEELO workspace tool will now handle legal research tasks automatically.
                  </li>
                </ol>
              </CardContent>
            </Card>

            {/* Gemini CLI */}
            <Card className="preview-surface rounded-2xl border-[hsl(var(--preview-border))]">
              <CardHeader className="p-5 pb-3">
                <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center mb-2">
                  <Terminal size={16} />
                </div>
                <CardTitle className="text-base font-bold">Gemini CLI (Developer Setup)</CardTitle>
                <CardDescription className="text-xs">Connect using Google's command line developer tool.</CardDescription>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4 text-xs text-muted-foreground leading-relaxed">
                <ol className="list-decimal list-inside space-y-2.5">
                  <li>
                    Open the Gemini CLI configuration file:
                    <code className="font-mono text-[10px] bg-background border block p-2 rounded mt-1.5 overflow-x-auto select-all">
                      ~/.config/google-gemini-cli/settings.json
                    </code>
                  </li>
                  <li>
                    Add the remote bridge transport configuration under the <code className="font-mono text-[10px] bg-background px-1 rounded">mcpServers</code> section:
                  </li>
                </ol>
                <div className="relative mt-2">
                  <pre className="p-3 rounded-lg bg-background border text-[9px] font-mono text-foreground overflow-x-auto whitespace-pre">
                    {`"mcpServers": {
  "alwakeelo": {
    "command": "npx",
    "args": [
      "-y",
      "mcp-remote",
      "https://alwakeelo.com/api/mcp?token=YOUR_API_KEY"
    ]
  }
}`}
                  </pre>
                  <Button 
                    onClick={() => handleCopy(`"mcpServers": {\n  "alwakeelo": {\n    "command": "npx",\n    "args": [\n      "-y",\n      "mcp-remote",\n      "https://alwakeelo.com/api/mcp?token=YOUR_API_KEY"\n    ]\n  }\n}`, "gemini-cli")} 
                    size="sm" 
                    variant="outline" 
                    className="absolute right-2 top-2 h-7 w-7 p-0"
                  >
                    {copiedText === "gemini-cli" ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* RAG Tools Details */}
      <Card className="preview-surface rounded-2xl border-[hsl(var(--preview-border))]">
        <CardHeader className="p-5 pb-3 flex flex-row items-center gap-2">
          <BookOpen size={16} className="text-primary" />
          <div>
            <CardTitle className="text-base font-bold">Registered Legal Search Tools</CardTitle>
            <CardDescription className="text-xs">Once connected, the AI will gain access to these 4 native search pipelines.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-background border rounded-xl space-y-1">
            <code className="text-primary font-bold font-mono text-[10px]">search_case_law</code>
            <p className="text-[10.5px] text-muted-foreground leading-normal">
              Searches 600,000+ judgments with our full hybrid pipeline (Voyage Law-2 embeddings, reranker, and court level boosts).
            </p>
          </div>
          <div className="p-3 bg-background border rounded-xl space-y-1">
            <code className="text-primary font-bold font-mono text-[10px]">search_statutes</code>
            <p className="text-[10.5px] text-muted-foreground leading-normal">
              Queries Pakistan statutes and act sections (PPC, CPC, etc.) matching exact legal taxonomies.
            </p>
          </div>
          <div className="p-3 bg-background border rounded-xl space-y-1">
            <code className="text-primary font-bold font-mono text-[10px]">get_judgment</code>
            <p className="text-[10.5px] text-muted-foreground leading-normal">
              Fetches full text and court headnotes of a specific judgment by its UUID.
            </p>
          </div>
          <div className="p-3 bg-background border rounded-xl space-y-1">
            <code className="text-primary font-bold font-mono text-[10px]">legal_research</code>
            <p className="text-[10.5px] text-muted-foreground leading-normal">
              Executes a deep multi-stage RAG query that analyzes the intent of your scenario and gathers fully cited legal context.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
