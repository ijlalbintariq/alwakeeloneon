import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Scale, Shield, Clock, ArrowRight, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return null;
  if (user) {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="py-6 px-6 md:px-12 flex justify-between items-center max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 text-primary">
          <Scale className="h-8 w-8" />
          <span className="font-heading font-bold text-2xl tracking-tight text-foreground">Al Wakeel</span>
        </div>
        <div className="flex gap-4">
          <Button variant="ghost" onClick={() => window.location.href = "/api/login"}>Sign In</Button>
          <Button onClick={() => window.location.href = "/api/login"}>Get Started</Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 px-6 md:px-12 overflow-hidden">
          <div className="absolute inset-0 z-0 opacity-5 pointer-events-none">
             {/* Abstract legal background pattern could go here */}
             <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary rounded-full blur-[120px] translate-x-1/3 -translate-y-1/3" />
             <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-accent rounded-full blur-[100px] -translate-x-1/3 translate-y-1/3" />
          </div>

          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              AI-Powered Legal Intelligence
            </div>
            
            <h1 className="font-heading text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
              Your Digital Lawyer,<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Available 24/7</span>
            </h1>
            
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              Consult with advanced AI trained on legal frameworks. Get instant answers, draft documents, and simplify complex regulations.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-lg shadow-primary/20" onClick={() => window.location.href = "/api/login"}>
                Start Free Consultation <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full bg-white/50 backdrop-blur-sm">
                View Practice Areas
              </Button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 bg-slate-50 dark:bg-slate-900/50">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard 
                icon={Shield} 
                title="Secure & Confidential" 
                description="Your data is protected with enterprise-grade encryption. Privacy is our first priority."
              />
              <FeatureCard 
                icon={Gavel} 
                title="Legal Document Review" 
                description="Upload contracts and legal documents for instant AI analysis and summarization."
              />
              <FeatureCard 
                icon={Clock} 
                title="Instant Answers" 
                description="No waiting for appointments. Get preliminary legal guidance immediately, any time of day."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="py-8 bg-card border-t text-center text-muted-foreground text-sm">
        <div className="max-w-7xl mx-auto px-6">
          <p className="mb-2">© {new Date().getFullYear()} Al Wakeel. All rights reserved.</p>
          <p className="text-xs opacity-70 max-w-2xl mx-auto">
            Disclaimer: Al Wakeel is an AI-powered assistant for informational purposes only and does not constitute professional legal advice. Always consult with a qualified human attorney for legal representation.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: any, title: string, description: string }) {
  return (
    <div className="bg-background p-8 rounded-2xl border border-border/50 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
      <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-heading text-xl font-bold mb-3">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
