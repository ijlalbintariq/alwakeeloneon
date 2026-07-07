import OpenAI from "openai";

const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1";
const DEFAULT_MODEL = "moonshot-v1-128k";

let moonshotClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (moonshotClient) return moonshotClient;
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    throw new Error("Moonshot/Kimi is not configured. MOONSHOT_API_KEY is required.");
  }
  moonshotClient = new OpenAI({
    apiKey,
    baseURL: MOONSHOT_BASE_URL,
    timeout: 300_000,
  });
  return moonshotClient;
}

export function isMoonshotAvailable(): boolean {
  return !!process.env.MOONSHOT_API_KEY;
}

interface MoonshotChatOptions {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>;
  maxTokens?: number;
  model?: string;
  temperature?: number;
  useInstant?: boolean;
}

interface MoonshotResponse {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export async function chatWithMoonshot(options: MoonshotChatOptions): Promise<MoonshotResponse> {
  const client = getClient();
  const model = options.model || DEFAULT_MODEL;
  
  const isKimiModel = model.startsWith("kimi");
  const useInstant = options.useInstant ?? false;

  const apiOptions: any = {
    model,
    messages: options.messages as any,
    max_tokens: options.maxTokens || 8192,
    temperature: options.temperature ?? (isKimiModel ? (useInstant ? 0.6 : 1.0) : 0.7),
  };

  if (isKimiModel) {
    apiOptions.thinking = useInstant ? { type: "disabled" } : { type: "enabled" };
  }

  const response = await client.chat.completions.create(apiOptions);

  const choice = response.choices[0];
  const message = choice?.message as any;
  let content = message?.content || "";

  // Fallback reasoning extraction if content is empty/falsy
  if (!content.trim() && message?.reasoning_content) {
    const reasoning = String(message.reasoning_content || "");
    const thinkEnd = reasoning.lastIndexOf("</think>");
    if (thinkEnd >= 0 && reasoning.length > thinkEnd + 8) {
      content = reasoning.slice(thinkEnd + 8).trim();
    }
    if (!content.trim()) {
      content = reasoning;
    }
  }

  if (!content.trim()) {
    content = "No response generated.";
  }

  return {
    content,
    model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}

export async function* streamWithMoonshot(options: MoonshotChatOptions): AsyncGenerator<string> {
  const client = getClient();
  const model = options.model || DEFAULT_MODEL;
  
  const isKimiModel = model.startsWith("kimi");
  const useInstant = options.useInstant ?? false;

  const apiOptions: any = {
    model,
    messages: options.messages as any,
    max_tokens: options.maxTokens || 8192,
    temperature: options.temperature ?? (isKimiModel ? (useInstant ? 0.6 : 1.0) : 0.7),
    stream: true,
  };

  if (isKimiModel) {
    apiOptions.thinking = useInstant ? { type: "disabled" } : { type: "enabled" };
  }

  const stream = (await client.chat.completions.create(apiOptions)) as any;

  let startedReasoning = false;
  let finishedReasoning = false;

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta as any;
    const reasoning = delta?.reasoning_content;
    const content = delta?.content;

    if (reasoning) {
      if (!startedReasoning) {
        yield "<think>\n";
        startedReasoning = true;
      }
      yield reasoning;
    }

    if (content) {
      if (startedReasoning && !finishedReasoning) {
        yield "\n</think>\n\n";
        finishedReasoning = true;
      }
      yield content;
    }
  }

  if (startedReasoning && !finishedReasoning) {
    yield "\n</think>\n\n";
  }
}

export function getMoonshotModelName(): string {
  return DEFAULT_MODEL;
}
