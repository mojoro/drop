export type ScriptLine = {
  speaker: "ALEX" | "SAM";
  text: string;
};

export function parseScript(script: string): ScriptLine[] {
  return script
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(ALEX|SAM):\s*(.+)$/i);

      if (!match) {
        throw new Error("Invalid script line format returned by model.");
      }

      return {
        speaker: match[1].toUpperCase() as "ALEX" | "SAM",
        text: match[2].trim(),
      };
    });
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
