import express, { type Express, type Request, type Response } from "express";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

const audioBodyParser = express.json({ limit: "50mb" });

async function convertToWav(audioBuffer: Buffer): Promise<string> {
  const inputPath = join(tmpdir(), `input-${randomUUID()}`);
  const outputPath = join(tmpdir(), `output-${randomUUID()}.wav`);
  await writeFile(inputPath, audioBuffer);
  try {
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-i", inputPath,
        "-vn",
        "-f", "wav",
        "-ar", "16000",
        "-ac", "1",
        "-acodec", "pcm_s16le",
        "-y",
        outputPath,
      ]);
      ffmpeg.stderr.on("data", () => {});
      ffmpeg.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))));
      ffmpeg.on("error", reject);
    });
    return outputPath;
  } catch (err) {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
    throw err;
  } finally {
    await unlink(inputPath).catch(() => {});
  }
}

async function transcribeWithWhisper(wavPath: string): Promise<string> {
  const bin = process.env.WHISPER_BIN_PATH;
  const model = process.env.WHISPER_MODEL_PATH;
  if (!bin || !model) {
    throw new Error("Offline transcription not configured (set WHISPER_BIN_PATH and WHISPER_MODEL_PATH)");
  }
  const outPrefix = join(tmpdir(), `whisper-${randomUUID()}`);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(bin, ["-m", model, "-f", wavPath, "-otxt", "-of", outPrefix]);
    proc.stderr.on("data", () => {});
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`whisper.cpp exited with code ${code}`))));
    proc.on("error", reject);
  });
  const outTxtPath = `${outPrefix}.txt`;
  const text = await readFile(outTxtPath, "utf-8").catch(() => "");
  await unlink(outTxtPath).catch(() => {});
  return text.trim();
}

export function registerOfflineTranscriptionRoutes(app: Express): void {
  app.post("/api/transcribe", audioBodyParser, async (req: Request, res: Response) => {
    try {
      const { audio } = req.body as { audio?: string };
      if (!audio) {
        return res.status(400).json({ error: "Audio data (base64) is required" });
      }
      const rawBuffer = Buffer.from(audio, "base64");
      const wavPath = await convertToWav(rawBuffer);
      try {
        const text = await transcribeWithWhisper(wavPath);
        await unlink(wavPath).catch(() => {});
        return res.json({ text });
      } catch (err: any) {
        await unlink(wavPath).catch(() => {});
        return res.status(503).json({ error: err?.message || "Transcription unavailable" });
      }
    } catch (err: any) {
      return res.status(500).json({ error: "Failed to process audio" });
    }
  });
}
