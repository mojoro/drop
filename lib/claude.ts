import { buildSystemPrompt, buildUserPrompt, getLengthConfig, type ScriptLength } from "@/lib/prompt";

export async function generateScriptClaude(content: string, length: ScriptLength = "short"): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY in .env.local");
  }

  const cfg = getLengthConfig(length);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: cfg.maxTokens,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserPrompt(content, length) }],
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = data?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Anthropic error: ${detail}`);
  }

  const script: string = data?.content?.[0]?.text ?? "";

  if (!script.includes("ALEX:") || !script.includes("SAM:")) {
    throw new Error("Claude returned invalid script format.");
  }

  return script.trim();
}
