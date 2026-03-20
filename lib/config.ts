import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

export type AppDefaults = {
  hostA: string;
  hostB: string;
  language: string;
  scriptLength: "short" | "medium" | "long" | "custom" | "unlimited";
  customMinutes: number;
  llmBackend: "auto" | "ollama" | "openrouter" | "featherless" | "claude";
  llmOrder: ("ollama" | "openrouter" | "featherless" | "claude")[];
  ttsBackend: "local" | "elevenlabs" | "openai" | "qwen";
  monologue: boolean;
  customSystemPrompt: string;
  customUserPrompt: string;
};

const FALLBACK: AppDefaults = {
  hostA: "ALEX",
  hostB: "SAM",
  language: "English",
  scriptLength: "short",
  customMinutes: 5,
  llmBackend: "auto",
  llmOrder: ["ollama", "openrouter", "featherless", "claude"],
  ttsBackend: "local",
  monologue: false,
  customSystemPrompt: "",
  customUserPrompt: "",
};

let cached: AppDefaults | null = null;

/** Load drop.config.json from the project root. Falls back to hardcoded defaults if absent or invalid. */
export async function loadConfig(): Promise<AppDefaults> {
  if (cached) return cached;

  const configPath = join(process.cwd(), "drop.config.json");
  if (!existsSync(configPath)) {
    cached = FALLBACK;
    return cached;
  }

  try {
    const raw = await readFile(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    cached = { ...FALLBACK, ...(parsed.defaults ?? {}) };
  } catch {
    cached = FALLBACK;
  }

  return cached;
}
