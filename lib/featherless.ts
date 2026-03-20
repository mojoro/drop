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

const FEATHERLESS_API_URL = "https://api.featherless.ai/v1/chat/completions";
const DEFAULT_MODEL =
  process.env.FEATHERLESS_MODEL || "Qwen/Qwen2.5-7B-Instruct";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/** Extract valid host lines from raw model output. */
export function extractValidLines(script: string, hostA = "ALEX", hostB?: string): string[] {
  const pattern = hostB
    ? new RegExp(`^(${hostA}|${hostB}):\\s.+`, "i")
    : new RegExp(`^${hostA}:\\s.+`, "i");
  return script
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => pattern.test(line));
}

export function validatePodcastScript(script: string, length: ScriptLength = "short", hostA = "ALEX", hostB = "SAM", customMinutes?: number, monologue = false) {
  const lines = monologue
    ? extractValidLines(script, hostA)
    : extractValidLines(script, hostA, hostB);
  const minLines = Math.max(4, getLengthConfig(length, customMinutes).lines[0] - 4);
  if (lines.length < minLines) return false;

  const patA = new RegExp(`^${hostA}:`, "i");
  if (monologue) return lines.some((l) => patA.test(l));
  const patB = new RegExp(`^${hostB}:`, "i");
  return lines.some((l) => patA.test(l)) && lines.some((l) => patB.test(l));
}

async function callFeatherless(messages: Array<{ role: "system" | "user"; content: string }>, maxTokens: number) {
  if (!process.env.FEATHERLESS_API_KEY) {
    throw new Error("Missing FEATHERLESS_API_KEY in .env.local");
  }

  const response = await fetch(FEATHERLESS_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.FEATHERLESS_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.4,
      max_tokens: maxTokens,
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
    throw new Error(`Featherless error: ${detail}`);
  }

  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Featherless returned an empty script.");
  }

  return stripCodeFences(content).trim();
}

export async function generateScriptFeatherless(content: string, length: ScriptLength = "short", language?: ScriptLanguage, opts?: PromptOptions, customMinutes?: number): Promise<string> {
  const cleanedContent = content.trim().slice(0, 10000);

  if (!cleanedContent) {
    throw new Error("No content was provided to Featherless.");
  }

  const promptOpts: PromptOptions = { ...opts, language: opts?.language ?? language };
  const hosts = promptOpts.hosts ?? DEFAULT_HOSTS;
  const cfg = getLengthConfig(length, customMinutes);
  const systemPrompt = buildSystemPrompt(promptOpts);
  const userPrompt = buildUserPrompt(cleanedContent, length, promptOpts, customMinutes);

  try {
    const firstPass = await callFeatherless([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], cfg.maxTokens);

    if (validatePodcastScript(firstPass, length, hosts.a, hosts.b, customMinutes, !!promptOpts.monologue)) {
      return firstPass;
    }

    const repaired = await callFeatherless([
      { role: "system", content: systemPrompt },
      { role: "user", content: buildRepairPrompt(firstPass, length, promptOpts, customMinutes) },
    ], cfg.maxTokens);

    if (!validatePodcastScript(repaired, length, hosts.a, hosts.b, customMinutes, !!promptOpts.monologue)) {
      throw new Error("Featherless returned invalid script format after retry.");
    }

    return repaired;
  } catch (error) {
    throw new Error(`Script generation failed: ${errorMessage(error)}`);
  }
}
