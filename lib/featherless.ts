import {
  buildSystemPrompt,
  buildUserPrompt,
  buildRepairPrompt,
  stripCodeFences,
  getLengthConfig,
  type ScriptLength,
} from "@/lib/prompt";

const FEATHERLESS_API_URL = "https://api.featherless.ai/v1/chat/completions";
const DEFAULT_MODEL =
  process.env.FEATHERLESS_MODEL || "Qwen/Qwen2.5-7B-Instruct";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/** Extract valid ALEX:/SAM: lines from raw model output. */
export function extractValidLines(script: string): string[] {
  return script
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^(ALEX|SAM):\s.+/i.test(line));
}

export function validatePodcastScript(script: string, length: ScriptLength = "short") {
  const lines = extractValidLines(script);
  const minLines = Math.max(4, getLengthConfig(length).lines[0] - 4);
  if (lines.length < minLines) return false;

  const hasAlex = lines.some((line) => /^ALEX:/i.test(line));
  const hasSam = lines.some((line) => /^SAM:/i.test(line));

  return hasAlex && hasSam;
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

export async function generateScriptFeatherless(content: string, length: ScriptLength = "short"): Promise<string> {
  const cleanedContent = content.trim().slice(0, 10000);

  if (!cleanedContent) {
    throw new Error("No content was provided to Featherless.");
  }

  const cfg = getLengthConfig(length);
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(cleanedContent, length);

  try {
    const firstPass = await callFeatherless([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ], cfg.maxTokens);

    if (validatePodcastScript(firstPass, length)) {
      return firstPass;
    }

    const repaired = await callFeatherless([
      { role: "system", content: systemPrompt },
      { role: "user", content: buildRepairPrompt(firstPass, length) },
    ], cfg.maxTokens);

    if (!validatePodcastScript(repaired, length)) {
      throw new Error("Featherless returned invalid script format after retry.");
    }

    return repaired;
  } catch (error) {
    throw new Error(`Script generation failed: ${errorMessage(error)}`);
  }
}
