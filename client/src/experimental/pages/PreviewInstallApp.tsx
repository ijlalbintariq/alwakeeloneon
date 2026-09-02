import React, { useState } from "react";
import { Link } from "wouter";
import {
  Smartphone,
  Monitor,
  Apple,
  Chrome,
  ArrowDown,
  Share,
  MoreVertical,
  Plus,
  ExternalLink,
  CheckCircle2,
  Menu,
  Download,
  FileText,
  Sparkles,
  Zap,
  ShieldCheck,
  Globe,
  Layers,
  ArrowRight
} from "lucide-react";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";

type Platform = "ios" | "android" | "windows" | "mac";

export default function PreviewInstallApp() {
  const [platform, setPlatform] = useState<Platform>("ios");

  const platforms: { id: Platform; label: string; icon: React.ReactNode; sublabel: string }[] = [
    { id: "ios", label: "iPhone / iPad", icon: <Apple className="w-5 h-5" />, sublabel: "Safari Browser" },
    { id: "android", label: "Android", icon: <Chrome className="w-5 h-5" />, sublabel: "Chrome & Samsung" },
    { id: "windows", label: "Windows PC", icon: <Monitor className="w-5 h-5" />, sublabel: "Edge / Chrome" },
    { id: "mac", label: "macOS (Mac)", icon: <Apple className="w-5 h-5" />, sublabel: "Safari / Chrome" },
  ];

  const iosSteps = [
    {
      step: 1,
      title: "Open Alwakeelo in Safari",
      description: "Ensure you are using Apple Safari on your iPhone or iPad. Web App installation is natively supported in Safari.",
      tip: "Navigate to https://alwakeelo.com/preview",
      icon: <ExternalLink className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 2,
      title: "Tap the Share Icon",
      description: "Tap the Share button located at the bottom toolbar of Safari (the square icon with an upward-pointing arrow).",
      tip: "If in landscape, the share button is in the top navigation bar.",
      icon: <Share className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 3,
      title: "Select 'Add to Home Screen'",
      description: "Scroll down the Share Sheet menu options and tap 'Add to Home Screen' (with the square plus icon).",
      tip: "You can swipe down to locate the option quickly.",
      icon: <Plus className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 4,
      title: "Confirm & Launch Alwakeelo",
      description: "Confirm the title 'Al Wakeelo' and tap 'Add' in the top-right corner. The golden Alwakeelo icon will appear on your iOS home screen.",
      tip: "Launches in standalone fullscreen with 0ms loading time.",
      icon: <CheckCircle2 className="w-6 h-6 text-[#105B38]" />,
    },
  ];

  const androidSteps = [
    {
      step: 1,
      title: "Open in Google Chrome",
      description: "Open the Alwakeelo platform in Google Chrome or Samsung Internet on your Android phone or tablet.",
      tip: "Visit https://alwakeelo.com/preview",
      icon: <Chrome className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 2,
      title: "Tap the 3-Dots Menu",
      description: "Tap the three vertical dots (⋮) located in the top-right corner of the Chrome browser window.",
      tip: "Opens Chrome's browser actions dropdown.",
      icon: <MoreVertical className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 3,
      title: "Tap 'Install App' or 'Add to Home Screen'",
      description: "From the menu list, tap 'Install app' or 'Add to Home screen'. Chrome will prompt for installation approval.",
      tip: "An automated install banner may also appear at the bottom.",
      icon: <Plus className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 4,
      title: "Complete Installation",
      description: "Tap 'Install' in the confirmation dialogue. Alwakeelo will be installed directly into your Android app drawer.",
      tip: "Fully supports Android system notifications for court diary hearings.",
      icon: <CheckCircle2 className="w-6 h-6 text-[#105B38]" />,
    },
  ];

  const windowsSteps = [
    {
      step: 1,
      title: "Open in Microsoft Edge or Google Chrome",
      description: "Navigate to Alwakeelo in Microsoft Edge or Chrome on your Windows 10/11 workstation.",
      tip: "Recommended for seamless desktop multitasking.",
      icon: <Monitor className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 2,
      title: "Click the App Install Icon in Address Bar",
      description: "Look at the right side of the address bar (URL bar). Click the small computer monitor with a down arrow (or 'App available' icon).",
      tip: "Shortcut in Edge: Menu (3 dots) &rarr; Apps &rarr; 'Install Alwakeelo'.",
      icon: <ArrowDown className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 3,
      title: "Click 'Install'",
      description: "A pop-up will prompt 'Install app?'. Click 'Install'. The platform will detach into its own clean desktop window.",
      tip: "Runs without browser URL bars, tabs, or bookmarks clutter.",
      icon: <Plus className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 4,
      title: "Pin to Taskbar & Start Menu",
      description: "Check 'Pin to taskbar' and 'Pin to Start'. You can now launch Alwakeelo with 1-click just like a native Windows application.",
      tip: "Press Windows Key and search 'Al Wakeelo' anytime.",
      icon: <CheckCircle2 className="w-6 h-6 text-[#105B38]" />,
    },
  ];

  const macSteps = [
    {
      step: 1,
      title: "Open in Safari or Chrome on macOS",
      description: "Open Alwakeelo in Safari (macOS Sonoma / Sequoia) or Google Chrome on your MacBook or iMac.",
      tip: "Supports Apple Silicon M1/M2/M3 native acceleration.",
      icon: <Apple className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 2,
      title: "In Safari: File &rarr; 'Add to Dock'",
      description: "If using Safari, click 'File' in the top macOS menu bar &rarr; select 'Add to Dock'. If in Chrome, click the Install icon in the address bar.",
      tip: "macOS Web Apps feature creates a dedicated .app package.",
      icon: <Share className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 3,
      title: "Confirm App Name",
      description: "Confirm the title 'Al Wakeelo' and click 'Add'. The app will be placed directly into your macOS Dock and Applications folder.",
      tip: "Icon is high-resolution Retina Display optimized.",
      icon: <Plus className="w-6 h-6 text-[#105B38]" />,
    },
    {
      step: 4,
      title: "Launch from Spotlight or Dock",
      description: "Click the Alwakeelo icon in your Dock or press Cmd + Space and type 'Al Wakeelo'. It runs in an isolated, distraction-free macOS window.",
      tip: "Supports native macOS Stage Manager and split-view windows.",
      icon: <CheckCircle2 className="w-6 h-6 text-[#105B38]" />,
    },
  ];

  const stepsByPlatform: Record<Platform, typeof iosSteps> = {
    ios: iosSteps,
    android: androidSteps,
    windows: windowsSteps,
    mac: macSteps,
  };

  const currentSteps = stepsByPlatform[platform];

  return (
    <PublicPreviewShell>
      <div className="space-y-12 md:space-y-16 max-w-4xl mx-auto">
        {/* ── HEADER ── */}
        <section className="text-center space-y-4 pt-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#EBF5F0] border border-[#A3D4BC] rounded-full text-xs text-[#105B38] font-bold uppercase tracking-wider">
            <Smartphone className="w-3.5 h-3.5 text-[#105B38]" />
            Multi-Platform Installation Guide
          </div>
          <h1
            className="text-4xl sm:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-tight"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Install Alwakeelo on Mobile &amp; Desktop
          </h1>
          <p className="text-sm sm:text-base text-[#334155] leading-relaxed max-w-2xl mx-auto">
            Experience lightning-fast legal research with 0ms launch speed. Install Alwakeelo as a native Progressive Web App on your iPhone, Android phone, Windows PC, or Mac — no App Store or Play Store account required.
          </p>
        </section>

        {/* ── PLATFORM TOGGLE TABS ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {platforms.map((p) => {
            const isSelected = platform === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 ${
                  isSelected
                    ? "bg-[#105B38] text-white border-[#105B38] shadow-md shadow-[#105B38]/20"
                    : "bg-white border-[#E2E8F0] text-[#334155] hover:border-[#A3D4BC] hover:bg-[#F8FAFC]"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isSelected ? "bg-white/20 text-white" : "bg-[#EBF5F0] text-[#105B38]"
                }`}>
                  {p.icon}
                </div>
                <div>
                  <h3 className={`text-xs font-bold ${isSelected ? "text-white" : "text-[#0F172A]"}`}>
                    {p.label}
                  </h3>
                  <p className={`text-[10px] ${isSelected ? "text-white/80" : "text-[#64748B]"}`}>
                    {p.sublabel}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── STEP-BY-STEP CARDS ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2
              className="text-lg font-bold text-[#0F172A]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Step-by-Step Installation for {platforms.find((p) => p.id === platform)?.label}
            </h2>
            <span className="text-xs font-bold text-[#105B38] bg-[#EBF5F0] px-2.5 py-1 rounded-full border border-[#A3D4BC]">
              4 Quick Steps (~30 seconds)
            </span>
          </div>

          <div className="space-y-3.5">
            {currentSteps.map((step) => (
              <div
                key={step.step}
                className="bg-white border border-[#E2E8F0] rounded-2xl p-5 sm:p-6 flex items-start gap-4 sm:gap-5 shadow-sm hover:border-[#A3D4BC] transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-[#EBF5F0] border border-[#A3D4BC] flex items-center justify-center shrink-0">
                  {step.icon}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#105B38] bg-[#EBF5F0] px-2 py-0.5 rounded">
                      Step {step.step}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-[#0F172A]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-xs sm:text-sm text-[#334155] leading-relaxed">
                    {step.description}
                  </p>
                  <p className="text-[11px] font-medium text-[#64748B] pt-0.5 flex items-center gap-1">
                    <span className="text-[#105B38] font-bold">Tip:</span> {step.tip}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── VALUE PROPOSITIONS GRID ── */}
        <section className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="text-center space-y-1">
            <h3
              className="text-lg font-bold text-[#0F172A]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Why Advocates Prefer the PWA Experience
            </h3>
            <p className="text-xs text-[#64748B]">
              Engineered for busy courtrooms, High Court libraries, and on-the-go chamber management.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl space-y-2 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#EBF5F0] flex items-center justify-center text-[#105B38] mx-auto">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-[#0F172A]">Instant 0ms Launch</h4>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Cached core assets load instantaneously without waiting for browser navigation.
              </p>
            </div>

            <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl space-y-2 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#1D4ED8] mx-auto">
                <Layers className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-[#0F172A]">Distraction-Free Fullscreen</h4>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Hides browser URL bars and tabs for maximum screen real estate during drafting.
              </p>
            </div>

            <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl space-y-2 text-center">
              <div className="w-10 h-10 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#B45309] mx-auto">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-xs font-bold text-[#0F172A]">Seamless Auto-Updates</h4>
              <p className="text-[11px] text-[#64748B] leading-relaxed">
                Always runs the newest statute amendments and precedent database silently in the background.
              </p>
            </div>
          </div>
        </section>

        {/* ── SISTER GUIDE: WORD ADD-IN LINK ── */}
        <section className="bg-gradient-to-br from-[#105B38] to-[#0D4A2E] text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
          <div className="space-y-1.5 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-wider text-[#A3D4BC]">
              <FileText className="w-3 h-3" /> Microsoft Word Add-in
            </div>
            <h3
              className="text-xl sm:text-2xl font-bold text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Also Need Alwakeelo Directly inside Microsoft Word?
            </h3>
            <p className="text-xs text-white/80 max-w-lg">
              Research 600k+ judgments and insert verified statutory clauses directly into your Word documents with our free sideloading add-in.
            </p>
          </div>
          <Link
            href="/preview/word-addin-guide"
            className="px-5 py-3 bg-white text-[#105B38] hover:bg-[#EBF5F0] text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shrink-0 inline-flex items-center gap-2"
          >
            <span>Word Add-in Setup Guide</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>
      </div>
    </PublicPreviewShell>
  );
}
