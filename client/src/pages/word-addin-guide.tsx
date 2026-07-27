import { useState } from "react";
import { 
  FileText, 
  Download, 
  Monitor, 
  Apple, 
  Globe, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  HelpCircle,
  Copy,
  Check
} from "lucide-react";
import { Link } from "wouter";
import { useDocumentHead } from "@/hooks/use-document-head";

type GuidePlatform = "windows" | "mac" | "web";

export default function WordAddinGuidePage() {
  useDocumentHead({
    title: "Microsoft Word Add-in Setup Guide — AL WAKEELO AI",
    description: "Complete step-by-step installation guide for AL WAKEELO Microsoft Word Add-in on Windows, macOS, and Word Web. Free 1-click manifest setup.",
    path: "/word-addin-guide",
  });

  const [platform, setPlatform] = useState<GuidePlatform>("windows");
  const [copied, setCopied] = useState(false);

  const manifestUrl = `${window.location.origin}/word-addin/manifest.xml`;

  const copyManifestUrl = () => {
    navigator.clipboard.writeText(manifestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* TOP HEADER */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-primary text-xs font-black uppercase tracking-widest mb-4">
            <FileText size={14} />
            Official Setup Guide
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-foreground mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            AL WAKEELO inside Microsoft Word
          </h1>
          <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            Follow this step-by-step guide to install the AL WAKEELO AI Legal Assistant directly into Microsoft Word for <strong className="text-primary">100% FREE</strong>.
          </p>

          {/* MANIFEST DOWNLOAD BANNER */}
          <div className="mt-8 max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left">
              <span className="text-xs font-bold text-primary uppercase tracking-wider block mb-1">Step 1: Get Manifest File</span>
              <h2 className="text-base font-bold text-foreground">alwakeelo-manifest.xml</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Required for free sideloading into Word</p>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <a
                href="/word-addin/manifest.xml"
                download="alwakeelo-manifest.xml"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs transition-all shadow-md"
              >
                <Download size={15} /> Download Manifest (.xml)
              </a>
              <button
                onClick={copyManifestUrl}
                className="p-3 bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl text-xs font-semibold transition-all"
                title="Copy Manifest URL"
              >
                {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* PLATFORM TOGGLE */}
        <div className="flex justify-center gap-3 mb-10">
          <button
            onClick={() => setPlatform("windows")}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              platform === "windows"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
            }`}
          >
            <Monitor size={18} />
            <span>Windows PC</span>
          </button>
          
          <button
            onClick={() => setPlatform("mac")}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              platform === "mac"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
            }`}
          >
            <Apple size={18} />
            <span>macOS (Mac)</span>
          </button>

          <button
            onClick={() => setPlatform("web")}
            className={`flex items-center gap-2 px-6 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              platform === "web"
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
            }`}
          >
            <Globe size={18} />
            <span>Word Web (Online)</span>
          </button>
        </div>

        {/* WINDOWS GUIDE */}
        {platform === "windows" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Save Manifest File on PC</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Create a dedicated folder on your computer for the add-in manifest.</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2 pl-13">
                <p>1. Download the <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">alwakeelo-manifest.xml</code> file using the download button above.</p>
                <p>2. Create a folder on your hard drive, e.g.: <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono font-bold">C:\AlWakeeloAddin\</code></p>
                <p>3. Move the downloaded <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">manifest.xml</code> into <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono font-bold">C:\AlWakeeloAddin\</code>.</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Trust the Folder in Microsoft Word</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Tell Microsoft Word to trust your local add-in folder.</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2 pl-13">
                <p>1. Open <strong>Microsoft Word</strong>.</p>
                <p>2. Click <strong>File</strong> (top-left) &rarr; select <strong>Options</strong> (bottom left).</p>
                <p>3. In the Options window, click <strong>Trust Center</strong> &rarr; click the <strong>Trust Center Settings...</strong> button.</p>
                <p>4. Select <strong>Trusted Add-in Catalogs</strong> on the left panel.</p>
                <p>5. In <strong>Catalog URL</strong>, type: <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono font-bold">C:\AlWakeeloAddin\</code></p>
                <p>6. Click <strong>Add catalog</strong>, then check the checkbox under <strong className="text-foreground">Show in Menu ☑️</strong>.</p>
                <p>7. Click <strong>OK</strong> twice and restart Microsoft Word.</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Launch AL WAKEELO inside Word</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Load your add-in from the Shared Folder tab.</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2 pl-13">
                <p>1. In Word, go to top ribbon &rarr; click <strong>Insert</strong> &rarr; click <strong>My Add-ins</strong>.</p>
                <p>2. Click the <strong>SHARED FOLDER</strong> tab at the top.</p>
                <p>3. Double-click <strong>AL WAKEELO</strong>.</p>
                <p className="text-emerald-500 font-semibold pt-2">🎉 AL WAKEELO will open in your Word sidebar with full case law search, contract drafting, and court formatting tools!</p>
              </div>
            </div>
          </div>
        )}

        {/* MACOS GUIDE */}
        {platform === "mac" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Download Manifest File</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Click the gold button at the top to download alwakeelo-manifest.xml.</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2 pl-13">
                <p>1. Download <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">alwakeelo-manifest.xml</code> above to your Mac Downloads folder.</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Copy to Mac Word Add-in Folder</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Place manifest in the macOS Word Add-ins directory (wef).</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2 pl-13">
                <p>1. Open <strong>Finder</strong> on your Mac.</p>
                <p>2. Press <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-bold">Cmd + Shift + G</code> (Go to Folder).</p>
                <p>3. Paste this path and press Enter:</p>
                <div className="bg-muted p-3 rounded-lg font-mono text-[11px] text-primary break-all">
                  ~/Library/Containers/com.microsoft.Word/Data/Documents/wef
                </div>
                <p>4. Move <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">manifest.xml</code> into this <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-bold">wef</code> folder. *(If the folder doesn't exist, create it).*</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Open Word on Mac</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Activate AL WAKEELO from My Add-ins.</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2 pl-13">
                <p>1. Open <strong>Microsoft Word</strong> for Mac.</p>
                <p>2. Go to <strong>Insert</strong> menu &rarr; click <strong>My Add-ins</strong> dropdown.</p>
                <p>3. Under <strong>Developer Add-ins</strong>, click <strong>AL WAKEELO</strong>.</p>
                <p className="text-emerald-500 font-semibold pt-2">🎉 AL WAKEELO is ready to use on macOS Word!</p>
              </div>
            </div>
          </div>
        )}

        {/* WORD WEB GUIDE */}
        {platform === "web" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Open Word Online (Browser)</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Go to office.com or word.office.com in Chrome, Edge, or Safari.</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2 pl-13">
                <p>1. Sign in to your Microsoft account at <a href="https://word.office.com" target="_blank" rel="noreferrer" className="text-primary underline">word.office.com</a>.</p>
                <p>2. Open a document.</p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-6 shadow-sm">
              <div className="flex items-center gap-3 pb-4 border-b border-border">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="font-bold text-foreground text-base">Upload Custom Add-in Manifest</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Upload manifest.xml directly into Word Online.</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2 pl-13">
                <p>1. Click <strong>Insert</strong> tab on top ribbon &rarr; click <strong>Add-ins</strong>.</p>
                <p>2. Select <strong>My Add-ins</strong> &rarr; click <strong>Upload My Add-in</strong> (top right).</p>
                <p>3. Browse and select your downloaded <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">manifest.xml</code> file.</p>
                <p>4. Click <strong>Upload</strong>.</p>
                <p className="text-emerald-500 font-semibold pt-2">🎉 AL WAKEELO will launch inside Word Web!</p>
              </div>
            </div>
          </div>
        )}

        {/* FAQ SECTION */}
        <div className="mt-12 bg-card border border-border rounded-2xl p-8 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
            <HelpCircle size={20} className="text-primary" />
            Frequently Asked Questions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs leading-relaxed text-muted-foreground">
            <div>
              <h4 className="font-bold text-foreground mb-1">Is this add-in free?</h4>
              <p>Yes. Direct manifest sideloading is 100% free with no Microsoft Store fees.</p>
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-1">How does the add-in update?</h4>
              <p>Updates are pushed automatically from our server. You never have to re-install manifest.xml.</p>
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-1">Does it support Pakistani case law?</h4>
              <p>Yes, searches 600,000+ court judgments (PLD, SCMR, YLR) and 5,900+ Pakistani statutes.</p>
            </div>
            <div>
              <h4 className="font-bold text-foreground mb-1">Does Court Format work in 1-click?</h4>
              <p>Yes, applies 1.5" left margin for court binding, Times New Roman 14pt, and double line spacing.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <Link href="/dashboard" className="text-primary hover:text-primary text-sm font-semibold transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
