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
    timeout: 300_000, // 300s client-level timeout — K2.6 web searches can take 90s+
    maxRetries: 1, // Reduce retries to avoid doubling an already-slow call
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
        modelId: "kimi-k2.6",
        temperature: 1,
        thinking: false,
        displayName: "Apex",
      };
    case "apex-agent":
      return {
        modelId: "kimi-k2.6",
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

  let response: any;
  try {
    response = await client.chat.completions.create(
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
  } catch (err: any) {
    // Moonshot sometimes returns 400 "model output must contain either output text or tool calls"
    const isEmptyOutputError = err?.status === 400
      || err?.message?.includes("model output")
      || err?.message?.includes("cannot both be empty");

    if (isEmptyOutputError) {
      // Retry with the non-thinking model (kimi-k2.6) + explicit thinking:false + lower temperature.
      // For thinking models (apex-agent), the original call had no chat_template_kwargs,
      // so retrying identically would fail the same way. Falling back to kimi-k2.6 ensures
      // the retry is genuinely different.
      const retryModelId = "kimi-k2.6";
      const retryTemp = 0.8;
      console.warn(`[chatWithApex] Moonshot 400 (${config.modelId}), retrying with ${retryModelId}: ${err?.message}`);
      try {
        const retryExtra = { chat_template_kwargs: { thinking: false } };
        response = await client.chat.completions.create(
          {
            model: retryModelId,
            messages: options.messages,
            temperature: retryTemp,
            max_tokens: options.maxTokens || 8192,
            top_p: 0.95,
            ...retryExtra,
          },
          { signal: options.signal, maxRetries: 1 } as any,
        );
      } catch (retryErr: any) {
        console.warn(`[chatWithApex] Retry with ${retryModelId} also failed: ${retryErr?.message}`);
        // Return a graceful fallback instead of crashing
        return {
          content: "The AI model encountered a temporary issue processing this request. Please try again, or use Standard/Turbo mode for instant answers from our internal legal database.",
          reasoning: undefined,
          model: config.displayName,
        };
      }
    } else {
      throw err;
    }
  }

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
 * chatWithApexAgent — uses Kimi K2.6 with built-in $web_search tool for
 * Pakistani legal research.
 *
 * How K2.6 $web_search works:
 * 1. We send the request with the $web_search builtin_function tool
 * 2. K2.6 decides to search → returns finish_reason="tool_calls" with
 *    search results embedded in the tool_call arguments as {search_result: {search_id: "..."}}
 * 3. We send the tool result back (passing through the search data)
 * 4. K2.6 reads the search results and generates the final synthesized answer
 */
export async function chatWithApexAgent(options: ApexAgentOptions): Promise<ApexAgentResponse> {
  const client = getClient();
  if (!client) {
    throw new Error("Apex AI is not configured. MOONSHOT_API_KEY is required.");
  }

  const agentModelId = "kimi-k2.6";
  const maxIterations = options.maxIterations ?? 6;
  const totalBudgetMs = Math.max(10_000, options.totalBudgetMs ?? 180_000);
  // Per-iteration timeout: 90s — K2.6 web search + synthesis can take 60-80s
  const perIterationTimeoutMs = Math.max(10_000, options.perIterationTimeoutMs ?? 90_000);
  const agentStartedAt = Date.now();
  const remainingBudgetMs = () => totalBudgetMs - (Date.now() - agentStartedAt);

  const steps: AgentStep[] = [];
  const searchQueries: string[] = [];
  const sourcesUsed: AgentSearchResult[] = [];

  const webSearchTool = {
    type: "builtin_function" as const,
    function: { name: "$web_search" },
  };

  const messages: any[] = [...options.messages];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalContent = "";
  let finalReasoning: string | undefined;

  steps.push({
    type: "thinking",
    content: "Analyzing your legal query and planning web research strategy...",
  });

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const remaining = remainingBudgetMs();
    if (remaining <= 2_000) {
      steps.push({
        type: "synthesizing",
        content: `Time budget exhausted — finalizing best available answer.`,
      });
      break;
    }

    const iterationTimeoutMs = Math.min(perIterationTimeoutMs, Math.max(5_000, remaining - 500));
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), iterationTimeoutMs);

    const parentSignal = options.signal;
    const onParentAbort = () => ctrl.abort();
    if (parentSignal && !parentSignal.aborted) {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }

    let response: any;
    try {
      response = await (client.chat.completions.create as any)(
        {
          model: agentModelId,
          messages,
          temperature: 0.6,
          max_tokens: options.maxTokens || 8192,
          tools: [webSearchTool],
          tool_choice: "auto",
          thinking: { type: "disabled" },
        },
        { signal: ctrl.signal, maxRetries: 1 } as any,
      );
    } catch (err: any) {
      clearTimeout(timer);
      parentSignal?.removeEventListener("abort", onParentAbort);

      const isAbort = err?.name === "AbortError"
        || err?.message?.includes("aborted")
        || err?.message?.includes("abort");

      // Moonshot sometimes returns 400 "model output must contain either output text or tool calls"
      // This happens when thinking:disabled conflicts with $web_search or context is too large.
      // Retry once without thinking:disabled before giving up.
      const isEmptyOutputError = err?.message?.includes("model output")
        || err?.message?.includes("cannot both be empty")
        || err?.status === 400;

      if (isEmptyOutputError && iteration === 0) {
        console.warn(`[Apex Agent] K2.6 empty-output error on iteration 0, retrying without thinking:disabled...`);
        try {
          const retryCtrl = new AbortController();
          const retryTimer = setTimeout(() => retryCtrl.abort(), iterationTimeoutMs);
          response = await (client.chat.completions.create as any)(
            {
              model: agentModelId,
              messages,
              temperature: 0.6,
              max_tokens: options.maxTokens || 8192,
              tools: [webSearchTool],
              tool_choice: "auto",
            },
            { signal: retryCtrl.signal, maxRetries: 1 } as any,
          );
          clearTimeout(retryTimer);
          // Fall through to normal processing below
        } catch (retryErr: any) {
          console.warn(`[Apex Agent] Retry also failed:`, retryErr?.message);
          steps.push({
            type: "synthesizing",
            content: "Web research could not be completed — returning answer from internal database.",
          });
          finalContent = "The Apex web research agent encountered an issue. Please use the standard Al Wakeelo chat for answers from our comprehensive internal legal database, or try a simpler query.";
          break;
        }
      } else if (finalContent || isAbort) {
        steps.push({
          type: "synthesizing",
          content: isAbort && !finalContent
            ? "Web research request timed out — please try a more specific query."
            : "Returning best partial answer gathered so far.",
        });
        if (!finalContent) {
          finalContent = "The web research request took longer than expected. Please try a more specific question, or use the standard Al Wakeelo chat for instant answers from our internal legal database.";
        }
        break;
      } else if (isEmptyOutputError) {
        // Failed on a later iteration — return what we have
        steps.push({
          type: "synthesizing",
          content: "Model returned empty response — finalizing with gathered information.",
        });
        if (!finalContent) {
          finalContent = "The web research agent could not generate a complete response. Please try a simpler or more specific query.";
        }
        break;
      } else {
        throw err;
      }
    }
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);

    totalInputTokens += response.usage?.prompt_tokens || 0;
    totalOutputTokens += response.usage?.completion_tokens || 0;

    const choice = response.choices[0];
    const message = choice?.message;
    if (!message) {
      // K2.6 occasionally returns empty choices — treat as end of conversation
      steps.push({
        type: "synthesizing",
        content: "Model returned no response — finalizing with available information.",
      });
      break;
    }

    // Strip reasoning_content before pushing back to avoid K2.6 validation errors
    const cleanMessage = { ...message };
    delete cleanMessage.reasoning_content;
    messages.push(cleanMessage);

    const finishReason = choice.finish_reason;

    // Handle $web_search tool calls — K2.6 returns search results embedded
    // in the tool_call arguments as {search_result: {search_id: "..."}}
    if (finishReason === "tool_calls" && message.tool_calls?.length > 0) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.function?.name === "$web_search") {
          // The arguments contain the actual search results from Moonshot API
          const rawArgs = toolCall.function.arguments || "{}";

          // Try to extract search query for logging
          try {
            const parsed = JSON.parse(rawArgs);
            const query = parsed.query || parsed.search_query || "";
            if (query) searchQueries.push(query);
          } catch {}

          steps.push({
            type: "searching",
            content: `Searching the web for Pakistani legal information...`,
          });

          // CRITICAL: Pass the search results back as the tool response.
          // The arguments already contain the search_id and results from
          // Moonshot's internal search — we pass them through unchanged.
          messages.push({
            role: "tool" as const,
            tool_call_id: toolCall.id,
            name: "$web_search",
            content: rawArgs,
          });

          steps.push({
            type: "reading",
            content: "Reading and analyzing web search results...",
          });
        }
      }
      continue; // Next iteration — model will now synthesize the search results
    }

    // Model returned text content (or empty — handle both)
    const rawContent = (message.content || "").trim();
    const reasoning = (message as any).reasoning_content || undefined;

    if (rawContent) {
      // Detect if the model wants to continue searching (partial answer)
      const wantsMoreSearch = /\b(let me search|let me look|i('ll| will) (search|look|find|check)|searching for more|need to (search|find|look|check)|i should search)\b/i.test(rawContent);

      if (wantsMoreSearch && finishReason !== "stop" && iteration < maxIterations - 1) {
        // Accumulate partial content and let the model continue
        finalContent = (finalContent ? finalContent + "\n\n" : "") + rawContent;
        finalReasoning = reasoning;
        steps.push({
          type: "thinking",
          content: "Continuing research for more comprehensive answer...",
        });
        continue; // Let the model do another iteration
      }

      // Final answer — combine with any previously accumulated partial content
      finalContent = finalContent
        ? finalContent + "\n\n" + rawContent
        : rawContent;
      finalReasoning = reasoning;
      steps.push({
        type: "synthesizing",
        content: "Synthesizing research findings into comprehensive legal analysis...",
      });
      break;
    }

    // Empty content with stop/length — use whatever we have
    if (finishReason === "stop" || finishReason === "length") {
      finalContent = finalContent || "Research complete. No additional information found.";
      break;
    }

    // Empty content, no tool_calls, no stop — K2.6 returned nothing useful.
    // This can happen when the model is confused by a complex prompt.
    // Don't loop forever — break and return what we have.
    if (!message.tool_calls?.length) {
      steps.push({
        type: "synthesizing",
        content: "Model response was empty — finalizing with gathered information.",
      });
      break;
    }
  }

  if (!finalContent) {
    finalContent = "Agent research completed but no content was generated. Please try rephrasing your query.";
  }

  return {
    content: finalContent,
    reasoning: finalReasoning,
    model: "Apex Agent (Kimi K2.6 Web Research)",
    steps,
    searchQueries,
    sourcesUsed,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}


