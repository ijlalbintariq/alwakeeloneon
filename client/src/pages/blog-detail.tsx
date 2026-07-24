import { useRoute, useLocation, Link } from "wouter";
import { useDocumentHead } from "@/hooks/use-document-head";
import { BLOG_ARTICLES } from "../../../shared/blog-data";
import { LegalMarkdown } from "@/components/legal-markdown";
import { ArrowLeft, Clock, Calendar, ChevronRight } from "lucide-react";

export default function BlogDetailPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug;

  const article = BLOG_ARTICLES.find((a) => a.slug === slug);

  useDocumentHead({
    title: article ? `${article.title} | Al Wakeelo Legal Guides` : "Legal Guide | Al Wakeelo",
    description: article ? article.summary : "Read comprehensive Pakistani legal guides on Al Wakeelo.",
    path: slug ? `/blog/${slug}` : undefined,
  });

  if (!article) {
    return (
      <div className="space-y-4 py-12 text-center">
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
          Article Not Found
        </h2>
        <p className="text-sm text-muted-foreground">The legal guide you requested does not exist or has been removed.</p>
        <button
          onClick={() => navigate("/blog")}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground hover:bg-card/75 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Blog
        </button>
      </div>
    );
  }

  // Prefer articles from the same category for hub-and-spoke interlinking
  const sameCategory = BLOG_ARTICLES.filter((a) => a.slug !== slug && a.category === article.category);
  const otherCategory = BLOG_ARTICLES.filter((a) => a.slug !== slug && a.category !== article.category);
  const otherArticles = [...sameCategory, ...otherCategory].slice(0, 3);

  return (
    <div className="space-y-10 fade-in">
      <button
        onClick={() => navigate("/blog")}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/50 px-3 py-2 text-xs font-semibold text-foreground hover:bg-card/75 transition-all"
      >
        <ArrowLeft size={14} /> Back to Guides
      </button>

      <article className="space-y-6">
        <header className="space-y-4">
          <span className="text-[10px] uppercase tracking-[0.18em] font-black rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1.5 text-primary inline-block">
            {article.category}
          </span>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-y border-border/60 py-3">

            <span className="inline-flex items-center gap-1.5"><Calendar size={13} /> {article.publishedAt}</span>
            <span className="inline-flex items-center gap-1.5"><Clock size={13} /> {article.readTime}</span>
          </div>
        </header>

        <section className="prose prose-invert prose-slate max-w-none leading-relaxed text-foreground text-sm space-y-4">
          <LegalMarkdown content={article.content} />
        </section>
      </article>

      {/* Suggested Articles */}
      <section className="border-t border-border pt-10 space-y-4">
        <h3 className="text-xl font-bold italic" style={{ fontFamily: "'Playfair Display', serif" }}>Related Legal Guides</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {otherArticles.map((item) => (
            <div key={item.slug} className="p-5 rounded-2xl border border-border bg-card/30 flex flex-col justify-between hover:border-primary/20 transition-all">
              <div className="space-y-2">
                <span className="text-[9px] uppercase tracking-wider font-bold text-primary">{item.category}</span>
                <h4 className="font-bold text-sm text-foreground line-clamp-1" style={{ fontFamily: "'Playfair Display', serif" }}>{item.title}</h4>
                <p className="text-xs text-muted-foreground line-clamp-2">{item.summary}</p>
              </div>
              <Link href={`/blog/${item.slug}`} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline mt-4">
                Read Guide <ChevronRight size={13} />
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
