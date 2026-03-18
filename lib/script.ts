export type ScriptLine = {
  speaker: "ALEX" | "SAM";
  text: string;
};

export function parseScript(script: string): ScriptLine[] {
  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(ALEX|SAM):\s*(.+)$/i);
      if (!match) return null;
      return {
        speaker: match[1].toUpperCase() as "ALEX" | "SAM",
        text: match[2].trim(),
      };
    })
    .filter((line): line is ScriptLine => line !== null);

  if (lines.length === 0) {
    throw new Error("No valid ALEX:/SAM: lines found in model output.");
  }

  return lines;
}

export function getScriptStats(scriptLines: ScriptLine[]) {
  const text = scriptLines.map((line) => line.text).join(" ");
  const charCount = text.length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const estimatedDurationSec = Math.round((wordCount / 150) * 60);

  return {
    charCount,
    wordCount,
    estimatedDurationSec,
    lineCount: scriptLines.length,
  };
}
