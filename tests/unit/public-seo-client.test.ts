import test, { after, afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { JSDOM } from "jsdom";
import React, { act } from "react";
import { Router } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { canonicalPublicPath, judgmentDirectoryPath } from "../../shared/public-routes";
import { BLOG_ARTICLES } from "../../shared/blog-data";
import { useDocumentHead } from "../../client/src/hooks/use-document-head";

const dom = new JSDOM('<html><head><meta name="robots"><link id="canonical-link" rel="canonical"><meta id="og-url-meta" property="og:url"></head><body><div id="root"></div></body></html>', { url: "https://www.alwakeelo.com/", pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window), React, IS_REACT_ACT_ENVIRONMENT: true });
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
const { createRoot } = await import("react-dom/client");
fs.mkdirSync("node_modules/.cache", { recursive: true });
const temporary = fs.mkdtempSync(path.resolve("node_modules/.cache/public-seo-tests-"));

async function component(file: string, stubRoutes = false) {
  const outfile = path.join(temporary, path.basename(file).replace(/\.tsx$/, ".mjs"));
  await build({ entryPoints: [file], outfile, bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic", loader: { ".css": "empty" },
    plugins: [{ name: "public-context", setup(builder) {
      builder.onResolve({ filter: /(?:use-auth|PublicPreviewShell|statute-pdf-viewer)$/ }, args => ({ path: args.path, namespace: "public-context" }));
      builder.onLoad({ filter: /.*/, namespace: "public-context" }, args => ({ contents: args.path.endsWith("use-auth")
        ? 'export const useAuth = () => ({ user: undefined, isLoading: false });'
        : args.path.endsWith("statute-pdf-viewer") ? 'export const StatutePdfViewer = () => null;'
        : 'export const PublicPreviewShell = ({ children }) => children;' }));
      if (stubRoutes) {
        builder.onResolve({ filter: /(?:\.\/pages\/|@\/pages\/)/ }, args => {
          if (args.importer.endsWith("AppPreviewRouter.tsx")) return { path: args.path, namespace: "route-marker" };
        });
        builder.onLoad({ filter: /.*/, namespace: "route-marker" }, args => ({ resolveDir: process.cwd(), contents: `import React from 'react'; export default function Marker(){return React.createElement('div',{'data-route':${JSON.stringify(args.path)}},${JSON.stringify(args.path)});}` }));
      }
    } }],
  });
  return (await import(pathToFileURL(outfile).href)).default;
}

const Blog = await component("client/src/experimental/pages/PreviewBlogDetail.tsx");
const Statute = await component("client/src/pages/statute-view.tsx");
const Directory = await component("client/src/pages/judgment-directory.tsx");
const AppRouter = await component("client/src/experimental/AppPreviewRouter.tsx", true);
let root: ReturnType<typeof createRoot>;
const originalFetch = globalThis.fetch;
beforeEach(() => {
  root = createRoot(document.getElementById("root")!);
  globalThis.fetch = async () => { throw new Error("Unexpected network request in public SEO regression test"); };
});
afterEach(async () => { await act(async () => root.unmount()); globalThis.fetch = originalFetch; });
after(() => { dom.window.close(); fs.rmSync(temporary, { recursive: true, force: true }); });

async function render(Component: React.ComponentType<any>, url: string, props = {}) {
  window.history.replaceState({}, "", url);
  await act(async () => root.render(React.createElement(Router, { hook: () => [url.split("?")[0], () => {}] }, React.createElement(Component, props))));
}

test("public aliases share canonical paths while workspace routes remain untouched", () => {
  for (const [legacy, canonical] of [["/preview", "/"], ["/landing", "/"], ["/preview/landing/", "/"], ["/preview/about", "/about"], ["/preview/blog/example", "/blog/example"], ["/preview/install-app", "/install"], ["/refund-policy", "/cancellation-return-refund-policy"], ["/preview/pricing", "/pricing"]]) {
    assert.equal(canonicalPublicPath(legacy), canonical);
  }
  for (const workspace of ["/preview/auth", "/preview/dashboard", "/preview/cases/123", "/preview/judgments/123", "/unknown"]) {
    assert.equal(canonicalPublicPath(workspace), workspace);
  }
});

test("directory canonicals retain valid filters and pagination in stable order", () => {
  assert.equal(judgmentDirectoryPath(new URLSearchParams("page=2&year=2024&courtId=03&limit=20&tracking=ignore")), "/judgments/browse?courtId=3&year=2024&limit=20&page=2");
  assert.equal(judgmentDirectoryPath(new URLSearchParams("limit=50&page=1")), "/judgments/browse");
  assert.throws(() => judgmentDirectoryPath(new URLSearchParams("page=-1")), RangeError);
});

test("client metadata preserves the public canonical and does not duplicate differently cased brand names", async () => {
  function Head({ title, route }: { title: string; route: string }) { useDocumentHead({ title, description: "Public page", path: route }); return null; }
  for (const title of ["AL WAKEELO AI — Legal Research", "Alwakeelo AI — Legal Research", "Al Wakeelo AI — Legal Research"]) {
    await render(Head, "/", { title, route: "/preview" });
    assert.equal(document.title, title);
    assert.equal(document.querySelector("#canonical-link")?.getAttribute("href"), "https://www.alwakeelo.com/");
    assert.equal(document.querySelector("#og-url-meta")?.getAttribute("content"), "https://www.alwakeelo.com/");
  }
});

for (const prefix of ["/blog/", "/preview/blog/"]) {
  test(`article renders immediately with public metadata through ${prefix}`, async () => {
    const article = BLOG_ARTICLES[0];
    await render(Blog, prefix + article.slug);
    assert.equal(document.querySelectorAll("h1").length, 1);
    assert.equal(document.querySelector("h1")?.textContent, article.title);
    assert.ok(document.querySelector("h2"));
    assert.doesNotMatch(document.body.textContent || "", /Article Not Found|Loading article/);
    assert.match(document.body.textContent || "", /individual legal reviewer is not recorded/);
    assert.equal(document.querySelector("#canonical-link")?.getAttribute("href"), `https://www.alwakeelo.com/blog/${article.slug}`);
    assert.doesNotMatch(document.querySelector('meta[name="robots"]')?.getAttribute("content") || "", /noindex/);
  });
}

test("missing articles stay on their URL and become noindex", async () => {
  await render(Blog, "/blog/missing-guide");
  assert.match(document.body.textContent || "", /Article Not Found/);
  assert.match(document.querySelector('meta[name="robots"]')?.getAttribute("content") || "", /noindex/);
  assert.equal(window.location.pathname, "/blog/missing-guide");
});

test("late statute responses cannot replace a newer document or its metadata", async () => {
  const pending = new Map<string, { signal?: AbortSignal | null; resolve: (value: any) => void }>();
  globalThis.fetch = ((url: string, options?: RequestInit) => new Promise(resolve => pending.set(url, { signal: options?.signal, resolve }))) as typeof fetch;
  await render(Statute, "/statute-view/1");
  await render(Statute, "/statute-view/2");
  assert.equal(pending.get("/api/public/statutes/1")?.signal?.aborted, true);
  await act(async () => pending.get("/api/public/statutes/2")!.resolve({ ok: true, json: async () => ({ id: 2, title: "New Statute", content: "New law", file: null }) }));
  await act(async () => pending.get("/api/public/statutes/1")!.resolve({ ok: true, json: async () => ({ id: 1, title: "Old Statute", content: "Old law", file: null }) }));
  assert.match(document.body.textContent || "", /New Statute/);
  assert.doesNotMatch(document.body.textContent || "", /Old Statute/);
  assert.match(document.title, /New Statute/);
  assert.equal(document.querySelector("#canonical-link")?.getAttribute("href"), "https://www.alwakeelo.com/statute-view/2");
});

test("missing statutes show an unavailable state without redirecting to a dashboard or indexing", async () => {
  globalThis.fetch = async () => ({ ok: false, status: 404 }) as Response;
  await render(Statute, "/statute-view/404");
  assert.match(document.body.textContent || "", /Statute not found/);
  assert.equal(window.location.pathname, "/statute-view/404");
  assert.match(document.querySelector('meta[name="robots"]')?.getAttribute("content") || "", /noindex/);
});

test("statute navigation clears the previous body and indexable metadata while the next document loads", async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: 1, title: "Previous Statute", content: "Previous body", file: null }) }) as Response;
  await render(Statute, "/statute-view/1");
  assert.match(document.title, /Previous Statute/);
  globalThis.fetch = (() => new Promise(() => {})) as typeof fetch;
  await render(Statute, "/statute-view/2");
  assert.doesNotMatch(document.body.textContent || "", /Previous body|Previous Statute/);
  assert.doesNotMatch(document.title, /Previous Statute/);
  assert.match(document.querySelector('meta[name="robots"]')?.getAttribute("content") || "", /noindex/);
  assert.equal(document.querySelector("#canonical-link")?.getAttribute("href"), "https://www.alwakeelo.com/statute-view/2");
});

test("restored directory fetches its real query-string endpoint and exposes canonical judgment links", async () => {
  const requests: string[] = [];
  globalThis.fetch = (async (url: string) => {
    requests.push(url);
    return { ok: true, json: async () => url.includes("/list?") ? {
      items: [{ id: "case-id", citation: "2024 SCMR 100", title: "Example vs State", year: 2024, page: 100, decisionDate: null, courtName: "Supreme Court", journalCode: "SCMR" }],
      pagination: { total: 101, totalIsEstimate: true, page: 1, limit: 50, totalPages: 3, hasMore: true },
    } : { courts: [], journals: [], years: [] } } as Response;
  }) as typeof fetch;
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0, queryFn: async ({ queryKey }) => (await fetch(String(queryKey[0]))).json() } } });
  function Page() { return React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Directory)); }
  await render(Page, "/judgments/browse?year=2024");
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  assert.ok(requests.includes("/api/public/browse/list?year=2024&page=1&limit=50"));
  assert.equal(document.querySelector('a[href="/judgment/case-id"]')?.getAttribute("href"), "/judgment/case-id");
  assert.equal(document.querySelector("a a"), null);
  assert.equal(document.querySelector("#canonical-link")?.getAttribute("href"), "https://www.alwakeelo.com/judgments/browse?year=2024");
  assert.match(document.body.textContent || "", /101 candidate records; unconfirmed identities omitted/);
  await render(Page, "/judgments/browse");
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  assert.ok(document.querySelector('a[href="/judgment/case-id"]'), "The unfiltered directory retains its server-rendered case links after rendering");
  assert.ok(document.querySelector('a[href="/judgments/browse?page=2"]'));
  await act(async () => root.unmount());
  root = createRoot(document.getElementById("root")!);
  queryClient.clear();
});

test("public router selects browse and statute readers before dynamic routes and shows a real unknown page", async () => {
  for (const [url, marker] of [["/judgments/browse", "@/pages/judgment-directory"], ["/statute-view/12", "@/pages/statute-view"], ["/ownership-statement", "@/pages/ownership-statement"], ["/missing-public-page", "@/pages/not-found"]]) {
    await render(AppRouter, url);
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
    assert.equal(document.querySelector("[data-route]")?.getAttribute("data-route"), marker);
  }
});
