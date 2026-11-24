import fs from "node:fs";
import os from "node:os";
import type { Request, Response, NextFunction } from "express";

const MiB = 1024 * 1024;
function readBytes(paths: string[]): number | undefined {
  for (const path of paths) {
    try {
      const value = Number(fs.readFileSync(path, "utf8").trim());
      if (Number.isFinite(value) && value > 0 && value < Number.MAX_SAFE_INTEGER) return value;
    } catch { /* cgroup files are absent on local macOS development machines. */ }
  }
}
export const memoryLimitBytes = readBytes([
  "/sys/fs/cgroup/memory.max", "/sys/fs/cgroup/memory/memory.limit_in_bytes",
]) ?? (process.env.RENDER ? 512 * MiB : os.totalmem());

export function memorySafeConcurrency(value: string | undefined, fallback: number, smallInstanceMax: number, limit = memoryLimitBytes): number {
  const parsed = Number(value || fallback);
  const desired = Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  return limit <= 768 * MiB ? Math.min(desired, smallInstanceMax) : desired;
}

export function containerWorkingSet(usage: number, stat: string): number {
  // Exclude reclaimable disk cache; otherwise disk uploads can cause permanent false pressure.
  const match = /(?:^|\n)total_inactive_file (\d+)/.exec(stat) ?? /(?:^|\n)inactive_file (\d+)/.exec(stat);
  return Math.max(0, usage - Number(match?.[1] || 0));
}

export function readMemorySnapshot() {
  const memory = process.memoryUsage();
  const containerBytes = readBytes([
    "/sys/fs/cgroup/memory.current", "/sys/fs/cgroup/memory/memory.usage_in_bytes",
  ]);
  let workingSetBytes = containerBytes;
  for (const path of ["/sys/fs/cgroup/memory.stat", "/sys/fs/cgroup/memory/memory.stat"]) {
    try { workingSetBytes = containerWorkingSet(containerBytes ?? 0, fs.readFileSync(path, "utf8")); break; }
    catch { /* RSS remains available when container accounting is absent. */ }
  }
  return { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, externalBytes: memory.external,
    arrayBufferBytes: memory.arrayBuffers, containerBytes, workingSetBytes, limitBytes: memoryLimitBytes,
    usedBytes: Math.max(memory.rss, workingSetBytes ?? 0) };
}

export function createMemoryGuard(readMemory = readMemorySnapshot) {
  let activeRequests = 0, publicReads = 0, sitemaps = 0, rejected = 0;
  const publicLimit = memorySafeConcurrency(process.env.SEO_MAX_CONCURRENT, 4, 4);
  const stats = () => ({ activeRequests, publicReads, sitemaps, rejected, publicLimit });
  const middleware = (req: Request, res: Response, next: NextFunction) => {
    const sitemap = /^\/sitemap(?:[.-]|$)/.test(req.path);
    const publicRead = /^(?:\/judgments?(?:\/|$)|\/statute-view(?:\/|$)|\/statutes(?:\/|$)|\/api\/public\/judgments(?:\/|$))/.test(req.path);
    if (sitemap || publicRead) {
      const memory = readMemory();
      if (memory.usedBytes >= memory.limitBytes * 0.8 || (sitemap ? sitemaps >= 1 : publicReads >= publicLimit)) {
        rejected++;
        res.setHeader("Retry-After", "30");
        res.setHeader("Cache-Control", "no-store");
        res.status(503).send("Temporarily busy. Please retry shortly.");
        return;
      }
    }
    activeRequests++;
    if (sitemap) sitemaps++;
    else if (publicRead) publicReads++;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      activeRequests--;
      if (sitemap) sitemaps--;
      else if (publicRead) publicReads--;
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
  return { middleware, stats };
}
export const memoryGuard = createMemoryGuard();

export function startMemoryMonitor(workload: () => object) {
  let peakBytes = 0, lastLog = 0;
  const sample = () => {
    const memory = readMemorySnapshot();
    peakBytes = Math.max(peakBytes, memory.usedBytes);
    const high = memory.usedBytes >= memory.limitBytes * 0.7;
    const now = Date.now();
    if (now - lastLog < (high ? 5_000 : 30_000)) return;
    lastLog = now;
    (high ? console.warn : console.log)("[Memory]", JSON.stringify({ ...memory, peakBytes, ...memoryGuard.stats(), ...workload() }));
  };
  sample();
  const timer = setInterval(sample, 1_000);
  timer.unref();
  return () => clearInterval(timer);
}
