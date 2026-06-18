import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useDocumentHead } from "@/hooks/use-document-head";
import { BLOG_ARTICLES } from "../../../shared/blog-data";
import { Search, BookOpen, Clock, ChevronRight } from "lucide-react";

export default function BlogPage() {
  useDocumentHead({
    title: "Legal Guides & Resources | Al Wakeelo",
    description: "Browse comprehensive legal guides, articles, and tutorials on Pakistani law. Written by legal experts and advocates.",
    path: "/blog",
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
    <div className="space-y-10 fade-in">
      <section className="text-center space-y-4 py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary font-bold uppercase tracking-widest">
          Legal Resources
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
          Pakistani Legal Guides &amp; <br/>
          <span className="text-primary italic">Expert Legal Resources</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Deep-dive articles and practical guides on Pakistani procedural codes, family laws, property registration, and business contracts.
        </p>
      </section>

      {/* Filter and Search controls */}
      <section className="flex flex-col md:flex-row gap-4 justify-between items-center border-t border-border pt-6">
        <div className="relative w-full md:w-[320px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            placeholder="Search articles..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-start md:justify-end">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
              selectedCategory === null
                ? "bg-primary border-primary text-primary-foreground"
                : "border-border text-foreground hover:bg-card/50"
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors ${
                selectedCategory === cat
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-border text-foreground hover:bg-card/50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Article Cards Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        {filteredArticles.length === 0 ? (
          <div className="col-span-full py-16 text-center text-muted-foreground space-y-2">
            <BookOpen size={40} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="font-bold text-foreground">No articles found</p>
            <p className="text-xs">Try adjusting your search terms or category filters.</p>
          </div>
        ) : (
          filteredArticles.map((article) => (
            <article key={article.slug} className="group rounded-2xl border border-border bg-card/40 p-6 flex flex-col justify-between hover:border-primary/30 hover:shadow-xl transition-all duration-300">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.18em] font-black rounded-md bg-primary/10 border border-primary/20 px-2 py-1 text-primary">
                    {article.category}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock size={12} /> {article.readTime}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {article.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {article.summary}
                </p>
              </div>
              
              <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-5">
                <span className="text-[10px] text-muted-foreground">{article.publishedAt}</span>
                <Link href={`/blog/${article.slug}`} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                  Read Article <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
