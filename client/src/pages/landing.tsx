import { Scale } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-amber-500/3 rounded-full blur-[100px]" />

      <div className="w-full max-w-md bg-[#1e293b] border border-slate-800 p-10 rounded-[4rem] shadow-2xl relative z-10 fade-in">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-lg shadow-amber-500/20">
            <Scale size={32} className="text-slate-900" />
          </div>
          <h1 className="text-4xl font-bold text-white uppercase tracking-tighter italic" style={{ fontFamily: "'Playfair Display', serif" }}>
            Al Wakeelo
          </h1>
          <p className="text-[10px] uppercase tracking-[0.4em] text-slate-500 font-black mt-2">
            Your Digital Lawyer, Always on Duty
          </p>
        </div>

        <div className="space-y-6">
          <div className="text-center space-y-3 mb-8">
            <p className="text-sm text-slate-400 leading-relaxed italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              "Knowledge of Law is Power -- and I'm Your Power Source."
            </p>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-black">
              Chambers Secure Protocol
            </p>
          </div>

          <button
            onClick={() => { window.location.href = "/api/login"; }}
            data-testid="button-login"
            className="w-full bg-amber-500 text-slate-950 font-black uppercase tracking-widest text-xs py-5 rounded-2xl hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-xl shadow-amber-500/10"
          >
            Enter the Chambers
          </button>

          <p className="text-[9px] text-center text-slate-600 uppercase tracking-widest font-black mt-4">
            Secured via Replit Authentication Protocol
          </p>
        </div>
      </div>
    </div>
  );
}
