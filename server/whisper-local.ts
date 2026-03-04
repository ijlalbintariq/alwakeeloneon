import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function getEnvInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  if (!Number.isFinite(raw)) return fallback;
  return Math.max(1, Math.floor(raw));
}

function spawnAndWait(cmd: string, args: string[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const proc = spawn(cmd, args);
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${cmd} exited with code ${code}. ${stderr}`.trim()));
    });
  });
}

export function isWhisperCppConfigured(): boolean {
  return Boolean(process.env.WHISPER_BIN_PATH && process.env.WHISPER_MODEL_PATH);
}

async function convertAudioToWav(
  inputBuffer: Buffer,
  inputExtension: string,
): Promise<string> {
  const tempInput = join(tmpdir(), `whisper-input-${randomUUID()}${inputExtension}`);
  const tempWav = join(tmpdir(), `whisper-audio-${randomUUID()}.wav`);
  await writeFile(tempInput, inputBuffer);
  try {
    await spawnAndWait("ffmpeg", [
      "-y",
      "-i",
      tempInput,
      "-vn",
      "-f",
      "wav",
      "-ar",
      "16000",
      "-ac",
      "1",
      "-acodec",
      "pcm_s16le",
      tempWav,
    ]);
    return tempWav;
  } finally {
    await unlink(tempInput).catch(() => {});
  }
}

export interface WhisperCppTranscribeOptions {
  audioBuffer: Buffer;
  filename?: string;
  language?: string;
}

export async function transcribeWithWhisperCpp(
  options: WhisperCppTranscribeOptions,
): Promise<{ text: string; model: string }> {
  const whisperBin = process.env.WHISPER_BIN_PATH;
  const whisperModel = process.env.WHISPER_MODEL_PATH;
  if (!whisperBin || !whisperModel) {
    throw new Error("whisper.cpp is not configured (set WHISPER_BIN_PATH and WHISPER_MODEL_PATH)");
  }

  const filename = (options.filename || "audio.webm").toLowerCase();
  const ext = filename.includes(".") ? filename.substring(filename.lastIndexOf(".")) : ".webm";
  const wavPath = await convertAudioToWav(options.audioBuffer, ext);
  const outPrefix = join(tmpdir(), `whisper-out-${randomUUID()}`);
  const outTxtPath = `${outPrefix}.txt`;
  const threads = getEnvInt("WHISPER_CPP_THREADS", 4);
  const language = (options.language || process.env.WHISPER_CPP_LANGUAGE || "auto").trim();

  try {
    const args = [
      "-m",
      whisperModel,
      "-f",
      wavPath,
      "-otxt",
      "-of",
      outPrefix,
      "-t",
      String(threads),
    ];
    if (language && language !== "auto") {
      args.push("-l", language);
    }
    await spawnAndWait(whisperBin, args);
    const text = (await readFile(outTxtPath, "utf8")).trim();
    return {
      text,
      model: "whisper.cpp",
    };
  } finally {
    await unlink(wavPath).catch(() => {});
    await unlink(outTxtPath).catch(() => {});
  }
}
