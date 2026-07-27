import { useState } from "react";
import { Smartphone, Monitor, Apple, Chrome, ArrowDown, Share, MoreVertical, Plus, ExternalLink, CheckCircle2, Menu, Download, FileText } from "lucide-react";
import { Link } from "wouter";
import { useDocumentHead } from "@/hooks/use-document-head";

type Platform = "ios" | "android" | "desktop";

const platforms: { id: Platform; label: string; icon: React.ReactNode }[] = [
  { id: "ios", label: "iPhone / iPad", icon: <Apple size={20} /> },
  { id: "android", label: "Android", icon: <Chrome size={20} /> },
  { id: "desktop", label: "Desktop", icon: <Monitor size={20} /> },
];

const iosSteps = [
  {
    step: 1,
    title: "Open in Safari",
    description: "Make sure you're using the Safari browser. This feature only works in Safari on iOS.",
    icon: <ExternalLink size={24} className="text-primary" />,
  },
  {
    step: 2,
    title: 'Tap the Share Button',
    description: 'Tap the Share icon at the bottom of the screen (the square with an arrow pointing up).',
    icon: <Share size={24} className="text-primary" />,
  },
  {
    step: 3,
    title: '"Add to Home Screen"',
    description: 'Scroll down in the share menu and tap "Add to Home Screen". You may need to scroll right to find it.',
    icon: <Plus size={24} className="text-primary" />,
  },
  {
    step: 4,
    title: "Name & Add",
    description: 'You can rename the app if you wish. Tap "Add" in the top right corner. The app icon will appear on your home screen.',
    icon: <CheckCircle2 size={24} className="text-emerald-400" />,
  },
];

const androidSteps = [
  {
    step: 1,
    title: "Open in Chrome",
    description: "Open Al Wakeelo in the Chrome browser on your Android device.",
    icon: <Chrome size={24} className="text-primary" />,
  },
  {
    step: 2,
    title: "Tap the Menu",
    description: 'Tap the three-dot menu icon in the top right corner of Chrome.',
    icon: <MoreVertical size={24} className="text-primary" />,
  },
  {
    step: 3,
    title: '"Add to Home Screen"',
    description: 'Find and tap "Add to Home screen" or "Install app" in the menu.',
    icon: <Plus size={24} className="text-primary" />,
  },
  {
    step: 4,
    title: "Install",
    description: 'Tap "Add" or "Install" to confirm. The app will be added to your home screen for instant access.',
    icon: <CheckCircle2 size={24} className="text-emerald-400" />,
  },
];

const desktopSteps = [
  {
    step: 1,
    title: "Open in Chrome or Edge",
    description: "Navigate to Al Wakeelo in Google Chrome or Microsoft Edge on your computer.",
    icon: <Chrome size={24} className="text-primary" />,
  },
  {
    step: 2,
    title: "Look for Install Icon",
    description: 'In Chrome, look for the install icon in the address bar (a monitor with a down arrow). In Edge, look for the "App available" icon.',
    icon: <ArrowDown size={24} className="text-primary" />,
  },
  {
    step: 3,
    title: "Click Install",
    description: 'Click "Install" when prompted. The app will open in its own window, separate from your browser.',
    icon: <Plus size={24} className="text-primary" />,
  },
  {
    step: 4,
    title: "Access Anytime",
    description: "Find Al Wakeelo in your Start Menu (Windows) or Applications folder (Mac). You can also pin it to your taskbar or dock.",
    icon: <CheckCircle2 size={24} className="text-emerald-400" />,
  },
];

const stepsByPlatform: Record<Platform, typeof iosSteps> = {
  ios: iosSteps,
  android: androidSteps,
  desktop: desktopSteps,
};

export default function InstallAppPage() {
  useDocumentHead({
    title: "Install Al Wakeelo on iPhone, Android, or Desktop",
    description: "Install Al Wakeelo as a PWA on iPhone, Android, or desktop. Quick setup guides for iOS Safari, Android Chrome, and Chrome/Edge on Windows and macOS.",
    path: "/install",
  });
  const [platform, setPlatform] = useState<Platform>("ios");
  const steps = stepsByPlatform[platform];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-primary text-xs font-bold uppercase tracking-widest mb-4">
            <Smartphone size={14} />
            Install Guide
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
            Add Al Wakeelo to Your Home Screen
          </h1>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Get instant access to your AI legal assistant. Open Al Wakeelo like a native app — no app store required.
          </p>
        </div>

        <div className="flex justify-center gap-3 mb-10">
          {platforms.map(p => (
            <button
              key={p.id}
              onClick={() => setPlatform(p.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${
                platform === p.id
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {p.icon}
              <span className="hidden sm:inline">{p.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {steps.map((step, i) => (
            <div
              key={i}
              className="bg-card border border-border/50 rounded-2xl p-6 flex items-start gap-5 hover:border-primary/30 transition-colors"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-card rounded-xl flex items-center justify-center border border-border">
                {step.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">Step {step.step}</span>
                </div>
                <h3 className="text-foreground font-bold text-base mb-1">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 bg-gradient-to-br from-primary/10 to-slate-800/50 border border-primary/20 rounded-2xl p-8 text-center">
          <h3 className="text-lg font-bold text-foreground mb-2">Why Install as an App?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="p-4 bg-background/50 rounded-xl">
              <Smartphone size={24} className="text-primary mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Instant Access</p>
              <p className="text-xs text-muted-foreground mt-1">One tap from your home screen. No browser needed.</p>
            </div>
            <div className="p-4 bg-background/50 rounded-xl">
              <Menu size={24} className="text-primary mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Full Screen</p>
              <p className="text-xs text-muted-foreground mt-1">No browser bars. Clean, native-like experience.</p>
            </div>
            <div className="p-4 bg-background/50 rounded-xl">
              <CheckCircle2 size={24} className="text-primary mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Always Updated</p>
              <p className="text-xs text-muted-foreground mt-1">Always runs the latest version automatically.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-6">
          <Link href="/word-addin-guide" className="text-[#C9A84C] hover:underline text-sm font-semibold transition-colors flex items-center gap-1.5">
            <FileText size={16} /> Microsoft Word Add-in Setup Guide &rarr;
          </Link>
          <Link href="/dashboard" className="text-primary hover:underline text-sm font-semibold transition-colors">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
