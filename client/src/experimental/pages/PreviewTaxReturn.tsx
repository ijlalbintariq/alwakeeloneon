import { useState } from "react";
import { ArrowRight, PhoneCall, FileText, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { PublicPreviewShell } from "../components/public/PublicPreviewShell";
import { useDocumentHead } from "../../hooks/use-document-head";
import { useEffect } from "react";

export default function PreviewTaxReturn() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  useDocumentHead({
    title: "Tax Return Services Pakistan | FBR Online Tax Filing | Al Wakeelo",
    description: "Expert income tax return filing, wealth statement reconciliation, and NTN registration online in Pakistan. Get hassle-free tax return services with professional tax consultants.",
    path: "/tax-return",
  });

  useEffect(() => {
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.setAttribute('name', 'keywords');
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute('content', 'tax return services, fbr online tax filing, file income tax return online, tax consultant pakistan, income tax e-filing, wealth statement fbr, ntn registration');
    
    return () => {
      // Optional cleanup
      metaKeywords?.setAttribute('content', 'AL WAKEELO, legal AI, pakistan law, ai lawyer');
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/public-chat/submit-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          caseType: "Tax Return Filing",
          description: `Tax return service request from ${name}. Phone: ${phone}${email ? `, Email: ${email}` : ""}`,
          city: "Unknown",
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
      setName("");
      setPhone("");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <PublicPreviewShell>
      <section className="py-16 md:py-24 px-6 bg-gradient-to-b from-background to-card border-b border-border/60 flex-1 flex items-center">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-start w-full">
          <div className="lg:col-span-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-xs text-amber-500 font-extrabold uppercase tracking-widest">
                <Sparkles size={12} className="animate-pulse" />
                New Service
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#105B38]/10 border border-[#105B38]/20 dark:border-[#105B38]/40 rounded-full text-xs text-[#105B38] dark:text-emerald-500 font-bold uppercase tracking-widest">
                <FileText size={14} />
                Professional Tax Return Services
              </div>
            </div>
            <h1
              className="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Expert Income Tax Return <br />
              <span className="text-[#105B38] dark:text-emerald-500 italic">
                Quick, Compliant & Hassle-Free
              </span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl">
              File your income tax return online with Pakistan's most reliable tax return services. From FBR e-filing to wealth statements, our professional tax consultants ensure 100% compliance and maximum savings.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#105B38] dark:text-emerald-500"/> FBR Tax Return Filing</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#105B38] dark:text-emerald-500"/> Online Tax Registration (NTN)</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#105B38] dark:text-emerald-500"/> Wealth Statement Reconciliation</div>
              <div className="flex items-center gap-2"><CheckCircle2 size={16} className="text-[#105B38] dark:text-emerald-500"/> Tax Audit & Notice Replies</div>
            </div>

            <div className="flex flex-col gap-2 pt-6">
              <div className="flex items-center gap-3 text-sm font-bold text-foreground bg-muted/50 p-5 rounded-xl border border-border inline-flex w-fit shadow-sm">
                <PhoneCall size={20} className="text-[#105B38] dark:text-emerald-500" />
                Direct Contact: <a href="tel:03394099906" className="text-[#105B38] dark:text-emerald-500 hover:underline text-lg">03394099906</a> <span className="text-muted-foreground ml-1">(Warzan Shahid)</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-6 relative">
            <div className="absolute inset-0 bg-[#105B38]/5 rounded-3xl blur-3xl -z-10" />
            <div className="rounded-3xl border border-border bg-card p-8 md:p-10 space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2"></div>

              {status === "success" ? (
                <div className="text-center py-10 space-y-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[#105B38]/10 mx-auto">
                    <CheckCircle2 size={32} className="text-[#105B38] dark:text-emerald-500" />
                  </div>
                  <h3 className="font-bold text-foreground text-2xl">Request Submitted!</h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Our tax team will contact you shortly. You can also call <a href="tel:03394099906" className="text-[#105B38] dark:text-emerald-500 font-bold hover:underline">03394099906</a> for immediate assistance.
                  </p>
                  <button
                    onClick={() => setStatus("idle")}
                    className="mt-4 px-6 py-3 border border-border rounded-xl text-sm font-bold text-foreground hover:bg-muted/50 transition-colors"
                  >
                    Submit Another Request
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="font-bold text-foreground text-2xl mb-2">
                    Quick Tax Return Request
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 pb-6 border-b border-border">
                    Provide your details below to start your online income tax e-filing process immediately.
                  </p>
                  {status === "error" && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-500 font-medium">
                      Something went wrong. Please try again or call directly.
                    </div>
                  )}
                  <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</label>
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-[#105B38] transition-colors" placeholder="Enter your full name" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</label>
                      <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-[#105B38] transition-colors" placeholder="e.g. 0300 1234567" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address (Optional)</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-[#105B38] transition-colors" placeholder="Enter your email" />
                    </div>
                    <div className="pt-4">
                      <button
                        type="submit"
                        disabled={status === "loading"}
                        className="w-full px-6 py-4 bg-[#105B38] text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-[#0D4A2E] transition-all shadow-lg shadow-[#105B38]/20 flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {status === "loading" ? (
                          <><Loader2 size={16} className="animate-spin" /> Submitting...</>
                        ) : (
                          <>Submit Request <ArrowRight size={16} /></>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* SEO Keywords */}
      <section className="bg-background py-8 px-6 border-b border-border/60">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-sm font-bold text-foreground mb-2">Comprehensive Tax Return Services in Pakistan</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Al Wakeelo provides expert <strong>tax return services</strong>, assisting salaried individuals, freelancers, and businesses with <strong>FBR tax return filing</strong>. Looking to <strong>file income tax return online</strong>? Our dedicated tax consultants handle <strong>income tax e-filing</strong>, NTN registration, wealth statements, and sales tax returns. Stay compliant and avoid FBR notices with the best <strong>professional tax consultant</strong> and legal advisors in Pakistan. 
          </p>
        </div>
      </section>
    </PublicPreviewShell>
  );
}
