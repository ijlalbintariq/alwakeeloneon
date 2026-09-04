import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useDocumentHead } from "@/hooks/use-document-head";
import { BLOG_ARTICLES } from "@shared/blog-data";
import { Search, BookOpen, Clock, ChevronRight } from "lucide-react";
import { PublicPreviewShell } from "@/experimental/components/public/PublicPreviewShell";

export default function PreviewBlog() {
  useDocumentHead({
    title: "Legal Guides & Resources | Al Wakeelo",
    description: "Browse comprehensive legal guides, articles, and tutorials on Pakistani law. Written by legal experts and advocates.",
    path: "/preview/blog",
  });

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set(BLOG_ARTICLES.map((a) => a.category));
    return Array.from(set);
  }, []);

  const filteredArticles = useMemo(() => {
    return BLOG_ARTICLES.filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(query.toLowerCase()) ||
        article.summary.toLowerCase().includes(query.toLowerCase()) ||
        article.content.toLowerCase().includes(query.toLowerCase());
      
      const matchesCategory = selectedCategory ? article.category === selectedCategory : true;
      
      return matchesSearch && matchesCategory;
    });
  }, [query, selectedCategory]);

  return (
    <PublicPreviewShell>
      <div className="preview-theme-scope space-y-10 fade-in py-12 px-6 max-w-7xl mx-auto text-[#0F172A] dark:text-[#F8FAFC]">
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#105B38]/10 border border-[#105B38]/20 dark:border-[#105B38]/40 rounded-full text-xs text-[#105B38] font-bold uppercase tracking-widest">
            Legal Resources
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC]" style={{ fontFamily: "'Playfair Display', serif" }}>
            The Al Wakeelo <span className="text-[#105B38]">Blog</span>
          </h1>
          <p className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] max-w-2xl mx-auto text-base">
            Expert insights, tutorials, and deep dives into Pakistani case law, statutory interpretation, and legal technology.
          </p>
        </section>

        <section className="bg-white dark:bg-[#131E2E] border border-[#E2E8F0] dark:border-[#1E2D44] p-6 rounded-[2rem] shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]" />
              <input 
                type="text" 
                placeholder="Search legal guides, articles, topics..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-[#E2E8F0] dark:border-[#1E2D44] bg-[#F8FAFC] dark:bg-[#0B131E] focus:outline-none focus:ring-2 focus:ring-[#105B38]/50 transition-all font-medium text-[#0F172A] dark:text-[#F8FAFC]"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${!selectedCategory ? 'bg-[#105B38] text-white shadow-sm' : 'bg-[#F1F5F9] dark:bg-[#1B293E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'}`}
              >
                All Topics
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-[#105B38] text-white shadow-sm' : 'bg-[#F1F5F9] dark:bg-[#1B293E] text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredArticles.length === 0 ? (
            <div className="col-span-full py-16 text-center space-y-4">
              <BookOpen className="w-16 h-16 text-[#CBD5E1] mx-auto" />
              <h3 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">No articles found</h3>
              <p className="text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">Try adjusting your search terms or category filter.</p>
            </div>
          ) : (
            filteredArticles.map((article) => (
              <Link key={article.slug} href={`/preview/blog/${article.slug}`}>
                <a className="group bg-white dark:bg-[#131E2E] rounded-3xl border border-[#E2E8F0] dark:border-[#1E2D44] overflow-hidden hover:border-[#A3D4BC] dark:hover:border-[#10B981]/40 hover:shadow-lg transition-all flex flex-col h-full">
                  <div className="px-6 pt-6">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#105B38]/10 dark:bg-[#10B981]/15 border border-[#105B38]/20 dark:border-[#10B981]/30 rounded-full text-[11px] text-[#105B38] dark:text-[#10B981] font-bold uppercase tracking-wider">
                      <BookOpen className="w-3 h-3" />
                      {article.category}
                    </span>
                  </div>
                  <div className="p-6 flex flex-col flex-1 space-y-4">
                    <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] dark:text-[#475569]">
                      <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {article.readTime} min read</span>
                    </div>
                    <h3 className="text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] group-hover:text-[#105B38] dark:group-hover:text-[#10B981] transition-colors leading-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {article.title}
                    </h3>
                    <p className="text-[#475569] dark:text-[#94A3B8] dark:text-[#475569] text-sm leading-relaxed flex-1">
                      {article.summary}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-[#E2E8F0] dark:border-[#1E2D44]">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#EBF5F0] dark:bg-[#105B38]/20 flex items-center justify-center text-[#105B38] font-bold text-xs">
                          {"Al Wakeelo Legal".charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">{"Al Wakeelo Legal"}</span>
                      </div>
                      <span className="text-xs font-semibold text-[#105B38] flex items-center gap-1 group-hover:gap-2 transition-all">
                        Read <ChevronRight className="w-4 h-4" />
                      </span>
                    </div>
                  </div>
                </a>
              </Link>
            ))
          )}
        </section>
      </div>
    </PublicPreviewShell>
  );
}
