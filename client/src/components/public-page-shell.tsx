import { type ReactNode } from "react";
import { Link } from "wouter";

/**
 * Minimal layout for pages that anonymous (unauthenticated) visitors can see.
 * Used for /judgment/:id when no session is present. Carries a slim header
 * with logo + Sign in / Sign up CTAs and a centered content column.
 */
export function PublicPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2 text-foreground hover:text-primary">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-700 shadow-md overflow-hidden">
              <img src="/logo.svg" alt="Al Wakeelo logo" className="h-6 w-6 object-contain" />
            </span>
            <span className="font-bold tracking-tight text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              Al Wakeelo
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              href="/auth?mode=login"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-card/70"
            >
              Sign in
            </Link>
            <Link
              href="/auth?mode=register"
              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground hover:bg-primary/90"
            >
              Sign up free
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 py-8">
          {children}
        </div>
      </main>
      <footer className="border-t border-border text-xs text-muted-foreground">
        <div className="mx-auto max-w-5xl px-4 py-5 flex flex-wrap items-center justify-between gap-3">
          <span>© Al Wakeelo — Pakistan's AI Legal Assistant</span>
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/about" className="hover:text-foreground">About Us</Link>
            <Link href="/contact" className="hover:text-foreground">Contact Us</Link>
            <Link href="/faq" className="hover:text-foreground">FAQ</Link>
            <Link href="/blog" className="hover:text-foreground">Legal Blog</Link>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/judgments/browse" className="hover:text-foreground">Browse Judgments</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
