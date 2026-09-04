import React, { useState, useEffect } from "react";
import {
  Building,
  Scale,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Award,
  BookOpen,
  FileText,
  Briefcase,
  Zap,
  Check,
  Info,
  MapPin,
  Users,
  Brain,
  Sliders,
  Layers,
} from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useDocumentHead } from "@/hooks/use-document-head";

interface PracticeArea {
  id: string;
  name: string;
  category: string;
  codes: string;
  icon: React.ReactNode;
  popular?: boolean;
}

const PRACTICE_AREAS: PracticeArea[] = [
  {
    id: "civil",
    name: "Civil Litigation & Land Laws",
    category: "Civil",
    codes: "CPC 1908 · SRA 1877 · Land Revenue Act",
    icon: <Scale className="w-5 h-5" />,
    popular: true,
  },
  {
    id: "criminal",
    name: "Criminal Defense & Bail",
    category: "Criminal",
    codes: "PPC 1860 · CrPC 1898 · CNSA 1997",
    icon: <ShieldCheck className="w-5 h-5" />,
    popular: true,
  },
  {
    id: "constitutional",
    name: "Constitutional & Writ Jurisdiction",
    category: "Constitutional",
    codes: "Constitution 1973 (Art 199/184) · General Clauses Act",
    icon: <Award className="w-5 h-5" />,
    popular: true,
  },
  {
    id: "corporate",
    name: "Corporate, Commercial & Banking",
    category: "Commercial",
    codes: "Companies Act 2017 · Contract Act 1872 · FIO 2001",
    icon: <Briefcase className="w-5 h-5" />,
  },
  {
    id: "taxation",
    name: "Taxation, Customs & Fiscal",
    category: "Fiscal",
    codes: "Income Tax Ord 2001 · Sales Tax Act · Customs Act",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    id: "family",
    name: "Family, Custody & Succession",
    category: "Family",
    codes: "Family Courts Act 1964 · Succession Act 1925",
    icon: <Users className="w-5 h-5" />,
  },
  {
    id: "cyber",
    name: "Cyber Crime & Digital Law",
    category: "Digital",
    codes: "PECA 2016 · Electronic Transactions Ord",
    icon: <Zap className="w-5 h-5" />,
  },
  {
    id: "labor",
    name: "Labor & Industrial Relations",
    category: "Labor",
    codes: "Industrial Relations Act · Standing Orders",
    icon: <BookOpen className="w-5 h-5" />,
  },
];

export default function PreviewOnboarding() {
  useDocumentHead({
    title: "Chamber Onboarding Setup | Al Wakeelo",
    description: "Configure your chamber profile, practice jurisdictions, statutory codes, and AI intelligence engine preferences.",
    path: "/preview/onboarding",
    index: false,
  });

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Step 1: Chamber Profile
  const [chamberName, setChamberName] = useState("Mian & Partners Law Chambers");
  const [principalAdvocate, setPrincipalAdvocate] = useState("Adv. Mian Tariq Ahmad");
  const [barCouncilEnrollment, setBarCouncilEnrollment] = useState("PBC-10492-ASC");
  const [jurisdiction, setJurisdiction] = useState("Supreme Court of Pakistan & Lahore High Court");
  const [city, setCity] = useState("Lahore");
  const [chamberSize, setChamberSize] = useState("2-5 Advocates");

  // Step 2: Practice Areas & Default Statutory Codes
  const [selectedPracticeAreas, setSelectedPracticeAreas] = useState<string[]>([
    "civil",
    "criminal",
    "constitutional",
    "corporate",
  ]);
  const [defaultCourtFeeProvince, setDefaultCourtFeeProvince] = useState("Punjab");

  // Step 3: AI Intelligence Engine & Model Preferences
  const [aiModelPreference, setAiModelPreference] = useState<"apex" | "turbo" | "standard">("standard");
  const [styleMemoryEnabled, setStyleMemoryEnabled] = useState<boolean>(true);
  const [citationStandard, setCitationStandard] = useState<"pakistan" | "commonlaw">("pakistan");
  const [urduLexiconEnabled, setUrduLexiconEnabled] = useState<boolean>(true);

  // Load existing profile from storage if available
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem("alwakeelo_preview_user");
      if (rawUser) {
        const parsed = JSON.parse(rawUser);
        if (parsed.name) setPrincipalAdvocate(parsed.name);
        if (parsed.barCouncilEnrollment) setBarCouncilEnrollment(parsed.barCouncilEnrollment);
        if (parsed.jurisdiction) setJurisdiction(parsed.jurisdiction);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const togglePracticeArea = (id: string) => {
    setSelectedPracticeAreas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        chamberName,
        principalAdvocate,
        barCouncilEnrollment,
        jurisdiction,
        city,
        chamberSize,
        practiceAreas: selectedPracticeAreas,
        defaultCourtFeeProvince,
        aiModelPreference,
        styleMemoryEnabled,
        citationStandard,
        urduLexiconEnabled,
      };

      await apiRequest("POST", "/api/auth/complete-onboarding", payload);

      // Save to localStorage
      try {
        localStorage.setItem("alwakeelo_preview_chamber_profile", JSON.stringify(payload));
        const rawUser = localStorage.getItem("alwakeelo_preview_user");
        const currentUser = rawUser ? JSON.parse(rawUser) : {};
        localStorage.setItem(
          "alwakeelo_preview_user",
          JSON.stringify({
            ...currentUser,
            name: principalAdvocate,
            chamberName,
            jurisdiction,
            barCouncilEnrollment,
            onboardingCompleted: true,
          })
        );
        localStorage.setItem("alwakeelo_preview_auth", "true");
      } catch {
        // Storage failed
      }

      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({
        title: "Chamber Workspace Configured!",
        description: `Welcome, ${principalAdvocate}. Your chambers workstation is ready.`,
      });
      navigate("/preview/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Onboarding Error",
        description: error.message || "Could not complete onboarding. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!chamberName.trim() || !principalAdvocate.trim()) {
        toast({
          title: "Required Fields",
          description: "Please enter your chamber name and principal advocate name.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (selectedPracticeAreas.length === 0) {
        toast({
          title: "Select Practice Areas",
          description: "Please choose at least one primary practice area.",
          variant: "destructive",
        });
        return;
      }
      setCurrentStep(3);
    } else if (currentStep === 3) {
      completeOnboardingMutation.mutate();
    }
  };

  const handleSkipToDashboard = () => {
    completeOnboardingMutation.mutate();
  };

  return (
    <div className="preview-theme-scope min-h-screen bg-[#F8FAFC] dark:bg-[#0B131E] py-8 px-3 sm:px-6 relative overflow-hidden text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Background ambient lighting */}
      <div className="absolute top-[-10%] left-[-10%] w-[45%] h-[45%] bg-[#105B38]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#105B38]/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Top Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl mx-auto overflow-hidden border border-[#105B38]/30 mb-3 shadow-lg shadow-[#105B38]/15 dark:shadow-[#10B981]/10 bg-[#EBF5F0] dark:bg-[#105B38]/20 flex items-center justify-center p-2.5">
            <Scale className="w-7 h-7 text-[#105B38]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]" style={{ fontFamily: "'Playfair Display', serif" }}>
            Chamber Setup Wizard
          </h1>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1 font-medium">
            Customize your Al Wakeelo AI workspace for your Pakistani litigation practice
          </p>
        </div>

        {/* 3-Step Progress Tracker */}
        <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-sm rounded-2xl p-4 mb-6">
          <div className="grid grid-cols-3 gap-2">
            {/* Step 1 Pill */}
            <div
              onClick={() => currentStep > 1 && setCurrentStep(1)}
              className={`flex items-center gap-2 p-2.5 rounded-xl transition-all cursor-pointer ${
                currentStep === 1
                  ? "bg-[#EBF5F0] dark:bg-[#105B38]/20 border border-[#A3D4BC] dark:border-[#10B981]/30 text-[#105B38]"
                  : currentStep > 1
                  ? "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#105B38]"
                  : "text-[#94A3B8] dark:text-[#475569]"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  currentStep === 1
                    ? "bg-[#105B38] text-white"
                    : currentStep > 1
                    ? "bg-[#105B38] text-white"
                    : "bg-[#E2E8F0] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                }`}
              >
                {currentStep > 1 ? <Check size={14} /> : "1"}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[11px] font-bold leading-tight">Step 1</p>
                <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] truncate">Chamber Profile</p>
              </div>
            </div>

            {/* Step 2 Pill */}
            <div
              onClick={() => currentStep > 2 && setCurrentStep(2)}
              className={`flex items-center gap-2 p-2.5 rounded-xl transition-all ${
                currentStep === 2
                  ? "bg-[#EBF5F0] dark:bg-[#105B38]/20 border border-[#A3D4BC] dark:border-[#10B981]/30 text-[#105B38]"
                  : currentStep > 2
                  ? "bg-[#F8FAFC] dark:bg-[#0B131E] text-[#105B38] cursor-pointer"
                  : "text-[#94A3B8] dark:text-[#475569]"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  currentStep === 2
                    ? "bg-[#105B38] text-white"
                    : currentStep > 2
                    ? "bg-[#105B38] text-white"
                    : "bg-[#E2E8F0] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                }`}
              >
                {currentStep > 2 ? <Check size={14} /> : "2"}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[11px] font-bold leading-tight">Step 2</p>
                <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] truncate">Practice & Codes</p>
              </div>
            </div>

            {/* Step 3 Pill */}
            <div
              className={`flex items-center gap-2 p-2.5 rounded-xl transition-all ${
                currentStep === 3
                  ? "bg-[#EBF5F0] dark:bg-[#105B38]/20 border border-[#A3D4BC] dark:border-[#10B981]/30 text-[#105B38]"
                  : "text-[#94A3B8] dark:text-[#475569]"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  currentStep === 3 ? "bg-[#105B38] text-white" : "bg-[#E2E8F0] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                }`}
              >
                3
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[11px] font-bold leading-tight">Step 3</p>
                <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] truncate">AI & Engine</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wizard Main Card */}
        <div className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] shadow-xl shadow-[#105B38]/5 rounded-[1.6rem] p-6 sm:p-8">
          {/* STEP 1: Chamber Profile */}
          {currentStep === 1 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="border-b border-[#E2E8F0] dark:border-[#1E2D44] pb-4">
                <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Building className="w-5 h-5 text-[#105B38]" />
                  Chamber Profile & Primary Jurisdiction
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
                  Set your chamber identity for court filings, petition headers, and cause lists.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#334155] dark:text-[#CBD5E1] mb-1.5">
                    Chamber / Law Firm Name *
                  </label>
                  <input
                    type="text"
                    value={chamberName}
                    onChange={(e) => setChamberName(e.target.value)}
                    placeholder="e.g. Mian & Partners Law Chambers"
                    data-testid="input-chamber-name"
                    className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#334155] dark:text-[#CBD5E1] mb-1.5">
                    Principal Advocate Name *
                  </label>
                  <input
                    type="text"
                    value={principalAdvocate}
                    onChange={(e) => setPrincipalAdvocate(e.target.value)}
                    placeholder="e.g. Adv. Mian Tariq Ahmad"
                    data-testid="input-principal-advocate"
                    className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#334155] dark:text-[#CBD5E1] mb-1.5">
                    Bar Council Registration / License No.
                  </label>
                  <input
                    type="text"
                    value={barCouncilEnrollment}
                    onChange={(e) => setBarCouncilEnrollment(e.target.value)}
                    placeholder="e.g. PBC-10492-ASC or LHC-4821"
                    data-testid="input-bar-council-no"
                    className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#334155] dark:text-[#CBD5E1] mb-1.5">
                    Chamber Office City
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    data-testid="select-chamber-city"
                    className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                  >
                    <option value="Lahore">Lahore (Punjab)</option>
                    <option value="Islamabad">Islamabad (Federal Capital)</option>
                    <option value="Karachi">Karachi (Sindh)</option>
                    <option value="Rawalpindi">Rawalpindi (Punjab)</option>
                    <option value="Peshawar">Peshawar (Khyber Pakhtunkhwa)</option>
                    <option value="Quetta">Quetta (Balochistan)</option>
                    <option value="Faisalabad">Faisalabad</option>
                    <option value="Multan">Multan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] dark:text-[#CBD5E1] mb-1.5">
                  Primary Court Jurisdiction / Bench
                </label>
                <select
                  value={jurisdiction}
                  onChange={(e) => setJurisdiction(e.target.value)}
                  data-testid="select-primary-jurisdiction"
                  className="w-full bg-[#F8FAFC] dark:bg-[#0B131E] border border-[#E2E8F0] dark:border-[#1E2D44] text-[#0F172A] dark:text-[#F8FAFC] px-3.5 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#105B38] focus:ring-2 focus:ring-[#105B38]/20 transition-all"
                >
                  <option value="Supreme Court of Pakistan & Lahore High Court">Supreme Court of Pakistan & Lahore High Court</option>
                  <option value="Supreme Court of Pakistan">Supreme Court of Pakistan (Principal Seat Islamabad)</option>
                  <option value="Lahore High Court (Principal Seat)">Lahore High Court (Principal Seat)</option>
                  <option value="Lahore High Court (Rawalpindi Bench)">Lahore High Court (Rawalpindi Bench)</option>
                  <option value="Sindh High Court (Principal Seat Karachi)">Sindh High Court (Principal Seat Karachi)</option>
                  <option value="Islamabad High Court">Islamabad High Court</option>
                  <option value="Peshawar High Court">Peshawar High Court</option>
                  <option value="High Court of Balochistan (Quetta)">High Court of Balochistan (Quetta)</option>
                  <option value="Special Accountability / Banking Tribunals">Special Accountability / NAB / Banking Tribunals</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#334155] dark:text-[#CBD5E1] mb-1.5">
                  Chamber Team Size
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Solo Advocate", desc: "1 Counsel Seat" },
                    { label: "2-5 Advocates", desc: "Small Chamber" },
                    { label: "6-15 Enterprise", desc: "Full Law Firm" },
                  ].map((size) => (
                    <button
                      key={size.label}
                      type="button"
                      onClick={() => setChamberSize(size.label)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        chamberSize === size.label
                          ? "bg-[#EBF5F0] dark:bg-[#105B38]/20 border-[#A3D4BC] dark:border-[#10B981]/30 text-[#105B38]"
                          : "bg-[#F8FAFC] dark:bg-[#0B131E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:border-[#CBD5E1]"
                      }`}
                    >
                      <p className="text-xs font-bold">{size.label}</p>
                      <p className="text-[10px] opacity-80">{size.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Practice Areas & Statutory Codes */}
          {currentStep === 2 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="border-b border-[#E2E8F0] dark:border-[#1E2D44] pb-4">
                <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Scale className="w-5 h-5 text-[#105B38]" />
                  Practice Areas & Default Statutory Codes
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
                  Choose your active litigation disciplines to pre-load statutory concordance tables and precedents.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRACTICE_AREAS.map((area) => {
                  const isSelected = selectedPracticeAreas.includes(area.id);
                  return (
                    <div
                      key={area.id}
                      onClick={() => togglePracticeArea(area.id)}
                      data-testid={`practice-area-${area.id}`}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? "bg-[#EBF5F0] dark:bg-[#105B38]/20 border-[#A3D4BC] dark:border-[#10B981]/30 shadow-sm"
                          : "bg-[#F8FAFC] dark:bg-[#0B131E] border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#CBD5E1]"
                      }`}
                    >
                      <div
                        className={`p-2 rounded-lg ${
                          isSelected ? "bg-[#105B38] text-white" : "bg-[#E2E8F0] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                        }`}
                      >
                        {area.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h4 className={`text-xs font-bold ${isSelected ? "text-[#105B38]" : "text-[#0F172A] dark:text-[#F8FAFC]"}`}>
                            {area.name}
                          </h4>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-[#105B38] flex-shrink-0" />}
                        </div>
                        <p className="text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-1 font-mono">{area.codes}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-[#334155] dark:text-[#CBD5E1] mb-1.5">
                  Default Provincial Court Fee & Limitation Schedule
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {["Punjab", "Sindh", "Islamabad", "KPK", "Balochistan"].map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setDefaultCourtFeeProvince(prov)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        defaultCourtFeeProvince === prov
                          ? "bg-[#105B38] text-white border-[#105B38]"
                          : "bg-[#F8FAFC] dark:bg-[#0B131E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:border-[#CBD5E1]"
                      }`}
                    >
                      {prov}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: AI Intelligence Engine & Preferences */}
          {currentStep === 3 && (
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="border-b border-[#E2E8F0] dark:border-[#1E2D44] pb-4">
                <h2 className="text-lg font-bold text-[#0F172A] dark:text-[#F8FAFC] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[#105B38]" />
                  AI Legal Intelligence Engine & Model Preferences
                </h2>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-0.5">
                  Configure reasoning depth, judicial style memory, and citation formatting standards.
                </p>
              </div>

              {/* Model Selectors */}
              <div className="space-y-3">
                {[
                  {
                    id: "apex",
                    name: "Apex Legal RAG (Recommended for Advocates)",
                    desc: "Strict judicial grounding on 600,000+ Pakistani SCMR/PLD judgments with zero hallucination guarantee.",
                    badge: "99.8% Precision",
                  },
                  {
                    id: "turbo",
                    name: "Turbo Intelligence Engine",
                    desc: "High-speed petition generation, commercial contract redlining, and client reply drafting.",
                    badge: "Fast Drafting",
                  },
                  {
                    id: "standard",
                    name: "Standard Companion",
                    desc: "General research inquiries, procedural statutory lookups, and plain-language summaries.",
                    badge: "Standard",
                  },
                ].map((m) => (
                  <div
                    key={m.id}
                    onClick={() => setAiModelPreference(m.id as any)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      aiModelPreference === m.id
                        ? "bg-[#EBF5F0] dark:bg-[#105B38]/20 border-[#A3D4BC] dark:border-[#10B981]/30 shadow-sm"
                        : "bg-[#F8FAFC] dark:bg-[#0B131E] border-[#E2E8F0] dark:border-[#1E2D44] hover:border-[#CBD5E1]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            aiModelPreference === m.id ? "border-[#105B38] bg-[#105B38]" : "border-[#94A3B8]"
                          }`}
                        >
                          {aiModelPreference === m.id && <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-[#131E2E]" />}
                        </div>
                        <h4 className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">{m.name}</h4>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-white dark:bg-[#131E2E] text-[#105B38] border border-[#A3D4BC] dark:border-[#10B981]/30">
                        {m.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] pl-6 leading-relaxed">{m.desc}</p>
                  </div>
                ))}
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 p-3 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={styleMemoryEnabled}
                    onChange={(e) => setStyleMemoryEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#105B38] rounded"
                  />
                  <div>
                    <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">Enable Chamber Style Memory</p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                      AI will adapt to your chamber's preferred pleading structure and accepted draft edits.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={urduLexiconEnabled}
                    onChange={(e) => setUrduLexiconEnabled(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[#105B38] rounded"
                  />
                  <div>
                    <p className="text-xs font-bold text-[#0F172A] dark:text-[#F8FAFC]">Urdu-to-English Legal Lexicon Assistant</p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                      Instant context for Pakistani terms (e.g. Fard, Wakalatnama, Taqseem, Qatl-i-Amd, Bayana).
                    </p>
                  </div>
                </label>
              </div>

              {/* Citation Standard */}
              <div>
                <label className="block text-xs font-bold text-[#334155] dark:text-[#CBD5E1] mb-1.5">
                  Default Citation Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCitationStandard("pakistan")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      citationStandard === "pakistan"
                        ? "bg-[#EBF5F0] dark:bg-[#105B38]/20 border-[#A3D4BC] dark:border-[#10B981]/30 text-[#105B38]"
                        : "bg-[#F8FAFC] dark:bg-[#0B131E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                    }`}
                  >
                    <p className="text-xs font-bold">Pakistan Standard</p>
                    <p className="text-[10px] opacity-80 font-mono">PLD, SCMR, CLC, PCrLJ, YLR</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCitationStandard("commonlaw")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      citationStandard === "commonlaw"
                        ? "bg-[#EBF5F0] dark:bg-[#105B38]/20 border-[#A3D4BC] dark:border-[#10B981]/30 text-[#105B38]"
                        : "bg-[#F8FAFC] dark:bg-[#0B131E] border-[#E2E8F0] dark:border-[#1E2D44] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]"
                    }`}
                  >
                    <p className="text-xs font-bold">Commonwealth Standard</p>
                    <p className="text-[10px] opacity-80 font-mono">[2026] UKSC / All ER / SCC</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons Footer */}
          <div className="mt-8 pt-5 border-t border-[#E2E8F0] dark:border-[#1E2D44] flex items-center justify-between gap-3">
            <div>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentStep((prev) => prev - 1)}
                  data-testid="button-onboarding-back"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:text-[#F8FAFC] px-4 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] hover:bg-[#F1F5F9] dark:bg-[#1E2D44] transition-all"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSkipToDashboard}
                  data-testid="button-onboarding-skip"
                  className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#105B38] font-semibold underline"
                >
                  Skip setup & use defaults
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleNextStep}
                disabled={completeOnboardingMutation.isPending}
                data-testid="button-onboarding-next"
                className="bg-[#105B38] text-white font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl hover:bg-[#0D4A2E] transition-all flex items-center gap-2 shadow-lg shadow-[#105B38]/20 disabled:opacity-50"
              >
                {completeOnboardingMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : currentStep === 3 ? (
                  <>
                    Launch Chambers Workstation
                    <ArrowRight size={14} />
                  </>
                ) : (
                  <>
                    Save & Continue
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="text-center text-[10px] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] mt-4">
          Preferences can be modified anytime in <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">Chamber Settings</span>.
        </p>
      </div>
    </div>
  );
}
