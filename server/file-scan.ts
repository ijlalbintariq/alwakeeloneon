import { promises as fs } from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import { spawn } from "child_process";
import { recordSecurityEvent } from "./security-monitoring";

export type FileScanMode = "off" | "optional" | "required";

export interface FileScanResult {
  allowed: boolean;
  reason?: string;
}

export interface FileScanConfig {
  mode: FileScanMode;
  bin: string;
  args: string[];
  timeoutMs: number;
}

const DEFAULT_SCAN_BIN = "clamscan";
const DEFAULT_SCAN_ARGS = ["--no-summary"];
const DEFAULT_SCAN_TIMEOUT_MS = 20000;
const DEFAULT_UNAVAILABLE_COOLDOWN_MS = 300000;
const warnedMessages = new Set<string>();
let scannerUnavailableUntil = 0;

function parseMode(raw: string | undefined): FileScanMode {
  const normalized = (raw || "optional").trim().toLowerCase();
  if (normalized === "off") return "off";
  if (normalized === "required") return "required";
  return "optional";
}

function parseArgs(raw: string | undefined): string[] {
  if (!raw) return [...DEFAULT_SCAN_ARGS];
  const parts = raw
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [...DEFAULT_SCAN_ARGS];
}

function parseTimeout(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SCAN_TIMEOUT_MS;
  return Math.max(1000, Math.min(120000, parsed));
}

function parseUnavailableCooldown(raw: string | undefined): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_UNAVAILABLE_COOLDOWN_MS;
  return Math.max(0, Math.min(60 * 60 * 1000, parsed));
}

export function getFileScanConfig(): FileScanConfig {
  return {
    mode: parseMode(process.env.FILE_SCAN_MODE),
    bin: (process.env.FILE_SCAN_BIN || DEFAULT_SCAN_BIN).trim(),
    args: parseArgs(process.env.FILE_SCAN_ARGS),
    timeoutMs: parseTimeout(process.env.FILE_SCAN_TIMEOUT_MS),
  };
}

function warnOnce(key: string, message: string): void {
  if (warnedMessages.has(key)) return;
  warnedMessages.add(key);
  console.warn(message);
}

async function runScanner(tempPath: string, config: FileScanConfig): Promise<"clean" | "infected" | "scanner_error"> {
  const args = [...config.args, tempPath];

  return await new Promise((resolve) => {
    let settled = false;
    const child = spawn(config.bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      resolve("scanner_error");
    }, config.timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve("scanner_error");
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) return resolve("clean");
      if (code === 1) return resolve("infected");
      if (stderr) {
        warnOnce(
          `scan_error:${config.bin}:${code}`,
          `[File Scan] Scanner "${config.bin}" returned code ${code}. ${stderr.trim()}`,
        );
      }
      return resolve("scanner_error");
    });
  });
}

function makeTempPath(filename: string): string {
  const safeName = (filename || "upload.bin").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
  const suffix = crypto.randomBytes(8).toString("hex");
  return path.join(os.tmpdir(), `alwakeelo-scan-${suffix}-${safeName}`);
}

export async function scanUploadedBuffer(buffer: Buffer, filename: string): Promise<FileScanResult> {
  const config = getFileScanConfig();
  if (config.mode === "off") {
    return { allowed: true };
  }

  // When scanner is unavailable in optional mode, avoid repeated expensive
  // spawn/temp-file attempts for every upload until cooldown expires.
  if (config.mode === "optional" && scannerUnavailableUntil > Date.now()) {
    return { allowed: true };
  }

  const tempPath = makeTempPath(filename);
  try {
    await fs.writeFile(tempPath, buffer, { mode: 0o600 });
    const scanResult = await runScanner(tempPath, config);
    if (scanResult === "clean") {
      return { allowed: true };
    }
    if (scanResult === "infected") {
      return { allowed: false, reason: "Malicious file detected by malware scanner." };
    }

    if (config.mode === "required") {
      recordSecurityEvent("malware_scan_error", config.bin, {
        mode: config.mode,
      });
      return { allowed: false, reason: "Malware scanner unavailable. Upload rejected by policy." };
    }

    recordSecurityEvent("malware_scan_error", config.bin, {
      mode: config.mode,
    });
    scannerUnavailableUntil = Date.now() + parseUnavailableCooldown(process.env.FILE_SCAN_UNAVAILABLE_COOLDOWN_MS);

    warnOnce(
      `scan_unavailable:${config.bin}`,
      `[File Scan] Scanner "${config.bin}" unavailable. Continuing because FILE_SCAN_MODE=optional.`,
    );
    return { allowed: true };
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
}
