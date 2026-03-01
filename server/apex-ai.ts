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

export type ApexModel = "apex" | "apex-pro" | "apex-agent";

interface ApexChatOptions {
  model: ApexModel;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  maxTokens?: number;
}

interface ApexResponse {
  content: string;
  reasoning?: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

function getModelConfig(model: ApexModel) {
  switch (model) {
    case "apex":
      return {
        modelId: "kimi-k2.5",
        temperature: 0.6,
        thinking: false,
        displayName: "Apex",
      };
    case "apex-pro":
      return {
        modelId: "kimi-k2.5",
        temperature: 1.0,
        thinking: true,
        displayName: "Apex Pro",
      };
    case "apex-agent":
      return {
        modelId: "kimi-k2.5",
        temperature: 0.7,
        thinking: true,
        displayName: "Apex Agent",
      };
  }
}

export function isApexAvailable(): boolean {
  return !!process.env.MOONSHOT_API_KEY;
}

export function getApexModelsForTier(tier: string): Array<{ id: ApexModel; name: string; description: string }> {
  const models: Array<{ id: ApexModel; name: string; description: string }> = [];

  if (tier === "pro" || tier === "enterprise") {
    models.push({
      id: "apex",
      name: "Apex",
      description: "Fast, intelligent responses for legal queries",
    });
    models.push({
      id: "apex-pro",
      name: "Apex Pro",
      description: "Deep reasoning with thinking traces for complex legal analysis",
    });
    models.push({
      id: "apex-agent",
      name: "Apex Agent",
      description: "Advanced agent with multi-step reasoning and task execution",
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

  const response = await client.chat.completions.create({
    model: config.modelId,
    messages: options.messages,
    temperature: config.temperature,
    max_tokens: options.maxTokens || 8192,
    top_p: 0.95,
    ...extraBody,
  });

  const choice = response.choices[0];
  const content = choice?.message?.content || "No response generated.";
  const reasoning = (choice?.message as any)?.reasoning_content || undefined;

  return {
    content,
    reasoning,
    model: config.displayName,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
  };
}
