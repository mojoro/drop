import test from "node:test";
import assert from "node:assert/strict";
import { validatePodcastScript } from "../lib/featherless";

test("validatePodcastScript accepts long valid script", () => {
  const lines: string[] = [];
  for (let i = 0; i < 14; i += 1) {
    if (i % 2 === 0) {
      lines.push(`ALEX: Question line ${i} about trends and impact?`);
    } else {
      lines.push(`SAM: Answer line ${i} with direct insight and useful context.`);
    }
  }

  const script = lines.join("\n");
  assert.equal(validatePodcastScript(script), true);
});

test("validatePodcastScript rejects too-short script", () => {
  const script = [
    "ALEX: One question?",
    "SAM: One answer.",
    "ALEX: Another question?",
    "SAM: Another answer.",
    "ALEX: Another?",
    "SAM: Another.",
  ].join("\n");

  assert.equal(validatePodcastScript(script), false);
});

test("validatePodcastScript rejects missing speaker prefixes", () => {
  const script = [
    "ALEX: Good start",
    "SAM: Good response",
    "Narrator: not allowed",
    "SAM: Continue",
    "ALEX: Continue",
    "SAM: Continue",
    "ALEX: Continue",
    "SAM: Continue",
    "ALEX: Continue",
    "SAM: Continue",
    "ALEX: Continue",
    "SAM: Continue",
    "ALEX: Continue",
    "SAM: End",
  ].join("\n");

  assert.equal(validatePodcastScript(script), false);
});
