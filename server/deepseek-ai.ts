import OpenAI from "openai";
import type { ChatCompletionTool, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { CITATION_SEARCH_TOOL, executeCitationSearch, normalizeCitationKey } from "./tools/citation-search-tool";

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_CHAT_MODEL = "deepseek-chat";
const DEEPSEEK_REASONER_MODEL = "deepseek-reasoner";

let deepseekClient: OpenAI | null = null;
let modelVersionLogged = false;

function resolveDeepSeekApiKey(): string | undefined {
  return process.env.DEEPSEEK_API_KEY || process.env.DeepSeek_API_KEY;
}

function getClient(): OpenAI {
  if (deepseekClient) return deepseekClient;
  const apiKey = resolveDeepSeekApiKey();
  if (!apiKey) {
    throw new Error("DeepSeek is not configured. Set DEEPSEEK_API_KEY.");
  }
  deepseekClient = new OpenAI({
    apiKey,
    baseURL: DEEPSEEK_BASE_URL,
  });
  return deepseekClient;
}

export function isDeepSeekAvailable(): boolean {
  return !!resolveDeepSeekApiKey();
}

export function getDeepSeekModelName(): string {
  return DEEPSEEK_CHAT_MODEL;
}

export function getDeepSeekProModelName(): string {
  return DEEPSEEK_REASONER_MODEL;
}

interface DeepSeekChatOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
}

interface DeepSeekResponse {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface DeepSeekTranscriptionOptions {
  audioBase64: string;
  audioFormat: "wav" | "mp3" | "m4a" | "webm" | "ogg";
  prompt?: string;
}

export async function chatWithDeepSeek(options: DeepSeekChatOptions): Promise<DeepSeekResponse> {
  const client = getClient();
  const model = options.model || DEEPSEEK_CHAT_MODEL;
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.7;

  const response = await client.chat.completions.create(
    {
      model,
      messages: options.messages,
      max_tokens: options.maxTokens || 8192,
      temperature,
    },
    { signal: options.signal, maxRetries: 1 } as any,
  );

  const choice = response.choices[0];
  const content = choice?.message?.content || "No response generated.";

  // One-time prod log: confirm which DeepSeek version `deepseek-chat` resolves to.
  // V4 launched 2026-04-24; this tells us if our slug is on V4 or still V3.
  if (!modelVersionLogged) {
    modelVersionLogged = true;
    console.log(`[DeepSeek] requested="${model}" served="${response.model || "unknown"}"`);
  }

  return {
    content,
    model: response.model || model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

export async function chatWithDeepSeekPro(options: Omit<DeepSeekChatOptions, "model">): Promise<DeepSeekResponse> {
  return chatWithDeepSeek({ ...options, model: DEEPSEEK_REASONER_MODEL });
}

export async function* streamWithDeepSeek(options: DeepSeekChatOptions): AsyncGenerator<string> {
  const client = getClient();
  const model = options.model || DEEPSEEK_CHAT_MODEL;
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : 0.7;

  const stream = await client.chat.completions.create(
    {
      model,
      messages: options.messages,
      max_tokens: options.maxTokens || 8192,
      temperature,
      stream: true,
    },
    { signal: options.signal, maxRetries: 1 } as any,
  );

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      yield text;
    }
  }
}

// ── Tool-calling support ─────────────────────────────────────────────────────

export interface ToolCallOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  tools: ChatCompletionTool[];
  toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>;
  maxTokens?: number;
  maxToolRounds?: number; // safety limit on tool call iterations
  signal?: AbortSignal;
}

/**
 * Chat with DeepSeek using function/tool calling.
 * Runs a tool-call loop: AI calls tool → executor runs it → results fed back → AI responds.
 * Returns the final text response after all tool calls are resolved.
 */
export async function chatWithDeepSeekTools(options: ToolCallOptions): Promise<DeepSeekResponse> {
  const client = getClient();
  const { tools, toolExecutor, maxToolRounds = 4, maxTokens = 8192 } = options;

  const messages: ChatCompletionMessageParam[] = options.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  let inputTokensTotal = 0;
  let outputTokensTotal = 0;
  let rounds = 0;

  while (rounds < maxToolRounds) {
    rounds++;

    const response = await client.chat.completions.create(
      {
        model: DEEPSEEK_CHAT_MODEL,
        messages,
        tools,
        tool_choice: "auto",
        max_tokens: maxTokens,
        temperature: 0.3, // lower temp for more deterministic tool use
      },
      { signal: options.signal, maxRetries: 1 } as any,
    );

    inputTokensTotal += response.usage?.prompt_tokens ?? 0;
    outputTokensTotal += response.usage?.completion_tokens ?? 0;

    const choice = response.choices[0];
    const message = choice?.message;

    // Push assistant message to history
    messages.push(message as ChatCompletionMessageParam);

    // If no tool calls → we have the final response
    if (!message?.tool_calls || message.tool_calls.length === 0) {
      return {
        content: message?.content || "No response generated.",
        model: response.model || DEEPSEEK_CHAT_MODEL,
        inputTokens: inputTokensTotal,
        outputTokens: outputTokensTotal,
      };
    }

    // Execute each tool call and push results back
    for (const toolCall of message.tool_calls) {
      const tc = toolCall as any;
      const fnName = tc.function?.name ?? "";
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function?.arguments || "{}");
      } catch {
        args = {};
      }

      let result = "";
      try {
        result = await toolExecutor(fnName, args);
      } catch (err) {
        result = JSON.stringify({ error: "Tool execution failed", message: String(err) });
      }

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: result,
      } as ChatCompletionMessageParam);
    }
  }

  // Fallback: ask for final response without tools after max rounds
  const fallbackResponse = await client.chat.completions.create(
    {
      model: DEEPSEEK_CHAT_MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    },
    { signal: options.signal, maxRetries: 1 } as any,
  );

  return {
    content: fallbackResponse.choices[0]?.message?.content || "No response generated.",
    model: fallbackResponse.model || DEEPSEEK_CHAT_MODEL,
    inputTokens: inputTokensTotal + (fallbackResponse.usage?.prompt_tokens ?? 0),
    outputTokens: outputTokensTotal + (fallbackResponse.usage?.completion_tokens ?? 0),
  };
}

export async function transcribeWithDeepSeek(options: DeepSeekTranscriptionOptions): Promise<DeepSeekResponse> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: DEEPSEEK_CHAT_MODEL,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: {
              data: options.audioBase64,
              format: options.audioFormat,
            },
          },
          {
            type: "text",
            text:
              options.prompt ||
              "Transcribe this audio accurately. Return ONLY the transcription text. If the audio is in Urdu or another language, transcribe it in that language.",
          },
        ] as any,
      },
    ],
    max_tokens: 2048,
    temperature: 0,
  } as any);

  const choice = response.choices[0];
  const messageContent: any = choice?.message?.content;
  const content =
    typeof messageContent === "string"
      ? messageContent
      : Array.isArray(messageContent)
        ? messageContent.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join(" ").trim()
        : "No response generated.";

  return {
    content,
    model: response.model || DEEPSEEK_CHAT_MODEL,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

// ── JSON repair ─────────────────────────────────────────────────────────────
// Used when deepseek-v4-flash emits malformed references JSON like
// {"laws":,"judgments":}. Sends the broken block to deepseek-chat with
// response_format:json_object so the API enforces valid JSON output.

export async function repairReferencesJson(
  brokenJson: string,
  signal?: AbortSignal,
): Promise<{ laws: unknown[]; judgments: unknown[] } | null> {
  if (!resolveDeepSeekApiKey()) return null;
  const client = getClient();
  try {
    const response = await client.chat.completions.create(
      {
        model: DEEPSEEK_CHAT_MODEL,
        messages: [
          {
            role: "system",
            content:
              'You are a JSON repair assistant. ' +
              'Return ONLY valid JSON matching this exact schema: ' +
              '{"laws":[{"name":"string","section":"string","description":"string"}],' +
              '"judgments":[{"citation":"string","court":"string","description":"string"}]}. ' +
              'If an array is missing or corrupt, use an empty array []. ' +
              'Never invent new entries — only repair what is there.',
          },
          {
            role: "user",
            content: `Repair this broken JSON:\n${brokenJson}`,
          },
        ],
        max_tokens: 600,
        temperature: 0,
        response_format: { type: "json_object" },
      } as any,
      { signal, maxRetries: 1 } as any,
    );
    const raw = response.choices[0]?.message?.content || "";
    const parsed = JSON.parse(raw);
    return {
      laws: Array.isArray(parsed.laws) ? parsed.laws : [],
      judgments: Array.isArray(parsed.judgments) ? parsed.judgments : [],
    };
  } catch (err) {
    console.warn("[repairReferencesJson] Failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ── Tool-based judgment search ────────────────────────────────────────────────
// AI calls search_judgments 2-3 times with its own chosen short queries.
// Same DB function as the Judgment Search UI — no pipeline, no classifiers.

export interface ToolJudgmentSearchResult {
  contextString: string;
  foundCount: number;
  queriesUsed: string[];
  verifiedCitations: string[];
}

export async function runToolJudgmentSearch(
  userQuery: string,
  onStatus: (query: string, found: number) => void,
  signal?: AbortSignal,
  totalTimeoutMs = 14000,
): Promise<ToolJudgmentSearchResult> {
  const client = getClient();
  const deadline = Date.now() + totalTimeoutMs;

  // Truncate long user messages — tool search only needs the legal topic,
  // not a full scenario. 300 chars is enough for the AI to pick search terms.
  const safeQuery = userQuery.slice(0, 300);

  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a Pakistani case law search assistant. " +
        "Call search_judgments 2-3 times with SHORT different queries (2-4 words each) to find relevant judgments. " +
        "Use specific Pakistani legal terms. Different angles per call. After all searches respond: DONE",
    },
    { role: "user", content: safeQuery },
  ];

  const allResults: Array<{ citation: string; court: string; title: string; summary: string }> = [];
  const queriesUsed: string[] = [];
  let rounds = 0;

  while (rounds < 3) {
    // Abort if overall deadline exceeded — prevents hanging the entire chat request
    if (Date.now() >= deadline) break;
    rounds++;

    // Per-round abort controller — each DeepSeek call gets max 6s
    const roundAbort = new AbortController();
    const roundTimer = setTimeout(() => roundAbort.abort(), 6000);
    // Propagate parent signal to round abort
    const onParentAbort = () => roundAbort.abort();
    signal?.addEventListener("abort", onParentAbort);

    let response;
    try {
      response = await client.chat.completions.create(
        {
          model: DEEPSEEK_CHAT_MODEL,
          messages,
          tools: [CITATION_SEARCH_TOOL],
          tool_choice: rounds === 1 ? "required" : "auto",
          max_tokens: 300,
          temperature: 0.1,
        },
        { signal: roundAbort.signal, maxRetries: 0 } as any,
      );
    } catch {
      break;
    } finally {
      clearTimeout(roundTimer);
      signal?.removeEventListener("abort", onParentAbort);
    }

    const message = response.choices[0]?.message;
    if (!message) break;
    messages.push(message as ChatCompletionMessageParam);

    if (!message.tool_calls?.length) break;

    for (const toolCall of message.tool_calls) {
      const tc = toolCall as any;
      let args: { query: string; court?: string; limit?: number } = { query: "" };
      try { args = JSON.parse(tc.function?.arguments || "{}"); } catch { /* ignore */ }
      if (!args.query) continue;

      queriesUsed.push(args.query);
      const resultStr = await executeCitationSearch(args).catch(() =>
        JSON.stringify({ found: 0, results: [] }),
      );

      let parsed: { found: number; results: typeof allResults } = { found: 0, results: [] };
      try { parsed = JSON.parse(resultStr); } catch { /* ignore */ }

      onStatus(args.query, parsed.found || 0);
      if (parsed.results?.length) allResults.push(...parsed.results);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: resultStr,
      } as ChatCompletionMessageParam);
    }
  }

  // Deduplicate by normalised citation string — handles formatting variants ("PLD 2020 SC 456" vs "PLD 2020 SC 456." etc.)
  const seen = new Set<string>();
  const unique = allResults.filter((r) => {
    const key = normalizeCitationKey(r.citation);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) {
    return { contextString: "", foundCount: 0, queriesUsed, verifiedCitations: [] };
  }

  const lines = unique.map(
    (r) =>
      `- CITATION: ${r.citation} | COURT: ${r.court} | TITLE: ${r.title}` +
      // V4 1M context — 1200 chars per case gives the answer model enough
      // substance to cite specifically rather than paraphrase short snippets.
      (r.summary ? ` — ${r.summary.slice(0, 1200)}` : ""),
  );

  const contextString = [
    "=== AI-SEARCHED JUDGMENTS (DIRECT DB — TOOL VERIFIED) ===",
    "Use ONLY these citations. Copy each CITATION string EXACTLY. Format: **[CITATION]** — explanation.",
    "FORBIDDEN: Do NOT invent citations. Every citation must appear in this list.",
    ...lines,
  ].join("\n");

  return { contextString, foundCount: unique.length, queriesUsed, verifiedCitations: unique.map(u => u.citation) };
}
