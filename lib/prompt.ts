export type ScriptLength = "1m" | "3m" | "7m" | "custom" | "unlimited";
export type ScriptLanguage = string; // e.g. "English", "German", "Japanese"

export type HostNames = { a: string; b: string };
export const DEFAULT_HOSTS: HostNames = { a: "ALEX", b: "SAM" };

export type PromptOptions = {
  language?: ScriptLanguage;
  hosts?: HostNames;
  customSystemPrompt?: string;
  customUserPrompt?: string;
  monologue?: boolean;
};

const PRESET_MINUTES: Record<string, number> = { "1m": 1, "3m": 3, "7m": 7 };

/** Interpolate length config from a target duration in minutes. */
export function getLengthConfig(length: ScriptLength, customMinutes?: number) {
  if (length === "unlimited") {
    return { lines: [60, 999] as [number, number], chars: [48000, 999000] as [number, number], duration: "unlimited", maxTokens: 128000 };
  }
  const min = PRESET_MINUTES[length] ?? (customMinutes && customMinutes > 0 ? customMinutes : 5);
  const lines: [number, number] = [Math.round(min * 6), Math.round(min * 8)];
  const chars: [number, number] = [Math.round(min * 800), Math.round(min * 1200)];
  const maxTokens = Math.min(Math.round(min * 800), 128000);
  return { lines, chars, duration: `${min} minute${min === 1 ? "" : "s"}`, maxTokens };
}

/** How many source chars to feed the model for a given length. */
export function getContentSlice(content: string, length: ScriptLength, customMinutes?: number): string {
  const min = PRESET_MINUTES[length] ?? (customMinutes && customMinutes > 0 ? customMinutes : 5);
  const maxChars = Math.min(Math.round(min * 3000), 80000);
  return content.trim().slice(0, maxChars);
}

export function buildSystemPrompt(opts: PromptOptions = {}): string {
  const { language, hosts = DEFAULT_HOSTS, customSystemPrompt, monologue } = opts;
  if (customSystemPrompt) {
    return customSystemPrompt
      .replace(/\{\{HOST_A\}\}/g, hosts.a)
      .replace(/\{\{HOST_B\}\}/g, hosts.b)
      .replace(/\{\{LANGUAGE\}\}/g, language || "English");
  }
  const langInstruction = language && language !== "English"
    ? ` Write ALL content in ${language}.`
    : "";
  if (monologue) {
    return [
      "You are a podcast narrator.",
      "Write a compelling single-speaker narration.",
      `Return ONLY lines in this exact format: "${hosts.a}: ...".`,
      "No intro, no title, no bullets, no stage directions, no markdown.",
      `Write the full requested length — do not stop early.${langInstruction}`,
    ].join(" ");
  }
  return [
    "You are a podcast script writer.",
    "Write a 2-host dialogue.",
    `Return ONLY lines in this exact format: "${hosts.a}: ..." or "${hosts.b}: ...".`,
    "No intro, no title, no bullets, no stage directions, no markdown.",
    `Write the full requested length — do not stop early.${langInstruction}`,
  ].join(" ");
}

export function buildUserPrompt(content: string, length: ScriptLength = "1m", opts: PromptOptions = {}, customMinutes?: number): string {
  const { language, hosts = DEFAULT_HOSTS, customUserPrompt, monologue } = opts;
  const cfg = getLengthConfig(length, customMinutes);
  if (customUserPrompt) {
    return customUserPrompt
      .replace(/\{\{SOURCE\}\}/g, content.trim().slice(0, 10000))
      .replace(/\{\{HOST_A\}\}/g, hosts.a)
      .replace(/\{\{HOST_B\}\}/g, hosts.b)
      .replace(/\{\{LANGUAGE\}\}/g, language || "English")
      .replace(/\{\{LINES_MIN\}\}/g, String(cfg.lines[0]))
      .replace(/\{\{LINES_MAX\}\}/g, String(cfg.lines[1]))
      .replace(/\{\{DURATION\}\}/g, cfg.duration)
      .replace(/\{\{CHARS_MIN\}\}/g, String(cfg.chars[0]))
      .replace(/\{\{CHARS_MAX\}\}/g, String(cfg.chars[1]));
  }
  if (monologue) {
    const langRule = language && language !== "English"
      ? `\n- Write ALL narration in ${language} (keep ${hosts.a}: prefix in English)`
      : "";
    const lengthRule = `- WRITE EXACTLY ${cfg.lines[0]}–${cfg.lines[1]} LINES — fill the full ${cfg.duration}, do not stop early`;
    return `
Write an engaging solo podcast narration based on the source below.

Rules:
${lengthRule}
- Single narrator: ${hosts.a} only
- ${hosts.a} is an engaging, insightful storyteller who speaks directly to the listener
- Every line must start with ${hosts.a}:
- End with a memorable takeaway${langRule}

Source:
${content}
`.trim();
  }
  const langRule = language && language !== "English"
    ? `\n- Write ALL dialogue lines in ${language} (keep ${hosts.a}: and ${hosts.b}: prefixes in English)`
    : "";
  const lengthRule = `- WRITE EXACTLY ${cfg.lines[0]}–${cfg.lines[1]} LINES — fill the full ${cfg.duration}, do not stop early`;
  return `
Write a podcast dialogue based on the source below.

Rules:
${lengthRule}
- Two hosts only: ${hosts.a} and ${hosts.b}
- ${hosts.a} is curious, conversational, and asks sharp questions
- ${hosts.b} is direct, insightful, and gives no-fluff answers
- Every line must start with ${hosts.a}: or ${hosts.b}:
- End with a memorable one-line takeaway from ${hosts.b}${langRule}

Source:
${content}
`.trim();
}

export function buildRepairPrompt(firstPass: string, length: ScriptLength = "1m", opts: PromptOptions = {}, customMinutes?: number): string {
  const { language, hosts = DEFAULT_HOSTS, monologue } = opts;
  const cfg = getLengthConfig(length, customMinutes);
  if (monologue) {
    const langRule = language && language !== "English"
      ? `\n- Keep narration in ${language} (${hosts.a}: prefix stays in English)`
      : "";
    return `
Rewrite the text below into the required strict format.

Rules:
- Every non-empty line must start with ${hosts.a}:
- Keep the meaning
- No extra commentary
- ${cfg.lines[0]} to ${cfg.lines[1]} total lines${langRule}

Text:
${firstPass}
`.trim();
  }
  const langRule = language && language !== "English"
    ? `\n- Keep dialogue in ${language} (${hosts.a}: and ${hosts.b}: prefixes stay in English)`
    : "";
  return `
Rewrite the text below into the required strict format.

Rules:
- Every non-empty line must start with ${hosts.a}: or ${hosts.b}:
- Keep the meaning
- No extra commentary
- ${cfg.lines[0]} to ${cfg.lines[1]} total lines
- End with a memorable ${hosts.b} line${langRule}

Text:
${firstPass}
`.trim();
}

export function stripCodeFences(text: string): string {
  // Remove <think>...</think> blocks (Qwen, DeepSeek thinking mode)
  let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  // Remove markdown code fences
  cleaned = cleaned.replace(/```[\s\S]*?```/g, (block) => {
    return block
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/```$/, "")
      .trim();
  });
  return cleaned;
}
