import express, { type Express } from "express";
import fs from "fs";
import path from "path";

const KNOWN_SPA_ROUTES: RegExp[] = [
  /^\/$/,
  /^\/auth$/,
  /^\/forgot-password$/,
  /^\/reset-password$/,
  /^\/share\/[^/]+$/,
  /^\/privacy$/,
  /^\/terms$/,
  /^\/install$/,
  /^\/dashboard$/,
  /^\/judgment-search$/,
  /^\/judgment-view$/,
  /^\/citation-search$/,
  /^\/judgment\/[^/]+$/,
  /^\/statute-search$/,
  /^\/statute-view\/[^/]+$/,
  /^\/al-wakeelo$/,
  /^\/legal-drafting$/,
  /^\/contract-drafting$/,
  /^\/case-documents$/,
  /^\/bookmarks$/,
  /^\/history$/,
  /^\/knowledge-vault$/,
  /^\/organization$/,
  /^\/admin$/,
  /^\/settings$/,
  /^\/admin-setup$/,
];

function isKnownSpaRoute(pathname: string): boolean {
  return KNOWN_SPA_ROUTES.some((pattern) => pattern.test(pathname));
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, {
    etag: true,
    maxAge: "7d",
    setHeaders: (res, filePath) => {
      const isHtml = filePath.endsWith(".html");
      if (isHtml) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      } else {
        res.setHeader("Cache-Control", "public, max-age=604800, immutable");
      }
    },
  }));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (req, res) => {
    const pathname = req.path || "/";
    const wantsHtml = (req.get("accept") || "").includes("text/html");
    if (!wantsHtml) {
      return res.status(404).end();
    }

    if (isKnownSpaRoute(pathname)) {
      return res.sendFile(path.resolve(distPath, "index.html"));
    }

    return res.status(404).sendFile(path.resolve(distPath, "index.html"));
  });
}
