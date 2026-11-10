import { useRoute, useLocation } from "wouter";
import { useDocumentHead } from "@/hooks/use-document-head";
import { LegalMarkdown } from "@/components/legal-markdown";
import { ArrowLeft, Clock, Calendar } from "lucide-react";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";
import { BLOG_ARTICLES } from "@shared/blog-data";
import { BLOG_REVIEW_NOTICE, BLOG_RESEARCH_SOURCES, blogReadMinutes } from "@shared/blog-editorial";

export default function PreviewBlogDetail() {
  const [, navigate] = useLocation();
  const [, publicParams] = useRoute("/blog/:slug");
  const [, previewParams] = useRoute("/preview/blog/:slug");
  const slug = publicParams?.slug ?? previewParams?.slug;
  // Match the server-rendered source without waiting for an unavailable blog API.
  const article = BLOG_ARTICLES.find((a) => a.slug === slug);
  const publishedDate = article?.publishedAt;

  useDocumentHead({
    title: article ? `${article.title} | Al Wakeelo Legal Guides` : "Legal Guide | Al Wakeelo",
    description: article ? article.summary : "Read comprehensive Pakistani legal guides on Al Wakeelo.",
    path: slug ? `/blog/${slug}` : undefined,
    index: !!article,
  });

  if (!article) {
    return (
      <PublicPreviewShell>
        <div className="preview-theme-scope space-y-4 py-24 text-center text-[#0F172A] dark:text-[#F8FAFC]">
          <h2 className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
            Article Not Found
          </h2>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">The legal guide you requested does not exist or has been removed.</p>
          <button
            onClick={() => navigate("/blog")}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-white dark:bg-[#131E2E] px-6 py-3 text-sm font-semibold hover:bg-[#F1F5F9] dark:bg-[#1B293E] transition-colors mt-6"
          >
            <ArrowLeft size={16} /> Back to Blog
          </button>
        </div>
      </PublicPreviewShell>
    );
  }

  return (
    <PublicPreviewShell>
      <div className="preview-theme-scope min-h-screen bg-white dark:bg-[#131E2E] text-[#0F172A] dark:text-[#F8FAFC] py-12">
        <article className="max-w-4xl mx-auto px-6">
          <button
            onClick={() => navigate("/blog")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#105B38] transition-colors mb-8"
          >
            <ArrowLeft size={16} /> Back to Blog
          </button>

          <header className="space-y-6 mb-12">
            <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
              <span className="text-[#105B38]">{article.category}</span>
              <span className="w-1 h-1 rounded-full bg-[#CBD5E1] dark:bg-[#475569]"></span>
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {publishedDate ? new Date(publishedDate).toLocaleDateString() : ""}</span>
              <span className="w-1 h-1 rounded-full bg-[#CBD5E1] dark:bg-[#475569]"></span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {blogReadMinutes(article.content)} min read</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#0F172A] dark:text-[#F8FAFC] leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
              {article.title}
            </h1>
            
            <div className="flex items-center gap-4 pt-6 border-t border-[#E2E8F0] dark:border-[#1E2D44]">
              <div className="w-12 h-12 rounded-full bg-[#EBF5F0] dark:bg-[#105B38]/20 flex items-center justify-center text-[#105B38] font-bold text-lg">
                {"Al Wakeelo Legal".charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{"Al Wakeelo Legal"}</div>
                <div className="text-xs text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] uppercase tracking-wider font-semibold">Publisher</div>
              </div>
            </div>
          </header>
          
          <div className="prose prose-slate prose-lg max-w-none prose-headings:font-bold prose-headings:text-[#0F172A] dark:prose-headings:text-[#F8FAFC] dark:text-[#F8FAFC] prose-a:text-[#105B38] prose-a:font-semibold prose-strong:text-[#0F172A] dark:prose-strong:text-[#F8FAFC] dark:text-[#F8FAFC] prose-strong:font-bold prose-p:text-[#334155] dark:prose-p:text-[#CBD5E1] dark:text-[#CBD5E1] prose-li:text-[#334155] dark:prose-li:text-[#CBD5E1] dark:text-[#CBD5E1]">
            <LegalMarkdown content={article.content.replace(/^#\s+[^\n]+\n+/, "")} />
          </div>
          <aside className="mt-8 border-t border-border pt-6 text-sm space-y-3">
            <p>{BLOG_REVIEW_NOTICE}</p>
            <h2 className="font-semibold">Official research sources</h2>
            <ul>
              {BLOG_RESEARCH_SOURCES.map(source => (
                <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">{source.title}</a></li>
              ))}
            </ul>
          </aside>
        </article>
      </div>
    </PublicPreviewShell>
  );
}
