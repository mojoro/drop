const FEATHERLESS_API_URL = "https://api.featherless.ai/v1/chat/completions";
const DEFAULT_MODEL =
  process.env.FEATHERLESS_MODEL || "Qwen/Qwen2.5-7B-Instruct";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function stripCodeFences(text: string) {
  return text.replace(/```[\s\S]*?```/g, (block) => {
    return block
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/```$/, "")
      .trim();
  });
}

export function validatePodcastScript(script: string) {
  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 12) return false;

  const everyLineValid = lines.every((line) => /^(ALEX|SAM):\s.+/.test(line));
  if (!everyLineValid) return false;

  const hasAlex = lines.some((line) => line.startsWith("ALEX:"));
  const hasSam = lines.some((line) => line.startsWith("SAM:"));

  return hasAlex && hasSam;
}

async function callFeatherless(messages: Array<{ role: "system" | "user"; content: string }>) {
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
      max_tokens: 1200,
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

export async function generateScriptFeatherless(content: string): Promise<string> {
  const cleanedContent = content.trim().slice(0, 10000);

  if (!cleanedContent) {
    throw new Error("No content was provided to Featherless.");
  }

  const systemPrompt = [
    "You are a podcast script writer.",
    "Write a short, punchy, 2-host dialogue.",
    'Return ONLY lines in this exact format: "ALEX: ..." or "SAM: ...".',
    "No intro, no title, no bullets, no stage directions, no markdown.",
    "Keep it concise and natural.",
  ].join(" ");

  const userPrompt = `
Write a sharp podcast dialogue based on the source below.

Rules:
- Two hosts only: Alex and Sam
- Alex is curious, conversational, and asks sharp questions
- Sam is direct, insightful, and gives no-fluff answers
- 14 to 18 total lines
- Every line must start with ALEX: or SAM:
- End with a memorable one-line takeaway from Sam
- Target roughly 90 seconds spoken duration
- Keep the total spoken text between 1600 and 2600 characters

Source:
${cleanedContent}
`.trim();

  try {
    const firstPass = await callFeatherless([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

    if (validatePodcastScript(firstPass)) {
      return firstPass;
    }

    const repairPrompt = `
Rewrite the text below into the required strict format.

Rules:
- Every non-empty line must start with ALEX: or SAM:
- Keep the meaning
- No extra commentary
- 14 to 18 total lines
- End with a memorable SAM line

Text:
${firstPass}
`.trim();

    const repaired = await callFeatherless([
      { role: "system", content: systemPrompt },
      { role: "user", content: repairPrompt },
    ]);

    if (!validatePodcastScript(repaired)) {
      throw new Error("Featherless returned invalid script format after retry.");
    }

    return repaired;
  } catch (error) {
    throw new Error(`Script generation failed: ${errorMessage(error)}`);
  }
}