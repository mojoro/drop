import {
  buildSystemPrompt,
  buildUserPrompt,
  buildRepairPrompt,
  stripCodeFences,
  type ScriptLength,
} from "@/lib/prompt";
import { validatePodcastScript } from "@/lib/featherless";

const DEFAULT_OLLAMA_URL = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5:7b";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

async function callOllama(
  messages: Array<{ role: "system" | "user"; content: string }>,
) {
  const baseUrl = process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL;
  const model = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;

  // No max_tokens limit for local — let the model generate freely
  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages,
    }),
    signal: AbortSignal.timeout(300_000),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      data?.error?.message ||
      data?.message ||
      JSON.stringify(data) ||
      `HTTP ${response.status}`;
    throw new Error(`Ollama error: ${detail}`);
  }

  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Ollama returned an empty script.");
  }

  return stripCodeFences(content).trim();
}

export async function generateScriptOllama(content: string, length: ScriptLength = "short"): Promise<string> {
  const cleanedContent = content.trim().slice(0, 10000);

  if (!cleanedContent) {
    throw new Error("No content was provided to Ollama.");
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(cleanedContent, length);

  try {
    const firstPass = await callOllama([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    if (validatePodcastScript(firstPass, length)) {
      return firstPass;
    }

    const repaired = await callOllama([
      { role: "system", content: systemPrompt },
      { role: "user", content: buildRepairPrompt(firstPass, length) },
    ]);

    if (!validatePodcastScript(repaired, length)) {
      throw new Error("Ollama returned invalid script format after retry.");
    }

    return repaired;
  } catch (error) {
    throw new Error(`Ollama script generation failed: ${errorMessage(error)}`);
  }
}
