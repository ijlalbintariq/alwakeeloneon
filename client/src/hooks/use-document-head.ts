import { useEffect } from "react";

const SITE_NAME = "Al Wakeelo";
const SITE_ORIGIN = "https://www.alwakeelo.com";

interface DocumentHeadOptions {
  title: string;
  description: string;
  path?: string;
  /** Defaults to true. Set false on pages that should not be indexed (auth, settings, admin, share/*). */
  index?: boolean;
}

function setMetaContent(selector: string, content: string) {
  const el = document.querySelector(selector) as HTMLMetaElement | null;
  if (el) {
    el.setAttribute("content", content);
  }
}

function setLinkHref(selector: string, href: string) {
  const el = document.querySelector(selector) as HTMLLinkElement | null;
  if (el) {
    el.setAttribute("href", href);
  }
}

export function useDocumentHead({ title, description, path, index = true }: DocumentHeadOptions): void {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const canonicalPath = path ?? (typeof window !== "undefined" ? window.location.pathname : "/");
    const canonicalUrl = `${SITE_ORIGIN}${canonicalPath === "/" ? "/" : canonicalPath.replace(/\/+$/, "")}`;

    document.title = fullTitle;
    setMetaContent('meta[name="description"]', description);
    setLinkHref('link#canonical-link', canonicalUrl);
    setMetaContent('meta#og-url-meta', canonicalUrl);
    setMetaContent('meta[property="og:title"]', fullTitle);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[name="twitter:title"]', fullTitle);
    setMetaContent('meta[name="twitter:description"]', description);

    const robotsEl = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (robotsEl) {
      robotsEl.setAttribute(
        "content",
        index
          ? "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
          : "noindex,nofollow",
      );
    }
  }, [title, description, path, index]);
}
