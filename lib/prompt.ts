export type ScriptLength = "short" | "medium" | "long" | "custom";
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

const LENGTH_PRESETS = {
  short:  { lines: [10, 16],  chars: [1200, 2200],  duration: "60 seconds",  maxTokens: 1200 },
  medium: { lines: [16, 28],  chars: [2200, 4500],  duration: "3 minutes",   maxTokens: 2400 },
  long:   { lines: [28, 60],  chars: [4500, 10000], duration: "7 minutes",   maxTokens: 6000 },
};

/** Interpolate length config from a target duration in minutes. */
export function getLengthConfig(length: ScriptLength, customMinutes?: number) {
  if (length === "custom" && customMinutes && customMinutes > 0) {
    const min = Math.max(0.5, Math.min(customMinutes, 30));
    const lines: [number, number] = [Math.round(min * 8), Math.round(min * 10)];
    const chars: [number, number] = [Math.round(min * 1100), Math.round(min * 1500)];
    const maxTokens = Math.round(min * 900);
    return { lines, chars, duration: `${min} minutes`, maxTokens };
  }
  return LENGTH_PRESETS[length as keyof typeof LENGTH_PRESETS] || LENGTH_PRESETS.medium;
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
      `Keep it engaging and natural.${langInstruction}`,
    ].join(" ");
  }
  return [
    "You are a podcast script writer.",
    "Write a punchy, 2-host dialogue.",
    `Return ONLY lines in this exact format: "${hosts.a}: ..." or "${hosts.b}: ...".`,
    "No intro, no title, no bullets, no stage directions, no markdown.",
    `Keep it concise and natural.${langInstruction}`,
  ].join(" ");
}

export function buildUserPrompt(content: string, length: ScriptLength = "short", opts: PromptOptions = {}, customMinutes?: number): string {
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
    return `
Write an engaging solo podcast narration based on the source below.

Rules:
- Single narrator: ${hosts.a} only
- ${hosts.a} is an engaging, insightful storyteller who speaks directly to the listener
- ${cfg.lines[0]} to ${cfg.lines[1]} total lines
- Every line must start with ${hosts.a}:
- End with a memorable takeaway
- Target roughly ${cfg.duration} spoken duration
- Keep the total spoken text between ${cfg.chars[0]} and ${cfg.chars[1]} characters${langRule}

Source:
${content.trim().slice(0, 10000)}
`.trim();
  }
  const langRule = language && language !== "English"
    ? `\n- Write ALL dialogue lines in ${language} (keep ${hosts.a}: and ${hosts.b}: prefixes in English)`
    : "";
  return `
Write a sharp podcast dialogue based on the source below.

Rules:
- Two hosts only: ${hosts.a} and ${hosts.b}
- ${hosts.a} is curious, conversational, and asks sharp questions
- ${hosts.b} is direct, insightful, and gives no-fluff answers
- ${cfg.lines[0]} to ${cfg.lines[1]} total lines
- Every line must start with ${hosts.a}: or ${hosts.b}:
- End with a memorable one-line takeaway from ${hosts.b}
- Target roughly ${cfg.duration} spoken duration
- Keep the total spoken text between ${cfg.chars[0]} and ${cfg.chars[1]} characters${langRule}

Source:
${content.trim().slice(0, 10000)}
`.trim();
}

export function buildRepairPrompt(firstPass: string, length: ScriptLength = "short", opts: PromptOptions = {}, customMinutes?: number): string {
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
