import { buildSystemPrompt, buildUserPrompt, getLengthConfig, getContentSlice, DEFAULT_HOSTS, type ScriptLength, type ScriptLanguage, type PromptOptions } from "@/lib/prompt";

export async function generateScriptClaude(content: string, length: ScriptLength = "1m", language?: ScriptLanguage, opts?: PromptOptions, customMinutes?: number): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY in .env.local");
  }

  const promptOpts: PromptOptions = { ...opts, language: opts?.language ?? language };
  const hosts = promptOpts.hosts ?? DEFAULT_HOSTS;
  const cfg = getLengthConfig(length, customMinutes);

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: cfg.maxTokens,
      system: buildSystemPrompt(promptOpts),
      messages: [{ role: "user", content: buildUserPrompt(getContentSlice(content, length, customMinutes), length, promptOpts, customMinutes) }],
    }),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = data?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`Anthropic error: ${detail}`);
  }

  const script: string = data?.content?.[0]?.text ?? "";

  if (!script.includes(`${hosts.a}:`) || !script.includes(`${hosts.b}:`)) {
    throw new Error("Claude returned invalid script format.");
  }

  return script.trim();
}
