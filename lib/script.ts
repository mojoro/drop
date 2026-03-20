export type ScriptLine = {
  speaker: string;
  text: string;
};

export function parseScript(script: string, hostNames?: { a: string; b: string }): ScriptLine[] {
  const a = hostNames?.a || "ALEX";
  const b = hostNames?.b || "SAM";
  const pattern = new RegExp(`^(${escapeRegex(a)}|${escapeRegex(b)}):\\s*(.+)$`, "i");

  const lines = script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(pattern);
      if (!match) return null;
      return {
        speaker: match[1].toUpperCase(),
        text: match[2].trim(),
      };
    })
    .filter((line): line is ScriptLine => line !== null);

  if (lines.length === 0) {
    throw new Error(`No valid ${a}:/${b}: lines found in model output.`);
  }

  return lines;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
