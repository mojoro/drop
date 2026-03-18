import { NextResponse } from "next/server";
import { extractContent } from "@/lib/scrape";
import { generateScriptOpenRouter } from "@/lib/openrouter";
import { generateScriptFeatherless } from "@/lib/featherless";
import { generateScriptClaude } from "@/lib/claude";
import { generateScriptOllama } from "@/lib/ollama";
import { parseScript, getScriptStats } from "@/lib/script";
import { synthesizeLine, getDefaultVoices, type TtsBackend, type TtsConfig } from "@/lib/tts-router";
import { stitchWav } from "@/lib/wavStitching";
import { getProfile, type SettingsProfile } from "@/lib/storage";
import type { ScriptLength, ScriptLanguage } from "@/lib/prompt";

export const runtime = "nodejs";

type ScriptBackend = "ollama" | "openrouter" | "featherless" | "claude";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/** Resolve a config value: profile → env var → fallback. */
function cfg(profileVal: string | undefined, envKey: string, fallback = ""): string {
  return profileVal || process.env[envKey] || fallback;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = typeof body?.input === "string" ? body.input.trim() : "";

    if (!input) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const length: ScriptLength = ["short", "medium", "long"].includes(body?.length) ? body.length : "short";
    const language: ScriptLanguage | undefined = typeof body?.language === "string" && body.language ? body.language : undefined;

    // Load active profile from server (keys never come from the client)
    let profile: SettingsProfile | null = null;
    if (typeof body?.profile === "string" && body.profile) {
      profile = await getProfile(body.profile);
    }

    // Resolve TTS backend and config
    const ttsBackend: TtsBackend = (["local", "elevenlabs", "openai"].includes(body?.ttsBackend) ? body.ttsBackend
      : profile?.ttsBackend && ["local", "elevenlabs", "openai"].includes(profile.ttsBackend) ? profile.ttsBackend
      : "local") as TtsBackend;

    const ttsConfig: TtsConfig = {
      backend: ttsBackend,
      elevenlabsKey: cfg(profile?.elevenlabsKey, "ELEVENLABS_API_KEY"),
      openaiKey: cfg(profile?.openaiKey, "OPENAI_API_KEY"),
    };

    const defaults = getDefaultVoices(ttsBackend);
    const alexVoice = typeof body?.alexVoice === "string" ? body.alexVoice : defaults.alex;
    const samVoice  = typeof body?.samVoice  === "string" ? body.samVoice  : defaults.sam;

    // LLM config
    const ollamaModel = cfg(profile?.ollamaModel, "OLLAMA_MODEL");
    const ollamaUrl   = cfg(profile?.ollamaUrl, "OLLAMA_URL", "http://localhost:11434");
    const orKey       = cfg(profile?.openrouterKey, "OPENROUTER_API_KEY");
    const orModel     = profile?.openrouterModel || "";
    const flKey       = cfg(profile?.featherlessKey, "FEATHERLESS_API_KEY");
    const aKey        = cfg(profile?.anthropicKey, "ANTHROPIC_API_KEY");
    const needleKey   = cfg(profile?.needleKey, "NEEDLE_API_KEY");

    // Temporarily set env vars so downstream modules can read them
    const envOverrides: Record<string, string | undefined> = {};
    function setEnv(key: string, val: string) {
      if (val) {
        envOverrides[key] = process.env[key];
        process.env[key] = val;
      }
    }
    setEnv("OLLAMA_URL", ollamaUrl);
    setEnv("OLLAMA_MODEL", ollamaModel);
    setEnv("FEATHERLESS_API_KEY", flKey);
    setEnv("ANTHROPIC_API_KEY", aKey);
    setEnv("NEEDLE_API_KEY", needleKey);

    const llmChoice = typeof body?.llmBackend === "string" ? body.llmBackend : "auto";

    try {
      const extracted = await extractContent(input);

      // ── Script generation ─────────────────────────────────────────────────
      let script: string | undefined;
      let scriptBackend: ScriptBackend = "claude";

      // Helper to try a specific backend
      async function tryOllama() {
        if (!ollamaModel) throw new Error("Ollama model not configured");
        script = await generateScriptOllama(extracted, length, language);
        scriptBackend = "ollama";
      }
      async function tryOpenRouter() {
        if (!orKey) throw new Error("OpenRouter API key not configured");
        script = await generateScriptOpenRouter(extracted, orKey, orModel, length, language);
        scriptBackend = "openrouter";
      }
      async function tryFeatherless() {
        if (!flKey) throw new Error("Featherless API key not configured");
        script = await generateScriptFeatherless(extracted, length, language);
        scriptBackend = "featherless";
      }
      async function tryClaude() {
        if (!aKey) throw new Error("Anthropic API key not configured");
        script = await generateScriptClaude(extracted, length, language);
        scriptBackend = "claude";
      }

      if (llmChoice !== "auto") {
        // User explicitly chose a backend — use it directly, no fallback
        const backendMap: Record<string, () => Promise<void>> = { ollama: tryOllama, openrouter: tryOpenRouter, featherless: tryFeatherless, claude: tryClaude };
        const fn = backendMap[llmChoice];
        if (fn) await fn();
        else throw new Error(`Unknown LLM backend: ${llmChoice}`);
      } else {
        // Auto: cascade Ollama → OpenRouter → Featherless → Claude
        const cascade = [
          { fn: tryOllama, available: !!ollamaModel, name: "Ollama" },
          { fn: tryOpenRouter, available: !!orKey, name: "OpenRouter" },
          { fn: tryFeatherless, available: !!flKey, name: "Featherless" },
          { fn: tryClaude, available: !!aKey, name: "Claude" },
        ];

        for (const backend of cascade) {
          if (!backend.available || script !== undefined) continue;
          try { await backend.fn(); } catch (e) {
            console.warn(`${backend.name} failed, falling back:`, e);
          }
        }

        if (script === undefined) {
          throw new Error(
            "No LLM backend available. Configure Ollama, OpenRouter, Featherless, or Anthropic in settings."
          );
        }
      }

      const scriptLines = parseScript(script!);
      const stats = getScriptStats(scriptLines);

      // ── TTS: generate per line, stitch into one WAV ──────────────────────
      const buffers: ArrayBuffer[] = [];
      for (const line of scriptLines) {
        const voice = line.speaker === "ALEX" ? alexVoice : samVoice;
        const buf = await synthesizeLine(line.text, voice, ttsConfig);
        buffers.push(buf);
      }

      const stitched = stitchWav(buffers);
      const audio = Buffer.from(stitched).toString("base64");

      return NextResponse.json({
        scriptLines,
        audio,
        scriptBackend,
        ttsBackend,
        debug: {
          extractedPreview: extracted.slice(0, 2500),
          rawScript: script,
          ...stats,
        },
      });
    } finally {
      for (const [key, val] of Object.entries(envOverrides)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
      }
    }
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}
