export type ScriptLength = "short" | "medium" | "long";

const LENGTH_CONFIG = {
  short:  { lines: [10, 16],  chars: [1200, 2200],  duration: "60 seconds",  maxTokens: 1200 },
  medium: { lines: [16, 28],  chars: [2200, 4500],  duration: "3 minutes",   maxTokens: 2400 },
  long:   { lines: [28, 60],  chars: [4500, 10000], duration: "7 minutes",   maxTokens: 6000 },
};

export function getLengthConfig(length: ScriptLength) {
  return LENGTH_CONFIG[length] || LENGTH_CONFIG.medium;
}

export function buildSystemPrompt(): string {
  return [
    "You are a podcast script writer.",
    "Write a punchy, 2-host dialogue.",
    'Return ONLY lines in this exact format: "ALEX: ..." or "SAM: ...".',
    "No intro, no title, no bullets, no stage directions, no markdown.",
    "Keep it concise and natural.",
  ].join(" ");
}

export function buildUserPrompt(content: string, length: ScriptLength = "short"): string {
  const cfg = getLengthConfig(length);
  return `
Write a sharp podcast dialogue based on the source below.

Rules:
- Two hosts only: Alex and Sam
- Alex is curious, conversational, and asks sharp questions
- Sam is direct, insightful, and gives no-fluff answers
- ${cfg.lines[0]} to ${cfg.lines[1]} total lines
- Every line must start with ALEX: or SAM:
- End with a memorable one-line takeaway from Sam
- Target roughly ${cfg.duration} spoken duration
- Keep the total spoken text between ${cfg.chars[0]} and ${cfg.chars[1]} characters

Source:
${content.trim().slice(0, 10000)}
`.trim();
}

export function buildRepairPrompt(firstPass: string, length: ScriptLength = "short"): string {
  const cfg = getLengthConfig(length);
  return `
Rewrite the text below into the required strict format.

Rules:
- Every non-empty line must start with ALEX: or SAM:
- Keep the meaning
- No extra commentary
- ${cfg.lines[0]} to ${cfg.lines[1]} total lines
- End with a memorable SAM line

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
