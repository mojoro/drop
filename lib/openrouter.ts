import {
  buildSystemPrompt,
  buildUserPrompt,
  buildRepairPrompt,
  stripCodeFences,
  getLengthConfig,
  DEFAULT_HOSTS,
  type ScriptLength,
  type ScriptLanguage,
  type PromptOptions,
} from "@/lib/prompt";
import { validatePodcastScript } from "@/lib/featherless";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "qwen/qwen3-8b";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

async function callOpenRouter(
  messages: Array<{ role: "system" | "user"; content: string }>,
  apiKey: string,
  model?: string,
  maxTokens?: number,
) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      temperature: 0.4,
      max_tokens: maxTokens || 1200,
      messages,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.message ||
      JSON.stringify(data) ||
      `HTTP ${response.status}`;
    throw new Error(`OpenRouter error: ${detail}`);
  }

  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter returned an empty script.");
  }

  return stripCodeFences(content).trim();
}

export async function generateScriptOpenRouter(
  content: string,
  apiKey?: string,
  model?: string,
  length: ScriptLength = "short",
  language?: ScriptLanguage,
  opts?: PromptOptions,
  customMinutes?: number,
): Promise<string> {
  const key = apiKey || process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("Missing OpenRouter API key");

  const cleanedContent = content.trim().slice(0, 10000);
  if (!cleanedContent) {
    throw new Error("No content was provided to OpenRouter.");
  }

  const promptOpts: PromptOptions = { ...opts, language: opts?.language ?? language };
  const hosts = promptOpts.hosts ?? DEFAULT_HOSTS;
  const cfg = getLengthConfig(length, customMinutes);
  const systemPrompt = buildSystemPrompt(promptOpts);
  const userPrompt = buildUserPrompt(cleanedContent, length, promptOpts, customMinutes);

  try {
    const firstPass = await callOpenRouter(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      key,
      model,
      cfg.maxTokens,
    );

    if (validatePodcastScript(firstPass, length, hosts.a, hosts.b, customMinutes, !!promptOpts.monologue)) {
      return firstPass;
    }

    const repaired = await callOpenRouter(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildRepairPrompt(firstPass, length, promptOpts, customMinutes) },
      ],
      key,
      model,
      cfg.maxTokens,
    );

    if (!validatePodcastScript(repaired, length, hosts.a, hosts.b, customMinutes, !!promptOpts.monologue)) {
      throw new Error("OpenRouter returned invalid script format after retry.");
    }

    return repaired;
  } catch (error) {
    throw new Error(`OpenRouter script generation failed: ${errorMessage(error)}`);
  }
}
