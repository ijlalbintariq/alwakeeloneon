import OpenAI from "openai";

const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1";

let moonshotClient: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (moonshotClient) return moonshotClient;
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) return null;
  moonshotClient = new OpenAI({
    apiKey,
    baseURL: MOONSHOT_BASE_URL,
  });
  return moonshotClient;
}

export type ApexModel = "apex-pro" | "apex-agent";

// ─── Kimi Agent Web Search Types ────────────────────────────────────────────

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
        modelId: "kimi-k2.5",
        temperature: 1,
        thinking: false,
        displayName: "Apex",
      };
    case "apex-agent":
      return {
        modelId: "kimi-k2-thinking",
        temperature: 1,
        thinking: true,
        displayName: "Apex Pro",
      };
  }
}

export function isApexAvailable(): boolean {
  return !!process.env.MOONSHOT_API_KEY;
}

export function getApexModelsForTier(tier: string): Array<{ id: ApexModel; name: string; description: string }> {
  const models: Array<{ id: ApexModel; name: string; description: string }> = [];

  if (tier === "chamber" || tier === "enterprise") {
    models.push({
      id: "apex-pro",
      name: "Apex",
      description: "Kimi-K2.5 mode for fast, high-quality legal drafting and analysis.",
    });
    models.push({
      id: "apex-agent",
      name: "Apex Pro",
      description: "Kimi-K2-Thinking mode for deeper legal reasoning in non-web internal context.",
    });
  }

  return models;
}

export async function chatWithApex(options: ApexChatOptions): Promise<ApexResponse> {
  const client = getClient();
  if (!client) {
    throw new Error("Apex AI is not configured. MOONSHOT_API_KEY is required.");
  }

  const config = getModelConfig(options.model);
  const extraBody: Record<string, any> = {};
  if (!config.thinking) {
    extraBody.chat_template_kwargs = { thinking: false };
  }

  const response = await client.chat.completions.create(
    {
      model: config.modelId,
      messages: options.messages,
      temperature: config.temperature,
      max_tokens: options.maxTokens || 8192,
      top_p: 0.95,
      ...extraBody,
    },
    { signal: options.signal, maxRetries: 1 } as any,
  );

  const choice = response.choices[0];
  const rawContent = choice?.message?.content || "";
  const reasoning = (choice?.message as any)?.reasoning_content || undefined;
  const content = rawContent.trim() || reasoning || "No response generated.";

  return {
    content,
    reasoning,
    model: config.displayName,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

export async function transcribeWithApex(options: ApexTranscriptionOptions): Promise<ApexResponse> {
  const client = getClient();
  if (!client) {
    throw new Error("Apex AI is not configured. MOONSHOT_API_KEY is required.");
  }

  const model = options.model || "apex-pro";
  const config = getModelConfig(model);

  const response = await client.chat.completions.create({
    model: config.modelId,
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
    temperature: 0,
    max_tokens: 2048,
    top_p: 1,
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
    reasoning: undefined,
    model: config.displayName,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

// ─── Kimi Agent with Web Search ──────────────────────────────────────────────

interface ApexAgentOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
  maxIterations?: number;
  // Total wall-clock budget across all agent iterations. When breached,
  // the loop exits gracefully and returns whatever partial content has been
  // assembled. Default: 45_000 ms.
  totalBudgetMs?: number;
  // Per-iteration model call timeout. Default: 30_000 ms (matches SLA).
  perIterationTimeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * chatWithApexAgent — uses Kimi's built-in $web_search tool to perform
 * multi-step legal research across the web, then synthesizes findings.
 *
 * Moonshot API supports the special "$web_search" tool which lets the model
 * autonomously decide when and what to search, then read results and continue.
 */
export async function chatWithApexAgent(options: ApexAgentOptions): Promise<ApexAgentResponse> {
  const client = getClient();
  if (!client) {
    throw new Error("Apex AI is not configured. MOONSHOT_API_KEY is required.");
  }

  // Use moonshot-v1-128k for agent mode — supports $web_search tool
  const agentModelId = "moonshot-v1-128k";
  const maxIterations = options.maxIterations ?? 6;
  const totalBudgetMs = Math.max(5_000, options.totalBudgetMs ?? 45_000);
  // Per-iteration capped at 8s so multiple search iterations fit within the total budget.
  // 45s total / ~8s per = ~5 usable iterations, which matches maxIterations=6 with a buffer.
  const perIterationTimeoutMs = Math.max(5_000, options.perIterationTimeoutMs ?? 8_000);
  const agentStartedAt = Date.now();
  const remainingBudgetMs = () => totalBudgetMs - (Date.now() - agentStartedAt);

  const steps: AgentStep[] = [];
  const searchQueries: string[] = [];
  const sourcesUsed: AgentSearchResult[] = [];

  // The $web_search tool definition for Moonshot API
  const webSearchTool = {
    type: "builtin_function" as const,
    function: {
      name: "$web_search",
    },
  };

  let messages: any[] = [...options.messages];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalContent = "";
  let finalReasoning: string | undefined;
  let budgetExhausted = false;

  steps.push({
    type: "thinking",
    content: "Analyzing your legal query and planning research strategy...",
  });

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    // Guard: do not start another iteration if we would breach the budget.
    const remaining = remainingBudgetMs();
    if (remaining <= 2_000) {
      budgetExhausted = true;
      steps.push({
        type: "synthesizing",
        content: `Time budget (${totalBudgetMs}ms) nearly exhausted — finalizing best available answer.`,
      });
      break;
    }

    // Cap this iteration's model call at min(perIterationTimeout, remainingBudget).
    const iterationTimeoutMs = Math.min(perIterationTimeoutMs, Math.max(2_000, remaining - 500));
    const iterationCtrl = new AbortController();
    const iterationTimer = setTimeout(() => iterationCtrl.abort(), iterationTimeoutMs);

    let response: any;
    try {
      response = await (client.chat.completions.create as any)(
        {
          model: agentModelId,
          messages,
          temperature: 0.3,
          max_tokens: options.maxTokens || 8192,
          top_p: 0.95,
          tools: [webSearchTool],
          tool_choice: "auto",
        },
        { signal: options.signal || iterationCtrl.signal, maxRetries: 1 } as any,
      );
    } catch (iterationErr) {
      clearTimeout(iterationTimer);
      // If we have accumulated some partial content from a prior iteration, return gracefully.
      if (finalContent) {
        budgetExhausted = true;
        steps.push({
          type: "synthesizing",
          content: "Upstream iteration failed — returning best partial answer gathered so far.",
        });
        break;
      }
      throw iterationErr;
    }
    clearTimeout(iterationTimer);

    totalInputTokens += response.usage?.prompt_tokens || 0;
    totalOutputTokens += response.usage?.completion_tokens || 0;

    const choice = response.choices[0];
    const message = choice?.message;

    if (!message) break;

    // Add assistant message to conversation
    messages.push(message);

    const finishReason = choice.finish_reason;

    // Check if model wants to call a tool (web search)
    if (finishReason === "tool_calls" && message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.function?.name === "$web_search") {
          let searchArgs: { query?: string } = {};
          try {
            searchArgs = JSON.parse(toolCall.function.arguments || "{}");
          } catch {
            searchArgs = {};
          }

          const query = searchArgs.query || "Pakistan legal research";
          searchQueries.push(query);

          steps.push({
            type: "searching",
            content: `Searching the web for: "${query}"`,
            searchQuery: query,
          });

          // Return the tool result — Moonshot handles the actual search
          // We provide a placeholder result; the API processes the search internally
          const toolResultMessage = {
            role: "tool" as const,
            tool_call_id: toolCall.id,
            name: "$web_search",
            content: JSON.stringify({
              query,
              status: "searching",
            }),
          };

          messages.push(toolResultMessage);

          steps.push({
            type: "reading",
            content: `Reading and analyzing search results for: "${query}"`,
            searchQuery: query,
          });
        }
      }
      // Continue the loop to get the next response after tool calls
      continue;
    }

    // Model has finished — extract final content
    const rawContent = message.content || "";
    const reasoning = (message as any).reasoning_content || undefined;

    if (rawContent) {
      finalContent = rawContent;
      finalReasoning = reasoning;

      steps.push({
        type: "synthesizing",
        content: "Synthesizing research findings into comprehensive legal analysis...",
      });

      break;
    }

    // If no content and no tool calls, break to avoid infinite loop
    if (finishReason === "stop" || finishReason === "length") {
      finalContent = rawContent || "Research complete. No additional information found.";
      break;
    }
  }

  if (!finalContent) {
    finalContent = budgetExhausted
      ? `Agent research stopped early (time budget ${totalBudgetMs}ms reached). Returning partial findings where available.`
      : "Agent research completed. Please review the analysis above.";
  }

  return {
    content: finalContent,
    reasoning: finalReasoning,
    model: "Apex Agent (Kimi Web Research)",
    steps,
    searchQueries,
    sourcesUsed,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}
