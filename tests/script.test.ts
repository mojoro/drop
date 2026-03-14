import test from "node:test";
import assert from "node:assert/strict";
import { getScriptStats, parseScript } from "../lib/script";

test("parseScript parses valid ALEX/SAM lines", () => {
  const script = [
    "ALEX: What changed in AI this year?",
    "SAM: Models got faster and cheaper.",
    "ALEX: What does that mean for teams?",
    "SAM: They can ship prototypes in days.",
  ].join("\n");

  const lines = parseScript(script);

  assert.equal(lines.length, 4);
  assert.deepEqual(lines[0], {
    speaker: "ALEX",
    text: "What changed in AI this year?",
  });
  assert.deepEqual(lines[1], {
    speaker: "SAM",
    text: "Models got faster and cheaper.",
  });
});

test("parseScript throws on invalid line format", () => {
  const badScript = "HOST: hello";

  assert.throws(() => parseScript(badScript), /Invalid script line format/);
});

test("getScriptStats returns words, chars, and estimated duration", () => {
  const lines = parseScript(
    [
      "ALEX: This is a short line for testing.",
      "SAM: This is another short line with extra words.",
    ].join("\n")
  );

  const stats = getScriptStats(lines);

  assert.equal(stats.lineCount, 2);
  assert.ok(stats.wordCount > 0);
  assert.ok(stats.charCount > 0);
  assert.ok(stats.estimatedDurationSec > 0);
});
