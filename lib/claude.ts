const SYSTEM_PROMPT = [
  "You are a podcast script writer.",
  "Write a short, punchy, 2-host dialogue.",
  'Return ONLY lines in this exact format: "ALEX: ..." or "SAM: ...".',
  "No intro, no title, no bullets, no stage directions, no markdown.",
  "Keep it concise and natural.",
].join(" ");

const USER_PROMPT = (content: string) => `
Write a sharp podcast dialogue based on the source below.

Rules:
- Two hosts only: Alex and Sam
- Alex is curious, conversational, and asks sharp questions
- Sam is direct, insightful, and gives no-fluff answers
- 14 to 18 total lines
- Every line must start with ALEX: or SAM:
- End with a memorable one-line takeaway from Sam
- Target roughly 90 seconds spoken duration

Source:
${content.trim().slice(0, 10000)}
`.trim();

export async function generateScriptClaude(content: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY in .env.local");
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: USER_PROMPT(content) }],
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
