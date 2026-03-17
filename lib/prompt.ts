export function buildSystemPrompt(): string {
  return [
    "You are a podcast script writer.",
    "Write a short, punchy, 2-host dialogue.",
    'Return ONLY lines in this exact format: "ALEX: ..." or "SAM: ...".',
    "No intro, no title, no bullets, no stage directions, no markdown.",
    "Keep it concise and natural.",
  ].join(" ");
}

export function buildUserPrompt(content: string): string {
  return `
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
${content.trim().slice(0, 10000)}
`.trim();
}

export function buildRepairPrompt(firstPass: string): string {
  return `
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
}

export function stripCodeFences(text: string): string {
  return text.replace(/```[\s\S]*?```/g, (block) => {
    return block
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/```$/, "")
      .trim();
  });
}
