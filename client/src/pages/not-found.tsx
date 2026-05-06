import { Scale } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-6">
        <Scale size={48} className="mx-auto text-primary/30" />
        <h1 className="text-4xl font-bold text-foreground italic" style={{ fontFamily: "'Playfair Display', serif" }}>
          404 - Case Dismissed
        </h1>
        <p className="text-muted-foreground text-sm">The page you seek has been struck from the docket.</p>
        <Link href="/dashboard">
          <button className="px-8 py-4 bg-primary text-foreground rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-primary transition-all shadow-xl">
            Return to Chambers
          </button>
        </Link>
      </div>
    </div>
  );
}
