/**
 * Per-route SEO metadata for server-side HTML injection.
 *
 * Mirrors client/src/hooks/use-document-head.ts so non-JS crawlers
 * (Bing, Yandex, ChatGPT search, Perplexity, social previews) see
 * unique <title>, <meta description>, canonical, og:*, twitter:*, and
 * robots tags per route — without needing a full SSR pipeline.
 *
 * For dynamic routes like /judgment/:id and /statute-view/:id we serve
 * a generic-but-relevant default. A later upgrade can do per-record DB
 * lookups (cached) for true per-item titles.
 */

const SITE_NAME = "Al Wakeelo";
const SITE_ORIGIN = "https://www.alwakeelo.com";

export interface SeoMeta {
  title: string;
  description: string;
  index: boolean;
  schemaMarkup?: string;
}

interface RouteRule {
  match: RegExp;
  meta: SeoMeta;
}

const DEFAULT_META: SeoMeta = {
  title: "Alwakeelo AI - Pakistan Law Search & AI Legal Assistant | Digital Lawyer",
  description:
    "Pakistan's premier AI-powered digital lawyer and case law search. Search 600,000+ judgments (PLD, SCMR, YLR), search Pakistan Penal Code, CPC & CrPC, draft petitions, and generate legally binding contracts.",
  index: true,
};

const ROUTE_RULES: RouteRule[] = [
  {
    match: /^\/$/,
    meta: {
      title: "Alwakeelo AI - Pakistan Law Search & AI Legal Assistant | Digital Lawyer",
      description:
        "Pakistan's premier AI-powered digital lawyer and case law search. Search 600,000+ judgments (PLD, SCMR, YLR), search Pakistan Penal Code, CPC & CrPC, draft petitions, and generate legally binding contracts.",
      index: true,
    },
  },
  {
    match: /^\/auth$/,
    meta: {
      title: "Sign in or create account | Al Wakeelo",
      description:
        "Sign in to Al Wakeelo to access AI-powered Pakistani legal research, judgment search, and drafting tools.",
      index: true,
    },
  },
  {
    match: /^\/forgot-password$/,
    meta: {
      title: "Forgot Password | Al Wakeelo",
      description: "Reset your Al Wakeelo password. We'll email you a secure link to set a new password.",
      index: false,
    },
  },
  {
    match: /^\/reset-password$/,
    meta: {
      title: "Reset Password | Al Wakeelo",
      description: "Set a new password for your Al Wakeelo account.",
      index: false,
    },
  },
  {
    match: /^\/privacy$/,
    meta: {
      title: "Privacy Policy | Al Wakeelo",
      description:
        "How Al Wakeelo collects, uses, and protects your data. Pakistani data-protection compliance, account information, AI chat history, and your rights.",
      index: true,
    },
  },
  {
    match: /^\/terms$/,
    meta: {
      title: "Terms of Service | Al Wakeelo",
      description:
        "Al Wakeelo terms of service: acceptable use, AI output disclaimer, subscription terms, and legal notices for users in Pakistan.",
      index: true,
    },
  },
  {
    match: /^\/cancellation-return-refund-policy$/,
    meta: {
      title: "Cancellation, Return & Refund Policy | Al Wakeelo",
      description:
        "Al Wakeelo subscription cancellation, return, and refund policy. Billing cycle handling, refund eligibility, and how to cancel your plan.",
      index: true,
    },
  },
  {
    match: /^\/ownership-statement$/,
    meta: {
      title: "Ownership Statement | Al Wakeelo",
      description:
        "Al Wakeelo ownership and operator information. Company details, registration, and the team behind Pakistan's AI legal assistant.",
      index: true,
    },
  },
  {
    match: /^\/about$/,
    meta: {
      title: "About Us | Al Wakeelo — Pakistan's AI Legal Assistant",
      description: "Learn about Al Wakeelo, Pakistan's premier AI legal assistant operated by Majnoon Studio. Discover our mission, values, and technology.",
      index: true,
    },
  },
  {
    match: /^\/contact$/,
    meta: {
      title: "Contact Us | Al Wakeelo — Legal Support & Consultation",
      description: "Contact Al Wakeelo and the Majnoon Studio team. Get platform support, ask billing questions, or schedule a professional chamber consultation.",
      index: true,
    },
  },
  {
    match: /^\/faq$/,
    meta: {
      title: "Frequently Asked Questions (FAQ) | Al Wakeelo",
      description: "Got questions about Al Wakeelo? Read our comprehensive FAQ covering features, AI grounding, database statistics, and subscriptions.",
      index: true,
    },
  },
  {
    match: /^\/blog$/,
    meta: {
      title: "Legal Guides & Resources | Al Wakeelo",
      description: "Browse comprehensive legal guides, articles, and tutorials on Pakistani law. Written by legal experts and advocates.",
      index: true,
    },
  },
  {
    match: /^\/blog\/[^/]+$/,
    meta: {
      title: "Legal Guide | Al Wakeelo",
      description: "Read this comprehensive Pakistani legal guide on Al Wakeelo.",
      index: true,
    },
  },
  {
    match: /^\/install$/,
    meta: {
      title: "Install Al Wakeelo on iPhone, Android, or Desktop | Al Wakeelo",
      description:
        "Install Al Wakeelo as a PWA on iPhone, Android, or desktop. Quick setup guides for iOS Safari, Android Chrome, and Chrome/Edge on Windows and macOS.",
      index: true,
    },
  },
  {
    match: /^\/judgments$/,
    meta: {
      title: "Pakistani Judgment Search — 600,000+ Cases | Al Wakeelo",
      description:
        "Search 600,000+ Pakistani judgments from the Supreme Court, High Courts, and Federal Shariat Court. Find case law by citation, party, court, and year.",
      index: true,
    },
  },
  {
    match: /^\/judgments\/browse$/,
    meta: {
      title: "Browse Pakistani Case Law & Judgments Directory | Al Wakeelo",
      description:
        "Browse our directory of Pakistani judgments and case law. Find cases categorized by Court (Supreme Court, High Courts), Year, and Law Journal (PLD, SCMR, CLC).",
      index: true,
    },
  },
  {
    match: /^\/judgment-search$/,
    meta: {
      title: "Pakistani Judgment Search — 600,000+ Cases | Al Wakeelo",
      description:
        "Search 600,000+ Pakistani judgments from the Supreme Court, High Courts, and Federal Shariat Court. Find case law by citation, party, court, and year.",
      index: false, // Legacy redirect route (/judgment-search -> /judgments). Noindex to avoid duplicate canonical.
    },
  },
  {
    match: /^\/judgment\/[^/]+$/,
    meta: {
      title: "Pakistani Judgment — Full Text & Citations | Al Wakeelo",
      description:
        "Read the full text of this Pakistani judgment with verified citation, court, and related case-law references on Al Wakeelo.",
      index: true,
    },
  },
  {
    match: /^\/statute-search$/,
    meta: {
      title: "Pakistani Statute Search — Constitution, PPC, CPC, CrPC, Family Laws | Al Wakeelo",
      description:
        "Search Pakistani statutes by name, section, or keyword. Constitution of Pakistan, Pakistan Penal Code, CPC, CrPC, Family Laws, Contract Act, and more.",
      index: true,
    },
  },
  {
    match: /^\/statute-view\/[^/]+$/,
    meta: {
      title: "Pakistani Statute — Full Text & Sections | Al Wakeelo",
      description:
        "Read the full text of this Pakistani statute with sections, schedules, and amendments on Al Wakeelo.",
      index: true,
    },
  },
  {
    match: /^\/citation-search$/,
    meta: {
      title: "Citation Search — Pakistani Case Law | Al Wakeelo",
      description: "Look up Pakistani case law by citation (PLD, SCMR, CLC, MLD, PCRLJ, and more).",
      index: true,
    },
  },
  {
    match: /^\/al-wakeelo$/,
    meta: {
      title: "Al Wakeelo Engine — Pakistani Legal AI Chat | Al Wakeelo",
      description:
        "Chat with Al Wakeelo, Pakistan's AI legal assistant. Ask questions about Pakistani statutes, judgments, and procedure. Verified citations from 600,000+ cases.",
      index: true,
    },
  },
  {
    match: /^\/legal-drafting$/,
    meta: {
      title: "Legal Drafting — Court-Ready Petitions & Applications | Al Wakeelo",
      description:
        "Draft writ petitions, applications, and court documents under Pakistani law. AI-assisted drafting with verified case-law citations and multi-document tabs.",
      index: true,
    },
  },
  {
    match: /^\/contract-drafting$/,
    meta: {
      title: "Contract Drafting — Pakistani Contract Act 1872 | Al Wakeelo",
      description:
        "Draft contracts under Pakistani law. AI-assisted clause generation with Contract Act 1872 and Arbitration Act 1940 compliance.",
      index: true,
    },
  },
  {
    match: /^\/share\/[^/]+$/,
    meta: {
      title: "Shared Conversation | Al Wakeelo",
      description: "A shared Al Wakeelo legal consultation thread.",
      index: false,
    },
  },
  // Authenticated app routes — set noindex so Google doesn't try to crawl them.
  { match: /^\/dashboard$/,        meta: { title: "Dashboard | Al Wakeelo",        description: "Your Al Wakeelo workspace.",        index: false } },
  { match: /^\/judgment-view$/,    meta: { title: "View Judgment | Al Wakeelo",     description: "Judgment viewer.",                  index: false } },
  { match: /^\/bookmarks$/,        meta: { title: "Bookmarks | Al Wakeelo",         description: "Your saved Al Wakeelo judgments and statutes.", index: false } },
  { match: /^\/history$/,          meta: { title: "History | Al Wakeelo",           description: "Your Al Wakeelo search and chat history.", index: false } },
  { match: /^\/case-documents$/,   meta: { title: "Case Documents | Al Wakeelo",    description: "Your uploaded case documents.",     index: false } },
  { match: /^\/knowledge-vault$/,  meta: { title: "Knowledge Vault | Al Wakeelo",   description: "Your private legal knowledge vault.", index: false } },
  { match: /^\/organization$/,     meta: { title: "Organization | Al Wakeelo",      description: "Manage your Al Wakeelo organization.", index: false } },
  { match: /^\/admin$/,            meta: { title: "Admin Panel | Al Wakeelo",       description: "Al Wakeelo admin panel.",          index: false } },
  { match: /^\/admin-setup$/,      meta: { title: "Admin Setup | Al Wakeelo",       description: "One-time Al Wakeelo admin setup.", index: false } },
  { match: /^\/settings$/,         meta: { title: "Settings | Al Wakeelo",          description: "Al Wakeelo account settings.",     index: false } },
  { match: /^\/checkout/,          meta: { title: "Checkout | Al Wakeelo",          description: "Al Wakeelo subscription checkout.", index: false } },
];

export function lookupSeoMeta(pathname: string): SeoMeta {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/+$/, "") || "/";
  for (const rule of ROUTE_RULES) {
    if (rule.match.test(normalized)) return rule.meta;
  }
  return DEFAULT_META;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildCanonicalUrl(pathname: string): string {
  const normalized = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
  return `${SITE_ORIGIN}${normalized || "/"}`;
}

/**
 * Replace SEO-relevant tags in the cached index.html with values for this route.
 * Touches only tags that exist in client/index.html — leaves everything else intact.
 */
export function injectSeoMeta(html: string, pathname: string, customMeta?: SeoMeta): string {
  const meta = customMeta || lookupSeoMeta(pathname);
  const canonical = buildCanonicalUrl(pathname);
  const titleSafe = escapeHtmlText(meta.title);
  const descSafe = escapeHtmlAttr(meta.description);
  const canonSafe = escapeHtmlAttr(canonical);
  const robots = meta.index
    ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
    : "noindex,nofollow";

  let resultHtml = html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${titleSafe}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="description" content="${descSafe}" />`,
    )
    .replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="robots" content="${robots}" />`,
    )
    .replace(
      /<link\s+id="canonical-link"\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
      `<link id="canonical-link" rel="canonical" href="${canonSafe}" />`,
    )
    .replace(
      /<meta\s+id="og-url-meta"\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
      `<meta id="og-url-meta" property="og:url" content="${canonSafe}" />`,
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:title" content="${titleSafe}" />`,
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta property="og:description" content="${descSafe}" />`,
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:title" content="${titleSafe}" />`,
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?>/i,
      `<meta name="twitter:description" content="${descSafe}" />`,
    );

  if (meta.schemaMarkup) {
    resultHtml = resultHtml.replace("</body>", `${meta.schemaMarkup}\n</body>`);
  }
  return resultHtml;
}
