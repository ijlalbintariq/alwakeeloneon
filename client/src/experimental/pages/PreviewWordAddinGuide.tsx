import React, { useState } from "react";
import { Link } from "wouter";
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
  Check,
  Sparkles,
  Code2,
  ExternalLink,
  BookOpen,
  Gavel,
  ShieldAlert,
  Layers
} from "lucide-react";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";

type GuidePlatform = "windows" | "mac" | "web";

export default function PreviewWordAddinGuide() {
  const [platform, setPlatform] = useState<GuidePlatform>("windows");
  const [copied, setCopied] = useState(false);
  const [manifestModalOpen, setManifestModalOpen] = useState(false);

  const manifestUrl = "https://alwakeelo.com/word-addin/manifest.xml";

  const copyManifestUrl = () => {
    navigator.clipboard.writeText(manifestUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sampleManifestXml = `<?xml version="1.0" encoding="UTF-8"?>
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
           xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
           xsi:type="TaskpaneApp">
  <Id>b29f45d1-92e1-4c12-9c31-7e8c0498a1a2</Id>
  <Version>2.4.0</Version>
  <ProviderName>Majnoon Studio (Al Wakeelo Legal AI)</ProviderName>
  <DefaultLocale>en-US</DefaultLocale>
  <DisplayName DefaultValue="AL WAKEELO AI Legal Assistant" />
  <Description DefaultValue="Pakistani Case Law Research, 83k Statutes Lookup &amp; Court Drafting Studio inside Microsoft Word" />
  <IconUrl DefaultValue="https://alwakeelo.com/logo-32.png" />
  <HighResolutionIconUrl DefaultValue="https://alwakeelo.com/logo-64.png" />
  <SupportUrl DefaultValue="https://alwakeelo.com/preview/contact" />
  <AppDomains>
    <AppDomain>https://alwakeelo.com</AppDomain>
  </AppDomains>
  <Hosts>
    <Host Name="Document" />
  </Hosts>
  <DefaultSettings>
    <SourceLocation DefaultValue="https://alwakeelo.com/word-addin/taskpane.html" />
  </DefaultSettings>
  <Permissions>ReadWriteDocument</Permissions>
</OfficeApp>`;

  const addinFeatures = [
    {
      title: "600,000+ Case Law Precedent Research",
      description: "Search Supreme Court and High Court rulings (SCMR, PLD, CLC, PCrLJ) and insert verified legal ratios into your Word brief with 1-click.",
      icon: <Gavel className="w-5 h-5 text-[#105B38]" />,
    },
    {
      title: "5,887 Acts & 83,117 Sections Concordance",
      description: "Lookup PPC, CrPC, CPC, PECA, Specific Relief, and Limitation Act articles in the sidebar and inject verbatim clauses into active paragraphs.",
      icon: <BookOpen className="w-5 h-5 text-[#105B38]" />,
    },
    {
      title: "1-Click Pakistani High Court Formatting",
      description: "Instantly applies 1.5-inch left margin for court ribbon binding, Times New Roman 13pt/14pt typography, and standardized paragraph indentation.",
      icon: <FileText className="w-5 h-5 text-[#105B38]" />,
    },
    {
      title: "Commercial Contract Risk & Redline Auditor",
      description: "Scans your Word agreement for missing dispute resolution clauses, invalid restraint of trade (S.27 Contract Act), and tax withholding oversights.",
      icon: <ShieldAlert className="w-5 h-5 text-[#105B38]" />,
    },
  ];

  return (
    <PublicPreviewShell>
      <div className="space-y-12 md:space-y-16 max-w-5xl mx-auto">
        {/* ── TOP HEADER ── */}
        <section className="text-center space-y-4 pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#EBF5F0] dark:bg-[#105B38]/20 border border-[#A3D4BC] dark:border-[#10B981]/30 rounded-full text-xs text-[#105B38] font-bold uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5 text-[#105B38]" />
            Official Microsoft 365 Add-in Guide
          </div>
          <h1
            className="text-4xl sm:text-5xl font-extrabold text-[#0F172A] dark:text-[#F8FAFC] tracking-tight leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Alwakeelo Legal AI inside Microsoft Word
          </h1>
          <p className="text-sm sm:text-base text-[#334155] dark:text-[#CBD5E1] leading-relaxed max-w-2xl mx-auto">
            Draft High Court petitions, research 600,000+ judgments, check 83k statutes, and audit commercial contracts directly inside Microsoft Word on Windows, Mac, or Word Web for <strong className="text-[#105B38]">100% Free</strong>.
          </p>

          {/* ── MANIFEST DOWNLOAD BANNER ── */}
          <div className="mt-8 max-w-2xl mx-auto bg-white dark:bg-[#131E2E] border border-[#A3D4BC] dark:border-[#10B981]/30 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-[#105B38] uppercase tracking-wider block">
                Step 1: Manifest Sideloading File
              </span>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC] font-mono">
                alwakeelo-manifest.xml
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                Free XML manifest required to load Alwakeelo into Word
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
              <a
                href="/word-addin/manifest.xml"
                download="alwakeelo-manifest.xml"
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#105B38] hover:bg-[#0D4A2E] text-white font-bold rounded-xl text-xs transition-all shadow-sm"
              >
                <Download className="w-4 h-4" /> Download Manifest
              </a>
              <button
                onClick={copyManifestUrl}
                className="p-2.5 bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#E2E8F0] text-[#0F172A] dark:text-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold transition-all"
                title="Copy Manifest URL"
              >
                {copied ? <Check className="w-4 h-4 text-[#105B38]" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setManifestModalOpen(true)}
                className="p-2.5 bg-[#F8FAFC] dark:bg-[#0B131E] hover:bg-[#E2E8F0] text-[#0F172A] dark:text-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold transition-all"
                title="View XML Content"
              >
                <Code2 className="w-4 h-4 text-[#105B38]" />
              </button>
            </div>
          </div>
        </section>

        {/* ── PLATFORM TOGGLE TABS ── */}
        <div className="flex justify-center gap-2 sm:gap-3">
          <button
            onClick={() => setPlatform("windows")}
            className={`flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              platform === "windows"
                ? "bg-[#105B38] text-white shadow-md shadow-[#105B38]/20"
                : "bg-white dark:bg-[#131E2E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44]"
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Windows PC</span>
          </button>

          <button
            onClick={() => setPlatform("mac")}
            className={`flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              platform === "mac"
                ? "bg-[#105B38] text-white shadow-md shadow-[#105B38]/20"
                : "bg-white dark:bg-[#131E2E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44]"
            }`}
          >
            <Apple className="w-4 h-4" />
            <span>macOS (Mac)</span>
          </button>

          <button
            onClick={() => setPlatform("web")}
            className={`flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
              platform === "web"
                ? "bg-[#105B38] text-white shadow-md shadow-[#105B38]/20"
                : "bg-white dark:bg-[#131E2E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] border border-[#E2E8F0] dark:border-[#1E2D44]"
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Word Web (Online)</span>
          </button>
        </div>

        {/* ── WINDOWS SETUP GUIDE ── */}
        {platform === "windows" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
              <div className="flex items-center gap-3.5 pb-3 border-b border-[#F1F5F9]">
                <div className="w-9 h-9 rounded-xl bg-[#EBF5F0] dark:bg-[#105B38]/20 text-[#105B38] flex items-center justify-center font-bold font-mono">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm sm:text-base">
                    Save Manifest File in a Dedicated Folder
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Create a local folder on your computer for the add-in.</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed space-y-2 pl-2 sm:pl-12">
                <p>1. Download the <code className="bg-[#F1F5F9] dark:bg-[#1E2D44] px-1.5 py-0.5 rounded text-[#0F172A] dark:text-[#F8FAFC] font-mono">alwakeelo-manifest.xml</code> file above.</p>
                <p>2. Create a folder on your drive, e.g.: <code className="bg-[#EBF5F0] dark:bg-[#105B38]/20 px-2 py-0.5 rounded text-[#105B38] font-mono font-bold">C:\AlWakeeloAddin\</code></p>
                <p>3. Move the downloaded XML file into <code className="bg-[#EBF5F0] dark:bg-[#105B38]/20 px-2 py-0.5 rounded text-[#105B38] font-mono font-bold">C:\AlWakeeloAddin\</code>.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
              <div className="flex items-center gap-3.5 pb-3 border-b border-[#F1F5F9]">
                <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center font-bold font-mono">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm sm:text-base">
                    Configure Trusted Add-in Catalog in Word
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Grant Microsoft Word permission to trust your local folder.</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed space-y-2 pl-2 sm:pl-12">
                <p>1. Open <strong>Microsoft Word</strong> desktop app.</p>
                <p>2. Click <strong>File</strong> (top-left) &rarr; select <strong>Options</strong> (bottom-left).</p>
                <p>3. In the Options window, click <strong>Trust Center</strong> &rarr; click the <strong>Trust Center Settings...</strong> button.</p>
                <p>4. Select <strong>Trusted Add-in Catalogs</strong> on the left side.</p>
                <p>5. In <strong>Catalog URL</strong>, enter: <code className="bg-[#EBF5F0] dark:bg-[#105B38]/20 px-2 py-0.5 rounded text-[#105B38] font-mono font-bold">C:\AlWakeeloAddin\</code></p>
                <p>6. Click <strong>Add catalog</strong>, and check the box under <strong className="text-[#0F172A] dark:text-[#F8FAFC]">Show in Menu ☑️</strong>.</p>
                <p>7. Click <strong>OK</strong> and restart Microsoft Word.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
              <div className="flex items-center gap-3.5 pb-3 border-b border-[#F1F5F9]">
                <div className="w-9 h-9 rounded-xl bg-[#EBF5F0] dark:bg-[#105B38]/20 text-[#105B38] flex items-center justify-center font-bold font-mono">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm sm:text-base">
                    Launch Alwakeelo inside Word Ribbon
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Open your add-in from the Shared Folder catalog.</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed space-y-2 pl-2 sm:pl-12">
                <p>1. In Word, go to the top ribbon &rarr; click <strong>Insert</strong> &rarr; click <strong>My Add-ins</strong>.</p>
                <p>2. Click the <strong>SHARED FOLDER</strong> tab at the top.</p>
                <p>3. Double-click <strong>AL WAKEELO</strong>.</p>
                <p className="text-[#105B38] font-semibold pt-1">
                  🎉 Alwakeelo will open in your Word sidebar with full case law search, contract drafting, and Pakistani court formatting tools!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── MACOS SETUP GUIDE ── */}
        {platform === "mac" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
              <div className="flex items-center gap-3.5 pb-3 border-b border-[#F1F5F9]">
                <div className="w-9 h-9 rounded-xl bg-[#EBF5F0] dark:bg-[#105B38]/20 text-[#105B38] flex items-center justify-center font-bold font-mono">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm sm:text-base">
                    Download alwakeelo-manifest.xml
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Download the manifest file to your Mac Downloads folder.</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed space-y-2 pl-2 sm:pl-12">
                <p>1. Download the manifest file using the green button at the top.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
              <div className="flex items-center gap-3.5 pb-3 border-b border-[#F1F5F9]">
                <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center font-bold font-mono">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm sm:text-base">
                    Copy Manifest to macOS Word Directory
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Move manifest into macOS Word's wef folder.</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed space-y-2 pl-2 sm:pl-12">
                <p>1. Open <strong>Finder</strong> on your Mac.</p>
                <p>2. Press <code className="bg-[#F1F5F9] dark:bg-[#1E2D44] px-2 py-0.5 rounded font-mono font-bold text-[#105B38]">Cmd + Shift + G</code> (Go to Folder).</p>
                <p>3. Paste the following path and press Enter:</p>
                <div className="p-3 bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-xl font-mono text-xs text-[#105B38] select-all break-all">
                  ~/Library/Containers/com.microsoft.Word/Data/Documents/wef
                </div>
                <p>4. Move <code className="bg-[#F1F5F9] dark:bg-[#1E2D44] px-1.5 py-0.5 rounded font-mono text-[#0F172A] dark:text-[#F8FAFC]">alwakeelo-manifest.xml</code> into this <code className="font-mono text-[#105B38]">wef</code> folder. *(If the folder doesn't exist, simply create a new folder named 'wef')*.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
              <div className="flex items-center gap-3.5 pb-3 border-b border-[#F1F5F9]">
                <div className="w-9 h-9 rounded-xl bg-[#EBF5F0] dark:bg-[#105B38]/20 text-[#105B38] flex items-center justify-center font-bold font-mono">
                  3
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm sm:text-base">
                    Activate AL WAKEELO on Word for Mac
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Launch the sidebar from Developer Add-ins.</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed space-y-2 pl-2 sm:pl-12">
                <p>1. Open <strong>Microsoft Word for Mac</strong>.</p>
                <p>2. In the top menu, go to <strong>Insert</strong> &rarr; click <strong>My Add-ins</strong>.</p>
                <p>3. Under <strong>Developer Add-ins</strong>, click <strong>AL WAKEELO</strong>.</p>
                <p className="text-[#105B38] font-semibold pt-1">
                  🎉 Alwakeelo is now operational inside your Mac Word environment!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── WORD WEB GUIDE ── */}
        {platform === "web" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
              <div className="flex items-center gap-3.5 pb-3 border-b border-[#F1F5F9]">
                <div className="w-9 h-9 rounded-xl bg-[#EBF5F0] dark:bg-[#105B38]/20 text-[#105B38] flex items-center justify-center font-bold font-mono">
                  1
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm sm:text-base">
                    Open Word Online in Browser
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Sign in to Microsoft Word in Chrome, Edge, or Safari.</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed space-y-2 pl-2 sm:pl-12">
                <p>1. Go to <a href="https://word.office.com" target="_blank" rel="noreferrer" className="text-[#105B38] font-semibold underline inline-flex items-center gap-1">word.office.com <ExternalLink className="w-3 h-3" /></a>.</p>
                <p>2. Open any document or create a new blank legal draft.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl p-6 sm:p-7 space-y-4 shadow-sm">
              <div className="flex items-center gap-3.5 pb-3 border-b border-[#F1F5F9]">
                <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#1D4ED8] flex items-center justify-center font-bold font-mono">
                  2
                </div>
                <div>
                  <h3 className="font-bold text-[#0F172A] dark:text-[#F8FAFC] text-sm sm:text-base">
                    Upload Custom Manifest XML
                  </h3>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Sideload the XML file directly into the online taskpane.</p>
                </div>
              </div>
              <div className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed space-y-2 pl-2 sm:pl-12">
                <p>1. In Word Web ribbon, click <strong>Insert</strong> &rarr; click <strong>Add-ins</strong>.</p>
                <p>2. Select <strong>My Add-ins</strong> &rarr; click <strong>Upload My Add-in</strong> (top right).</p>
                <p>3. Browse and select your downloaded <code className="font-mono text-[#0F172A] dark:text-[#F8FAFC]">alwakeelo-manifest.xml</code>.</p>
                <p>4. Click <strong>Upload</strong>.</p>
                <p className="text-[#105B38] font-semibold pt-1">
                  🎉 Alwakeelo taskpane will mount instantly inside your Word Web tab!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── ADD-IN FEATURES SHOWCASE ── */}
        <section className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="text-center space-y-1">
            <h3
              className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Key Capabilities inside Microsoft Word
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              Never leave Microsoft Word to search law reporters or look up statutory sections again.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {addinFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="p-5 bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-2xl space-y-2 hover:border-[#A3D4BC] dark:border-[#10B981]/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EBF5F0] dark:bg-[#105B38]/20 flex items-center justify-center text-[#105B38]">
                  {feat.icon}
                </div>
                <h4 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">{feat.title}</h4>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── TROUBLESHOOTING & FAQ ── */}
        <section className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <h3
            className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            <HelpCircle className="w-5 h-5 text-[#105B38]" />
            Word Add-in Frequently Asked Questions
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
            <div className="space-y-1">
              <h4 className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Is this Add-in 100% free to sideload?</h4>
              <p className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Yes. Direct manifest sideloading bypasses the Microsoft AppSource store fees and is completely free for all Pakistani advocates.</p>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Do I need to re-download the manifest for updates?</h4>
              <p className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">No. The manifest file references our live serverless endpoints. All dataset upgrades and statutory amendments update automatically in your Word sidebar.</p>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Does 1-Click Court Formatting work on existing briefs?</h4>
              <p className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Yes. It applies Pakistani High Court formatting rules (1.5" left margin, Times New Roman 13/14pt, double line spacing) directly to your active document selection.</p>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-[#0F172A] dark:text-[#F8FAFC]">Need technical assistance during sideloading?</h4>
              <p className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Contact our chamber technical desk on WhatsApp at <a href="https://wa.me/923358341897" target="_blank" rel="noreferrer" className="text-[#105B38] font-mono font-bold underline">+92 335 834 1897</a>.</p>
            </div>
          </div>
        </section>

        {/* ── MANIFEST XML MODAL ── */}
        {manifestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] flex flex-col space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-[#105B38]" />
                  <h3 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC] font-mono">
                    alwakeelo-manifest.xml
                  </h3>
                </div>
                <button
                  onClick={() => setManifestModalOpen(false)}
                  className="px-2.5 py-1 text-xs font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC]"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#0F172A] text-[#F8FAFC] p-4 rounded-xl font-mono text-[11px] leading-relaxed custom-scrollbar">
                <pre>{sampleManifestXml}</pre>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#F1F5F9]">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(sampleManifestXml);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-4 py-2 bg-[#105B38] text-white text-xs font-bold rounded-xl hover:bg-[#0D4A2E] transition-colors inline-flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? "Copied XML!" : "Copy XML to Clipboard"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PublicPreviewShell>
  );
}
