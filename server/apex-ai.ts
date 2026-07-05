import OpenAI from "openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

let openrouterClientForApex: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (openrouterClientForApex) return openrouterClientForApex;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;
  openrouterClientForApex = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      "HTTP-Referer": "https://al-wakeelo.replit.app",
      "X-Title": "Al Wakeelo Legal Assistant",
    },
    timeout: 300_000, 
    maxRetries: 1, 
  });
  return openrouterClientForApex;
}

export type ApexModel = "apex-pro" | "apex-agent";

// ─── Claude Sonnet 5 Agent Types ────────────────────────────────────────────

export interface AgentSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface AgentStep {
  type: "thinking" | "searching" | "reading" | "synthesizing";
  content: string;
  searchQuery?: string;
  results?: AgentSearchResult[];
}

export interface ApexAgentResponse {
  content: string;
  reasoning?: string;
  model: string;
  steps: AgentStep[];
  searchQueries: string[];
  sourcesUsed: AgentSearchResult[];
  inputTokens?: number;
  outputTokens?: number;
}

interface ApexChatOptions {
  model: ApexModel;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

interface ApexResponse {
  content: string;
  reasoning?: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

interface ApexTranscriptionOptions {
  model?: ApexModel;
  audioBase64: string;
  audioFormat: "wav" | "mp3" | "m4a" | "webm" | "ogg";
  prompt?: string;
}

function getModelConfig(model: ApexModel) {
  switch (model) {
    case "apex-pro":
      return {
        modelId: "anthropic/claude-sonnet-5",
        temperature: 0.5,
        displayName: "Claude Sonnet 5",
      };
    case "apex-agent":
      return {
        modelId: "anthropic/claude-sonnet-5",
        temperature: 0.5,
        displayName: "Claude Sonnet 5",
      };
  }
}

export function isApexAvailable(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

export function getApexModelsForTier(tier: string): Array<{ id: ApexModel; name: string; description: string }> {
  const models: Array<{ id: ApexModel; name: string; description: string }> = [];

  if (tier === "chamber" || tier === "enterprise") {
    models.push({
      id: "apex-pro",
      name: "Apex",
      description: "Claude Sonnet 5 mode for advanced legal research & analysis.",
    });
    models.push({
      id: "apex-agent",
      name: "Apex Pro",
      description: "Claude Sonnet 5 mode with deep reasoning.",
    });
  }

  return models;
}

export async function chatWithApex(options: ApexChatOptions): Promise<ApexResponse> {
  const client = getClient();
  if (!client) {
    throw new Error("Apex AI is not configured. OPENROUTER_API_KEY is required.");
  }

  const config = getModelConfig(options.model);
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : config.temperature;

  const response = await client.chat.completions.create(
    {
      model: config.modelId,
      messages: options.messages,
      temperature,
      max_tokens: options.maxTokens || 8192,
    },
    { signal: options.signal, maxRetries: 1 } as any,
  );

  const choice = response.choices[0];
  const content = (choice?.message?.content || "").trim();

  return {
    content,
    reasoning: undefined,
    model: config.displayName,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

export async function transcribeWithApex(options: ApexTranscriptionOptions): Promise<ApexResponse> {
  const model = options.model || "apex-pro";
  const config = getModelConfig(model);
  return {
    content: "Audio transcription is only supported using the primary Whisper model. Please use the default audio transcriber.",
    reasoning: undefined,
    model: config.displayName,
  };
}

export async function* streamWithApex(options: {
  model?: ApexModel;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}): AsyncGenerator<string> {
  const client = getClient();
  if (!client) {
    throw new Error("Apex AI is not configured. OPENROUTER_API_KEY is required.");
  }
  const model = options.model || "apex-pro";
  const config = getModelConfig(model);
  const temperature = Number.isFinite(options.temperature) ? Number(options.temperature) : config.temperature;

  const stream = await client.chat.completions.create(
    {
      model: config.modelId,
      messages: options.messages as any,
      temperature,
      max_tokens: options.maxTokens || 8192,
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

// ─── Claude Sonnet 5 Agent ──────────────────────────────────────────────

interface ApexAgentOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  maxIterations?: number;
  totalBudgetMs?: number;
  perIterationTimeoutMs?: number;
  signal?: AbortSignal;
}

export async function chatWithApexAgent(options: ApexAgentOptions): Promise<ApexAgentResponse> {
  const client = getClient();
  if (!client) {
    throw new Error("Apex AI is not configured. OPENROUTER_API_KEY is required.");
  }

  const agentModelId = "anthropic/claude-sonnet-5";
  const steps: AgentStep[] = [];
  steps.push({
    type: "thinking",
    content: "Claude Sonnet 5 is analyzing your legal query...",
  });

  const response = await client.chat.completions.create({
    model: agentModelId,
    messages: options.messages as any,
    temperature: 0.5,
    max_tokens: options.maxTokens || 8192,
  });

  const choice = response.choices[0];
  const rawContent = choice?.message?.content || "";
  const content = rawContent.trim() || "No response generated.";

  steps.push({
    type: "synthesizing",
    content: "Claude Sonnet 5 has completed legal research and analysis.",
  });

  return {
    content,
    reasoning: undefined,
    model: "Claude Sonnet 5",
    steps,
    searchQueries: [],
    sourcesUsed: [],
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}
