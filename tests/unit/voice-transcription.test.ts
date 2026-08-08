import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveOpenRouterAudioFormat, transcribeWithOpenRouter } from "../../server/openrouter-transcription";

test("audio format resolution accepts supported recorder and upload formats only", () => {
  assert.equal(resolveOpenRouterAudioFormat("audio/webm; codecs=opus", "recording.webm"), "webm");
  assert.equal(resolveOpenRouterAudioFormat("audio/mp4", "recording.m4a"), "m4a");
  assert.equal(resolveOpenRouterAudioFormat("audio/x-wav", "recording"), "wav");
  assert.equal(resolveOpenRouterAudioFormat("application/octet-stream", "hearing.flac"), "flac");
  assert.equal(resolveOpenRouterAudioFormat("audio/x-unsupported", "recording.bin"), null);
  assert.equal(resolveOpenRouterAudioFormat("video/webm", "recording.bin"), null);
});

test("OpenRouter transcription sends base64 audio to the dedicated STT endpoint", async () => {
  let requestUrl = "";
  let requestBody: Record<string, any> = {};
  let requestHeaders = new Headers();
  const fetchImpl: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body || "{}"));
    requestHeaders = new Headers(init?.headers);
    return new Response(JSON.stringify({ text: "  section 489-F PPC  ", usage: { seconds: 2.4 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await transcribeWithOpenRouter({
    audioBuffer: Buffer.from("legal audio"),
    audioFormat: "webm",
    apiKey: "test-key",
    fetchImpl,
    primaryModel: "openai/gpt-4o-mini-transcribe",
    fallbackModel: "openai/whisper-large-v3",
  });

  assert.equal(requestUrl, "https://openrouter.ai/api/v1/audio/transcriptions");
  assert.equal(requestBody.model, "openai/gpt-4o-mini-transcribe");
  assert.deepEqual(requestBody.input_audio, {
    data: Buffer.from("legal audio").toString("base64"),
    format: "webm",
  });
  assert.equal(requestBody.language, undefined);
  assert.equal(requestHeaders.get("Authorization"), "Bearer test-key");
  assert.equal(requestHeaders.get("HTTP-Referer"), "https://alwakeelo.com");
  assert.equal(result.text, "section 489-F PPC");
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.fallbackFrom, null);
});

test("OpenRouter transcription falls back to Whisper when the primary model fails", async () => {
  const requestedModels: string[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body || "{}"));
    requestedModels.push(body.model);
    if (body.model === "primary-model") {
      return new Response(JSON.stringify({ error: { message: "primary unavailable" } }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ text: "fallback transcript" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await transcribeWithOpenRouter({
    audioBuffer: Buffer.from("audio"),
    audioFormat: "m4a",
    apiKey: "test-key",
    fetchImpl,
    primaryModel: "primary-model",
    fallbackModel: "fallback-model",
  });

  assert.deepEqual(requestedModels, ["primary-model", "fallback-model"]);
  assert.equal(result.text, "fallback transcript");
  assert.equal(result.model, "fallback-model");
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.fallbackFrom, "primary-model");
});

test("OpenRouter transcription falls back when the primary returns empty text", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ text: calls === 1 ? "   " : "usable transcript" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await transcribeWithOpenRouter({
    audioBuffer: Buffer.from("audio"),
    audioFormat: "wav",
    apiKey: "test-key",
    fetchImpl,
    primaryModel: "primary-model",
    fallbackModel: "fallback-model",
  });

  assert.equal(calls, 2);
  assert.equal(result.text, "usable transcript");
  assert.equal(result.fallbackUsed, true);
});

test("OpenRouter transcription rejects blank API keys without making a request", async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => {
    called = true;
    return new Response();
  };

  await assert.rejects(
    transcribeWithOpenRouter({
      audioBuffer: Buffer.from("audio"),
      audioFormat: "wav",
      apiKey: "   ",
      fetchImpl,
      primaryModel: "same-model",
      fallbackModel: "same-model",
    }),
    /OPENROUTER_API_KEY is required/,
  );
  assert.equal(called, false);
});

test("OpenRouter transcription aborts requests that exceed the timeout", async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    });
  };

  await assert.rejects(
    transcribeWithOpenRouter({
      audioBuffer: Buffer.from("audio"),
      audioFormat: "wav",
      apiKey: "test-key",
      fetchImpl,
      primaryModel: "same-model",
      fallbackModel: "same-model",
      timeoutMs: 10,
    }),
    /timed out after 10ms/,
  );
});

test("OpenRouter transcription returns the final provider error when both models fail", async () => {
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    return new Response(JSON.stringify({ error: { message: `failure ${calls}` } }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  };

  await assert.rejects(
    transcribeWithOpenRouter({
      audioBuffer: Buffer.from("audio"),
      audioFormat: "ogg",
      apiKey: "test-key",
      fetchImpl,
      primaryModel: "primary-model",
      fallbackModel: "fallback-model",
    }),
    /failure 2/,
  );
  assert.equal(calls, 2);
});

test("voice recording is connected to engine, legal drafting, and contract drafting", () => {
  const helperSource = readFileSync(new URL("../../server/openrouter-transcription.ts", import.meta.url), "utf8");
  const routeSource = readFileSync(new URL("../../server/routes.ts", import.meta.url), "utf8");
  const hookSource = readFileSync(new URL("../../client/src/hooks/use-voice-recorder.ts", import.meta.url), "utf8");
  const engineSource = readFileSync(new URL("../../client/src/pages/chat.tsx", import.meta.url), "utf8");
  const legalSource = readFileSync(new URL("../../client/src/pages/legal-drafting.tsx", import.meta.url), "utf8");
  const contractSource = readFileSync(new URL("../../client/src/pages/contract-drafting.tsx", import.meta.url), "utf8");

  assert.match(helperSource, /DEFAULT_PRIMARY_MODEL = "openai\/gpt-4o-transcribe"/);
  assert.match(helperSource, /DEFAULT_FALLBACK_MODEL = "openai\/whisper-large-v3"/);
  assert.match(routeSource, /transcribeWithOpenRouter\(\{/);
  assert.doesNotMatch(routeSource, /transcribeWithDeepSeek\(\{/);
  assert.doesNotMatch(routeSource, /transcribeWithApex\(\{/);
  assert.match(hookSource, /onAutoTranscriptionRef\.current/);
  assert.match(engineSource, /useVoiceRecorder\(\{ onAutoTranscription:/);
  assert.match(legalSource, /useVoiceRecorder\(\{ onAutoTranscription:/);
  assert.match(contractSource, /useVoiceRecorder\(\{ onAutoTranscription:/);
});
